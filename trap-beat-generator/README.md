# Trap Beat Generator

PWA che genera basi trap complete (drum, 808, armonia, melodie), le fa ascoltare nel browser
e le esporta in **MIDI pronti per FL Studio**.

Non e' un generatore di note casuali: c'e' un motore di teoria musicale (scale, progressioni,
voice leading, motivi melodici) e un mood engine che cambia davvero scale, pattern e dinamiche.

---

## Avvio rapido

```bash
npm install
npm run dev      # sviluppo su http://localhost:5173
npm run build    # build di produzione in dist/
npm run preview  # anteprima della build
npm test         # test del generatore, dello schedule e dell'export MIDI
```

Nessun backend, nessun account: tutto gira nel browser.

---

## Come si usa

1. **Mood**: scegli uno o due mood fra i 13 disponibili (Dark, Aggressive, Melodic, Sad,
   Emotional, Chill, Atmospheric, Energetic, Street, Ominous, Futuristic, Luxury, Ambient).
2. **BPM**: slider, campo numerico o preset (70-160). Il valore iniziale segue il mood scelto.
3. **GENERATE BEAT**: vengono creati tonalita', scala, progressione, struttura e tutte le parti.
4. Nello studio puoi ascoltare, modificare e rigenerare le singole parti, poi esportare.

### Studio

| Zona | Cosa fa |
| --- | --- |
| **Arrangement** | timeline delle sezioni: aggiungi, duplica, sposta, rinomina, allunga o elimina. Doppio click su una sezione per posizionare la testina. |
| **Step Sequencer** | griglia 1/16 o 1/32 per le drum. Click attiva o disattiva, click destro cambia l'accento. |
| **Piano Roll** | note melodiche: click per aggiungere, trascina per spostare, bordo destro per la durata, corsia in basso per la velocity, click destro o Canc per eliminare. Griglia 1/4-1/32. |
| **Generatore** | Regenerate All / Melody / Drums / 808 / Chords / Struttura, Variation, Humanize e cambio tonalita'. |
| **Mixer** | volume, pan, mute e solo per 12 canali piu' master. |
| **Export** | ZIP completo, singoli MIDI, WAV 24 bit, file informativo. |

Scorciatoie: **barra spaziatrice** play/pausa, **⟳** loop sulla sezione selezionata.

---

## Export per FL Studio

Il pulsante *Scarica ZIP completo* produce `TrapBeat_<BPM>BPM_<Key>.zip`:

```
/midi
  drums.mid        kick, snare, clap, hi-hat, open hat, perc (canale 10)
  808.mid          808 con pitch bend sugli slide (range 12 semitoni)
  melody.mid       main melody, counter melody, lead
  chords.mid       progressione armonica
  pad.mid          pad / atmosfera
  full_beat.mid    tutte le tracce insieme
/flstudio
  TrapBeat_*.flp   progetto FL Studio (sperimentale)
/text
  beat-info.txt    BPM, key, scala, mood, progressione, struttura
```

### Progetto .flp (sperimentale)

Oltre ai MIDI viene generato un vero progetto FL Studio: tempo, un pattern per sezione,
playlist gia' montata e un canale per strumento nel Channel Rack.

Due avvertenze oneste:

- I canali arrivano **vuoti** (sampler senza campione): ci carichi i tuoi suoni e plugin.
  Le note, i pattern e l'arrangiamento ci sono gia'.
- Il formato `.flp` **non e' documentato** da Image-Line. Il writer segue la struttura
  ricostruita dalla community e il risultato viene validato in automatico rileggendolo con
  [PyFLP](https://github.com/demberto/PyFLP), ma non e' stato provato dentro FL Studio.
  Se la tua versione non lo aprisse, i MIDI restano la via garantita.

Per eseguire anche il controllo incrociato con PyFLP:

```bash
pip install pyflp
npm test            # se PyFLP c'e', il test lo usa da solo
```

In FL Studio: **File > Import > MIDI file** (o trascina il file nella playlist), scegli
*import to new channels*, imposta il tempo del progetto sul BPM indicato e, per sentire gli
slide dell'808, attiva il portamento dello strumento.

L'export WAV (24 bit, 44.1 kHz) renderizza offline a blocchi con crossfade: su beat lunghi
puo' richiedere qualche decina di secondi, per questo c'e' anche l'export della sola
sezione selezionata.

---

## Come funziona il motore musicale

```
src/
  music/       teoria: scale, accordi, voice leading, progressioni, mood profile, RNG con seed
  generator/   struttura, drum, 808, melodie (motif engine), armonia, humanize
  audio/       strumenti Tone.js, schedule, transport, rendering WAV offline
  midi/        writer SMF formato 1 + bundle ZIP e beat-info
  store/       stato globale (zustand) e persistenza IndexedDB
  components/  interfaccia (timeline, step sequencer, piano roll, mixer, export)
```

- **Tonalita' e scala** vengono sorteggiate fra quelle compatibili con il mood
  (minore naturale, armonica, melodica, dorica, frigia, pentatoniche, lidia, esatonale, hirajoshi).
- **Progressione**: database di oltre 25 progressioni con affinita' per mood, con settime ed
  estensioni applicate in modo probabilistico.
- **Drum**: loop di due battute con variazioni a fine frase, roll di hi-hat (1/32, terzine,
  sestine), ghost snare, fill, backbeat in half-time sopra i 126 BPM.
- **808**: segue la cassa e la progressione, usa fondamentale, quinta, terza e settima
  dell'accordo, con slide, salti di ottava e durate legate al mood.
- **Melodia**: motivo generato da celle ritmiche trap e contorno melodico, poi sviluppato in
  varianti (A - A' - B - A''): trasposizione, inversione, ornamentazione, spostamento ritmico.
- **Armonia**: voicing con voice leading fra un accordo e il successivo, in stile sustain,
  stab o arpeggio; il pad usa un voicing piu' largo.
- **Variation** agisce sulle prossime generazioni (densita', fill, complessita' ritmica),
  **Humanize** agisce subito su playback ed export (timing, velocity, durate).
- Ogni beat ha un **seed**: con lo stesso seed la generazione e' identica.

---

## PWA e salvataggi

- `manifest.json`, service worker con precache (Workbox) e supporto offline completo dopo il
  primo caricamento: la generazione, l'audio e l'export MIDI non richiedono rete.
- Installabile da desktop e mobile, icone 192/512 e maskable incluse.
- I progetti vengono salvati in **IndexedDB** (con fallback su localStorage): salva, apri,
  duplica ed elimina dal pannello *Progetti*. L'ultima sessione viene ripristinata dalla
  schermata iniziale.

---

## Stack

React 19, TypeScript, Vite 7, Tailwind CSS 3, Tone.js 15, zustand, fflate, vite-plugin-pwa.

## Deploy

La build e' completamente statica: basta pubblicare la cartella `dist/` (Netlify, Vercel,
GitHub Pages, qualunque hosting statico). Per pubblicare in una sottocartella usa
`VITE_BASE=/percorso/ npm run build`.
