import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PIECE_SHAPES, PIECE_SIZES, PIECE_COLORS } from '../constants';
import PieceAppearanceFields from './PieceAppearanceFields';

const PRESETS = [
  { name: 'Io (Uomo)', role: 'Protagonista', shape: 'box', size: 'medium', color: 'ash' },
  { name: 'Io (Donna)', role: 'Protagonista', shape: 'cylinder', size: 'medium', color: 'sage' },
  { name: 'Padre', role: 'Genitore', shape: 'box', size: 'tall', color: 'walnut' },
  { name: 'Madre', role: 'Genitrice', shape: 'cylinder', size: 'tall', color: 'ochre' },
  { name: 'Figlio/a', role: 'Bambino/a', shape: 'cube', size: 'short', color: 'terracotta' },
  { name: 'Nonno/a', role: 'I Generazione', shape: 'sphere', size: 'tall', color: 'chalk' },
  { name: 'Neonato / Evento', role: 'Nodo familiare', shape: 'token', size: 'short', color: 'peach' }
];

const DEFAULT_PIECE = { name: '', role: '', shape: 'box', size: 'medium', color: 'ash' };

export default function PieceDrawer({ onAddPiece, queuePreview, isDark, isOpen, onOpenChange }) {
  const [draft, setDraft] = useState(DEFAULT_PIECE);
  const previewRef = useRef(null);
  const openButtonRef = useRef(null);
  const headingRef = useRef(null);
  const wasOpen = useRef(false);
  const { shape, size, color } = draft;

  useEffect(() => {
    if (!isOpen || !queuePreview || !previewRef.current) return;
    return queuePreview({ shape, size, color }, previewRef.current);
  }, [isOpen, queuePreview, shape, size, color, isDark]);

  useLayoutEffect(() => {
    if (isOpen) headingRef.current?.focus({ preventScroll: true });
    else if (wasOpen.current) openButtonRef.current?.focus({ preventScroll: true });
    wasOpen.current = isOpen;
  }, [isOpen]);

  const close = () => onOpenChange(false);

  const updateDraft = (change) => setDraft((piece) => ({ ...piece, ...change }));

  const handleCreate = (event) => {
    event.preventDefault();
    onAddPiece({ ...draft, name: draft.name.trim() || 'Nuovo membro', rotationY: 0, notes: '' });
    setDraft(DEFAULT_PIECE);
    close();
  };

  const shapeName = PIECE_SHAPES.find((item) => item.id === shape).shortName;
  const sizeName = PIECE_SIZES.find((item) => item.id === size).label;
  const colorName = PIECE_COLORS.find((item) => item.id === color).name;

  return (
    <section
      className="geno-kit"
      aria-label="Kit dei pezzi"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={openButtonRef}
        type="button"
        className="btn-scandi btn-scandi-primary geno-kit-toggle"
        onClick={() => onOpenChange(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="geno-kit-options"
        hidden={isOpen}
      >
        <Plus size={17} aria-hidden="true" /> Aggiungi pezzo
      </button>
      {isOpen && (
        <form id="geno-kit-options" className="geno-composer" onSubmit={handleCreate}>
          <div className="geno-composer-heading">
            <h2 ref={headingRef} tabIndex={-1}>Componi il pezzo</h2>
            <button type="button" className="btn-scandi btn-scandi-icon" onClick={close} aria-label="Chiudi composizione">
              <X size={17} aria-hidden="true" />
            </button>
          </div>
          <figure className="geno-preview">
            <canvas ref={previewRef} width="320" height="230" aria-hidden="true" />
            <figcaption aria-live="polite">{shapeName} · {sizeName.toLowerCase()} · {colorName}</figcaption>
          </figure>
          <div className="geno-composer-fields">
            <div className="geno-composer-text">
              <label>
                <span>Nome <small>(facoltativo)</small></span>
                <input
                  type="text"
                  className="scandi-input"
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  placeholder="es. Sara"
                />
              </label>
              <label>
                <span>Modello di partenza</span>
                <select
                  className="scandi-input"
                  value=""
                  onChange={(event) => setDraft(PRESETS[Number(event.target.value)])}
                >
                  <option value="" disabled>Scegli un modello</option>
                  {PRESETS.map((preset, index) => <option key={preset.name} value={index}>{preset.name}</option>)}
                </select>
              </label>
            </div>

            <PieceAppearanceFields piece={draft} onChange={updateDraft} />
          </div>

          <button type="submit" className="btn-scandi btn-scandi-primary geno-add-to-tray">
            <Plus size={17} aria-hidden="true" /> Aggiungi al piano
          </button>
        </form>
      )}
    </section>
  );
}
