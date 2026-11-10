import React, { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { CAMERA_PROJECTIONS, DEFAULT_PHASES } from '../constants';
import PhaseComparison from './PhaseComparison';

const TABS = [
  ['images', 'Immagini'],
  ['compare', 'Confronto'],
  ['scene3d', 'Scena 3D'],
  ['session', 'Archivio']
];

const IMAGE_VIEWS = [
  ['isometric', 'Di tre quarti'], ['top', 'Dall’alto'], ['front', 'Frontale'],
  ['right', 'Laterale'], ['left', 'Laterale sinistra'], ['back', 'Da dietro'],
  ['perspective', 'Prospettiva 3D'], ['camera', 'Vista attuale'], ['composite', 'Tavola con più viste']
];

export default function ExportModal({ onClose, exportApi, currentPhaseId, phasesData, initialTab, onExportJson }) {
  const [tab, setTab] = useState(initialTab);
  const [view, setView] = useState('isometric');
  const [framing, setFraming] = useState('pieces');
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(false);
  const [preview, setPreview] = useState(null);
  const [format, setFormat] = useState('glb');
  const [includeTray, setIncludeTray] = useState(true);
  const [includeLinks, setIncludeLinks] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const phase = DEFAULT_PHASES.find(({ id }) => id === currentPhaseId);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    if (!exportApi || tab !== 'images') return;
    const frame = requestAnimationFrame(() => {
      try {
        const options = { framing, includeLabels, includeHeader };
        setPreview(view === 'composite'
          ? exportApi.renderCompositeSheetDataUrl({ ...options, resolutionScale: 0.42 })
          : exportApi.renderProjectionDataUrl({ ...options, projectionId: view, width: 840, height: 630 }));
      } catch {
        setError('Anteprima non disponibile. Prova un’altra vista.');
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [exportApi, tab, view, framing, includeLabels, includeHeader]);

  const run = async (action) => {
    setWorking(true);
    setError('');
    try {
      await action();
    } catch {
      setError('Il file non è stato creato. Riprova a scaricarlo.');
    } finally {
      setWorking(false);
    }
  };

  const imageOptions = { framing, includeLabels, includeHeader };
  const downloadImage = () => run(() => view === 'composite'
    ? exportApi.downloadCompositeSheet(imageOptions)
    : exportApi.downloadProjections({ ...imageOptions, projectionIds: [view] }));

  return (
    <dialog
      className="geno-export-dialog scandi-panel"
      ref={dialog}
      aria-labelledby="geno-export-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="geno-export-inner">
        <header className="geno-export-heading">
          <div>
            <h2 id="geno-export-title">{tab === 'compare' ? 'Confronta le fasi' : 'Esporta genogramma'}</h2>
            {tab !== 'compare' && <p>{phase?.shortName}</p>}
          </div>
          <button type="button" className="btn-scandi btn-scandi-icon" aria-label="Chiudi finestra esportazione" onClick={onClose}><X size={17} /></button>
        </header>

        <nav className="geno-export-segment" aria-label="Esportazione e confronto">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" className="btn-scandi" aria-pressed={tab === id} onClick={() => { setTab(id); setError(''); }}>
              {label}
            </button>
          ))}
        </nav>

        {tab === 'images' && (
          <section className="geno-export-section" aria-label="Esporta un’immagine">
            <div className="geno-export-fields">
              <label className="geno-field">
                <span>Vista</span>
                <select className="scandi-input" aria-label="Vista" value={view} onChange={(event) => setView(event.target.value)}>
                  {IMAGE_VIEWS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <label className="geno-field">
                <span>Inquadratura</span>
                <select className="scandi-input" aria-label="Inquadratura" value={framing} onChange={(event) => setFraming(event.target.value)}>
                  <option value="pieces">Vicino ai pezzi</option>
                  <option value="tray">{view === 'camera' ? 'Come nell’editor' : 'Vassoio intero'}</option>
                </select>
              </label>
              <label className="geno-export-check">
                <input type="checkbox" checked={includeLabels} onChange={(event) => setIncludeLabels(event.target.checked)} /> Nomi
              </label>
              {view !== 'composite' && (
                <label className="geno-export-check">
                  <input type="checkbox" checked={includeHeader} onChange={(event) => setIncludeHeader(event.target.checked)} /> Titolo e legenda
                </label>
              )}
            </div>
            <div className="geno-export-preview">
              {preview ? <img src={preview} alt="Anteprima dell’immagine da esportare" /> : <p>Preparazione anteprima…</p>}
            </div>
            <div className="geno-export-footer">
              <button type="button" className="btn-scandi" disabled={working || !exportApi} onClick={() => run(() => exportApi.downloadProjections({
                ...imageOptions, projectionIds: CAMERA_PROJECTIONS.filter(({ id }) => ['camera', 'top', 'front', 'right', 'isometric'].includes(id)).map(({ id }) => id)
              }))}>
                Scarica 5 viste
              </button>
              <button type="button" className="btn-scandi btn-scandi-primary" disabled={working || !exportApi} onClick={downloadImage}>
                <Download size={16} /> {view === 'composite' ? 'Scarica tavola PNG' : 'Scarica immagine PNG'}
              </button>
            </div>
          </section>
        )}

        {tab === 'compare' && <PhaseComparison phasesData={phasesData} currentPhaseId={currentPhaseId} exportApi={exportApi} />}

        {tab === 'scene3d' && (
          <section className="geno-export-section">
            <div className="geno-export-fields">
              <label className="geno-field">
                <span>Formato 3D</span>
                <select className="scandi-input" aria-label="Formato 3D" value={format} onChange={(event) => setFormat(event.target.value)}>
                  <option value="glb">GLB · modello con materiali</option>
                  <option value="gltf">glTF · modello con materiali</option>
                  <option value="obj">OBJ · geometria</option>
                  <option value="stl">STL · stampa 3D</option>
                </select>
              </label>
              <label className="geno-export-check"><input type="checkbox" checked={includeTray} onChange={(event) => setIncludeTray(event.target.checked)} /> Vassoio</label>
              <label className="geno-export-check"><input type="checkbox" checked={includeLinks} onChange={(event) => setIncludeLinks(event.target.checked)} /> Fili</label>
            </div>
            <div className="geno-export-footer">
              <button type="button" className="btn-scandi btn-scandi-primary" disabled={working || !exportApi} onClick={() => run(() => exportApi.export3D({ format, includeTray, includeLinks }))}>
                <Download size={16} /> Esporta scena 3D
              </button>
            </div>
          </section>
        )}

        {tab === 'session' && (
          <section className="geno-export-section">
            <p className="geno-export-hint">Salva tutte le fasi di questa seduta in un file da importare in Geno3D.</p>
            <div className="geno-export-footer">
              <button type="button" className="btn-scandi btn-scandi-primary" onClick={onExportJson}><Download size={16} /> Scarica archivio JSON</button>
            </div>
          </section>
        )}
        {error && <p className="geno-export-error" role="alert">{error}</p>}
      </div>
    </dialog>
  );
}
