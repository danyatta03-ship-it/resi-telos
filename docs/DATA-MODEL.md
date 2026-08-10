# Data Model — Resi Telos

## 1. Il record "reso" (`row`)

Ogni reso è un oggetto piatto. Vive in memoria come `rows[key]` (dizionario
per chiave), viene sincronizzato su Firebase in `returns/<key>` e cachato
localmente su IndexedDB (chiave `td`).

| Campo | Tipo | Descrizione | Set/aggiornato da |
|---|---|---|---|
| `_key` | string | ID univoco `r<ts><rand>` (rows vivi) o `tri_<n>` (pregresso) | `handleLocal.add` / `db_tri.json` |
| `_ts` | number | timestamp di creazione (ms) | `handleLocal.add` |
| `_who` | string | operatore che ha inserito (deviceName) | `addRow` |
| `_role` | string | ruolo alla creazione | `addRow` |
| `_lastEdit` | string | ultimo operatore che ha modificato | `svEdit`, `qkSt` |
| `_lastEditTs` | number | timestamp ultima modifica | `svEdit` |
| `_lastEditRole` | string | ruolo dell'ultima modifica | `svEdit` |
| `_log` | Array | audit interno per-record `[{ts,user,action,changes}]` (max 20) | `handleLocal` |
| `_frozen` | boolean | record del pregresso (read-only base) | derivato per `tri_*` |
| `_photoPez` | string dataURL | foto pezzo chiusura MAG (max 1024px, JPEG .8) | `_pickFotoWorkflow('pez')` |
| `_photoPezTs` | number | ts scatto foto pezzo | `_pickFotoWorkflow` |
| `_photoFin` | string dataURL | foto bolla firmata corriere (FINALE) | `_pickFotoWorkflow('fin')` |
| `_photoFinTs` | number | ts scatto foto FINALE | `_pickFotoWorkflow` |
| **Anagrafica** | | | |
| `datArr` | ISO date | data listato bolla | RIC (`hArr`) |
| `datElab` | ISO date | data elaborazione UFF | UFF |
| `vetRic` | string | vettore ricevimento (CIPI/CITYLINE/…) | RIC (`hVet`) |
| `vetUsc` | string | vettore uscita | UFF/MAG |
| `sogg` | string | codice cliente + " - " + nome (o solo nome) | RIC (`hSogg`) |
| `agente` | string | agente commerciale | auto da `CLI_AGENTS` |
| **Articolo** | | | |
| `pre` | string (2-4) | sigla marca (KET, BKS, NGK, …) | RIC/OCR |
| `cod` | string | codice articolo intero | RIC/OCR |
| `qty` | number | quantità pezzi | RIC/OCR |
| `prc` | number | prezzo unitario € | RIC/OCR |
| `forn` | string | fornitore | RIC/OCR/auto |
| **Classificazione** | | | |
| `causale` | string ∈ `CAULIST` | motivo del reso (GARANZIA, CARCASSA, ERRATA SPEDIZIONE, …) | RIC/OCR |
| `anomalia` | string ∈ `CAU_SUBS[causale]` | sub-anomalia | RIC (opz.) |
| `flusso` | string | STANDARD / FILIALE IN / FILIALE OUT / ANOMALIA / ECCEZIONE | RIC + auto |
| `tipoDoc` | string | FLOTTA/SCONTRINO/FATTURA/VENDITA/BL/TRA/… | RIC/OCR |
| **Ciclo** | | | |
| `fase` | string ∈ `FASI_ORDER` | RICEVIMENTO / UFFICIO RESI / MAGAZZINO / FINALE | avanzamento |
| `stato` | string ∈ `STATI[fase]` | vedi tabella stati sotto | qkSt/svEdit |
| `datSta` | ISO date | data cambio stato | qkSt/svEdit |
| `datAcqForn` | ISO date | data acquisto dal fornitore (per calcolo scadenza garanzia) | RIC/UFF |
| **RMA/RNC/mail** | | | |
| `rma` | string | numero RMA/RNC fornitore | UFF |
| `contatto` | string | riferimento contatto fornitore | UFF |
| `datCon` | ISO date | data contatto | UFF |
| **MAGAZZINO** | | | |
| `colli` | number | numero colli chiusi | MAG |
| `tipoImb` | string | SCATOLA / BANCALE / A VISTA / SACCO / MISTO | MAG |
| **FINALE / NR** | | | |
| `motivoNR` | string | motivo se stato ~ NON RENDIBILE (embedded nel nome stato o legacy) | UFF/MAG/ADM |
| **Foto/allegati** | | | |
| `photo` | string filename | nome foto principale (bolla) | RIC |
| `photoThumb` | string dataURL | thumbnail 200px | RIC |
| `photoKeys` | Array<string> | tutti i file allegati (foto pezzo, anomalie, documenti) | RIC |
| **Altro** | | | |
| `docRic` | string | tipo doc ricezione | UFF |
| `datDoc` | ISO date | data ricezione doc | UFF |
| `note` | string | testo libero | tutti |

