import React, { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play } from 'lucide-react';
import { createPhaseComparison, encodeComparisonGif, TIMELINE_DURATION } from '../utils/phaseComparison';
import { triggerDownload } from '../utils/exportUtils';

const MODES = [
  ['side', 'Affiancate'],
  ['ghost', 'Sovrapposte'],
  ['motion', 'Animazione']
];

function outputSize(mode, large) {
  if (mode === 'side') return large ? [2700, 750] : [1080, 300];
  return large ? [1920, 1440] : [800, 600];
}

export default function PhaseComparison({ phasesData, currentPhaseId, exportApi }) {
  const [mode, setMode] = useState('side');
  const [view, setView] = useState('top');
  const [reference, setReference] = useState(() => currentPhaseId === 'futuro' ? 2 : 1);
  const [labels, setLabels] = useState(true);
  const [framing, setFraming] = useState('pieces');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const jobRef = useRef(null);
  const [width, height] = outputSize(mode, false);

  useEffect(() => {
    if (!exportApi) return;
    try {
      engineRef.current = createPhaseComparison(phasesData, exportApi.getComparisonTray());
    } catch {
      setError('Impossibile avviare il confronto. Riapri la finestra per riprovare.');
    }
    return () => {
      jobRef.current?.abort();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [phasesData, exportApi]);

  useEffect(() => {
    if (canvasRef.current && engineRef.current) {
      try {
        engineRef.current.draw(canvasRef.current, { mode, view, reference, labels, framing, time });
      } catch {
        setPlaying(false);
        setError('Anteprima non disponibile. Riprova con un’altra vista.');
      }
    }
  }, [mode, view, reference, labels, framing, time, phasesData, exportApi]);

  useEffect(() => {
    if (!playing) return;
    let start;
    let frame;
    const update = (now) => {
      start ??= now;
      const next = Math.min(time + now - start, TIMELINE_DURATION);
      setTime(next);
      if (next < TIMELINE_DURATION) frame = requestAnimationFrame(update);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
    // Riprende dalla posizione scelta quando parte la riproduzione.
  }, [playing]);

  const chooseMode = (next) => {
    setPlaying(false);
    setTime(0);
    setMode(next);
    setError('');
  };

  const download = async () => {
    const engine = engineRef.current;
    if (!engine || jobRef.current) return;
    setError('');
    const settings = { mode, view, reference, labels, framing };
    const job = new AbortController();
    jobRef.current = job;
    try {
      if (mode === 'motion') {
        setPlaying(false);
        setProgress(0);
        const blob = await encodeComparisonGif(
          (canvas, at) => engine.draw(canvas, { ...settings, time: at }),
          job.signal,
          setProgress
        );
        if (blob && !job.signal.aborted) triggerDownload(blob, 'geno3d-passato-presente-futuro.gif');
      } else {
        const canvas = document.createElement('canvas');
        [canvas.width, canvas.height] = outputSize(mode, true);
        engine.draw(canvas, settings);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error();
        if (!job.signal.aborted) triggerDownload(blob, `geno3d-confronto-${mode === 'side' ? 'affiancato' : 'sovrapposto'}.png`);
      }
    } catch {
      if (!job.signal.aborted) setError('Il file non è stato creato. Riprova a scaricarlo.');
    } finally {
      if (jobRef.current === job) jobRef.current = null;
      if (!job.signal.aborted) setProgress(null);
    }
  };

  return (
    <section className="geno-export-section" aria-label="Confronto delle fasi">
      <div className="geno-export-segment" role="group" aria-label="Tipo di confronto">
        {MODES.map(([id, title]) => (
          <button key={id} type="button" className="btn-scandi" aria-pressed={mode === id} disabled={progress !== null} onClick={() => chooseMode(id)}>
            {title}
          </button>
        ))}
      </div>

      <p className="geno-export-hint">
        {mode === 'side' && 'Passato, Presente e Futuro con lo stesso punto di vista e la stessa scala.'}
        {mode === 'ghost' && 'Le sagome colorate mostrano dove si trovavano i pezzi nelle fasi precedenti.'}
        {mode === 'motion' && 'I pezzi corrispondenti si spostano e ruotano tra le tre fasi. Gli altri compaiono o scompaiono.'}
      </p>

      <div className="geno-export-fields">
        <label className="geno-field">
          <span>Vista</span>
          <select className="scandi-input" aria-label="Vista" value={view} onChange={(event) => setView(event.target.value)} disabled={progress !== null}>
            <option value="top">Dall’alto</option>
            <option value="isometric">Di tre quarti</option>
            <option value="front">Frontale</option>
            <option value="right">Laterale</option>
          </select>
        </label>
        {mode === 'ghost' && (
          <label className="geno-field">
            <span>Fase in primo piano</span>
            <select className="scandi-input" aria-label="Fase in primo piano" value={reference} onChange={(event) => setReference(Number(event.target.value))}>
              <option value={1}>Presente</option>
              <option value={2}>Futuro</option>
            </select>
          </label>
        )}
        <label className="geno-field">
          <span>Inquadratura</span>
          <select className="scandi-input" aria-label="Inquadratura" value={framing} onChange={(event) => setFraming(event.target.value)} disabled={progress !== null}>
            <option value="pieces">Vicino ai pezzi</option>
            <option value="tray">Vassoio intero</option>
          </select>
        </label>
        <label className="geno-export-check">
          <input type="checkbox" checked={labels} onChange={(event) => setLabels(event.target.checked)} disabled={progress !== null} /> Nomi
        </label>
      </div>

      <div className="geno-export-preview" data-wide={mode === 'side'}>
        <canvas ref={canvasRef} width={width} height={height} role="img" aria-label="Anteprima del confronto" />
      </div>

      {mode === 'side' && <p className="geno-export-hint geno-compare-scroll">Scorri l’immagine di lato per vedere tutte le fasi.</p>}

      {mode === 'motion' && (
        <>
          <div className="geno-timeline">
            <button
              type="button"
              className="btn-scandi"
              disabled={progress !== null}
              onClick={() => {
                if (time >= TIMELINE_DURATION) setTime(0);
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? 'Pausa' : 'Riproduci'}
            </button>
            <input
              type="range"
              min="0"
              max={TIMELINE_DURATION}
              value={time}
              aria-label="Posizione nell’animazione"
              disabled={progress !== null}
              onChange={(event) => {
                setPlaying(false);
                setTime(Number(event.target.value));
              }}
            />
          </div>
          <p className="geno-export-hint">Le corrispondenze usano lo stesso identificativo o un nome univoco. L’animazione mostra i pezzi; i fili sono visibili nel confronto affiancato.</p>
        </>
      )}

      <div className="geno-export-footer">
        {progress !== null ? (
          <>
            <span role="status">Preparazione GIF · {Math.round(progress * 100)}%</span>
            <button type="button" className="btn-scandi" onClick={() => { jobRef.current?.abort(); setProgress(null); }}>Annulla</button>
          </>
        ) : (
          <button type="button" className="btn-scandi btn-scandi-primary" disabled={!exportApi || Boolean(error && !engineRef.current)} onClick={download}>
            <Download size={16} /> {mode === 'motion' ? 'Scarica animazione GIF' : 'Scarica confronto PNG'}
          </button>
        )}
      </div>
      {error && <p className="geno-export-error" role="alert">{error}</p>}
    </section>
  );
}
