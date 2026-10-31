// Kit Geno 3D (Bassoli & Mariotti - Terapia Sistemica Relazionale)
// Estetica Scandinava: materiali organici, legno naturale tornito e levigato, tonalità terrose e nordiche

export const PIECE_SHAPES = [
  { id: 'box', name: 'Parallelepipedo', shortName: 'Blocco', desc: 'Figura maschile / struttura / confini definiti', icon: 'box' },
  { id: 'cylinder', name: 'Cilindro', shortName: 'Cilindro', desc: 'Figura femminile / accoglienza / continuità', icon: 'cylinder' },
  { id: 'cube', name: 'Cubo', shortName: 'Cubo', desc: 'Figura neutra / infanzia / elemento base', icon: 'cube' },
  { id: 'wedge', name: 'Prisma / Cuneo', shortName: 'Cuneo', desc: 'Divergenza / tensione / direzione marcata', icon: 'wedge' },
  { id: 'sphere', name: 'Sfera su base', shortName: 'Sfera', desc: 'Figura focale / gravidanza / valore simbolico centrale', icon: 'sphere' },
  { id: 'token', name: 'Dischetto', shortName: 'Disco', desc: 'Neonato / animale d\'affezione / evento nodale', icon: 'circle' }
];

export const PIECE_SIZES = [
  { id: 'tall', label: 'Alto', multiplier: 1.4, height: 3.2, desc: 'Generazione anziana / genitori / figure autorevoli' },
  { id: 'medium', label: 'Medio', multiplier: 1.0, height: 2.2, desc: 'Adulti / giovani adulti / pari' },
  { id: 'short', label: 'Basso', multiplier: 0.65, height: 1.3, desc: 'Bambini / fratelli minori / figure subordinate' }
];

export const PIECE_COLORS = [
  { id: 'ash', name: 'Frassino naturale', hex: '#E4D5C1', border: '#C5B39B', isWood: true, grainDarkness: 0.11, roughness: 0.58 },
  { id: 'walnut', name: 'Noce scuro', hex: '#5C4433', border: '#3E2C20', isWood: true, grainDarkness: 0.18, roughness: 0.52 },
  { id: 'terracotta', name: 'Rosso terracotta', hex: '#B85540', border: '#96402D', isWood: false, grainDarkness: 0.05, roughness: 0.68 },
  { id: 'fjord', name: 'Blu fiordo', hex: '#48657F', border: '#354E64', isWood: false, grainDarkness: 0.05, roughness: 0.66 },
  { id: 'sage', name: 'Verde salvia', hex: '#5B7B65', border: '#45614E', isWood: false, grainDarkness: 0.05, roughness: 0.66 },
  { id: 'ochre', name: 'Giallo ocra', hex: '#C8963E', border: '#A3772A', isWood: false, grainDarkness: 0.05, roughness: 0.64 },
  { id: 'chalk', name: 'Bianco gesso', hex: '#ECE8DF', border: '#CCC5B7', isWood: false, grainDarkness: 0.04, roughness: 0.72 },
  { id: 'basalt', name: 'Nero basalto', hex: '#282B2E', border: '#151719', isWood: false, grainDarkness: 0.06, roughness: 0.62 },
  { id: 'lavender', name: 'Lavanda nordica', hex: '#8E809A', border: '#71647D', isWood: false, grainDarkness: 0.05, roughness: 0.68 },
  { id: 'peach', name: 'Pesca tenue', hex: '#D6836B', border: '#B56953', isWood: false, grainDarkness: 0.05, roughness: 0.66 }
];

export const LINK_TYPES = [
  { id: 'positive', label: 'Legame affettivo / Alleanza', shortLabel: 'Alleanza', color: '#5B7B65', style: 'solid', thickness: 0.075 },
  { id: 'conflict', label: 'Conflitto / Tensione', shortLabel: 'Conflitto', color: '#B85540', style: 'zigzag', thickness: 0.07 },
  { id: 'distant', label: 'Distante / Fragile', shortLabel: 'Distante', color: '#7E8882', style: 'dashed', thickness: 0.05 },
  { id: 'enmeshed', label: 'Invischiamento / Fusione', shortLabel: 'Invischiato', color: '#C8963E', style: 'double', thickness: 0.065 },
  { id: 'cutoff', label: 'Legame interrotto / Taglio emotivo', shortLabel: 'Taglio emotivo', color: '#282B2E', style: 'cutoff', thickness: 0.065 }
];

export const DEFAULT_PHASES = [
  { id: 'passato', name: 'Famiglia d\'Origine (Passato)', shortName: 'Passato', desc: 'Le radici e la rete relazionale durante l\'infanzia e l\'adolescenza' },
  { id: 'presente', name: 'Configurazione Attuale (Presente)', shortName: 'Presente', desc: 'Come viene vissuta la rete familiare oggi' },
  { id: 'futuro', name: 'Scenario Desiderato (Futuro)', shortName: 'Futuro', desc: 'La riorganizzazione desiderata e l\'attivazione delle risorse' }
];

