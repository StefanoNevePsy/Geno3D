import React, { useState, useCallback, useEffect, useRef } from 'react';
import GenoCanvas from './components/GenoCanvas';
import Header from './components/Header';
import PieceDrawer from './components/PieceDrawer';
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
  findFreePositionOnTray,
  calculateDragPosition
} from './utils/physicsUtils';
import { triggerDownload } from './utils/exportUtils';

const LEGACY_STORAGE_KEY = 'geno3d-session-v2';
const ARCHIVE_STORAGE_KEY = 'geno3d-patients-archive-v3';

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
  const isDraggingRef = useRef(false);
  const preDragSnapshotRef = useRef(null);
  const phasesDataRef = useRef(phasesData);
  phasesDataRef.current = phasesData;

  const [currentPhaseId, setCurrentPhaseId] = useState('presente');
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [cameraView, setCameraView] = useState(null);
  const [showLabels, setShowLabels] = useState(true);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isRelationsModalOpen, setIsRelationsModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPatientsModalOpen, setIsPatientsModalOpen] = useState(false);
  const [exportApi, setExportApi] = useState(null);

  const currentPhaseData = phasesData[currentPhaseId] || { pieces: [], links: [] };
  const currentPieces = currentPhaseData.pieces;
  const currentLinks = currentPhaseData.links;

  // Salvataggio automatico dell'archivio multi-paziente su localStorage (100% locale)
  useEffect(() => {
    try {
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archive));
    } catch {
      // Ignora errori di quota storage
    }
  }, [archive]);

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
        return {
          ...rec,
          updatedAt: new Date().toISOString(),
          phasesData: nextPhasesData
        };
      });
      return {
        ...prevArchive,
        records: updatedRecords
      };
    });
  }, []);

  // Registra uno stato nella cronologia Undo
  const pushHistorySnapshot = useCallback((snapshot) => {
    setPastHistory((prev) => [...prev.slice(-29), JSON.parse(JSON.stringify(snapshot))]);
    setFutureHistory([]);
  }, []);

  const handleUndo = useCallback(() => {
    setPastHistory((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previousState = prevPast[prevPast.length - 1];
      setFutureHistory((prevFuture) => [
        JSON.parse(JSON.stringify(phasesDataRef.current)),
        ...prevFuture.slice(0, 29)
      ]);
      setPhasesData(previousState);
      return prevPast.slice(0, -1);
    });
  }, [setPhasesData]);

  const handleRedo = useCallback(() => {
    setFutureHistory((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const nextState = prevFuture[0];
      setPastHistory((prevPast) => [
        ...prevPast.slice(-29),
        JSON.parse(JSON.stringify(phasesDataRef.current))
      ]);
      setPhasesData(nextState);
      return prevFuture.slice(1);
    });
  }, [setPhasesData]);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    preDragSnapshotRef.current = JSON.parse(JSON.stringify(phasesDataRef.current));
  }, []);

  const handleDragEnd = useCallback(() => {
    if (isDraggingRef.current && preDragSnapshotRef.current) {
      const before = JSON.stringify(preDragSnapshotRef.current);
      const after = JSON.stringify(phasesDataRef.current);
      if (before !== after) {
        pushHistorySnapshot(preDragSnapshotRef.current);
      }
    }
    isDraggingRef.current = false;
    preDragSnapshotRef.current = null;
  }, [pushHistorySnapshot]);

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

      if (isInputFocused) return;

      const keyLower = e.key.toLowerCase();

      if (e.key === 'Escape') {
        if (isPatientsModalOpen) setIsPatientsModalOpen(false);
        else if (isExportModalOpen) setIsExportModalOpen(false);
        else if (isRelationsModalOpen) setIsRelationsModalOpen(false);
        else if (isHelpModalOpen) setIsHelpModalOpen(false);
        else if (selectedPieceId) setSelectedPieceId(null);
        else if (isZenMode) setIsZenMode(false);
        return;
      }

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

      // 1. Movimento sul tavolo con WASD o Frecce Direzionali (relativo alla vista telecamera)
      let moveFwd = 0;
      let moveRight = 0;
      if (keyLower === 'w' || e.key === 'ArrowUp') moveFwd = 1;
      else if (keyLower === 's' || e.key === 'ArrowDown') moveFwd = -1;
      else if (keyLower === 'a' || e.key === 'ArrowLeft') moveRight = -1;
      else if (keyLower === 'd' || e.key === 'ArrowRight') moveRight = 1;

      if (moveFwd !== 0 || moveRight !== 0) {
        e.preventDefault();
        const step = e.shiftKey ? 0.65 : 0.25;
        const axes = exportApi?.getCameraHorizontalAxes
          ? exportApi.getCameraHorizontalAxes()
          : { forward: { x: 0, z: -1 }, right: { x: 1, z: 0 } };

        const targetX = piece.x + (axes.forward.x * moveFwd + axes.right.x * moveRight) * step;
        const targetZ = piece.z + (axes.forward.z * moveFwd + axes.right.z * moveRight) * step;
        const newPos = calculateDragPosition(targetX, targetZ, selectedPieceId, currentPieces);
        handleUpdatePiece(selectedPieceId, newPos, e.repeat);
        return;
      }

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
    exportApi,
    isPatientsModalOpen,
    isExportModalOpen,
    isRelationsModalOpen,
    isHelpModalOpen,
    isZenMode,
    handleUndo,
    handleRedo,
    handleDeletePiece,
    handleDuplicatePiece,
    handleUpdatePiece
  ]);

  const selectedPiece = currentPieces.find((p) => p.id === selectedPieceId);

  return (
    <main style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <GenoCanvas
        pieces={currentPieces}
        onUpdatePiece={handleUpdatePiece}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        selectedPieceId={selectedPieceId}
        onSelectPiece={setSelectedPieceId}
        links={currentLinks}
        currentPhaseId={currentPhaseId}
        showLabels={showLabels}
        cameraView={cameraView}
        onCameraViewHandled={() => setCameraView(null)}
        onRegisterExportApi={setExportApi}
      />

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
        onToggleZenMode={() => setIsZenMode(!isZenMode)}
        canUndo={pastHistory.length > 0}
        canRedo={futureHistory.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {!isZenMode && (
        <CameraControlsBar
          onSelectView={(view) => setCameraView(view)}
          showLabels={showLabels}
          onToggleLabels={() => setShowLabels(!showLabels)}
        />
      )}

      {!isZenMode && selectedPiece && (
        <SelectedPiecePanel
          piece={selectedPiece}
          pieces={currentPieces}
          links={currentLinks}
          onUpdatePiece={handleUpdatePiece}
          onDeselect={() => setSelectedPieceId(null)}
          onOpenConnectModal={() => setIsRelationsModalOpen(true)}
          onDeleteLink={handleDeleteLink}
          onDuplicate={handleDuplicatePiece}
          onDelete={handleDeletePiece}
        />
      )}

      {!isZenMode && <PieceDrawer onAddPiece={handleAddPiece} />}

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
