import React from 'react';
import { X, BookOpen } from 'lucide-react';

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay)',
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
          width: '660px',
          maxWidth: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--accent-pine-light)',
                color: 'var(--accent-pine)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BookOpen size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Guida Metodologica e Comandi — Geno 3D
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Rappresentazione analogica tridimensionale della famiglia (Metodo Bassoli &amp; Mariotti)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-scandi btn-scandi-icon" aria-label="Chiudi guida">
            <X size={16} />
          </button>
        </div>

        <div className="geno-help-basics">
          <h3>I primi gesti</h3>
          <ol>
            <li>Apri <strong>Aggiungi pezzo</strong> e guarda come cambia l’anteprima mentre scegli forma, altezza e colore.</li>
            <li>Quando ti rappresenta ciò che hai in mente, premi <strong>Aggiungi al piano</strong>.</li>
            <li>Trascina il pezzo, oppure scegli <strong>Sposta</strong> e indica dove metterlo sul piano.</li>
            <li>Usa <strong>Gira</strong> per orientarlo o <strong>Postura</strong> per inclinarlo o ribaltarlo. Apri <strong>Modifica</strong> per regolare sguardo e aspetto.</li>
          </ol>
        </div>

        {/* Citazione teorica */}
        <div
          style={{
            background: 'var(--accent-pine-light)',
            border: '1px solid var(--border-light)',
            padding: '14px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            color: 'var(--accent-pine-hover)',
            lineHeight: 1.55
          }}
        >
          Ideato da <strong>Mauro Mariotti</strong> e sviluppato nell&apos;ambito della psicoterapia sistemico-relazionale con <strong>Fabio Bassoli</strong>, il <strong>Geno 3D</strong> sostituisce il disegno bidimensionale su carta con legnetti fisici manipolabili nello spazio, favorendo il canale analogico e la lettura immediata di alleanze, gerarchie e distanze emotive.
        </div>

        {/* Le Coordinate Analogiche (Tabella strutturata chiara) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Le Coordinate Spaziali della Scultura
          </h3>

          <div
            style={{
              background: 'var(--surface-muted)',
              borderRadius: '10px',
              border: '1px solid var(--border-light)',
              overflow: 'hidden'
            }}
          >
            {[
              {
                title: 'Distanza e Prossimità',
                desc: 'La vicinanza sul vassoio circolare riflette il grado percepito di intimità, coinvolgimento, alleanza o differenziazione affettiva.'
              },
              {
                title: 'Direzione dello Sguardo',
                desc: 'Indicatore in ottone sul fronte di ciascun pezzo: mostra chi guarda chi, chi volta le spalle o chi converge verso un membro.'
              },
              {
                title: 'Altezza e Impilamento',
                desc: 'Le tre stature (Alto, Medio, Basso) e la possibilità di posare un pezzo sopra l\'altro rappresentano gerarchie generazionali o pedestalizzazioni.'
              },
              {
                title: 'Fili Relazionali 3D',
                desc: 'Cordicelle continue (alleanza), a zig-zag (conflitto), tratteggiate (distanza), a doppia elica (invischiamento) o con doppia cesura (taglio emotivo).'
              }
            ].map((row, idx) => (
              <div
                key={row.title}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '170px 1fr',
                  gap: '12px',
                  padding: '10px 14px',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)',
                  fontSize: '12px',
                  lineHeight: 1.45
                }}
              >
                <strong style={{ color: 'var(--text-main)' }}>{row.title}</strong>
                <span style={{ color: 'var(--text-muted)' }}>{row.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scorciatoie e Interazioni Rapide */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Scorciatoie da tastiera
          </h3>
          <ul
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: 1.65,
              paddingLeft: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <li>
              <strong>Spostamento da Tastiera (WASD / Frecce):</strong> Seleziona un pezzo e usa <code>W A S D</code> oppure le <code>Frecce ↑ ← ↓ →</code> per muoverlo rispetto alla tua visuale. Tieni premuto per continuare, aggiungi <code>Shift</code> per accelerare. Per salire sopra un altro pezzo, dirigiti verso il suo centro e rilascia il tasto quando il pezzo è in appoggio.
            </li>
            <li>
              <strong>Rotazione Sguardo (Asse Y):</strong> Usa i tasti <code>Q</code> / <code>E</code>, trascina la <strong>punta della freccia verde</strong> sul tavolo, oppure fai <code>Shift + Clic</code> su un altro membro per guardarlo direttamente.
            </li>
            <li>
              <strong>Inclinazione e Ribaltamento 3D (Assi X e Z):</strong> Usa <code>R</code> / <code>F</code> per inclinare avanti/indietro, <code>Z</code> / <code>C</code> per inclinare di lato, <code>X</code> per sdraiare (90°) o capovolgere a testa in giù (180°), e <code>0</code> per raddrizzare il pezzo in piedi.
            </li>
            <li>
              <strong>Altre Scorciatoie:</strong> <code>Ctrl/Cmd + Z</code> Annulla • <code>Ctrl/Cmd + Y</code> Ripristina • <code>Canc / Backspace</code> Elimina • <code>Ctrl/Cmd + D</code> Duplica • <code>L</code> Mostra/Nascondi nomi • <code>Esc</code> Deseleziona.
            </li>
            <li>
              <strong>Esportazione 2D e 3D:</strong> Dal pulsante <em>Esporta</em> puoi scaricare la <strong>Tavola Sinottica Multi-Proiezione</strong>, le singole proiezioni ortogonali (Pianta, Fronte, Lato, Isometrica, Vista Camera) oppure la <strong>Scena 3D</strong> nei formati <code>.glb</code>, <code>.gltf</code>, <code>.obj</code> e <code>.stl</code>.
            </li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="btn-scandi btn-scandi-primary"
          style={{ width: '100%' }}
        >
          Torna alla scultura
        </button>
      </div>
    </div>
  );
}
