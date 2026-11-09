import React from 'react';
import { ChevronDown } from 'lucide-react';

const POSTURES = [
  { label: 'In piedi', x: 0, z: 0 },
  { label: 'Inclina avanti', x: 0.44, z: 0 },
  { label: 'Inclina indietro', x: -0.44, z: 0 },
  { label: 'Sdraiato', x: Math.PI / 2, z: 0 },
  { label: 'Sul fianco', x: 0, z: Math.PI / 2 },
  { label: 'Capovolto', x: Math.PI, z: 0 }
];

function applyPosture(posture, onChange) {
  onChange({ rotationX: posture.x, rotationZ: posture.z });
}

export default function PiecePosture({ piece, onChange, compact = false }) {
  const selected = POSTURES.findIndex(({ x, z }) =>
    Math.abs(x - (piece.rotationX || 0)) < 0.01 && Math.abs(z - (piece.rotationZ || 0)) < 0.01
  );

  if (compact) {
    return (
      <label className="btn-scandi geno-posture-menu">
        Postura <ChevronDown size={14} aria-hidden="true" />
        <select
          aria-label="Postura rapida"
          value={selected}
          onChange={(event) => applyPosture(POSTURES[Number(event.target.value)], onChange)}
        >
          <option value={-1} disabled>Personalizzata</option>
          {POSTURES.map(({ label }, index) => <option key={label} value={index}>{label}</option>)}
        </select>
      </label>
    );
  }

  return (
    <fieldset>
      <legend>Postura</legend>
      <div className="geno-posture-grid">
        {POSTURES.map((posture, index) => (
          <button
            key={posture.label}
            type="button"
            className="btn-scandi"
            aria-pressed={selected === index}
            onClick={() => applyPosture(posture, onChange)}
          >
            {posture.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
