import React, { useRef } from 'react';
import {
  Upload,
  Link,
  BookOpen,
  Eraser,
  Eye,
  EyeOff,
  Undo2,
  Redo2,
  Share2,
  FolderOpen,
  Moon,
  Sun
} from 'lucide-react';
import { DEFAULT_PHASES } from '../constants';

export default function Header({
  currentPhaseId,
  onSelectPhase,
  activePatientName,
  totalPatientsCount,
  onOpenPatientsModal,
  linkCount,
  onOpenRelationsModal,
  onOpenExportModal,
  onImportJson,
  onClearTray,
  onOpenHelpModal,
  isZenMode,
  onToggleZenMode,
  isDark,
  onToggleTheme,
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
    <header className="geno-header" data-zen={isZenMode}>
      <div className="geno-identity">
        <div className="geno-brand">
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'var(--accent-pine)',
              color: 'var(--text-inverse)',
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
                className="geno-brand-credit"
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: 'var(--accent-pine-light)',
                  color: 'var(--accent-pine)',
                  fontWeight: 600
                }}
              >
                Dr. Mariotti Mauro
              </span>
            </div>
            <span className="geno-brand-caption" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
              Genogramma Tridimensionale Sistemico
            </span>
          </div>
        </div>

        {/* Pulsante Archivio Pazienti / Caso Attivo */}
        {!isZenMode && (
          <button
            onClick={onOpenPatientsModal}
            className="btn-scandi geno-patient"
            style={{
              padding: '8px 13px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12.5px',
              fontWeight: 600
            }}
            aria-label={`Archivio pazienti · ${activePatientName || 'Caso attivo'}`}
            title={`Apri archivio · ${activePatientName || 'Caso attivo'}`}
          >
            <FolderOpen size={15} color="var(--accent-pine)" />
            <span className="geno-patient-name">
              {activePatientName || 'Caso Attivo'}
            </span>
            <span
              style={{
                background: 'var(--accent-pine-light)',
                color: 'var(--accent-pine)',
                fontSize: '10.5px',
                padding: '1px 6px',
                borderRadius: '8px',
                fontWeight: 700
              }}
            >
              {totalPatientsCount}
            </span>
          </button>
        )}
        {!isZenMode && (
          <button
            type="button"
            className="btn-scandi geno-theme-toggle"
            onClick={onToggleTheme}
            aria-label="Tema scuro"
            aria-pressed={isDark}
            title={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
          >
            {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
        )}
      </div>

      {/* Selettore Fasi Temporali (Passato / Presente / Futuro) */}
      {!isZenMode && (
        <nav className="geno-phases" aria-label="Fase temporale">
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
                  color: isCurr ? 'var(--text-inverse)' : 'var(--text-muted)',
                  border: isCurr ? '1px solid var(--accent-pine)' : '1px solid transparent',
                  fontWeight: isCurr ? 600 : 500
                }}
                aria-pressed={isCurr}
                title={phase.desc}
              >
                {phase.shortName}
              </button>
            );
          })}
        </nav>
      )}

      <div className="geno-actions" role="group" aria-label="Azioni della sessione">
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
          onClick={onClearTray}
          className="btn-scandi"
          style={{ padding: '6px 10px', fontSize: '12px' }}
          aria-label="Svuota il piatto"
          title="Svuota il piatto togliendo tutti i pezzi dalla fase corrente"
        >
          <Eraser size={14} />
          <span className="geno-action-label">Svuota</span>
        </button>

        <button
          onClick={onOpenRelationsModal}
          className="btn-scandi"
          style={{ padding: '6px 10px', fontSize: '12px' }}
          aria-label={`Fili relazionali (${linkCount})`}
          title="Gestisci fili e legami relazionali"
        >
          <Link size={14} />
          <span className="geno-action-label">Fili</span>
          {linkCount > 0 && (
            <span
              style={{
                background: 'var(--accent-pine)',
                color: 'var(--text-inverse)',
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
          aria-label="Esporta"
          title="Esporta immagini con proiezioni ortogonali, vista telecamera o scena 3D"
        >
          <Share2 size={14} />
          <span className="geno-export-label">Esporta</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-scandi"
          style={{ padding: '6px 8px' }}
          title="Importa paziente o archivio (.JSON)"
          aria-label="Importa JSON"
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
            color: isZenMode ? 'var(--text-inverse)' : 'var(--text-main)'
          }}
          title={isZenMode ? 'Mostra interfaccia completa' : 'Modalità contemplativa (nascondi pannelli)'}
          aria-label="Modalità vista pulita"
          aria-pressed={isZenMode}
        >
          {isZenMode ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </header>
  );
}