export const CAMERA_PROJECTIONS = [
  {
    id: 'camera',
    name: 'Vista Telecamera Attuale',
    shortName: 'Vista Attuale',
    desc: 'Inquadratura corrente scelta dall\'utente nello spazio 3D',
    isOrtho: false
  },
  {
    id: 'top',
    name: 'Pianta Zenitale (2D Ortogonale)',
    shortName: 'Pianta (Alto)',
    desc: 'Proiezione ortogonale dall\'alto per lettura mappa genogramma e sguardi',
    position: [0, 24, 0.001],
    target: [0, 0, 0],
    isOrtho: true,
    orthoSize: 11.5
  },
  {
    id: 'front',
    name: 'Proiezione Frontale (Sud)',
    shortName: 'Frontale',
    desc: 'Alzata frontale ad altezza occhi per leggere gerarchie ed elevazioni Y',
    position: [0, 3.2, 20],
    target: [0, 1.4, 0],
    isOrtho: true,
    orthoSize: 8.5
  },
  {
    id: 'right',
    name: 'Proiezione Laterale Destra (Est)',
    shortName: 'Laterale Dx',
    desc: 'Alzata laterale destra per valutare profondità avanti/dietro',
    position: [20, 3.2, 0],
    target: [0, 1.4, 0],
    isOrtho: true,
    orthoSize: 8.5
  },
  {
    id: 'left',
    name: 'Proiezione Laterale Sinistra (Ovest)',
    shortName: 'Laterale Sx',
    desc: 'Alzata laterale sinistra per valutare profondità e schieramenti',
    position: [-20, 3.2, 0],
    target: [0, 1.4, 0],
    isOrtho: true,
    orthoSize: 8.5
  },
  {
    id: 'back',
    name: 'Proiezione Posteriore (Nord)',
    shortName: 'Posteriore',
    desc: 'Vista dal retro del tavolo verso il fronte',
    position: [0, 3.2, -20],
    target: [0, 1.4, 0],
    isOrtho: true,
    orthoSize: 8.5
  },
  {
    id: 'isometric',
    name: 'Assonometria Isometrica',
    shortName: 'Isometrica',
    desc: 'Proiezione assonometrica bilanciata a 45° senza distorsione prospettica',
    position: [13.5, 13.5, 13.5],
    target: [0, 0.8, 0],
    isOrtho: true,
    orthoSize: 10.5
  },
  {
    id: 'perspective',
    name: 'Prospettiva Studio 3D',
    shortName: 'Prospettiva 3D',
    desc: 'Visuale tridimensionale naturale da studio clinico',
    position: [0, 13.5, 15.5],
    target: [0, 0.5, 0],
    isOrtho: false
  }
];

// Esempio clinico iniziale: Genogramma 3D sistemico di partenza (Presente)
export const INITIAL_PIECES = [
  {
    id: 'piece-1',
    name: 'Io',
    role: 'Paziente designato / Protagonista',
    shape: 'box',
    size: 'medium',
    color: 'ash',
    x: -0.5,
    y: 0,
    z: 1.2,
    rotationY: 0.3,
    notes: 'In cerca di differenziazione rispetto alla famiglia d\'origine'
  },
  {
    id: 'piece-2',
    name: 'Partner',
    role: 'Compagna / Coniuge',
    shape: 'cylinder',
    size: 'medium',
    color: 'sage',
    x: 1.4,
    y: 0,
    z: 1.1,
    rotationY: -0.4,
    notes: 'Sostegno affettivo stabile ma richiesta di maggiore presenza'
  },
  {
    id: 'piece-3',
    name: 'Madre',
    role: 'Madre (Famiglia d\'origine)',
    shape: 'cylinder',
    size: 'tall',
    color: 'ochre',
    x: -2.8,
    y: 0,
    z: -1.6,
    rotationY: 0.6,
    notes: 'Presenza centrale, protettiva ma percepita come invadente'
  },
  {
    id: 'piece-4',
    name: 'Padre',
    role: 'Padre (Famiglia d\'origine)',
    shape: 'box',
    size: 'tall',
    color: 'fjord',
    x: -4.5,
    y: 0,
    z: -2.2,
    rotationY: 1.57,
    notes: 'Voltato di lato, percepito come emotivamente periferico'
  },
  {
    id: 'piece-5',
    name: 'Figlio',
    role: 'Bambino (6 anni)',
    shape: 'cube',
    size: 'short',
    color: 'terracotta',
    x: 0.4,
    y: 0,
    z: 2.4,
    rotationY: 3.14,
    notes: 'Punto di convergenza emotiva della coppia'
  }
];

export const INITIAL_LINKS = [
  { id: 'link-1', sourceId: 'piece-1', targetId: 'piece-2', type: 'positive' },
  { id: 'link-2', sourceId: 'piece-1', targetId: 'piece-3', type: 'enmeshed' },
  { id: 'link-3', sourceId: 'piece-3', targetId: 'piece-4', type: 'distant' },
  { id: 'link-4', sourceId: 'piece-1', targetId: 'piece-5', type: 'positive' },
  { id: 'link-5', sourceId: 'piece-2', targetId: 'piece-5', type: 'positive' }
];

export const INITIAL_PASSATO_PIECES = [
  {
    id: 'p-orig-1',
    name: 'Io (Bambino)',
    role: 'Età 8 anni',
    shape: 'cube',
    size: 'short',
    color: 'ash',
    x: 0,
    y: 0,
    z: 0.5,
    rotationY: -0.4,
    notes: 'Attento agli equilibri tra i genitori'
  },
  {
    id: 'p-orig-2',
    name: 'Madre',
    role: 'Figura primaria',
    shape: 'cylinder',
    size: 'tall',
    color: 'ochre',
    x: -1.6,
    y: 0,
    z: -0.8,
    rotationY: 0.85,
    notes: 'Molto vicina al bambino'
  },
  {
    id: 'p-orig-3',
    name: 'Padre',
    role: 'Lavoro fuori casa',
    shape: 'box',
    size: 'tall',
    color: 'fjord',
    x: 2.5,
    y: 0,
    z: -2.0,
    rotationY: 2.2,
    notes: 'Spesso assente per lavoro'
  }
];

export const INITIAL_PASSATO_LINKS = [
  { id: 'l-orig-1', sourceId: 'p-orig-1', targetId: 'p-orig-2', type: 'enmeshed' },
  { id: 'l-orig-2', sourceId: 'p-orig-2', targetId: 'p-orig-3', type: 'distant' }
];
