import React, { useRef } from 'react';
import {
  Camera,
  Upload,
  Link,
  BookOpen,
  RotateCcw,
  Eye,
  EyeOff,
  Undo2,
  Redo2,
  Share2
} from 'lucide-react';
import { DEFAULT_PHASES } from '../constants';

export default function Header({
  currentPhaseId,
  onSelectPhase,
  linkCount,
  onOpenRelationsModal,
  onOpenExportModal,
  onImportJson,
  onResetSession,
  onOpenHelpModal,
  isZenMode,
  onToggleZenMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          onImportJson(parsed);
        } catch {
          alert('Errore nella lettura del file JSON: formato non valido.');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  return (
    <header
      style={{
        position: 'absolute',
        top: '14px',
        left: '18px',
        right: '18px',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        flexWrap: 'wrap',
        pointerEvents: 'none'
      }}
    >
      {/* Brand & Titolo */}
      <div
        className="scandi-panel"
        style={{
          padding: '7px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          pointerEvents: 'auto'
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: 'var(--accent-pine)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '12px',
            letterSpacing: '-0.02em'
          }}
        >
          G3
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h1
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: 0,
                letterSpacing: '-0.01em'
              }}
            >
              Geno 3D
            </h1>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                background: 'var(--accent-pine-light)',
                color: 'var(--accent-pine)',
                fontWeight: 600
              }}
            >
              Bassoli &amp; Mariotti
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
            Genogramma Tridimensionale Sistemico
          </span>
        </div>
      </div>

      {/* Selettore Fasi Temporali (Passato / Presente / Futuro) */}
      {!isZenMode && (
        <div
          className="scandi-panel"
          style={{
            padding: '4px',
            display: 'flex',
            gap: '4px',
            pointerEvents: 'auto'
          }}
        >
          {DEFAULT_PHASES.map((phase) => {
            const isCurr = currentPhaseId === phase.id;
            return (
              <button
                key={phase.id}
                onClick={() => onSelectPhase(phase.id)}
                className="btn-scandi"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: isCurr ? 'var(--accent-pine)' : 'transparent',
                  color: isCurr ? '#FFFFFF' : 'var(--text-muted)',
                  border: isCurr ? '1px solid var(--accent-pine)' : '1px solid transparent',
                  fontWeight: isCurr ? 600 : 500
                }}
                title={phase.desc}
              >
                {phase.shortName}
              </button>
            );
          })}
        </div>
      )}

      {/* Azioni Sessione & Strumenti */}
      <div
        className="scandi-panel"
        style={{
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          pointerEvents: 'auto'
        }}
      >
        {!isZenMode && (
          <>
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="btn-scandi"
              style={{ padding: '6px 8px', opacity: canUndo ? 1 : 0.4 }}
              title="Annulla ultima modifica (Ctrl+Z)"
              aria-label="Annulla"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="btn-scandi"
              style={{ padding: '6px 8px', opacity: canRedo ? 1 : 0.4 }}
              title="Ripristina modifica (Ctrl+Y)"
              aria-label="Ripristina"
            >
              <Redo2 size={14} />
            </button>
            <div style={{ width: '1px', height: '18px', background: 'var(--border-light)', margin: '0 2px' }} />
          </>
        )}

        <button
          onClick={onOpenRelationsModal}
          className="btn-scandi"
          style={{ padding: '6px 10px', fontSize: '12px' }}
          title="Gestisci fili e legami relazionali"
        >
          <Link size={14} />
          <span>Fili</span>
          {linkCount > 0 && (
            <span
              style={{
                background: 'var(--accent-pine)',
                color: '#FFFFFF',
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '8px',
                fontWeight: 600
              }}
            >
              {linkCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenExportModal}
          className="btn-scandi btn-scandi-primary"
          style={{ padding: '6px 11px', fontSize: '12px' }}
          title="Esporta immagini con proiezioni ortogonali, vista telecamera o scena 3D"
        >
          <Share2 size={14} />
          <span>Esporta 2D / 3D</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-scandi"
          style={{ padding: '6px 8px' }}
          title="Carica seduta salvata (.JSON)"
          aria-label="Carica seduta JSON"
        >
          <Upload size={14} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          onClick={onResetSession}
          className="btn-scandi"
          style={{ padding: '6px 8px' }}
          title="Ripristina scultura predefinita della fase corrente"
          aria-label="Ripristina scultura"
        >
          <RotateCcw size={14} />
        </button>

        <button
          onClick={onOpenHelpModal}
          className="btn-scandi"
          style={{ padding: '6px 8px' }}
          title="Guida metodologica e scorciatoie"
          aria-label="Guida metodologica"
        >
          <BookOpen size={14} />
        </button>

        <button
          onClick={onToggleZenMode}
          className="btn-scandi"
          style={{
            padding: '6px 8px',
            background: isZenMode ? 'var(--accent-pine)' : 'transparent',
            color: isZenMode ? '#FFFFFF' : 'var(--text-main)'
          }}
          title={isZenMode ? 'Mostra interfaccia completa' : 'Modalità contemplativa (nascondi pannelli)'}
          aria-label="Modalità vista pulita"
        >
          {isZenMode ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </header>
  );
}
