import React from 'react';
import {
  RotateCcw,
  RotateCw,
  Repeat,
  Link,
  Copy,
  Trash2,
  X,
  Target,
  ArrowDown,
  Eye,
  RefreshCw
} from 'lucide-react';
import { PIECE_SHAPES, PIECE_SIZES, PIECE_COLORS, LINK_TYPES } from '../constants';
import { getPieceDimensions, findFreePositionOnTray } from '../utils/physicsUtils';

const COMMON_ROLES = [
  'Io',
  'Padre',
  'Madre',
  'Partner',
  'Figlio/a',
  'Fratello',
  'Sorella',
  'Nonna',
  'Nonno',
  'Ex-partner'
];

const POSTURE_PRESETS = [
  { id: 'upright', label: 'In piedi (0°)', rx: 0, rz: 0, title: 'Posizione eretta verticale (Tasto 0)' },
  { id: 'lean-fwd', label: 'Proteso (+25°)', rx: 0.44, rz: 0, title: 'Inclinato in avanti nella direzione dello sguardo' },
  { id: 'lean-back', label: 'Ritratto (-25°)', rx: -0.44, rz: 0, title: 'Inclinato all\'indietro' },
  { id: 'laid-fwd', label: 'Sdraiato (90°)', rx: Math.PI / 2, rz: 0, title: 'Abbattuto / steso orizzontalmente in avanti' },
  { id: 'laid-side', label: 'Sul fianco (90°)', rx: 0, rz: Math.PI / 2, title: 'Coricato orizzontalmente sul fianco' },
  { id: 'upside-down', label: 'Capovolto (180°)', rx: Math.PI, rz: 0, title: 'Ribaltato completamente a testa in giù (Tasto X)' }
];