## 2. Stati per fase (`STATI[fase]`)

**RICEVIMENTO (4)**
- DA GESTIRE ⏳ · OK PER UFFICIO · ANOMALIA RICEVIMENTO · STALLO RICEVIMENTO

**UFFICIO RESI (9)**
- DA GESTIRE ⏳ · OK PER UFFICIO
- RICHIESTA ATTESA APPROVAZIONE ⏳
- RICHIESTA ✅ - ACCUMULARE
- RICHIESTA ✅ - FARE RNC (FILIALE)
- RNC 🔓 - ACCUMULARE (SOLO DDT SENZA RIF AQ)
- RNC ✅ - FARE RICHIESTA (FILIALE)
- STALLO UFFICIO · ANOMALIA UFFICIO

**MAGAZZINO (4)**
- CHIUDERE · PRESA LOGISTICA · ANOMALIA MAGAZZINO · STALLO MAGAZZINO

**FINALE (23)**
- NOTA CREDITO FORNITORE
- NON RENDIBILE — 7 varianti:
  - COSTI DI TRASPORTO · FUORI TEMPISTICA · IMPORTO INFERIORE
  - IMPORTO INFERIORE E FUORI TEMPISTICA
  - FUORI TEMPISTICA E COSTI DI TRASPORTO
  - COSTI DI TRASPORTO E IMPORTO INFERIORE
  - TUTTE LE CASISTICHE
- VENDUTO CLIENTE · STOCK MAGAZZINO · TRASFERITO FILIALE
- ROTTAMATO - FILIALE · ROTTAMATO - CLIENTE · REVISIONATO
- ADDEBITATO VETTORE PIEMME · ADDEBITATO VETTORE CIPI
- SOSTITUZIONE GARANZIA - STOCK
- RIFIUTO FORNITORE - STOCK · RIFIUTO FORNITORE - ROTTAMAZIONE & COMMERCIALE
- COMMERCIALE - ROTTAMATO · COMMERCIALE - REN
- COMMERCIALE - SCONTO MERCE · COMMERCIALE - BST

## 3. Causali (`CAULIST`, 17)

`"NON CONFORME" - ERRATO ORDINE` · `"RESO/RESO MERCE" - ERRATO ORDINE` ·
`"NO CAUSALE" - ERRATO ORDINE` · `ERRATA SPEDIZIONE` ·
`ORDINE DISDETTO CLIENTE` · `ORDINE MULTIPLO` ·
`ERRATA COMPARAZIONE CATALOGO` · `DIVERSO DA OE/INCOMPATIBILE` ·
`ERRATO CONFEZIONAMENTO` · `INCOMPLETO - MANCA UN PZ ALL'INTERNO` ·
`CARCASSA` · `GARANZIA` · `GARANZIA MANODOPERA` ·
`GARANZIA DANNI E MANODOPERA` · `DANNEGGIATO - SEGNALATO AL BANCO` ·
`PERVENUTO MONTATO/SPORCO AL CLIENTE DA RESO` ·
`PERVENUTO MONTATO/SPORCO AL CLIENTE DA FORNITORE`

## 4. Anagrafiche esterne (`data JSON`)

### `cli_data.json` (~61k voci)
```json
{
  "007183": "AUTOFFICINA ROSSI SNC|01",
  "009997": "MOTORTECNICA SRL|03",
  ...
}
```
Formato: `codCliente → "Ragione Sociale|codFiliale"`.
- `codFiliale === "01"` → filiale sede.
- `codFiliale !== "01"` → attiva **flusso FILIALE IN** automatico (v34ac).

### `CLI_FIL` (in `index.html`, ~20 voci)
```js
CLI_FIL = { "01": "CIPI/PIEMME", "02": "CITYLINE", "03": "NAZ/INT", ... }
```
Mappa `codFiliale → vettore uscita preferenziale`.

### `client_agents.json`
```json
{
  "007183": "Votano Alessandro",
  ...
}
```

### `db_tri.json` (pregresso, ~7k righe)
Array di record identici allo schema `row` sopra, ma marcati `_frozen=true`
runtime e con `_key` che inizia per `tri_`.
Read-only lato client: le modifiche vengono salvate in `TRI_OVR`
(localStorage) e riapplicate via `triApplyOvr(r)` in lettura.

### `GARANZIE_DB` (in `index.html`, ~80 fornitori)
Regole per fornitore:
```js
{
  "BOSCH": {
    codVet: "994",
    giorni: "",              // giorni ammessi (vuoto = illimitato)
    valoreMin: 0.0,          // importo minimo (< → NON RENDIBILE)
    documenti: ["BOLLA","MODULO","LIBRETTO","RELAZIONE E/O RICEVUTA DI INSTALLAZIONE","CIPI/PIEMME"],
    vettore: ""
  },
  "MF PINTO": { ... },
  ...
}
```
Usata da:
- `showGaranziaDocsPopup(forn)` — popup documenti quando causale = GARANZIA.
- `checkForzaNonRendibile({forn, prc, datAcqForn})` — forzatura NR.

