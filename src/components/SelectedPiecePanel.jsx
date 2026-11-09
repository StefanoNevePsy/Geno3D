import React, { useEffect, useRef } from 'react';
import { Copy, Link, Move, RotateCcw, RotateCw, Trash2, X } from 'lucide-react';
import { LINK_TYPES } from '../constants';
import { findFreePositionOnTray } from '../utils/physicsUtils';
import PieceAppearanceFields from './PieceAppearanceFields';
import PiecePosture from './PiecePosture';

const COMMON_NAMES = ['Io', 'Padre', 'Madre', 'Partner', 'Figlio/a', 'Fratello', 'Sorella', 'Nonna', 'Nonno', 'Ex-partner'];
const toDegrees = (radians) => Math.round(((radians || 0) * 180) / Math.PI);
const toRadians = (degrees) => Math.round((Number(degrees) * Math.PI / 180) * 100) / 100;

export default function SelectedPiecePanel({
  piece,
  pieces,
  links,
  onUpdatePiece,
  onDeselect,
  onStartPlacement,
  onRotate,
  onOpenConnectModal,
  onDeleteLink,
  onDuplicate,
  onDelete
}) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);

  const update = (change) => onUpdatePiece(piece.id, change);
  const others = pieces.filter((other) => other.id !== piece.id);
  const pieceLinks = links.filter((link) => link.sourceId === piece.id || link.targetId === piece.id);
  const lookToward = (id) => {
    const target = id === 'center' ? { x: 0, z: 0 } : others.find((other) => other.id === id);
    if (!target) return;
    const angle = Math.atan2(target.x - piece.x, target.z - piece.z);
    update({ rotationY: Math.round(angle * 100) / 100 });
  };

  return (
    <aside aria-label="Proprietà membro selezionato" className="geno-properties">
      <div className="geno-properties-heading">
        <div>
          <h2 ref={headingRef} tabIndex={-1}>{piece.name || 'Senza nome'}</h2>
          <p>Trascina il pezzo o scegli dove metterlo.</p>
        </div>
        <button type="button" onClick={onDeselect} className="btn-scandi btn-scandi-icon" aria-label="Chiudi modifica">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <button type="button" className="btn-scandi geno-place-button" onClick={onStartPlacement}>
        <Move size={16} aria-hidden="true" /> Scegli dove spostarlo
      </button>

      <label className="geno-field">
        <span>Nome</span>
        <input
          className="scandi-input"
          value={piece.name || ''}
          onChange={(event) => update({ name: event.target.value })}
          list="geno-member-names"
        />
      </label>
      <datalist id="geno-member-names">
        {COMMON_NAMES.map((name) => <option key={name} value={name} />)}
      </datalist>

      <fieldset className="geno-gaze-tools">
        <legend>Sguardo</legend>
        <div className="geno-rotate-options">
          <button type="button" className="btn-scandi" onClick={() => onRotate(-Math.PI / 4)}>
            <RotateCcw size={15} aria-hidden="true" /> A sinistra
          </button>
          <button type="button" className="btn-scandi" onClick={() => onRotate(Math.PI / 4)}>
            <RotateCw size={15} aria-hidden="true" /> A destra
          </button>
        </div>
        <select className="scandi-input" aria-label="Guarda verso" value="" onChange={(event) => lookToward(event.target.value)}>
          <option value="" disabled>Guarda verso…</option>
          <option value="center">Il centro del piano</option>
          {others.map((other) => <option key={other.id} value={other.id}>{other.name || 'Senza nome'}</option>)}
        </select>
      </fieldset>

      <PiecePosture piece={piece} onChange={update} />

      {(piece.y || 0) > 0.05 && (
        <button
          type="button"
          className="btn-scandi"
          onClick={() => update(findFreePositionOnTray(pieces, piece.shape, piece.size, piece.x + 1.1, piece.z + 1.1, piece.id))}
        >
          Riporta sul piano
        </button>
      )}

      <details>
        <summary>Aspetto</summary>
        <PieceAppearanceFields piece={piece} onChange={update} />
      </details>

      <details>
        <summary>Ruolo e note</summary>
        <div className="geno-property-group">
          <label className="geno-field">
            <span>Ruolo</span>
            <input
              className="scandi-input"
              value={piece.role || ''}
              placeholder="es. sorella"
              onChange={(event) => update({ role: event.target.value })}
            />
          </label>
          <label className="geno-field">
            <span>Note</span>
            <textarea
              className="scandi-input"
              rows={3}
              value={piece.notes || ''}
              onChange={(event) => update({ notes: event.target.value })}
            />
          </label>
        </div>
      </details>

      <details>
        <summary>Regolazioni precise</summary>
        <div className="geno-property-group">
          {[
            { key: 'rotationY', label: 'Direzione dello sguardo', min: 0, max: 360 },
            { key: 'rotationX', label: 'Inclinazione avanti e indietro', min: -180, max: 180 },
            { key: 'rotationZ', label: 'Inclinazione laterale', min: -180, max: 180 }
          ].map(({ key, label, min, max }) => {
            const degrees = toDegrees(piece[key]);
            const value = min === 0 ? ((degrees % 360) + 360) % 360 : degrees;
            return (
              <label key={key} className="geno-field">
                <span>{label} <small>{value}°</small></span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(event) => update({ [key]: toRadians(event.target.value) })}
                />
              </label>
            );
          })}
        </div>
      </details>

      <details>
        <summary>Legami {pieceLinks.length > 0 && <small>· {pieceLinks.length}</small>}</summary>
        <div className="geno-property-group">
          {pieceLinks.map((link) => {
            const otherId = link.sourceId === piece.id ? link.targetId : link.sourceId;
            const otherName = others.find((other) => other.id === otherId)?.name || 'Membro';
            const type = LINK_TYPES.find((item) => item.id === link.type) || LINK_TYPES[0];
            return (
              <div className="geno-piece-link" key={link.id}>
                <span><strong>{otherName}</strong> <small>{type.shortLabel}</small></span>
                <button type="button" className="btn-scandi btn-scandi-icon" aria-label={`Rimuovi il legame con ${otherName}`} onClick={() => onDeleteLink(link.id)}>
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            );
          })}
          <button type="button" className="btn-scandi" onClick={onOpenConnectModal}>
            <Link size={15} aria-hidden="true" /> Aggiungi un legame
          </button>
        </div>
      </details>

      <div className="geno-property-actions">
        <button type="button" className="btn-scandi" onClick={() => onDuplicate(piece.id)}>
          <Copy size={15} aria-hidden="true" /> Duplica
        </button>
        <button type="button" className="btn-scandi btn-scandi-danger" onClick={() => onDelete(piece.id)}>
          <Trash2 size={15} aria-hidden="true" /> Elimina
        </button>
      </div>
    </aside>
  );
}
