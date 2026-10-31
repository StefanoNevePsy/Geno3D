import React, { useState } from 'react';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { PIECE_SHAPES, PIECE_SIZES, PIECE_COLORS } from '../constants';

function ShapeSvgIcon({ shapeId }) {
  switch (shapeId) {
    case 'cylinder':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v14c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
        </svg>
      );
    case 'cube':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
        </svg>
      );
    case 'wedge':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12,3 21,20 3,20" />
        </svg>
      );
    case 'sphere':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="10" r="6.5" />
          <path d="M7 20h10M9 17h6" />
        </svg>
      );
    case 'token':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <ellipse cx="12" cy="12" rx="9" ry="4.5" />
          <path d="M3 12v3c0 2.5 4 4.5 9 4.5s9-2 9-4.5v-3" />
        </svg>
      );
    case 'box':
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="2.5" width="12" height="19" rx="2" />
        </svg>
      );
  }
}

export default function PieceDrawer({ onAddPiece }) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedShape, setSelectedShape] = useState('box');
  const [selectedSize, setSelectedSize] = useState('medium');
  const [selectedColor, setSelectedColor] = useState('ash');
  const [pieceName, setPieceName] = useState('');

  const handleCreate = (e) => {
    if (e) e.preventDefault();
    onAddPiece({
      name: pieceName.trim() || 'Nuovo Membro',
      role: '',
      shape: selectedShape,
      size: selectedSize,
      color: selectedColor,
      rotationY: 0,
      notes: ''
    });
    setPieceName('');
  };

  const handleQuickAdd = (preset) => {
    onAddPiece({
      name: preset.name,
      role: preset.role,
      shape: preset.shape,
      size: preset.size,
      color: preset.color,
      rotationY: 0,
      notes: ''
    });
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '95vw'
      }}
    >
      <div
        className="scandi-panel scandi-panel-floating"
        style={{
          padding: isOpen ? '14px 18px' : '9px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '11px',
          width: isOpen ? '790px' : 'auto',
          maxWidth: '95vw',
          transition: 'all 0.24s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header vassoio */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            gap: '12px'
          }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--accent-pine)'
              }}
            >
              Kit dei Legnetti (Vassoio Geno 3D)
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {isOpen ? '— Scegli forma, legno e altezza oppure usa i modelli rapidi' : '— Clicca per aprire'}
            </span>
          </div>

          <button
            type="button"
            className="btn-scandi btn-scandi-icon"
            style={{ width: '26px', height: '26px', border: 'none', background: 'transparent' }}
            aria-label={isOpen ? 'Riduci vassoio pezzi' : 'Espandi vassoio pezzi'}
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {isOpen && (
          <>
            {/* Template rapidi sistemici */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                Inserimento rapido:
              </span>
              {[
                { name: 'Io (Uomo)', role: 'Protagonista', shape: 'box', size: 'medium', color: 'ash' },
                { name: 'Io (Donna)', role: 'Protagonista', shape: 'cylinder', size: 'medium', color: 'sage' },
                { name: 'Padre', role: 'Genitore', shape: 'box', size: 'tall', color: 'walnut' },
                { name: 'Madre', role: 'Genitrice', shape: 'cylinder', size: 'tall', color: 'ochre' },
                { name: 'Figlio/a', role: 'Bambino/a', shape: 'cube', size: 'short', color: 'terracotta' },
                { name: 'Nonno/a', role: 'I Generazione', shape: 'sphere', size: 'tall', color: 'chalk' },
                { name: 'Neonato / Evento', role: 'Nodo familiare', shape: 'token', size: 'short', color: 'peach' }
              ].map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickAdd(p)}
                  className="btn-scandi"
                  style={{
                    fontSize: '11px',
                    padding: '4px 9px',
                    borderRadius: '10px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={11} /> {p.name}
                </button>
              ))}
            </div>

            {/* Configurazione personalizzata pezzo */}
            <form
              onSubmit={handleCreate}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.15fr 1.65fr 1.45fr 0.9fr auto',
                gap: '12px',
                alignItems: 'end',
                borderTop: '1px solid var(--border-light)',
                paddingTop: '10px'
              }}
            >
              {/* Nome opzionale */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Nome (opzionale)
                </label>
                <input
                  type="text"
                  className="scandi-input"
                  value={pieceName}
                  onChange={(e) => setPieceName(e.target.value)}
                  placeholder="es. Fratello, Sara..."
                  style={{ height: '32px', padding: '4px 9px', fontSize: '12px' }}
                />
              </div>

              {/* Tutte le 6 Forme con icona SVG */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Forma ({PIECE_SHAPES.find((s) => s.id === selectedShape)?.shortName})
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
                  {PIECE_SHAPES.map((s) => {
                    const isSel = selectedShape === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedShape(s.id)}
                        style={{
                          height: '32px',
                          borderRadius: '6px',
                          border: `1px solid ${isSel ? 'var(--accent-pine)' : 'var(--border-light)'}`,
                          background: isSel ? 'var(--accent-pine-light)' : '#FFFFFF',
                          color: isSel ? 'var(--accent-pine)' : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title={`${s.name} — ${s.desc}`}
                      >
                        <ShapeSvgIcon shapeId={s.id} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tutti i 10 Colori swatch */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Essenza / Colore
                </span>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', height: '32px' }}>
                  {PIECE_COLORS.map((c) => {
                    const isSel = selectedColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedColor(c.id)}
                        data-tooltip={c.name}
                        aria-label={c.name}
                        style={{
                          width: '21px',
                          height: '21px',
                          borderRadius: '50%',
                          backgroundColor: c.hex,
                          border: isSel ? '2.5px solid var(--accent-pine)' : `1px solid ${c.border}`,
                          cursor: 'pointer',
                          transform: isSel ? 'scale(1.18)' : 'scale(1)',
                          transition: 'transform 0.15s ease',
                          flexShrink: 0
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Taglia */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Altezza
                </span>
                <div style={{ display: 'flex', gap: '4px', height: '32px' }}>
                  {PIECE_SIZES.map((s) => {
                    const isSel = selectedSize === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSize(s.id)}
                        style={{
                          padding: '0 7px',
                          borderRadius: '6px',
                          border: `1px solid ${isSel ? 'var(--accent-pine)' : 'var(--border-light)'}`,
                          background: isSel ? 'var(--accent-pine-light)' : '#FFFFFF',
                          color: isSel ? 'var(--accent-pine)' : 'var(--text-muted)',
                          fontSize: '11px',
                          fontWeight: isSel ? 600 : 500,
                          cursor: 'pointer',
                          flex: 1
                        }}
                        title={s.desc}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottone Aggiungi */}
              <button
                type="submit"
                className="btn-scandi btn-scandi-primary"
                style={{ padding: '0 14px', height: '32px' }}
              >
                <Plus size={14} /> Posiziona
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