## 5. Storage locale del client

### `localStorage`
| Chiave | Contenuto |
|---|---|
| `fbcfg` | `{apiKey, dbUrl}` — credenziali Firebase (salvate dal popup di connessione). |
| `codemem` | Mappa `cod → {pre, qty}` per auto-completamento futuro. |
| `codFornMem` | Mappa `pre|cod → fornitore` (auto-fill per OCR). |
| `triovr` | `TRI_OVR = { 'tri_N': {campo: valore, ...} }` — override per il pregresso. |
| `_ofpBuf` | Coda sync offline (v34w): `sendMsg` bufferizzati quando FB_REF è null. |
| `secLogBuf` | Buffer offline per `security_log/mods`. |
| `secLogAccBuf` | Buffer offline per `security_log/access`. |
| `_ocrLiveBuf` | Buffer offline per invio scans SCA → RPC. |
| `_killAck` | Ultimo `_killswitch.ts` visto dal client (per non triggerare wipe due volte). |
| `notif_prefs` | Preferenze notifiche (Centro Notifiche). |
| `notif_log` | Log eventi del Centro Notifiche. |
| `pkgKeys` | Elenco chiavi delle foto pacco (`pkg_*`) in IndexedDB. |
| `_insertUndoStack` | Stack di batch chiavi (v34v) per undo inserimenti OCR. |

### `IndexedDB` (via helper `idbGet/idbSet/idbDel/idbKeys`)
| Chiave | Contenuto |
|---|---|
| `td` | Cache di `rows` (dump JSON) — usata per il boot offline. |
| `tarch` | Cache di `arch` (record archiviati). |
| `pkg:<id>` | Foto pacco con metadata: `{id, ts, tag, by, dataUrl}`. |
| `<gardoc_filename>` | Foto documento garanzia caricata da popup. |
| `<foto_anomalia_filename>` | Foto anomalie ricevimento. |

## 6. Path Firebase Realtime DB

```
returns/                         ← rows condivisi (chiave = _key)
├── r<ts><rand>/                 (record vivo)
└── ...
pkgphotos/                       ← foto pacco condivise
└── pkg_<ts>_<rand>/{id,ts,tag,by,dataUrl}
presence/                        ← presence tracker per pill "N online"
└── d<deviceId>/{name, role, ts}
security_log/
├── access/<push>/{ts, device, name, role, action, ua}
└── mods/<push>/{ts, device, name, role, action, key, extra}
ocrLive/                         ← scans SCA → RPC (v34o+)
└── <push>/{ts, sender, articoli, sogg, forn, causale, vetRic, flusso, ...}
_killswitch/                     ← kill switch remoto
└── {ts, msg}
chat/                            ← chat interna (v36+)
└── messages/<push>/{ts, user, role, text}
notif/                           ← notifiche cross-device (v34f)
└── <deviceId>/<push>/{ts, kind, text}
mfu/                             ← follow-up mail (v34b)
└── <push>/{...}
arrivi_bancale/                  ← storico bancali (v29)
└── <push>/{...}
```

## 7. Costanti runtime notevoli

Definite in `index.html`:

| Costante | Uso |
|---|---|
| `FASI_ORDER` | `['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE']` |
| `NEXT_FASE` | mappa fase → fase successiva |
| `PREV_FASE` | mappa fase → fase precedente (per canSendBack) |
| `LIST_PAGE`, `QUEUE_PAGE` | paginazione liste (default 100) |
| `SLA_WARN`, `SLA_CRIT` | soglie giorni di fermo (7 warn / 14 crit) |
| `HDR` | headers export Excel/CSV (28 colonne) |
| `MOTIVI_NR` | motivi standard NR usati nel popup legacy |
| `CYCLES_ORDER` | ordine cicli logistici (INTERCOMPANY, CATI, …) |
| `CYCLES_ICON`, `CYCLES_COLOR` | icona/colore per raggruppamento cicli |

## 8. Auto-mappe derivate a runtime

Costruite on-demand con cache breve (60s):

- **`COD_FORN_MEM` / indice `_CODF_IDX_CACHE`** (v34y)
  Cod → Forn dedotto da `DB_TRI` + `rows` + memoria locale.
  API: `fornForCod(pre, cod) → string` · `rememberCodForn(pre, cod, forn)`.

- **`CODE_MEM`** (v22+)
  Cod → `{pre, qty}` per riempire il PRE quando OCR non lo trova.
  API: `loadCodeMem()` · `saveCodeMem()`.

- **`TRI_OVR`** — override modifiche sul pregresso, applicate da
  `triApplyOvr(r)` in fase di lettura.
