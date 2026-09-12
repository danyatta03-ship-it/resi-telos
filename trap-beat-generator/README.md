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
  /strumenti
    01_kick.mid    un file per ogni strumento, da trascinare sul singolo canale
    02_snare.mid
    ...
/flstudio
  TrapBeat_*.flp   progetto FL Studio (sperimentale)
/text
  beat-info.txt    BPM, key, scala, mood, progressione, struttura
  struttura.txt    scaletta, accordi per battuta, griglia drum, note di 808 e melodia
```

### Tre modi per portarlo in FL Studio

1. **Tutto in una volta**: trascina `full_beat.mid` nella playlist e scegli
   *import to new channels*. Il Channel Rack si riempie con un canale per strumento.
2. **Uno strumento alla volta**: i file in `/midi/strumenti` si trascinano sul singolo
   canale, comodo per sostituire solo la batteria o solo l'808.
3. **Progetto gia' montato**: apri il `.flp` (sperimentale) e trovi tempo, pattern e playlist.

Il pulsante *Copia struttura* mette negli appunti una scheda di testo con scaletta,
accordi battuta per battuta, griglia delle drum e note di 808 e melodia. Serve come
riferimento mentre lavori: FL Studio non accetta testo incollato nel piano roll.

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

Il motore segue una grammatica precisa, ispirata alla trap italiana moderna nella sua
variante hard, dark e minimale: **una sola idea forte, 808 protagonista, drum con bounce,
e spazio**. Non imita nessun brano: applica le regole comuni di quel linguaggio.

```
src/
  music/       teoria, scale, accordi, progressioni minimali, profili dei mood, parametri
  generator/   identita' del beat, groove condiviso, melodia con punteggio, drum, 808, armonia
  audio/       strumenti Tone.js (timbri legati agli assi), schedule, transport, rendering WAV
  midi/ flp/   export MIDI e progetto FL Studio
  store/       stato globale e persistenza
  components/  interfaccia
```

### I tre assi

Oltre a Variation e Humanize il beat ha tre parametri, impostati dal mood e modificabili
dai cursori nel pannello Generatore:

| Asse | Cosa muove |
| --- | --- |
| **Hardness** | densita' e aggressivita' di cassa e 808, velocity, sincopi, timbri piu' saturi |
| **Darkness** | scelta della scala, registro, tensione armonica, presenza di pad e atmosfera |
| **Space** | quanto silenzio entra nel groove: finestre in cui gli strumenti tacciono insieme |

Hard e Dark restano due cose diverse: un beat puo' essere durissimo e luminoso, cupo e
rarefatto, oppure entrambe le cose (il territorio piu' vicino al target).

### Le regole principali

- **Una sola idea.** Il motivo melodico e il groove nascono una volta per tutto il beat.
  Le sezioni ne cambiano la densita', non il materiale: l'hook e' la stessa frase con piu'
  impatto, non un altro pezzo.
- **Melodia valutata, non casuale.** Ogni motivo candidato riceve un punteggio di
  catchiness, complessita' e groove (ripetizione, auto-somiglianza fra le battute, pause,
  numero di suoni diversi, scale suonate di fila). Se il risultato e' troppo complicato o
  sembra una scala a caso, viene rigenerato, fino a sedici tentativi.
- **808 e cassa nascono insieme.** Un unico groove decide dove appoggia il basso e come la
  cassa gli gira intorno: insieme, in anticipo, in risposta o in silenzio.
- **Poche note.** Tavolozza di 3-5 suoni per la melodia, due o tre accordi, 808 fra una e
  tre note per battuta.
- **Il silenzio e' scritto.** Finestre condivise in cui batteria, 808 e a volte la melodia
  tacciono insieme, e una transizione che svuota l'ultima battuta prima dell'hook.
- **Passaggio di minimalismo.** Se una sezione supera la densita' prevista, il generatore
  toglie elementi invece di aggiungerne: prima percussioni, counter melody e lead, poi,
  a seconda del carattere, il tappeto armonico o gli hi-hat.
- **Counter melody e lead solo se servono.** Probabilita' bassa, poche note, registro diverso.
- **Seed.** Stessi mood, BPM e seed producono lo stesso beat. Melodia e groove hanno un seed
  proprio, cosi' Rigenera Melody non tocca le drum e viceversa.

### Numeri misurati dai test

Media su decine di beat generati (`npm test` stampa la tabella completa):

| Misura | Hard | Dark | Chill |
| --- | --- | --- | --- |
| Note di melodia per battuta | 2,4 | 2,5 | 2,3 |
| Suoni diversi nel motivo | 2-6 | 3-7 | 2-4 |
| Note di 808 per battuta | 1,4-2,9 | 1,4-2,9 | 1,4-2,9 |
| 808 dentro all'accordo | 100% | 100% | 100% |
| Colpi di 808 con la cassa agganciata | 95-100% | 95-100% | 100% |
| Hi-hat per battuta | 8,3 | 8,0 | 4,7 |
| Velocity media delle drum | 119 | 112 | 98 |

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
