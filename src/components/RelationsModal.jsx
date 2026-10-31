import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { LINK_TYPES } from '../constants';

export default function RelationsModal({
  isOpen,
  onClose,
  pieces,
  links,
  onAddLink,
  onDeleteLink,
  preselectedSourceId
}) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [linkType, setLinkType] = useState('positive');

  // Sincronizza sourceId e targetId quando si apre il modal o cambiano i pezzi/selezione
  useEffect(() => {
    if (!isOpen || pieces.length === 0) return;

    const validPreselected = pieces.find((p) => p.id === preselectedSourceId)?.id;
    const nextSource =
      validPreselected ||
      (pieces.find((p) => p.id === sourceId)?.id) ||
      pieces[0]?.id ||
      '';

    setSourceId(nextSource);

    const currentTargetValid =
      targetId && targetId !== nextSource && pieces.some((p) => p.id === targetId);
    if (!currentTargetValid) {
      const nextTarget = pieces.find((p) => p.id !== nextSource)?.id || '';
      setTargetId(nextTarget);
    }
  }, [isOpen, preselectedSourceId, pieces]);

  const handleSourceChange = (newSourceId) => {
    setSourceId(newSourceId);
    if (targetId === newSourceId) {
      const alt = pieces.find((p) => p.id !== newSourceId)?.id || '';
      setTargetId(alt);
    }
  };

  if (!isOpen) return null;

  const existingLinkBetweenPair = links.find(
    (l) =>
      (l.sourceId === sourceId && l.targetId === targetId) ||
      (l.sourceId === targetId && l.targetId === sourceId)
  );

  const handleCreate = (e) => {
    e.preventDefault();
    if (!sourceId || !targetId || sourceId === targetId) return;

    onAddLink({
      id: existingLinkBetweenPair ? existingLinkBetweenPair.id : `link-${Date.now()}`,
      sourceId,
      targetId,
      type: linkType
    });
  };

  const getPieceName = (id) => {
    const p = pieces.find((item) => item.id === id);
    return p ? p.name : 'Elemento rimosso';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(25, 30, 27, 0.45)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="scandi-panel scandi-panel-floating"
        style={{
          width: '540px',
          maxWidth: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Fili e Legami Relazionali
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Traccia o modifica le connessioni sistemiche tra i membri della famiglia
            </p>
          </div>
          <button onClick={onClose} className="btn-scandi btn-scandi-icon" aria-label="Chiudi">
            <X size={16} />
          </button>
        </div>

        {/* Form nuovo legame */}
        <form
          onSubmit={handleCreate}
          style={{
            background: '#FAF8F4',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Dal membro:
              </label>
              <select
                className="scandi-input"
                value={sourceId}
                onChange={(e) => handleSourceChange(e.target.value)}
              >
                {pieces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.role ? `(${p.role})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Al membro:
              </label>
              <select
                className="scandi-input"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                {pieces
                  .filter((p) => p.id !== sourceId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.role ? `(${p.role})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Qualità del legame sistemico:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              {LINK_TYPES.map((lt) => (
                <label
                  key={lt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${
                      linkType === lt.id ? 'var(--accent-pine)' : 'var(--border-light)'
                    }`,
                    background: linkType === lt.id ? 'var(--accent-pine-light)' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="linkType"
                      checked={linkType === lt.id}
                      onChange={() => setLinkType(lt.id)}
                      style={{ accentColor: 'var(--accent-pine)' }}
                    />
                    <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{lt.label}</span>
                  </div>
                  <div
                    style={{
                      width: '32px',
                      height: lt.style === 'double' ? '6px' : '4px',
                      borderRadius: '2px',
                      backgroundColor: lt.style === 'dashed' ? 'transparent' : lt.color,
                      borderBottom: lt.style === 'dashed' ? `3px dashed ${lt.color}` : 'none'
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn-scandi btn-scandi-primary"
            disabled={!sourceId || !targetId || sourceId === targetId}
            style={{ marginTop: '4px' }}
          >
            <Plus size={15} />
            {existingLinkBetweenPair ? 'Aggiorna Filo Relazionale Esistente' : 'Aggiungi Filo Relazionale'}
          </button>
        </form>

        {/* Lista legami esistenti */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>
            Legami attivi ({links.length})
          </h3>

          {links.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
                background: '#FAF8F4',
                borderRadius: '8px',
                border: '1px solid var(--border-light)'
              }}
            >
              Nessun filo tracciato. Collega due membri per visualizzare alleanze, conflitti o invischiamenti.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {links.map((link) => {
                const typeDef = LINK_TYPES.find((t) => t.id === link.type) || LINK_TYPES[0];
                return (
                  <div
                    key={link.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#FFFFFF',
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: typeDef.color
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        {getPieceName(link.sourceId)} ↔ {getPieceName(link.targetId)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ({typeDef.shortLabel})
                      </span>
                    </div>

                    <button
                      onClick={() => onDeleteLink(link.id)}
                      className="btn-scandi btn-scandi-danger"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      <Trash2 size={12} /> Rimuovi
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