export default function SelectedPiecePanel({
  piece,
  pieces = [],
  links = [],
  onUpdatePiece,
  onDeselect,
  onOpenConnectModal,
  onDeleteLink,
  onDuplicate,
  onDelete
}) {
  if (!piece) return null;

  const rotateBy = (deltaRad) => {
    const current = piece.rotationY || 0;
    const next = (current + deltaRad) % (Math.PI * 2);
    onUpdatePiece(piece.id, { rotationY: Math.round(next * 100) / 100 });
  };

  const lookAtCenter = () => {
    const angle = Math.atan2(-piece.x, -piece.z);
    onUpdatePiece(piece.id, { rotationY: Math.round(angle * 100) / 100 });
  };

  const lookAtPiece = (targetPiece) => {
    if (!targetPiece) return;
    const angle = Math.atan2(targetPiece.x - piece.x, targetPiece.z - piece.z);
    onUpdatePiece(piece.id, { rotationY: Math.round(angle * 100) / 100 });
  };

  const currentDegreesY = Math.round((((piece.rotationY || 0) * 180) / Math.PI + 360) % 360);
  const currentDegreesX = Math.round(((piece.rotationX || 0) * 180) / Math.PI);
  const currentDegreesZ = Math.round(((piece.rotationZ || 0) * 180) / Math.PI);

  // Trova se è impilato su un altro pezzo
  const isStacked = (piece.y || 0) > 0.05;
  let supportingPieceName = null;
  if (isStacked) {
    for (const other of pieces) {
      if (other.id === piece.id) continue;
      const otherDims = getPieceDimensions(other);
      const otherTopY = (other.y || 0) + otherDims.height;
      const dx = piece.x - other.x;
      const dz = piece.z - other.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= otherDims.topRadius * 1.2 && Math.abs((piece.y || 0) - otherTopY) <= 0.45) {
        supportingPieceName = other.name;
        break;
      }
    }
  }

  // Riporta a terra sul tavolo in una posizione libera adiacente
  const handleMoveToGround = () => {
    const freePos = findFreePositionOnTray(
      pieces,
      piece.shape,
      piece.size,
      piece.x + 1.1,
      piece.z + 1.1,
      piece.id
    );
    onUpdatePiece(piece.id, freePos);
  };

  const otherPieces = pieces.filter((p) => p.id !== piece.id);
  const pieceLinks = links.filter((l) => l.sourceId === piece.id || l.targetId === piece.id);

  return (
    <aside
      aria-label="Proprietà membro selezionato"
      className="scandi-panel scandi-panel-floating"
      style={{
        position: 'absolute',
        top: '68px',
        right: '18px',
        width: '336px',
        maxHeight: 'calc(100vh - 88px)',
        overflowY: 'auto',
        padding: '16px 18px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
    >
      {/* Header pannello */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '10px'
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: 0
            }}
          >
            {piece.name || 'Senza nome'}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Usa <strong>WASD</strong> o <strong>Frecce</strong> per muovere • <strong>Q/E</strong> ruota • <strong>R/F</strong> inclina
          </span>
        </div>
        <button
          onClick={onDeselect}
          className="btn-scandi btn-scandi-icon"
          data-tooltip="Chiudi (Esc)"
          aria-label="Chiudi pannello"
          style={{ width: '28px', height: '28px', flexShrink: 0 }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Nome e Ruolo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
          Nome / Identificativo
        </label>
        <input
          type="text"
          className="scandi-input"
          value={piece.name}
          onChange={(e) => onUpdatePiece(piece.id, { name: e.target.value })}
          placeholder="es. Io, Madre, Marco..."
        />

        {/* Chip suggeriti rapidi */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {COMMON_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() =>
                onUpdatePiece(piece.id, {
                  name: role,
                  role: role === 'Io' ? 'Protagonista' : piece.role || `Ruolo: ${role}`
                })
              }
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: piece.name === role ? 'var(--accent-pine-light)' : '#FFFFFF',
                color: piece.name === role ? 'var(--accent-pine)' : 'var(--text-muted)',
                fontWeight: piece.name === role ? 600 : 500,
                cursor: 'pointer'
              }}
            >
              {role}
            </button>
          ))}
        </div>

        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '4px' }}>
          Ruolo / Descrizione sintetica
        </label>
        <input
          type="text"
          className="scandi-input"
          value={piece.role || ''}
          onChange={(e) => onUpdatePiece(piece.id, { role: e.target.value })}
          placeholder="es. Figura protettiva, periferico..."
        />
      </div>

      {/* Direzione dello Sguardo (Asse Y Verticale) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
            Direzione Sguardo (Asse Y • Q/E)
          </label>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--accent-pine)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {currentDegreesY}°
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="360"
          value={currentDegreesY}
          onChange={(e) => {
            const rad = (parseInt(e.target.value, 10) * Math.PI) / 180;
            onUpdatePiece(piece.id, { rotationY: Math.round(rad * 100) / 100 });
          }}
        />

        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            type="button"
            onClick={() => rotateBy(-Math.PI / 4)}
            className="btn-scandi"
            style={{ flex: 1, padding: '5px' }}
            title="Ruota sguardo a sinistra di 45° (Tasto Q)"
          >
            <RotateCcw size={13} /> -45°
          </button>
          <button
            type="button"
            onClick={() => rotateBy(Math.PI / 4)}
            className="btn-scandi"
            style={{ flex: 1, padding: '5px' }}
            title="Ruota sguardo a destra di 45° (Tasto E)"
          >
            <RotateCw size={13} /> +45°
          </button>
          <button
            type="button"
            onClick={() => rotateBy(Math.PI)}
            className="btn-scandi"
            style={{ flex: 1, padding: '5px' }}
            title="Volta le spalle (180°)"
          >
            <Repeat size={13} /> 180°
          </button>
          <button
            type="button"
            onClick={lookAtCenter}
            className="btn-scandi"
            style={{ padding: '5px 8px' }}
            title="Guarda verso il centro del tavolo"
          >
            <Target size={13} />
          </button>
        </div>

        {/* Orienta sguardo direttamente verso un altro membro */}
        {otherPieces.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Eye size={12} /> Guarda verso (o Shift+Clic):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {otherPieces.map((other) => (
                <button
                  key={other.id}
                  type="button"
                  onClick={() => lookAtPiece(other)}
                  className="btn-scandi"
                  style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '8px' }}
                  title={`Orienta lo sguardo di ${piece.name} verso ${other.name}`}
                >
                  → {other.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Postura, Inclinazione & Ribaltamento 3D (Assi X e Z) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: '#FAF8F4',
          padding: '10px 12px',
          borderRadius: '10px',
          border: '1px solid var(--border-light)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
            Postura, Inclinazione &amp; Ribaltamento
          </label>
          {(currentDegreesX !== 0 || currentDegreesZ !== 0) && (
            <button
              type="button"
              onClick={() => onUpdatePiece(piece.id, { rotationX: 0, rotationZ: 0 })}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--accent-pine)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Rimetti il pezzo dritto in piedi (Tasto 0)"
            >
              <RefreshCw size={11} /> Raddrizza
            </button>
          )}
        </div>

        {/* Preset rapidi postura */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
          {POSTURE_PRESETS.map((preset) => {
            const isMatch =
              Math.abs((piece.rotationX || 0) - preset.rx) < 0.08 &&
              Math.abs((piece.rotationZ || 0) - preset.rz) < 0.08;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onUpdatePiece(piece.id, {
                    rotationX: Math.round(preset.rx * 100) / 100,
                    rotationZ: Math.round(preset.rz * 100) / 100
                  })
                }
                style={{
                  padding: '5px 4px',
                  borderRadius: '6px',
                  border: `1px solid ${isMatch ? 'var(--accent-pine)' : 'var(--border-light)'}`,
                  background: isMatch ? 'var(--accent-pine-light)' : '#FFFFFF',
                  color: isMatch ? 'var(--accent-pine)' : 'var(--text-main)',
                  fontSize: '10.5px',
                  fontWeight: isMatch ? 600 : 500,
                  cursor: 'pointer'
                }}
                title={preset.title}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Slider Beccheggio X (Avanti / Indietro / Capovolto) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Avanti / Indietro (Asse X • R/F)</span>
            <span style={{ fontWeight: 600, color: 'var(--accent-pine)', fontVariantNumeric: 'tabular-nums' }}>
              {currentDegreesX}°
            </span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            value={currentDegreesX}
            onChange={(e) => {
              const rad = (parseInt(e.target.value, 10) * Math.PI) / 180;
              onUpdatePiece(piece.id, { rotationX: Math.round(rad * 100) / 100 });
            }}
          />
        </div>

        {/* Slider Rollio Z (Inclinazione Laterale) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Fianco Sinistro / Destro (Asse Z • Z/C)</span>
            <span style={{ fontWeight: 600, color: 'var(--accent-pine)', fontVariantNumeric: 'tabular-nums' }}>
              {currentDegreesZ}°
            </span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            value={currentDegreesZ}
            onChange={(e) => {
              const rad = (parseInt(e.target.value, 10) * Math.PI) / 180;
              onUpdatePiece(piece.id, { rotationZ: Math.round(rad * 100) / 100 });
            }}
          />
        </div>
      </div>

      {/* Forma e Dimensione */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
          Forma &amp; Generazione
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
          {PIECE_SHAPES.map((shape) => (
            <button
              key={shape.id}
              type="button"
              onClick={() => onUpdatePiece(piece.id, { shape: shape.id })}
              style={{
                padding: '6px 4px',
                borderRadius: '7px',
                border: `1px solid ${
                  piece.shape === shape.id ? 'var(--accent-pine)' : 'var(--border-light)'
                }`,
                background: piece.shape === shape.id ? 'var(--accent-pine-light)' : '#FFFFFF',
                color: piece.shape === shape.id ? 'var(--accent-pine)' : 'var(--text-main)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: piece.shape === shape.id ? 600 : 500
              }}
              title={shape.desc}
            >
              {shape.shortName}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '5px' }}>
          {PIECE_SIZES.map((size) => (
            <button
              key={size.id}
              type="button"
              onClick={() => onUpdatePiece(piece.id, { size: size.id })}
              style={{
                flex: 1,
                padding: '5px',
                borderRadius: '7px',
                border: `1px solid ${
                  piece.size === size.id ? 'var(--accent-pine)' : 'var(--border-light)'
                }`,
                background: piece.size === size.id ? 'var(--accent-pine-light)' : '#FFFFFF',
                color: piece.size === size.id ? 'var(--accent-pine)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: piece.size === size.id ? 600 : 500
              }}
              title={size.desc}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      {/* Colore del legno / vernice nordica */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
          Essenza Legno &amp; Colore
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '7px' }}>
          {PIECE_COLORS.map((c) => {
            const isCurr = piece.color === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onUpdatePiece(piece.id, { color: c.id })}
                data-tooltip={c.name}
                aria-label={c.name}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: '50%',
                  backgroundColor: c.hex,
                  border: isCurr ? '3px solid var(--accent-pine)' : `1px solid ${c.border}`,
                  boxShadow: isCurr ? '0 0 0 2px #FFFFFF inset' : 'none',
                  cursor: 'pointer',
                  transform: isCurr ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.15s ease'
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Note cliniche */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
          Osservazioni e Vissuti Clinici
        </label>
        <textarea
          className="scandi-input"
          rows={2}
          value={piece.notes || ''}
          onChange={(e) => onUpdatePiece(piece.id, { notes: e.target.value })}
          placeholder="Annota vissuti, risonanze emotive o frasi significative..."
          style={{ resize: 'vertical', minHeight: '48px', lineHeight: 1.4 }}
        />
      </div>

      {/* Stato di Appoggio e Aderenza Fisica */}
      {isStacked && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: '#FAF8F4',
            padding: '9px 11px',
            borderRadius: '8px',
            border: '1px solid var(--border-light)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 500 }}>
              Sopra: {supportingPieceName || 'Altro pezzo'}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--accent-pine)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              Quota {(piece.y || 0).toFixed(1)}m
            </span>
          </div>
          <button
            type="button"
            onClick={handleMoveToGround}
            className="btn-scandi"
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            <ArrowDown size={12} /> Riporta sul piano del tavolo
          </button>
        </div>
      )}

      {/* Legami attivi di questo pezzo */}
      {pieceLinks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
            Fili collegati ({pieceLinks.length})
          </span>
          {pieceLinks.map((lk) => {
            const otherId = lk.sourceId === piece.id ? lk.targetId : lk.sourceId;
            const otherName = pieces.find((p) => p.id === otherId)?.name || 'Membro';
            const lDef = LINK_TYPES.find((t) => t.id === lk.type) || LINK_TYPES[0];
            return (
              <div
                key={lk.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  background: '#FAF8F4',
                  border: '1px solid var(--border-light)',
                  fontSize: '11px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: lDef.color,
                      display: 'inline-block'
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{otherName}</span>
                  <span style={{ color: 'var(--text-muted)' }}>({lDef.shortLabel})</span>
                </div>
                {onDeleteLink && (
                  <button
                    type="button"
                    onClick={() => onDeleteLink(lk.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#B84545',
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                    title="Rimuovi questo filo"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Azioni del pezzo */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '12px'
        }}
      >
        <button
          type="button"
          onClick={onOpenConnectModal}
          className="btn-scandi btn-scandi-primary"
          style={{ width: '100%' }}
        >
          <Link size={14} /> Collega con un filo relazionale
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onDuplicate(piece.id)}
            className="btn-scandi"
            style={{ flex: 1 }}
            title="Duplica membro (Ctrl+D)"
          >
            <Copy size={14} /> Duplica
          </button>
          <button
            type="button"
            onClick={() => onDelete(piece.id)}
            className="btn-scandi btn-scandi-danger"
            style={{ flex: 1 }}
            title="Elimina membro (Canc)"
          >
            <Trash2 size={14} /> Elimina
          </button>
        </div>
      </div>
    </aside>
  );
}
