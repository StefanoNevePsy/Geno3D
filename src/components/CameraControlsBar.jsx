import React from 'react';
import { Compass, Maximize, Tag } from 'lucide-react';

export default function CameraControlsBar({ onSelectView, showLabels, onToggleLabels }) {
  return (
    <nav aria-label="Viste e inquadratura" className="geno-camera scandi-panel">
      <label className="geno-view-select">
        <Compass size={16} aria-hidden="true" />
        <select
          aria-label="Scegli vista"
          value=""
          onChange={(event) => onSelectView(event.target.value)}
        >
          <option value="" disabled>Viste</option>
          <option value="perspective">Prospettiva 3D</option>
          <option value="isometric">Isometrica 45°</option>
          <option value="top">Pianta dall’alto</option>
          <option value="front">Vista frontale</option>
          <option value="right">Vista laterale</option>
        </select>
      </label>
      <button type="button" onClick={() => onSelectView('fit')} className="btn-scandi" title="Inquadra tutti i membri">
        <Maximize size={15} aria-hidden="true" /> Inquadra
      </button>
      <button
        type="button"
        onClick={onToggleLabels}
        className="btn-scandi"
        aria-pressed={showLabels}
        title="Mostra o nascondi i nomi (L)"
      >
        <Tag size={15} aria-hidden="true" /> Nomi
      </button>
    </nav>
  );
}
