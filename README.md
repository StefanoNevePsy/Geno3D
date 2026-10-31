# Geno 3D — Genogramma Tridimensionale Sistemico
### Basato sulla metodologia clinica di Mauro Mariotti e Fabio Bassoli (Terapia Sistemico-Relazionale)

Un'applicazione web 3D progettata per la rappresentazione analogica e spaziale della famiglia e delle reti relazionali in psicoterapia, mediazione familiare e counseling sistemico. Il design segue un'estetica **Scandinavian / Nordic Craft**: essenziale, calda, focalizzata sui materiali naturali (legno massello di frassino e noce tornito e levigato, vernici nordiche opache con venatura sottostante, palette terrosa).

---

## 🌿 Caratteristiche Principali

### 1. Il Kit Analogico dei Legnetti (Modelli 3D Artigianali & Texture PBR)
- **Forme geometriche sistemico-relazionali**:
  - **Parallelepipedo smussato** (tradizionalmente associato a figure maschili, stabilità, confini definiti)
  - **Cilindro tornito** (con colletto tornito, associato a figure femminili, accoglienza, continuità)
  - **Cubo levigato** (figure neutre, infanzia o elemento base)
  - **Prisma triangolare / Cuneo** (polarizzazioni, divergenze, direzione marcata)
  - **Sfera su piedistallo tornito** (elemento focale, gravidanza, lutto o valore simbolico centrale)
  - **Dischetto tornito** (neonati, animali d'affezione, eventi nodali)
- **Intarsio dello Sguardo in Ottone/Ebano**: posizionato con precisione geometrica sulla superficie frontale (`+Z`) di ogni forma e taglia.
- **Altezze / Generazioni**: Alto (nonni/genitori), Medio (adulti), Basso (bambini).
- **Palette cromatica nordica con bump map delle fibre del legno**: Frassino naturale, Noce scuro, Rosso terracotta, Blu fiordo, Verde salvia, Giallo ocra, Bianco gesso, Nero basalto, Lavanda nordica, Pesca tenue.

### 2. Manipolazione Spaziale, Sguardo Diretto & Usabilità Clinica
- **Trascina & Impila con fisica di contatto**: clicca e trascina ciascun pezzo sul vassoio in frassino dogato o sopra la sommità di un altro pezzo.
- **Orientamento dello Sguardo Diretto in 3D**:
  - Trascina direttamente la **punta della freccia 3D** davanti al pezzo selezionato sul tavolo.
  - Fai `Shift + Clic` su un altro membro (o usa i pulsanti rapidi `"→ [Nome Membro]"` nel pannello laterale) per far sì che il pezzo selezionato guardi esattamente verso quel membro.
  - Rotazione continua `0°–360°` e pulsanti rapidi (`-45°`, `+45°`, `180°`, `Guarda al centro`).
- **Cronologia Annulla / Ripristina (`Ctrl+Z` / `Ctrl+Y`)** e **Salvataggio automatico** locale.
- **Osservazioni e Vissuti Clinici**: campo note dedicato per ogni membro della famiglia.

### 3. Fili Relazionali 3D (Legami Sistemici)
Ciascuna qualità del legame ha una propria geometria tridimensionale distintiva:
- **Alleanza / Vicinanza affettiva**: cordicella continua verde salvia
- **Conflitto / Tensione**: linea 3D a **zig-zag** rosso terracotta
- **Distanza / Fragilità**: filo **tratteggiato** a segmenti grigio ardesia
- **Invischiamento / Fusione**: **doppia cordicella intrecciata a elica** giallo ocra
- **Legame interrotto / Taglio emotivo**: filo nero basalto interrotto al centro con **doppia cesura ortogonale (`//`)**

### 4. Esportazione Completa 2D (Proiezioni Ortogonali & Vista Camera) e Scena 3D
Dal pannello **Esporta 2D / 3D**:
- **Tavola Sinottica Multi-Proiezione (4-in-1 PNG HD)**: combina in un'unica tavola ad alta risoluzione la *Vista Telecamera Attuale*, la *Pianta Zenitale 2D (con frecce vettoriali degli sguardi)*, la *Proiezione Frontale*, l'*Assonometria Isometrica 45°*, l'elenco dei membri con note cliniche e la legenda dei fili.
- **Proiezioni Singole e Pacchetto Multi-Proiezione (.PNG)**:
  - Vista dalla posizione attuale della telecamera
  - Pianta Zenitale (2D Ortogonale)
  - Proiezione Frontale (Sud), Posteriore (Nord), Laterale Destra (Est), Laterale Sinistra (Ovest)
  - Assonometria Isometrica (45°) e Prospettiva Studio 3D
- **Esportazione Scena 3D**:
  - **`.glb` (Binary glTF 2.0)** e **`.gltf`**: scena 3D completa di modelli, colori e texture del legno
  - **`.obj` (Wavefront OBJ)**: geometria 3D universale
  - **`.stl` (Binary STL)**: modello solido pronto per la stampa 3D fisica della scultura
- **Archivio Seduta (`.json`)**: esportazione e importazione dell'intera seduta (Passato, Presente, Futuro).

### 5. Efficienza Energetica & Prestazioni (Render-on-Demand)
- **Ciclo WebGL On-Demand**: il motore 3D renderizza i fotogrammi solo durante il movimento della telecamera o la manipolazione dei pezzi, scendendo a **0% di utilizzo CPU/GPU** quando la scultura viene osservata staticamente durante il colloquio clinico.
- **Shadow Map Caching & Proiezione Etichette GPU**: la mappa delle ombre `2048×2048` viene ricalcolata solo quando i pezzi si muovono (non durante la semplice rotazione della telecamera) e le etichette 2D vengono posizionate tramite trasformazioni CSS `translate3d` dirette senza re-render di React.

---

## 🚀 Avvio dell'Applicazione

Per avviare il server di sviluppo:
```bash
npm run dev
```

Per creare la build statica ottimizzata:
```bash
npm run build
```
