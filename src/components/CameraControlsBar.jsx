import React from 'react';
import { Compass, Layers, Maximize, Tag, Move, Box, ArrowRightLeft } from 'lucide-react';

export default function CameraControlsBar({
  onSelectView,
  showLabels,
  onToggleLabels
}) {
  return (
    <nav
      aria-label="Controlli viste telecamera"
      className="scandi-panel"
      style={{
        position: 'absolute',
        top: '68px',
        left: '18px',
        zIndex: 80,
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}
    >
      <button
        onClick={() => onSelectView('perspective')}
        className="btn-scandi"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
        title="Prospettiva tridimensionale da studio"
      >
        <Compass size={14} /> Prospettiva 3D
      </button>

      <button
        onClick={() => onSelectView('isometric')}
        className="btn-scandi"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
        title="Assonometria isometrica diagonale a 45°"
      >
        <Box size={14} /> Isometrica 45°
      </button>

      <button
        onClick={() => onSelectView('top')}
        className="btn-scandi"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
        title="Vista zenitale dall'alto (mappa genogramma 2D)"
      >
        <Layers size={14} /> Pianta Zenitale (2D)
      </button>

      <button
        onClick={() => onSelectView('front')}
        className="btn-scandi"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
        title="Vista frontale all'altezza degli occhi"
      >
        <Move size={14} /> Vista Frontale
      </button>

      <button
        onClick={() => onSelectView('right')}
        className="btn-scandi"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
        title="Vista laterale destra per leggere le profondità"
      >
        <ArrowRightLeft size={14} /> Vista Laterale
      </button>

      <button
        onClick={() => onSelectView('fit')}
        className="btn-scandi"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '12px' }}
        title="Inquadra tutti gli elementi sul vassoio"
      >
        <Maximize size={14} /> Centra Tutto
      </button>

      <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />

      <button
        onClick={onToggleLabels}
        className="btn-scandi"
        style={{
          justifyContent: 'flex-start',
          padding: '6px 10px',
          fontSize: '12px',
          background: showLabels ? 'var(--accent-pine-light)' : '#FFFFFF',
          color: showLabels ? 'var(--accent-pine)' : 'var(--text-main)'
        }}
        title="Attiva/disattiva etichette dei membri nello spazio (Tasto L)"
      >
        <Tag size={14} /> {showLabels ? 'Nascondi Nomi' : 'Mostra Nomi'}
      </button>
    </nav>
  );
}
