# Changelog — Resi Telos

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/).
La versione bumpata compare in `sw.js` (`CACHE`) e in `index.html`
(`appVersionLbl` + footer link).

---

## [v35c] – 2026-08-11

### Cambiato
- **OCR AI · mapping colori causali** — chiarita la separazione:
  - 🟢 Verde → **CARCASSA** (solo carcasse)
  - 🟡 Giallo → **RENDERE AL FORNITORE** (invece che CARCASSA)
  - 🟠 Arancione → GARANZIA (invariato)
  - 🔴 Rosso → ANOMALIA + flusso ANOMALIA (invariato)
  - ⬜ Stock / non evidenziato → nessuna causale automatica

## [v35b] – 2026-08-11

### Migrato
- **db_tri.json**: 1001 righe con `fase=RICEVIMENTO` + `stato~DA GESTIRE`
  spostate a `fase=UFFICIO RESI` + `stato=DA GESTIRE ⏳` (script Python
  idempotente).

### Cambiato
- Prompt OCR AI: nuovo mapping `causale_colore` (poi corretto in v35c).

## [v35a] – 2026-08-11

### Aggiunto
- **Modalità RICEVIMENTO MANUALE** (`✏️ MAN`) come terza opzione nel
  mode-picker RICEVIMENTO, oltre a Scanner Bolle e Ricevimento PC.
  Rimostra il form classico (data listato / codice / prezzo / causale /
  fornitore / fase / stato) e un pulsante "← Cambia modalità".

## [v35] – 2026-08-11

### Merge branch review `claude/resi-admin-customization-3ijstl` (8 commit)

Cambiamenti aggregati:

- **Rinomina UI**: TRIMESTRE → PREGRESSO, STORICO → RESOCONTO. Variabili
  interne (`db_tri`, `pgTri`, `_frozen`) intatte per retrocompatibilità.
- **`STATI['FINALE']` esteso da 10 a 23 voci** dal foglio LISTE del xlsm
  master (NOTA CREDITO FORNITORE, 7 varianti NON RENDIBILE, ADDEBITATO
  VETTORE PIEMME/CIPI, RIFIUTO/COMMERCIALE/ROTTAMATO, ecc.).
- **`db_tri.json` rigenerato** dal xlsm master: **6.986 righe** (era ~6.164),
  tutti i 24 campi mappati sullo schema esistente.
- **Ciclo → resi UFFICIO**: pulsante "→ N UFF" nella modale Cicli fornitori,
  apre `showResiByCycle()` con lista ordinata + click riga.
- **FINALE gated foto bolla firmata corriere** (eccezione GLS): scatta SOLO
  sulla vera transizione a FINALE, mai su pregresso o legacy.
- **MAGAZZINO campi extra**: `colli` (numero) + `tipoImb` (SCATOLA/
  BANCALE/A VISTA/SACCO/MISTO). Pulsante "📷 Foto pezzo chiusura" salva
  `_photoPez` e auto-imposta stato `PRESA LOGISTICA`.
- **OCR AI potenziato** (via `extPrompt`):
  - `tipo_documento` (SCONTRINO/FATTURA/BL/TRA/…) mappato al select TIPO DOC.
  - `codice_cliente` (scontrino/fattura) → prefill soggetto se vuoto.
  - `causale_colore` da evidenziatore (arancione/rosso/verde/giallo).
- **Auto-stato solo in RICEVIMENTO** (`DA GESTIRE ⏳` precompilato). Nelle
  altre fasi lo stato va scelto manualmente.
- **Lista prelievo per ciclo** (`showPickingList`): raggruppa MAG CHIUDERE
  + PRESA LOGISTICA + UFF RNC valorizzato, ordinati per priorità con thumb
  foto, chip RMA + colli/imballo.
- **Archivio pratica** nella modifica reso: 3 tessere colorate
  (RIC blu / MAG giallo / FIN verde) con foto della fase o placeholder,
  timestamp, viewer inline fullscreen.
- **Dashboard rigenerata**: `renderChart()` mostra 4 gruppi (CAUSALI/FLUSSI/
  FASI/STATI) con TUTTE le voci del DB; conteggio 0 in grigio (barra minima).
- **7 code-review fix** + followup residui:
  - `openSheet()` → `editRow()` nelle modali cicli + picking list.
  - Helper `isNR(s)` + `nrStatoFromMotivo(motivo)` per compat con vecchia
    stringa liscia `'NON RENDIBILE'`.
  - `editRow` preserva stati legacy assenti dal dropdown (stesso pattern
    di anomalia).
  - `qkSt` / `onStatoChange` / `onEiStatoChange` gestiscono le nuove varianti
    NR senza aprire popup superfluo né cancellare `motivoNR` esistente.
  - `_pickFotoWorkflow` supporta i record pregresso (`tri_*`) salvando
    le foto in `TRI_OVR`.
  - Renderer UI (chip motivoNR, tabella storico, dashboard) usano `isNR`
    invece di `===`.
  - Residui `capture()` mancanti in `resi-generico` (blocks.js form fields,
    ui.js columns editor).
- **`resi-generico/`**: page builder white-label autonomo (schema-driven,
  admin login "admin", nessun Firebase, 20+ block types).

## [v34ac] – 2026-08-10

### Aggiunto
- **Cliente con filiale ≠ 01 → flusso FILIALE IN automatico** in
  `pickSogg()`. Se il codice cliente ha `CLI_DATA[cod].split('|')[1]`
  diverso da "01"/"1", il flusso viene forzato a `FILIALE IN` sia nel
  form manuale che sulle righe OCR non ancora scelte.
