import React from 'react';
import { PIECE_SHAPES, PIECE_SIZES, PIECE_COLORS } from '../constants';
import ShapeIcon from './ShapeIcon';

export default function PieceAppearanceFields({ piece, onChange }) {
  const colorName = PIECE_COLORS.find((item) => item.id === piece.color)?.name;
  return (
    <div className="geno-appearance-fields">
      <fieldset>
        <legend>Forma</legend>
        <div className="geno-shape-options">
          {PIECE_SHAPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="btn-scandi"
              aria-pressed={piece.shape === item.id}
              onClick={() => onChange({ shape: item.id })}
            >
              <ShapeIcon shapeId={item.id} /> {item.shortName}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="geno-composer-appearance">
        <fieldset>
          <legend>Altezza</legend>
          <div className="geno-size-options">
            {[...PIECE_SIZES].reverse().map((item) => (
              <button
                key={item.id}
                type="button"
                className="btn-scandi"
                aria-pressed={piece.size === item.id}
                onClick={() => onChange({ size: item.id })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Colore {colorName && <small>· {colorName}</small>}</legend>
          <div className="geno-color-options">
            {PIECE_COLORS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.name}
                title={item.name}
                aria-pressed={piece.color === item.id}
                onClick={() => onChange({ color: item.id })}
                style={{ '--swatch': item.hex }}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
