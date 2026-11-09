import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Minus, Move, Plus, RotateCw, SlidersHorizontal } from 'lucide-react';
import GenoCanvas from './components/GenoCanvas';
import Header from './components/Header';
import PieceDrawer from './components/PieceDrawer';
import PiecePosture from './components/PiecePosture';
import useKeyboardMovement from './hooks/useKeyboardMovement';
import SelectedPiecePanel from './components/SelectedPiecePanel';
import CameraControlsBar from './components/CameraControlsBar';
import RelationsModal from './components/RelationsModal';
import HelpModal from './components/HelpModal';
import ExportModal from './components/ExportModal';
import PatientsModal from './components/PatientsModal';
import {
  INITIAL_PIECES,
  INITIAL_LINKS,
  INITIAL_PASSATO_PIECES,
  INITIAL_PASSATO_LINKS
} from './constants';
import {
  findStackedPiecesRecursive,
  stabilizeAllPieces,
  findFreePositionOnTray
} from './utils/physicsUtils';
import { triggerDownload } from './utils/exportUtils';

const LEGACY_STORAGE_KEY = 'geno3d-session-v2';
const ARCHIVE_STORAGE_KEY = 'geno3d-patients-archive-v3';
const THEME_STORAGE_KEY = 'geno3d-theme';

function loadThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

function createDemoPhasesData() {
  return {
    presente: {
      pieces: stabilizeAllPieces(INITIAL_PIECES),
      links: INITIAL_LINKS
    },
    passato: {
      pieces: stabilizeAllPieces(INITIAL_PASSATO_PIECES),
      links: INITIAL_PASSATO_LINKS
    },
    futuro: {
      pieces: [],
      links: []
    }
  };
}

function createEmptyPhasesData() {
  return {
    presente: { pieces: [], links: [] },
    passato: { pieces: [], links: [] },
    futuro: { pieces: [], links: [] }
  };
}

function sanitizePhasesData(rawPhases) {
  return {
    presente: {
      pieces: stabilizeAllPieces(rawPhases?.presente?.pieces || []),
      links: Array.isArray(rawPhases?.presente?.links) ? rawPhases.presente.links : []
    },
    passato: {
      pieces: stabilizeAllPieces(rawPhases?.passato?.pieces || []),
      links: Array.isArray(rawPhases?.passato?.links) ? rawPhases.passato.links : []
    },
    futuro: {
      pieces: stabilizeAllPieces(rawPhases?.futuro?.pieces || []),
      links: Array.isArray(rawPhases?.futuro?.links) ? rawPhases.futuro.links : []
    }
  };
}

function slugifyFileName(str) {
  return (str || 'paziente')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'paziente';
}