- **FILIALE IN skip validation**: in `addRow` e `applyOcrConfirm`
  l'unico campo obbligatorio è il CODICE. Fornitore/causale/fase/stato/
  data listato/vettore/tipo doc tutti opzionali.

## [v34ab] – 2026-08-10

### Cambiato
- **Nuova icona PWA** (icon-192.png + icon-512.png): logo Telos (freccia
  diamante blu + scritta) su fondo bianco, invece della vecchia freccia
  return.

## [v34aa] – 2026-08-10

### Corretto
- **Blocco SCA popup conferma OCR risolto**: il label pulsante e la
  visibilità di "Precompila solo il form" usavano `ROLE==='SCA'` invece di
  `_isMode('SCA')`. Ora la modalità Scanner Bolle dal mode-picker mostra
  correttamente "✓ Invia al PC (senza compilare campi)" e nessun blocco.

### Cambiato
- **Ritaglio OCR come chip fluttuante** in basso a destra durante la
  lettura (era pulsante nel panel SCA). Se non tocchi, la foto intera viene
  letta. Se tocchi `✂ Ritaglia`, sessione OCR invalidata via token e apre
  il crop overlay sulla stessa foto.

## [v34z] – 2026-08-10

### Cambiato
- **SCA scanner senza blocchi**: `applyOcrConfirm` in SCA bypassa la
  validazione (bastava già `_isMode('SCA')`). Anche con zero articoli
  la scansione parte per il PC.

## [v34y] – 2026-08-10

### Aggiunto
- **Auto-fornitore per riga OCR** da mappa storica cod→forn
  (`COD_FORN_MEM` + `DB_TRI` + `rows`). `fornForCod(pre, cod)` restituisce
  il fornitore storico più frequente; `rememberCodForn` persiste in
  localStorage le correzioni manuali.
- **Popup GARANZIA per fornitore riga**: `ocrRowOnCauChange` passa il
  fornitore della riga specifica a `showGaranziaDocsPopup(fornOverride)`
  invece del campo globale.

## [v34x] – 2026-08-10

### Corretto
- **OCR precodice fix (KET/KDF034)**: nuova regola nel prompt AI
  "DUE COLONNE SEPARATE" con esempi (KET+KDF034, BKS+SGM0009R,
  MAL+48244KLR). Rete di sicurezza post-processing per ricomporre codice
  spezzato (`pre="KDF" cod="034"` → `cod="KDF034"`).

### Cambiato
- **Crop UI opt-in**: rimosso l'overlay ritaglio automatico. Foto → OCR
  diretto su tutta la foto. Nuovo pulsante `✂ Ritaglia prima di leggere`
  nel panel SCA come opzione. Pulsanti dell'overlay ritaglio resi
  visibili (bordi bianchi + ombra, no sfumature).

## [v34w] – 2026-08-10

### Aggiunto
- **Light mode aggressive**: icone/bordi blu (#3B9FD4), testo nero,
  pulsanti blu+nero. Eccezioni: ANOMALIA rossa, FILIALE IN azzurra.
- **Offline sync buffer**: `_ofpBuf` in localStorage cattura scritture
  `sendMsg` quando `FB_REF` è nullo, flush a riconnessione.

### Cambiato
- Tab STORICO riordinati: `DASH · GALLERIA · ARCHIVIO · TEMPI · EXPORT`.
- "Versione app" spostato da LOGISTICA → Fornitori a STORICO → Export.
- Card fornitori `.sup-card` in light mode: bordi/sfondo blu (fix
  "juventini" residui).

## [v34v] – 2026-08-09

### Aggiunto
- **Undo inserimento OCR** con stack di chiavi + toast "↶ ANNULLA".
- **Auto-focus prossimo campo** (`ocrRowFocusNext`) per velocità
  inserimento.

### Corretto
- Blocco RICEVIMENTO + flusso ANOMALIA + stato "DA GESTIRE" (incoerente).

## [v34u] – 2026-08-09

### Aggiunto
- **Mode picker RICEVIMENTO**: dopo login RIC, scelta tra Scanner Bolle e
  Ricevimento PC (Manuale aggiunto in v35a). Pulsante "← Cambia modalità".

---

## Versioni precedenti (v33 → v34t)

Storia più antica ricostruibile via `git log --oneline main`.

Milestones principali:
- **v34b/c** (2026-06/07): infrastruttura notifiche + follow-up mail +
  Centro Notifiche.
- **v34e** (2026-06): forzatura NON RENDIBILE su fuori tempistiche /
  importo minimo.
- **v34g2** (2026-06): light mode completo.
- **v34i2** (2026-07): nuovo logo Telos v2 in header + popup selezione ruolo.
- **v34y** (2026-08): sync foto pacco su Firebase.
- **v33** (2026-04): pannello Admin protetto (PIN AttaDani260403).
- **v32** (2026-03): blocco RMA, anomalie per agente, Firebase RTDB,
  spunte + Richiedi Presa, log mail, statistiche fasi.
- **v29** (2026-01): dati/UX/fornitori/foto pacco.
- **v28** (2025-12): sostituito footer Excel/CSV con Chat e Copilota AI.
- **v25 bis** (2025-11): registrazione client_agents nel service worker.
- **v22** (2025-09): OCR multi-riga + prompt AI + modifica su storico.
- **v21** (2025-09): Proxy Netlify Function per Gemini.
- **v13** (2025-06): ritaglio guidato pre-OCR + prompt multi-articolo.
- **v1** (2025-04): prima versione con `dev-server` locale.
