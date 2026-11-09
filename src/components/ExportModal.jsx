import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Box,
  FileJson,
  Download,
  Layers,
  Check,
  Sparkles,
  Image as ImageIcon,
  Grid
} from 'lucide-react';
import { CAMERA_PROJECTIONS, DEFAULT_PHASES } from '../constants';

const EXPORT_3D_FORMATS = [
  {
    id: 'glb',
    label: 'GLB (glTF 2.0 Binario)',
    ext: '.glb',
    desc: 'Formato 3D universale completo di materiali, colori e texture del legno. Ideale per Blender, macOS, Windows e visualizzatori 3D.'
  },
  {
    id: 'gltf',
    label: 'GLTF (JSON + Texture)',
    ext: '.gltf',
    desc: 'Formato aperto leggibile per interscambio tra software 3D e motori grafici.'
  },
  {
    id: 'obj',
    label: 'Wavefront OBJ',
    ext: '.obj',
    desc: 'Geometria 3D universale compatibile con qualsiasi programma CAD o modellazione.'
  },
  {
    id: 'stl',
    label: 'STL per Stampa 3D',
    ext: '.stl',
    desc: 'Mesh solida pronta per stampanti 3D (ideale per stampare fisicamente la scultura).'
  }
];

export default function ExportModal({
  isOpen,
  onClose,
  exportApi,
  currentPhaseId,
  onExportJson
}) {
  const [activeTab, setActiveTab] = useState('images'); // 'images' | 'scene3d' | 'session'
  const [selectedViewMode, setSelectedViewMode] = useState('composite'); // 'composite' | projectionId
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [highRes, setHighRes] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Opzioni 3D
  const [format3D, setFormat3D] = useState('glb');
  const [includeTray3D, setIncludeTray3D] = useState(true);
  const [includeLinks3D, setIncludeLinks3D] = useState(true);

  const phaseDef = DEFAULT_PHASES.find((p) => p.id === currentPhaseId) || DEFAULT_PHASES[1];

  // Aggiorna l'anteprima quando cambiano le opzioni nel tab immagini
  useEffect(() => {
    if (!isOpen || !exportApi || activeTab !== 'images') return;

    const timer = setTimeout(() => {
      if (selectedViewMode === 'composite') {
        const url = exportApi.renderCompositeSheetDataUrl({
          includeLabels,
          resolutionScale: 0.55
        });
        setPreviewUrl(url);
      } else {
        const url = exportApi.renderProjectionDataUrl({
          projectionId: selectedViewMode,
          width: 960,
          height: 720,
          includeLabels,
          includeHeader
        });
        setPreviewUrl(url);
      }
    }, 40);

    return () => clearTimeout(timer);
  }, [isOpen, exportApi, activeTab, selectedViewMode, includeLabels, includeHeader, currentPhaseId]);

  if (!isOpen) return null;

  const handleDownloadSelectedImage = async () => {
    if (!exportApi) return;
    setIsExporting(true);
    try {
      if (selectedViewMode === 'composite') {
        exportApi.downloadCompositeSheet({
          includeLabels,
          resolutionScale: highRes ? 1.0 : 0.75
        });
      } else {
        await exportApi.downloadProjections({
          projectionIds: [selectedViewMode],
          width: highRes ? 2048 : 1440,
          height: highRes ? 1536 : 1080,
          includeLabels,
          includeHeader
        });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadBaseProjectionsPack = async () => {
    if (!exportApi) return;
    setIsExporting(true);
    try {
      await exportApi.downloadProjections({
        projectionIds: ['camera', 'top', 'front', 'right', 'isometric'],
        width: highRes ? 1920 : 1440,
        height: highRes ? 1440 : 1080,
        includeLabels,
        includeHeader
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport3DScene = async () => {
    if (!exportApi) return;
    setIsExporting(true);
    try {
      await exportApi.export3D({
        format: format3D,
        includeTray: includeTray3D,
        includeLinks: includeLinks3D
      });
    } catch (err) {
      alert(`Errore durante l'esportazione 3D: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="scandi-panel scandi-panel-floating"
        style={{
          width: '860px',
          maxWidth: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Esporta Genogramma — {phaseDef.shortName}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Salva le proiezioni ortogonali, la vista dalla telecamera o l&apos;intera scena tridimensionale
            </p>
          </div>
          <button onClick={onClose} className="btn-scandi btn-scandi-icon" aria-label="Chiudi finestra esportazione">
            <X size={16} />
          </button>
        </div>

        {/* Selettore Tab */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            background: 'var(--bg-secondary)',
            padding: '5px',
            borderRadius: '12px'
          }}
        >
          <button
            onClick={() => setActiveTab('images')}
            className="btn-scandi"
            style={{
              flex: 1,
              background: activeTab === 'images' ? 'var(--accent-pine)' : 'transparent',
              color: activeTab === 'images' ? 'var(--text-inverse)' : 'var(--text-main)',
              borderColor: 'transparent',
              fontWeight: 600
            }}
          >
            <Camera size={15} /> Immagini &amp; Proiezioni (2D / Camera)
          </button>
          <button
            onClick={() => setActiveTab('scene3d')}
            className="btn-scandi"
            style={{
              flex: 1,
              background: activeTab === 'scene3d' ? 'var(--accent-pine)' : 'transparent',
              color: activeTab === 'scene3d' ? 'var(--text-inverse)' : 'var(--text-main)',
              borderColor: 'transparent',
              fontWeight: 600
            }}
          >
            <Box size={15} /> Scena 3D (.GLB / .OBJ / .STL)
          </button>
          <button
            onClick={() => setActiveTab('session')}
            className="btn-scandi"
            style={{
              flex: 1,
              background: activeTab === 'session' ? 'var(--accent-pine)' : 'transparent',
              color: activeTab === 'session' ? 'var(--text-inverse)' : 'var(--text-main)',
              borderColor: 'transparent',
              fontWeight: 600
            }}
          >
            <FileJson size={15} /> Archivio Seduta (.JSON)
          </button>
        </div>

        {/* TAB 1: IMMAGINI & PROIEZIONI */}
        {activeTab === 'images' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '20px', alignItems: 'start' }}>
            {/* Colonna sinistra: Scelta Proiezione e Opzioni */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Scegli Proiezione o Tavola
                </h3>

                {/* Bottone Tavola Sinottica 4-in-1 */}
                <button
                  onClick={() => setSelectedViewMode('composite')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: `1.5px solid ${
                      selectedViewMode === 'composite' ? 'var(--accent-pine)' : 'var(--border-light)'
                    }`,
                    background: selectedViewMode === 'composite' ? 'var(--accent-pine-light)' : 'var(--bg-elevated)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Grid size={14} color="var(--accent-pine)" />
                      Tavola Sinottica Multi-Proiezione (4 Viste)
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Vista Camera + Pianta 2D + Frontale + Isometrica + Scheda Membri
                    </div>
                  </div>
                  {selectedViewMode === 'composite' && <Check size={16} color="var(--accent-pine)" />}
                </button>

                {/* Griglia Proiezioni Singole */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {CAMERA_PROJECTIONS.map((proj) => {
                    const isSel = selectedViewMode === proj.id;
                    return (
                      <button
                        key={proj.id}
                        onClick={() => setSelectedViewMode(proj.id)}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${isSel ? 'var(--accent-pine)' : 'var(--border-light)'}`,
                          background: isSel ? 'var(--accent-pine-light)' : 'var(--bg-elevated)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                        title={proj.desc}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: isSel ? 600 : 500,
                            color: isSel ? 'var(--accent-pine)' : 'var(--text-main)'
                          }}
                        >
                          {proj.shortName}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {proj.id === 'camera' ? 'Posizione camera' : proj.isOrtho ? 'Ortogonale' : 'Prospettica'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opzioni sovrimpressione grafica */}
              <div
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeLabels}
                    onChange={(e) => setIncludeLabels(e.target.checked)}
                    style={{ accentColor: 'var(--accent-pine)' }}
                  />
                  <span>Includi nomi, ruoli e frecce sguardo in pianta</span>
                </label>

                {selectedViewMode !== 'composite' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeHeader}
                      onChange={(e) => setIncludeHeader(e.target.checked)}
                      style={{ accentColor: 'var(--accent-pine)' }}
                    />
                    <span>Includi intestazione clinica e legenda fili</span>
                  </label>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={highRes}
                    onChange={(e) => setHighRes(e.target.checked)}
                    style={{ accentColor: 'var(--accent-pine)' }}
                  />
                  <span>Alta Risoluzione Stampa (Ultra HD)</span>
                </label>
              </div>

              {/* Pulsanti Download */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={handleDownloadSelectedImage}
                  disabled={isExporting}
                  className="btn-scandi btn-scandi-primary"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13px' }}
                >
                  <Download size={15} />
                  {selectedViewMode === 'composite'
                    ? 'Scarica Tavola Sinottica (.PNG)'
                    : `Scarica ${CAMERA_PROJECTIONS.find((p) => p.id === selectedViewMode)?.shortName || 'Immagine'} (.PNG)`}
                </button>

                <button
                  onClick={handleDownloadBaseProjectionsPack}
                  disabled={isExporting}
                  className="btn-scandi"
                  style={{ width: '100%', padding: '9px 14px', fontSize: '12px' }}
                >
                  <Layers size={14} /> Scarica Set 5 Proiezioni Base (Camera + Pianta + Fronte + Lato + Iso)
                </button>
              </div>
            </div>

            {/* Colonna destra: Anteprima Live */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'var(--surface-muted)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                padding: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Anteprima di Esportazione
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {selectedViewMode === 'composite' ? '2400 × 1800 px' : highRes ? '2048 × 1536 px' : '1440 × 1080 px'}
                </span>
              </div>

              <div
                style={{
                  width: '100%',
                  aspectRatio: '4 / 3',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Anteprima proiezione genogramma"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generazione anteprima...</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SCENA 3D */}
        {activeTab === 'scene3d' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {EXPORT_3D_FORMATS.map((fmt) => {
                const isSel = format3D === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    onClick={() => setFormat3D(fmt.id)}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: `1.5px solid ${isSel ? 'var(--accent-pine)' : 'var(--border-light)'}`,
                      background: isSel ? 'var(--accent-pine-light)' : 'var(--bg-elevated)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {fmt.label}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isSel ? 'var(--accent-pine)' : 'var(--bg-secondary)',
                          color: isSel ? 'var(--text-inverse)' : 'var(--text-main)'
                        }}
                      >
                        {fmt.ext}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                      {fmt.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                gap: '24px',
                flexWrap: 'wrap'
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeTray3D}
                  onChange={(e) => setIncludeTray3D(e.target.checked)}
                  style={{ accentColor: 'var(--accent-pine)' }}
                />
                <span>Includi il vassoio circolare in legno di frassino</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeLinks3D}
                  onChange={(e) => setIncludeLinks3D(e.target.checked)}
                  style={{ accentColor: 'var(--accent-pine)' }}
                />
                <span>Includi le geometrie 3D dei fili relazionali</span>
              </label>
            </div>

            <button
              onClick={handleExport3DScene}
              disabled={isExporting}
              className="btn-scandi btn-scandi-primary"
              style={{ padding: '12px 20px', fontSize: '14px', alignSelf: 'flex-end' }}
            >
              <Box size={16} /> Esporta Scena 3D ({EXPORT_3D_FORMATS.find((f) => f.id === format3D)?.ext})
            </button>
          </div>
        )}

        {/* TAB 3: ARCHIVIO SEDUTA JSON */}
        {activeTab === 'session' && (
          <div
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px'
            }}
          >
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Salvataggio Completo Seduta Clinica (.JSON)
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                Salva tutte le tre fasi temporali (Passato, Presente, Futuro), le coordinate spaziali, gli sguardi, i fili relazionali e le note cliniche per poter riaprire e modificare la seduta in qualsiasi momento.
              </p>
            </div>
            <button
              onClick={() => {
                onExportJson();
                onClose();
              }}
              className="btn-scandi btn-scandi-primary"
              style={{ whiteSpace: 'nowrap', padding: '10px 18px' }}
            >
              <Download size={15} /> Scarica Archivio .JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
