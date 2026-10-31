import React, { useState, useCallback, useEffect, useRef } from 'react';
import GenoCanvas from './components/GenoCanvas';
import Header from './components/Header';
import PieceDrawer from './components/PieceDrawer';
import SelectedPiecePanel from './components/SelectedPiecePanel';
import CameraControlsBar from './components/CameraControlsBar';
import RelationsModal from './components/RelationsModal';
import HelpModal from './components/HelpModal';
import ExportModal from './components/ExportModal';
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

const STORAGE_KEY = 'geno3d-session-v2';

function createDefaultPhasesData() {
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

export default function App() {
  const [phasesData, setPhasesData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.presente && Array.isArray(parsed.presente.pieces)) {
          return {
            presente: {
              pieces: stabilizeAllPieces(parsed.presente.pieces),
              links: parsed.presente.links || []
            },
            passato: {
              pieces: stabilizeAllPieces(parsed.passato?.pieces || INITIAL_PASSATO_PIECES),
              links: parsed.passato?.links || INITIAL_PASSATO_LINKS
            },
            futuro: {
              pieces: stabilizeAllPieces(parsed.futuro?.pieces || []),
              links: parsed.futuro?.links || []
            }
          };
        }
      }
    } catch {
      // Fallback ai dati predefiniti
    }
    return createDefaultPhasesData();
  });

  // Cronologia Undo / Redo
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
  const [exportApi, setExportApi] = useState(null);

  const currentPhaseData = phasesData[currentPhaseId] || { pieces: [], links: [] };
  const currentPieces = currentPhaseData.pieces;
  const currentLinks = currentPhaseData.links;

  // Salvataggio automatico su localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(phasesData));
    } catch {
      // Ignora errori di quota storage
    }
  }, [phasesData]);

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
  }, []);

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
  }, []);

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
    if (phaseId === 'futuro' && (!phasesData.futuro.pieces || phasesData.futuro.pieces.length === 0)) {
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
    [currentPhaseId, pushHistorySnapshot]
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
    [currentPhaseId, pushHistorySnapshot]
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
    [currentPieces, currentPhaseId, pushHistorySnapshot]
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
    [currentPhaseId, selectedPieceId, pushHistorySnapshot]
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
    [currentPhaseId, pushHistorySnapshot]
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
    [currentPhaseId, pushHistorySnapshot]
  );

  const handleExportJson = () => {
    const exportData = {
      app: 'Geno3D',
      version: '2.1',
      createdDate: new Date().toISOString(),
      currentPhaseId,
      phasesData
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    triggerDownload(blob, `geno3d-seduta-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleImportJson = (data) => {
    if (data.phasesData) {
      pushHistorySnapshot(phasesDataRef.current);
      const stabilizedPhases = {};
      for (const k of Object.keys(data.phasesData)) {
        stabilizedPhases[k] = {
          ...data.phasesData[k],
          pieces: stabilizeAllPieces(data.phasesData[k].pieces || [])
        };
      }
      setPhasesData(stabilizedPhases);
      if (data.currentPhaseId) {
        setCurrentPhaseId(data.currentPhaseId);
      }
      setSelectedPieceId(null);
    }
  };

  const handleResetSession = () => {
    if (window.confirm('Vuoi ripristinare la scultura della fase corrente ai valori predefiniti?')) {
      pushHistorySnapshot(phasesDataRef.current);
      setPhasesData((prev) => ({
        ...prev,
        [currentPhaseId]: {
          pieces:
            currentPhaseId === 'presente'
              ? stabilizeAllPieces(INITIAL_PIECES)
              : currentPhaseId === 'passato'
              ? stabilizeAllPieces(INITIAL_PASSATO_PIECES)
              : [],
          links:
            currentPhaseId === 'presente'
              ? INITIAL_LINKS
              : currentPhaseId === 'passato'
              ? INITIAL_PASSATO_LINKS
              : []
        }
      }));
      setSelectedPieceId(null);
    }
  };

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
        if (isExportModalOpen) setIsExportModalOpen(false);
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
        linkCount={currentLinks.length}
        onOpenRelationsModal={() => setIsRelationsModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onImportJson={handleImportJson}
        onResetSession={handleResetSession}
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
        onExportJson={handleExportJson}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </main>
  );
}
