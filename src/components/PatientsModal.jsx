import React, { useState, useRef } from 'react';
import {
  X,
  FolderOpen,
  Plus,
  Download,
  Upload,
  Trash2,
  Copy,
  ShieldCheck,
  Eraser,
  Check,
  Search,
  Sparkles,
  FileDown
} from 'lucide-react';

export default function PatientsModal({
  isOpen,
  onClose,
  records,
  activeRecordId,
  onSelectRecord,
  onCreateBlankRecord,
  onDuplicateRecord,
  onUpdateActiveRecordMeta,
  onDeleteRecord,
  onClearCurrentPhaseTray,
  onClearAllPhasesTray,
  onLoadDemoPreset,
  onExportSingleRecord,
  onExportAllRecordsArchive,
  onImportFile
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [newPatientName, setNewPatientName] = useState('');
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const activeRecord = records.find((r) => r.id === activeRecordId) || records[0];

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.patientName || '').toLowerCase().includes(q) ||
      (r.sessionTitle || '').toLowerCase().includes(q) ||
      (r.sessionNotes || '').toLowerCase().includes(q)
    );
  });

  const handleCreateNew = (e) => {
    e.preventDefault();
    onCreateBlankRecord({
      patientName: newPatientName.trim() || `Paziente ${records.length + 1}`,
      sessionTitle: newSessionTitle.trim() || `Seduta del ${new Date().toLocaleDateString('it-IT')}`
    });
    setNewPatientName('');
    setNewSessionTitle('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          onImportFile(parsed);
        } catch {
          alert('Errore nella lettura del file JSON: formato non valido.');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const countTotalPieces = (rec) => {
    if (!rec?.phasesData) return 0;
    return (
      (rec.phasesData.passato?.pieces?.length || 0) +
      (rec.phasesData.presente?.pieces?.length || 0) +
      (rec.phasesData.futuro?.pieces?.length || 0)
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100,
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
          width: '840px',
          maxWidth: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Gestione Pazienti, Genogrammi e Pulizia Piatto
            </h2>
            <p
              style={{
                fontSize: '12.5px',
                color: 'var(--accent-pine)',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 500
              }}
            >
              <ShieldCheck size={15} />
              Archivio 100% locale e offline: nessun dato viene mai inviato a server esterni o cloud.
            </p>
          </div>
          <button onClick={onClose} className="btn-scandi btn-scandi-icon" aria-label="Chiudi gestione pazienti">
            <X size={16} />
          </button>
        </div>

        {/* Sezione Superiore: Genogramma Attivo + Azioni Rapide sul Piatto */}
        {activeRecord && (
          <div
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Scheda Genogramma Attivo
              </h3>

              {/* Azioni sul Piatto (Svuota Piatto) */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    onClearCurrentPhaseTray();
                    onClose();
                  }}
                  className="btn-scandi"
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                  title="Toglie tutti i pezzi e i fili dalla fase temporale corrente lasciando il piatto vuoto"
                >
                  <Eraser size={13} /> Svuota Piatto (Fase attuale)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClearAllPhasesTray();
                    onClose();
                  }}
                  className="btn-scandi btn-scandi-danger"
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                  title="Svuota tutti i pezzi da Passato, Presente e Futuro per questo genogramma"
                >
                  <Trash2 size={13} /> Svuota Tutte le 3 Fasi
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onLoadDemoPreset();
                    onClose();
                  }}
                  className="btn-scandi"
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                  title="Ripristina i pezzi del caso clinico dimostrativo"
                >
                  <Sparkles size={13} /> Carica Caso Dimostrativo
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Codice / Identificativo Paziente
                </label>
                <input
                  type="text"
                  className="scandi-input"
                  value={activeRecord.patientName || ''}
                  onChange={(e) => onUpdateActiveRecordMeta({ patientName: e.target.value })}
                  placeholder="es. Paziente M. R. / Famiglia Rossi"
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Seduta / Riferimento
                </label>
                <input
                  type="text"
                  className="scandi-input"
                  value={activeRecord.sessionTitle || ''}
                  onChange={(e) => onUpdateActiveRecordMeta({ sessionTitle: e.target.value })}
                  placeholder="es. I Seduta — Consultazione"
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Note Generali della Seduta
                </label>
                <input
                  type="text"
                  className="scandi-input"
                  value={activeRecord.sessionNotes || ''}
                  onChange={(e) => onUpdateActiveRecordMeta({ sessionNotes: e.target.value })}
                  placeholder="Annotazioni cliniche generali..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Creazione Rapida Nuovo Paziente / Nuovo Genogramma con Piatto Vuoto */}
        <form
          onSubmit={handleCreateNew}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: '10px',
            alignItems: 'end',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '14px 16px'
          }}
        >
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Nuovo Paziente / Caso (parte con il piatto vuoto)
            </label>
            <input
              type="text"
              className="scandi-input"
              value={newPatientName}
              onChange={(e) => setNewPatientName(e.target.value)}
              placeholder="Codice o iniziali paziente (es. Paziente A.B.)..."
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Titolo Seduta (opzionale)
            </label>
            <input
              type="text"
              className="scandi-input"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              placeholder="es. Prima scultura familiare..."
            />
          </div>
          <button type="submit" className="btn-scandi btn-scandi-primary" style={{ height: '35px' }}>
            <Plus size={15} /> Crea Nuovo (Piatto Vuoto)
          </button>
        </form>

        {/* Elenco Pazienti / Genogrammi salvati in locale */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Genogrammi Salvati sul Dispositivo ({records.length})
            </h3>

            <div style={{ position: 'relative', width: '240px' }}>
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                className="scandi-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca paziente o seduta..."
                style={{ paddingLeft: '30px', height: '30px', fontSize: '12px' }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '240px',
              overflowY: 'auto',
              paddingRight: '2px'
            }}
          >
            {filteredRecords.map((rec) => {
              const isCurrent = rec.id === activeRecordId;
              const dateFormatted = rec.updatedAt
                ? new Date(rec.updatedAt).toLocaleString('it-IT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '';

              return (
                <div
                  key={rec.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1.5px solid ${isCurrent ? 'var(--accent-pine)' : 'var(--border-light)'}`,
                    background: isCurrent ? 'var(--accent-pine-light)' : 'var(--bg-elevated)'
                  }}
                >
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'pointer', flex: 1 }}
                    onClick={() => {
                      onSelectRecord(rec.id);
                      onClose();
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {rec.patientName || 'Paziente senza nome'}
                      </span>
                      {rec.sessionTitle && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                          — {rec.sessionTitle}
                        </span>
                      )}
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 7px',
                            borderRadius: '8px',
                            background: 'var(--accent-pine)',
                            color: 'var(--text-inverse)'
                          }}
                        >
                          Attivo
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {countTotalPieces(rec)} pezzi totali nelle 3 fasi • Ultima modifica: {dateFormatted}
                      {rec.sessionNotes ? ` • "${rec.sessionNotes}"` : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRecord(rec.id);
                          onClose();
                        }}
                        className="btn-scandi btn-scandi-primary"
                        style={{ padding: '5px 10px', fontSize: '11.5px' }}
                      >
                        <Check size={13} /> Apri
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onExportSingleRecord(rec.id)}
                      className="btn-scandi"
                      style={{ padding: '5px 9px', fontSize: '11.5px' }}
                      title="Esporta questo singolo paziente su file .JSON locale"
                    >
                      <FileDown size={13} /> Esporta
                    </button>

                    <button
                      type="button"
                      onClick={() => onDuplicateRecord(rec.id)}
                      className="btn-scandi"
                      style={{ padding: '5px 8px', fontSize: '11.5px' }}
                      title="Duplica questo genogramma (es. per nuova seduta dello stesso paziente)"
                    >
                      <Copy size={13} />
                    </button>

                    {records.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(rec.id)}
                        className="btn-scandi btn-scandi-danger"
                        style={{ padding: '5px 8px', fontSize: '11.5px' }}
                        title="Elimina questo genogramma"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer: Export / Import Archivio Offline Multi-Paziente */}
        <div
          style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onExportAllRecordsArchive}
              className="btn-scandi"
              style={{ fontSize: '12px' }}
              title="Salva tutti i pazienti e genogrammi in un unico file di backup locale (.JSON)"
            >
              <Download size={14} /> Esporta Intero Archivio Pazienti (.JSON)
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-scandi"
              style={{ fontSize: '12px' }}
              title="Importa un file .JSON (singolo paziente oppure intero archivio multi-paziente)"
            >
              <Upload size={14} /> Importa Paziente o Archivio (.JSON)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-scandi btn-scandi-primary"
            style={{ padding: '7px 16px' }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