function loadInitialArchive() {
  try {
    const savedArchive = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (savedArchive) {
      const parsed = JSON.parse(savedArchive);
      if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
        const sanitizedRecords = parsed.records.map((rec) => ({
          id: rec.id || `patient-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          patientName: rec.patientName || 'Caso Clinico',
          sessionTitle: rec.sessionTitle || '',
          sessionNotes: rec.sessionNotes || '',
          updatedAt: rec.updatedAt || new Date().toISOString(),
          phasesData: sanitizePhasesData(rec.phasesData)
        }));
        const validActiveId = sanitizedRecords.some((r) => r.id === parsed.activeRecordId)
          ? parsed.activeRecordId
          : sanitizedRecords[0].id;
        return {
          records: sanitizedRecords,
          activeRecordId: validActiveId
        };
      }
    }

    // Migrazione automatica da eventuale sessione precedente v2
    const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacySaved) {
      const parsedLegacy = JSON.parse(legacySaved);
      if (parsedLegacy && parsedLegacy.presente) {
        const migratedId = 'patient-migrated-1';
        return {
          records: [
            {
              id: migratedId,
              patientName: 'Caso Dimostrativo / Sessione Precedente',
              sessionTitle: 'Consultazione Sistemica',
              sessionNotes: '',
              updatedAt: new Date().toISOString(),
              phasesData: sanitizePhasesData(parsedLegacy)
            }
          ],
          activeRecordId: migratedId
        };
      }
    }
  } catch {
    // Fallback al caso predefinito
  }

  const defaultId = 'patient-demo-1';
  return {
    records: [
      {
        id: defaultId,
        patientName: 'Caso Dimostrativo (Marco)',
        sessionTitle: 'I Seduta — Consultazione',
        sessionNotes: 'Esempio precaricato (puoi svuotare il piatto o creare nuovi pazienti)',
        updatedAt: new Date().toISOString(),
        phasesData: createDemoPhasesData()
      }
    ],
    activeRecordId: defaultId
  };
}

export default function App() {
  const [archive, setArchive] = useState(loadInitialArchive);
  const { records, activeRecordId } = archive;

  const activeRecord = records.find((r) => r.id === activeRecordId) || records[0];
  const phasesData = activeRecord.phasesData;

  // Cronologia Undo / Redo per il genogramma attivo
  const [pastHistory, setPastHistory] = useState([]);
  const [futureHistory, setFutureHistory] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [keyboardMoving, setKeyboardMoving] = useState(false);
  const isDraggingRef = useRef(false);
  const preDragSnapshotRef = useRef(null);
  const phasesDataRef = useRef(phasesData);
  phasesDataRef.current = phasesData;

  const [currentPhaseId, setCurrentPhaseId] = useState('presente');
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [cameraView, setCameraView] = useState(null);
  const [showLabels, setShowLabels] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [placementPieceId, setPlacementPieceId] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [themePreference, setThemePreference] = useState(loadThemePreference);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const isDark = themePreference ? themePreference === 'dark' : systemDark;
  const inspectorButtonRef = useRef(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isRelationsModalOpen, setIsRelationsModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPatientsModalOpen, setIsPatientsModalOpen] = useState(false);
  const [exportApi, setExportApi] = useState(null);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemDark(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setThemePreference(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // La scelta resta attiva per questa pagina.
    }
  };

  const handleCanvasSelect = useCallback((id) => {
    setSelectedPieceId(id);
    setPlacementPieceId(null);
    if (!id) setInspectorOpen(false);
  }, []);

  useEffect(() => {
    if (!selectedPieceId) {
      setInspectorOpen(false);
      setPlacementPieceId(null);
    }
  }, [selectedPieceId]);

  const changeComposer = (open) => {
    setComposerOpen(open);
    if (open) {
      setInspectorOpen(false);
      setPlacementPieceId(null);
    }
  };

  const currentPhaseData = phasesData[currentPhaseId] || { pieces: [], links: [] };
  const currentPieces = currentPhaseData.pieces;
  const currentLinks = currentPhaseData.links;

  // Salva al rilascio del pezzo e quando la pagina viene chiusa durante un gesto.
  const archiveRef = useRef(archive);
  archiveRef.current = archive;
  const lastSavedArchive = useRef(null);
  const saveArchive = useCallback(() => {
    const current = archiveRef.current;
    if (lastSavedArchive.current === current) return;
    try {
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(current));
      lastSavedArchive.current = current;
    } catch {
      // Lo spazio di archiviazione locale può essere esaurito.
    }
  }, []);

  useEffect(() => {
    if (!dragActive && !keyboardMoving) saveArchive();
  }, [archive, dragActive, keyboardMoving, saveArchive]);

  useEffect(() => {
    window.addEventListener('pagehide', saveArchive);
    return () => window.removeEventListener('pagehide', saveArchive);
  }, [saveArchive]);

  // Helper per aggiornare phasesData del paziente attivo
  const setPhasesData = useCallback((updaterOrValue) => {
    setArchive((prevArchive) => {
      const targetId = prevArchive.activeRecordId;
      const updatedRecords = prevArchive.records.map((rec) => {
        if (rec.id !== targetId) return rec;
        const nextPhasesData =
          typeof updaterOrValue === 'function'
            ? updaterOrValue(rec.phasesData)
            : updaterOrValue;
        if (nextPhasesData === rec.phasesData) return rec;
        return {
          ...rec,
          updatedAt: new Date().toISOString(),
          phasesData: nextPhasesData
        };
      });
      if (updatedRecords.every((record, index) => record === prevArchive.records[index])) return prevArchive;
      return { ...prevArchive, records: updatedRecords };
    });
  }, []);

  // Registra uno stato nella cronologia Undo
  const pushHistorySnapshot = useCallback((snapshot) => {
    setPastHistory((prev) => [...prev.slice(-29), snapshot]);
    setFutureHistory([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (pastHistory.length === 0 || isDraggingRef.current) return;
    const current = phasesDataRef.current;
    setFutureHistory((history) => [current, ...history.slice(0, 29)]);
    setPhasesData(pastHistory.at(-1));
    setPastHistory((history) => history.slice(0, -1));
  }, [pastHistory, setPhasesData]);

  const handleRedo = useCallback(() => {
    if (futureHistory.length === 0 || isDraggingRef.current) return;
    const current = phasesDataRef.current;
    setPastHistory((history) => [...history.slice(-29), current]);
    setPhasesData(futureHistory[0]);
    setFutureHistory((history) => history.slice(1));
  }, [futureHistory, setPhasesData]);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    preDragSnapshotRef.current = phasesDataRef.current;
    setDragActive(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    setDragActive(false);
  }, []);

  useEffect(() => {
    if (dragActive || !preDragSnapshotRef.current) return;
    if (preDragSnapshotRef.current !== phasesDataRef.current) {
      pushHistorySnapshot(preDragSnapshotRef.current);
    }
    preDragSnapshotRef.current = null;
  }, [dragActive, pushHistorySnapshot]);

  const handleSelectPhase = (phaseId) => {
    if (
      phaseId === 'futuro' &&
      (!phasesData.futuro.pieces || phasesData.futuro.pieces.length === 0) &&
      phasesData.presente.pieces.length > 0
    ) {
      pushHistorySnapshot(phasesDataRef.current);
      setPhasesData((prev) => ({
        ...prev,
        futuro: {
          pieces: JSON.parse(JSON.stringify(prev.presente.pieces)),
          links: JSON.parse(JSON.stringify(prev.presente.links))
        }
      }));
    }
    setCurrentPhaseId(phaseId);
    setSelectedPieceId(null);
  };

  // Aggiorna un pezzo mantenendo l'aderenza fisica e muovendo/stabilizzando i pezzi impilati sopra
  const handleUpdatePiece = useCallback(
    (pieceId, partial, skipHistory = false) => {
      if (!isDraggingRef.current && !skipHistory) {
        pushHistorySnapshot(phasesDataRef.current);
      }

      setPhasesData((prev) => {
        const activePhase = prev[currentPhaseId];
        const currentPiece = activePhase.pieces.find((p) => p.id === pieceId);
        if (!currentPiece) return prev;

        const dx = partial.x !== undefined ? partial.x - currentPiece.x : 0;
        const dz = partial.z !== undefined ? partial.z - currentPiece.z : 0;
        const dy = partial.y !== undefined ? partial.y - (currentPiece.y || 0) : 0;

        const stackedIds = new Set();
        if (dx !== 0 || dz !== 0 || dy !== 0) {
          findStackedPiecesRecursive(pieceId, activePhase.pieces, stackedIds);
        }

        let updatedPieces = activePhase.pieces.map((p) => {
          if (p.id === pieceId) {
            return { ...p, ...partial };
          }
          if (stackedIds.has(p.id)) {
            return {
              ...p,
              x: Math.round((p.x + dx) * 100) / 100,
              y: Math.round(((p.y || 0) + dy) * 100) / 100,
              z: Math.round((p.z + dz) * 100) / 100
            };
          }
          return p;
        });

        // Se è cambiata l'altezza, la forma o l'inclinazione, ristabilizza le quote dei pezzi sovrastanti
        if (
          partial.size !== undefined ||
          partial.shape !== undefined ||
          partial.rotationX !== undefined ||
          partial.rotationZ !== undefined
        ) {
          updatedPieces = stabilizeAllPieces(updatedPieces);
        }

        return {
          ...prev,
          [currentPhaseId]: {
            ...activePhase,
            pieces: updatedPieces
          }
        };
      });
    },
    [currentPhaseId, pushHistorySnapshot, setPhasesData]
  );

  const handleAddPiece = useCallback(
    (newPiece) => {
      pushHistorySnapshot(phasesDataRef.current);
      const id = `piece-${Date.now()}`;

      setPhasesData((prev) => {
        const activePhase = prev[currentPhaseId];
        const freePos = findFreePositionOnTray(
          activePhase.pieces,
          newPiece.shape,
          newPiece.size,
          0,
          0
        );
        const pieceWithId = {
          rotationX: 0,
          rotationZ: 0,
          ...newPiece,
          id,
          x: freePos.x,
          y: 0,
          z: freePos.z
        };
        const pieces = [...activePhase.pieces, pieceWithId];
        return {
          ...prev,
          [currentPhaseId]: {
            ...activePhase,
            pieces: stabilizeAllPieces(pieces)
          }
        };
      });
      setSelectedPieceId(id);
      setAnnouncement(`${newPiece.name} aggiunto al piano. Puoi trascinarlo oppure scegliere Sposta.`);
    },
    [currentPhaseId, pushHistorySnapshot, setPhasesData]
  );

  const handleDuplicatePiece = useCallback(
    (pieceId) => {
      const original = currentPieces.find((p) => p.id === pieceId);
      if (!original) return;

      pushHistorySnapshot(phasesDataRef.current);
      const newId = `piece-${Date.now()}`;

      setPhasesData((prev) => {
        const activePhase = prev[currentPhaseId];
        const freePos = findFreePositionOnTray(
          activePhase.pieces,
          original.shape,
          original.size,
          original.x + 1.2,
          original.z + 1.0
        );
        const duplicated = {
          ...original,
          id: newId,
          name: `${original.name} (Copia)`,
          x: freePos.x,
          y: 0,
          z: freePos.z
        };
        const pieces = [...activePhase.pieces, duplicated];
        return {
          ...prev,
          [currentPhaseId]: {
            ...activePhase,
            pieces: stabilizeAllPieces(pieces)
          }
        };
      });
      setSelectedPieceId(newId);
    },
    [currentPieces, currentPhaseId, pushHistorySnapshot, setPhasesData]
  );

  const handleDeletePiece = useCallback(
    (pieceId) => {
      pushHistorySnapshot(phasesDataRef.current);
      setPhasesData((prev) => {
        const activePhase = prev[currentPhaseId];
        const filteredPieces = activePhase.pieces.filter((p) => p.id !== pieceId);
        const filteredLinks = activePhase.links.filter(
          (l) => l.sourceId !== pieceId && l.targetId !== pieceId
        );
        return {
          ...prev,
          [currentPhaseId]: {
            ...activePhase,
            pieces: stabilizeAllPieces(filteredPieces),
            links: filteredLinks
          }
        };
      });
      if (selectedPieceId === pieceId) {
        setSelectedPieceId(null);
      }
    },
    [currentPhaseId, selectedPieceId, pushHistorySnapshot, setPhasesData]
  );

  const handleAddLink = useCallback(
    (newLink) => {
      pushHistorySnapshot(phasesDataRef.current);
      setPhasesData((prev) => {
        const activePhase = prev[currentPhaseId];
        const existingIndex = activePhase.links.findIndex(
          (l) =>
            (l.sourceId === newLink.sourceId && l.targetId === newLink.targetId) ||
            (l.sourceId === newLink.targetId && l.targetId === newLink.sourceId)
        );

        let updatedLinks;
        if (existingIndex >= 0) {
          updatedLinks = activePhase.links.map((l, idx) =>
            idx === existingIndex ? { ...l, type: newLink.type } : l
          );
        } else {
          updatedLinks = [...activePhase.links, newLink];
        }

        return {
          ...prev,
          [currentPhaseId]: {
            ...activePhase,
            links: updatedLinks
          }
        };
      });
    },
    [currentPhaseId, pushHistorySnapshot, setPhasesData]
  );

  const handleDeleteLink = useCallback(
    (linkId) => {
      pushHistorySnapshot(phasesDataRef.current);
      setPhasesData((prev) => {
        const activePhase = prev[currentPhaseId];
        return {
          ...prev,
          [currentPhaseId]: {
            ...activePhase,
            links: activePhase.links.filter((l) => l.id !== linkId)
          }
        };
      });
    },
    [currentPhaseId, pushHistorySnapshot, setPhasesData]
  );

  // ============================================================================
  // PULIZIA PIATTO (SVUOTA TUTTI I PEZZI) E GESTIONE MULTI-PAZIENTE LOCALE
  // ============================================================================

  const handleClearCurrentPhaseTray = useCallback(
    (askConfirm = false) => {
      if (currentPieces.length === 0 && currentLinks.length === 0) return;
      if (
        askConfirm &&
        !window.confirm(
          `Vuoi svuotare il piatto rimuovendo tutti i ${currentPieces.length} pezzi dalla fase "${currentPhaseId.toUpperCase()}"? (Potrai comunque annullare con Ctrl+Z)`
        )
      ) {
        return;
      }
      pushHistorySnapshot(phasesDataRef.current);
      setPhasesData((prev) => ({
        ...prev,
        [currentPhaseId]: {
          pieces: [],
          links: []
        }
      }));
      setSelectedPieceId(null);
    },
    [currentPieces.length, currentLinks.length, currentPhaseId, pushHistorySnapshot, setPhasesData]
  );

  const handleClearAllPhasesTray = useCallback(() => {
    pushHistorySnapshot(phasesDataRef.current);
    setPhasesData(createEmptyPhasesData());
    setSelectedPieceId(null);
  }, [pushHistorySnapshot, setPhasesData]);

  const handleLoadDemoPreset = useCallback(() => {
    pushHistorySnapshot(phasesDataRef.current);
    setPhasesData(createDemoPhasesData());
    setSelectedPieceId(null);
  }, [pushHistorySnapshot, setPhasesData]);

  const handleSelectRecord = useCallback((recordId) => {
    setArchive((prev) => ({
      ...prev,
      activeRecordId: recordId
    }));
    setPastHistory([]);
    setFutureHistory([]);
    setSelectedPieceId(null);
    setCurrentPhaseId('presente');
  }, []);

  const handleCreateBlankRecord = useCallback(({ patientName, sessionTitle }) => {
    const newId = `patient-${Date.now()}`;
    const newRecord = {
      id: newId,
      patientName: patientName || 'Nuovo Paziente',
      sessionTitle: sessionTitle || `Seduta del ${new Date().toLocaleDateString('it-IT')}`,
      sessionNotes: '',
      updatedAt: new Date().toISOString(),
      phasesData: createEmptyPhasesData()
    };
    setArchive((prev) => ({
      records: [newRecord, ...prev.records],
      activeRecordId: newId
    }));
    setPastHistory([]);
    setFutureHistory([]);
    setSelectedPieceId(null);
    setCurrentPhaseId('presente');
  }, []);

  const handleDuplicateRecord = useCallback((recordId) => {
    setArchive((prev) => {
      const source = prev.records.find((r) => r.id === recordId);
      if (!source) return prev;
      const newId = `patient-${Date.now()}`;
      const duplicated = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        patientName: `${source.patientName} (Copia)`,
        updatedAt: new Date().toISOString()
      };
      return {
        records: [duplicated, ...prev.records],
        activeRecordId: newId
      };
    });
    setPastHistory([]);
    setFutureHistory([]);
    setSelectedPieceId(null);
  }, []);

  const handleDeleteRecord = useCallback((recordId) => {
    setArchive((prev) => {
      if (prev.records.length <= 1) return prev;
      const target = prev.records.find((r) => r.id === recordId);
      if (
        target &&
        !window.confirm(`Vuoi eliminare definitivamente il genogramma "${target.patientName}" dal dispositivo?`)
      ) {
        return prev;
      }
      const remaining = prev.records.filter((r) => r.id !== recordId);
      const nextActiveId =
        prev.activeRecordId === recordId ? remaining[0].id : prev.activeRecordId;
      return {
        records: remaining,
        activeRecordId: nextActiveId
      };
    });
    setSelectedPieceId(null);
  }, []);

  const handleUpdateActiveRecordMeta = useCallback((partialMeta) => {
    setArchive((prev) => ({
      ...prev,
      records: prev.records.map((rec) =>
        rec.id === prev.activeRecordId
          ? { ...rec, ...partialMeta, updatedAt: new Date().toISOString() }
          : rec
      )
    }));
  }, []);

  const handleExportSingleRecord = useCallback(
    (recordId) => {
      const target = records.find((r) => r.id === (recordId || activeRecordId)) || activeRecord;
      if (!target) return;
      const exportData = {
        app: 'Geno3D',
        format: 'single-patient-genogram',
        version: '3.0',
        exportedAt: new Date().toISOString(),
        patientName: target.patientName,
        sessionTitle: target.sessionTitle,
        sessionNotes: target.sessionNotes,
        updatedAt: target.updatedAt,
        currentPhaseId,
        phasesData: target.phasesData
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const slug = slugifyFileName(target.patientName);
      triggerDownload(blob, `geno3d-${slug}-${new Date().toISOString().slice(0, 10)}.json`);
    },
    [records, activeRecordId, activeRecord, currentPhaseId]
  );

  const handleExportAllRecordsArchive = useCallback(() => {
    const exportData = {
      app: 'Geno3D',
      format: 'multi-patient-archive',
      version: '3.0',
      exportedAt: new Date().toISOString(),
      activeRecordId,
      records
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    triggerDownload(
      blob,
      `geno3d-archivio-pazienti-${new Date().toISOString().slice(0, 10)}.json`
    );
  }, [records, activeRecordId]);

  const handleImportJson = useCallback((data) => {
    if (!data || typeof data !== 'object') return;

    // Caso 1: Archivio multi-paziente completo
    if (Array.isArray(data.records) && data.records.length > 0) {
      const importedRecords = data.records.map((rec, idx) => ({
        id: rec.id || `patient-imp-${Date.now()}-${idx}`,
        patientName: rec.patientName || `Paziente Importato ${idx + 1}`,
        sessionTitle: rec.sessionTitle || '',
        sessionNotes: rec.sessionNotes || '',
        updatedAt: rec.updatedAt || new Date().toISOString(),
        phasesData: sanitizePhasesData(rec.phasesData)
      }));

      setArchive((prev) => {
        const existingIds = new Set(prev.records.map((r) => r.id));
        const merged = [...prev.records];
        for (const imp of importedRecords) {
          if (existingIds.has(imp.id)) {
            const idx = merged.findIndex((r) => r.id === imp.id);
            merged[idx] = imp;
          } else {
            merged.unshift(imp);
          }
        }
        return {
          records: merged,
          activeRecordId: importedRecords[0].id
        };
      });
      setPastHistory([]);
      setFutureHistory([]);
      setSelectedPieceId(null);
      return;
    }

    // Caso 2: Singolo paziente / singola seduta JSON
    if (data.phasesData) {
      const newId = `patient-imp-${Date.now()}`;
      const importedRecord = {
        id: newId,
        patientName:
          data.patientName || `Paziente Importato (${new Date().toLocaleDateString('it-IT')})`,
        sessionTitle: data.sessionTitle || 'Seduta Importata',
        sessionNotes: data.sessionNotes || '',
        updatedAt: data.updatedAt || new Date().toISOString(),
        phasesData: sanitizePhasesData(data.phasesData)
      };

      setArchive((prev) => ({
        records: [importedRecord, ...prev.records],
        activeRecordId: newId
      }));
      if (data.currentPhaseId) {
        setCurrentPhaseId(data.currentPhaseId);
      }
      setPastHistory([]);
      setFutureHistory([]);
      setSelectedPieceId(null);
    }
  }, []);

  useKeyboardMovement({
    pieceId: selectedPieceId,
    contextKey: `${activeRecordId}:${currentPhaseId}`,
    pieces: currentPieces,
    enabled: !dragActive && !composerOpen && !placementPieceId &&
      !isPatientsModalOpen && !isExportModalOpen && !isRelationsModalOpen && !isHelpModalOpen,
    getAxes: exportApi?.getCameraHorizontalAxes,
    onMove: handleUpdatePiece,
    onMovingChange: setKeyboardMoving
  });

  // Scorciatoie da tastiera globali:
  // - WASD o Frecce direzionali: sposta il pezzo selezionato sul piano del tavolo (relativo alla telecamera)
  // - Q / E: ruota sguardo a sinistra / destra (asse Y)
  // - R / F: inclina avanti / indietro (asse X)
  // - Z / C: inclina lateralmente (asse Z)
  // - X: cicla postura (In piedi -> Sdraiato 90° -> Capovolto 180°)
  // - 0: raddrizza (rotationX = 0, rotationZ = 0)
  useEffect(() => {
    const normalizeAngleSigned = (rad) => {
      let a = ((rad + Math.PI) % (Math.PI * 2));
      if (a < 0) a += Math.PI * 2;
      return Math.round((a - Math.PI) * 100) / 100;
    };

    const handleKeyDown = (e) => {
      if (e.defaultPrevented) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isInputFocused = tag === 'input' || tag === 'textarea' || tag === 'select';

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (!isInputFocused) {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (!isInputFocused) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (e.key === 'Escape') {
        if (isPatientsModalOpen) setIsPatientsModalOpen(false);
        else if (isExportModalOpen) setIsExportModalOpen(false);
        else if (isRelationsModalOpen) setIsRelationsModalOpen(false);
        else if (isHelpModalOpen) setIsHelpModalOpen(false);
        else if (composerOpen) setComposerOpen(false);
        else if (placementPieceId) setPlacementPieceId(null);
        else if (inspectorOpen) {
          setInspectorOpen(false);
          inspectorButtonRef.current?.focus();
        }
        else if (selectedPieceId) setSelectedPieceId(null);
        else if (isZenMode) setIsZenMode(false);
        return;
      }

      if (isInputFocused || composerOpen || isPatientsModalOpen || isExportModalOpen || isRelationsModalOpen || isHelpModalOpen) return;
      const keyLower = e.key.toLowerCase();
      if (keyLower === 'l' && !e.metaKey && !e.ctrlKey) {
        setShowLabels((prev) => !prev);
        return;
      }

      if (!selectedPieceId) return;
      const piece = currentPieces.find((p) => p.id === selectedPieceId);
      if (!piece) return;

      // Elimina o Duplica
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeletePiece(selectedPieceId);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && keyLower === 'd') {
        e.preventDefault();
        handleDuplicatePiece(selectedPieceId);
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // 2. Rotazione sguardo orizzontale (Q / E)
      const angleStep = e.shiftKey ? Math.PI / 4 : Math.PI / 12;
      if (keyLower === 'q') {
        e.preventDefault();
        handleUpdatePiece(
          selectedPieceId,
          { rotationY: Math.round(((piece.rotationY || 0) - angleStep) * 100) / 100 },
          e.repeat
        );
        return;
      }
      if (keyLower === 'e') {
        e.preventDefault();
        handleUpdatePiece(
          selectedPieceId,
          { rotationY: Math.round(((piece.rotationY || 0) + angleStep) * 100) / 100 },
          e.repeat
        );
        return;
      }

      // 3. Inclinazione avanti / indietro / ribaltamento (R / F -> asse X)
      if (keyLower === 'r') {
        e.preventDefault();
        handleUpdatePiece(
          selectedPieceId,
          { rotationX: normalizeAngleSigned((piece.rotationX || 0) + angleStep) },
          e.repeat
        );
        return;
      }
      if (keyLower === 'f') {
        e.preventDefault();
        handleUpdatePiece(
          selectedPieceId,
          { rotationX: normalizeAngleSigned((piece.rotationX || 0) - angleStep) },
          e.repeat
        );
        return;
      }

      // 4. Inclinazione laterale (Z / C -> asse Z)
      if (keyLower === 'z') {
        e.preventDefault();
        handleUpdatePiece(
          selectedPieceId,
          { rotationZ: normalizeAngleSigned((piece.rotationZ || 0) - angleStep) },
          e.repeat
        );
        return;
      }
      if (keyLower === 'c') {
        e.preventDefault();
        handleUpdatePiece(
          selectedPieceId,
          { rotationZ: normalizeAngleSigned((piece.rotationZ || 0) + angleStep) },
          e.repeat
        );
        return;
      }

      // 5. Ribaltamento rapido ciclico (Tasto X: 0° In piedi -> 90° Sdraiato -> 180° Capovolto)
      if (keyLower === 'x') {
        e.preventDefault();
        const currX = Math.abs(piece.rotationX || 0);
        let nextX = Math.PI / 2;
        if (Math.abs(currX - Math.PI / 2) < 0.25) {
          nextX = Math.PI;
        } else if (currX > 2.5) {
          nextX = 0;
        }
        handleUpdatePiece(selectedPieceId, {
          rotationX: Math.round(nextX * 100) / 100,
          rotationZ: 0
        });
        return;
      }

      // 6. Raddrizza in piedi (Tasto 0)
      if (e.key === '0') {
        e.preventDefault();
        handleUpdatePiece(selectedPieceId, { rotationX: 0, rotationZ: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedPieceId,
    currentPieces,
    isPatientsModalOpen,
    isExportModalOpen,
    isRelationsModalOpen,
    isHelpModalOpen,
    isZenMode,
    inspectorOpen,
    composerOpen,
    placementPieceId,
    handleUndo,
    handleRedo,
    handleDeletePiece,
    handleDuplicatePiece,
    handleUpdatePiece
  ]);

  const selectedPiece = currentPieces.find((p) => p.id === selectedPieceId);
  const showPieceTools = !isZenMode && !composerOpen && Boolean(selectedPiece);
  const showInspector = showPieceTools && inspectorOpen;
  const isPlacing = showPieceTools && placementPieceId === selectedPieceId;

  const startPlacement = () => {
    setInspectorOpen(false);
    setPlacementPieceId(isPlacing ? null : selectedPieceId);
  };

  const placePiece = (id, position) => {
    handleUpdatePiece(id, position);
    setPlacementPieceId(null);
    setAnnouncement(`${selectedPiece?.name || 'Pezzo'} spostato.`);
  };

  const rotateSelected = (delta) => {
    const angle = ((selectedPiece.rotationY || 0) + delta) % (Math.PI * 2);
    handleUpdatePiece(selectedPiece.id, { rotationY: Math.round(angle * 100) / 100 });
  };

  const closeInspector = () => {
    setInspectorOpen(false);
    inspectorButtonRef.current?.focus();
  };

  return (
    <main className="geno-app">
      <Header
        currentPhaseId={currentPhaseId}
        onSelectPhase={handleSelectPhase}
        activePatientName={activeRecord?.patientName}
        totalPatientsCount={records.length}
        onOpenPatientsModal={() => setIsPatientsModalOpen(true)}
        linkCount={currentLinks.length}
        onOpenRelationsModal={() => setIsRelationsModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onImportJson={handleImportJson}
        onClearTray={() => handleClearCurrentPhaseTray(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        isZenMode={isZenMode}
        onToggleZenMode={() => {
          setPlacementPieceId(null);
          setIsZenMode(!isZenMode);
        }}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        canUndo={pastHistory.length > 0}
        canRedo={futureHistory.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <div className="geno-workspace" data-inspector={Boolean(showInspector)}>
        <section className="geno-stage" aria-label="Piano di lavoro 3D">
          <GenoCanvas
            pieces={currentPieces}
            onUpdatePiece={handleUpdatePiece}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            selectedPieceId={selectedPieceId}
            onSelectPiece={handleCanvasSelect}
            links={currentLinks}
            currentPhaseId={currentPhaseId}
            showLabels={showLabels}
            cameraView={cameraView}
            onCameraViewHandled={() => setCameraView(null)}
            onRegisterExportApi={setExportApi}
            isDark={isDark}
            placementPieceId={isPlacing ? selectedPieceId : null}
            onPlacePiece={placePiece}
          />

          {!isZenMode && (
            <>
              <div className="geno-stage-tools">
                <CameraControlsBar
                  onSelectView={setCameraView}
                  showLabels={showLabels}
                  onToggleLabels={() => setShowLabels(!showLabels)}
                />
              </div>
              <div className="geno-zoom scandi-panel" role="group" aria-label="Zoom">
                <button type="button" className="btn-scandi" aria-label="Avvicina" title="Avvicina" onClick={() => setCameraView('zoom-in')}>
                  <Plus size={17} aria-hidden="true" />
                </button>
                <button type="button" className="btn-scandi" aria-label="Allontana" title="Allontana" onClick={() => setCameraView('zoom-out')}>
                  <Minus size={17} aria-hidden="true" />
                </button>
              </div>
              {showPieceTools && (
                <div className="geno-piece-tools">
                  {isPlacing && <p role="status">Scegli un punto sul piano o un altro pezzo su cui appoggiarlo.</p>}
                  <div className="scandi-panel" role="group" aria-label="Comandi del pezzo selezionato">
                    <button type="button" className="btn-scandi" onClick={startPlacement} aria-pressed={isPlacing}>
                      <Move size={16} aria-hidden="true" /> {isPlacing ? 'Annulla spostamento' : 'Sposta'}
                    </button>
                    <button type="button" className="btn-scandi" onClick={() => rotateSelected(Math.PI / 4)} title="Gira il pezzo di 45 gradi">
                      <RotateCw size={16} aria-hidden="true" /> Gira
                    </button>
                    <PiecePosture
                      compact
                      piece={selectedPiece}
                      onChange={(change) => handleUpdatePiece(selectedPiece.id, change)}
                    />
                    <button
                      ref={inspectorButtonRef}
                      type="button"
                      className="btn-scandi"
                      aria-expanded={showInspector}
                      aria-controls={showInspector ? 'geno-inspector' : undefined}
                      onClick={() => {
                        setPlacementPieceId(null);
                        setInspectorOpen(!inspectorOpen);
                      }}
                    >
                      <SlidersHorizontal size={16} aria-hidden="true" /> Modifica
                    </button>
                  </div>
                </div>
              )}
              {currentPieces.length === 0 && (
                <div className="geno-empty">
                  <strong>Il piano è vuoto</strong>
                  <span>Scegli un pezzo per rappresentare una persona o un elemento importante.</span>
                  <button type="button" className="btn-scandi" onClick={() => changeComposer(true)}>Scegli il primo pezzo</button>
                </div>
              )}
              <span className="geno-sr-only" role="status">{announcement}</span>
              <div className="geno-stage-status">
                <span>{currentPieces.length} {currentPieces.length === 1 ? 'membro' : 'membri'}</span>
                <span className="geno-stage-hints">{selectedPiece ? 'Trascina il pezzo per spostarlo' : 'Trascina lo sfondo per cambiare punto di vista'}</span>
              </div>
            </>
          )}
        </section>

        {showInspector && (
          <div className="geno-inspector" id="geno-inspector">
            <SelectedPiecePanel
              piece={selectedPiece}
              pieces={currentPieces}
              links={currentLinks}
              onUpdatePiece={handleUpdatePiece}
              onDeselect={closeInspector}
              onStartPlacement={startPlacement}
              onRotate={rotateSelected}
              onOpenConnectModal={() => setIsRelationsModalOpen(true)}
              onDeleteLink={handleDeleteLink}
              onDuplicate={handleDuplicatePiece}
              onDelete={handleDeletePiece}
            />
          </div>
        )}
      </div>

      {!isZenMode && (
        <PieceDrawer
          onAddPiece={handleAddPiece}
          isOpen={composerOpen}
          onOpenChange={changeComposer}
          queuePreview={exportApi?.queuePiecePreview}
          isDark={isDark}
        />
      )}

      <PatientsModal
        isOpen={isPatientsModalOpen}
        onClose={() => setIsPatientsModalOpen(false)}
        records={records}
        activeRecordId={activeRecordId}
        onSelectRecord={handleSelectRecord}
        onCreateBlankRecord={handleCreateBlankRecord}
        onDuplicateRecord={handleDuplicateRecord}
        onUpdateActiveRecordMeta={handleUpdateActiveRecordMeta}
        onDeleteRecord={handleDeleteRecord}
        onClearCurrentPhaseTray={() => handleClearCurrentPhaseTray(false)}
        onClearAllPhasesTray={handleClearAllPhasesTray}
        onLoadDemoPreset={handleLoadDemoPreset}
        onExportSingleRecord={handleExportSingleRecord}
        onExportAllRecordsArchive={handleExportAllRecordsArchive}
        onImportFile={handleImportJson}
      />

      <RelationsModal
        isOpen={isRelationsModalOpen}
        onClose={() => setIsRelationsModalOpen(false)}
        pieces={currentPieces}
        links={currentLinks}
        onAddLink={handleAddLink}
        onDeleteLink={handleDeleteLink}
        preselectedSourceId={selectedPieceId}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        exportApi={exportApi}
        currentPhaseId={currentPhaseId}
        onExportJson={() => handleExportSingleRecord(activeRecordId)}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </main>
  );
}
