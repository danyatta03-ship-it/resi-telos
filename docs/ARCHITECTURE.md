# Architettura — Resi Telos

## 1. Panoramica

Applicazione PWA client-heavy. Nessun server applicativo: la persistenza
condivisa è delegata a **Firebase Realtime Database**, mentre l'unico
endpoint server-side custom è una **Netlify Function** che fa da proxy alla
Google Gemini API (per non esporre la chiave AI al client).

```
    ┌──────────────────────────────────────┐
    │            CLIENT (browser)          │
    │  ┌──────────────────────────────┐    │
    │  │ index.html (~14k righe)      │    │
    │  │  • UI + logica business      │    │
    │  │  • sync layer                │    │
    │  │  • OCR AI orchestration      │    │
    │  │  • foto/anomalie/mail        │    │
    │  └──────────────────────────────┘    │
    │  ┌──────────┐  ┌──────────┐          │
    │  │ localStg │  │IndexedDB │          │
    │  │  cfg,    │  │ rows     │          │
    │  │  memorie │  │ cache,   │          │
    │  │          │  │ foto     │          │
    │  └──────────┘  └──────────┘          │
    │  ┌──────────────────────────────┐    │
    │  │ Service Worker (sw.js)       │    │
    │  │  cache-first per anagrafiche │    │
    │  │  network-first per shell     │    │
    │  └──────────────────────────────┘    │
    └────────┬─────────────────────┬───────┘
             │                     │
             │ HTTPS               │ WebSocket (RTDB SDK)
             ▼                     ▼
    ┌────────────────┐   ┌─────────────────────┐
    │  Netlify       │   │  Firebase Realtime  │
    │  Function      │   │  Database           │
    │  gemini.js     │   │                     │
    │  → Gemini API  │   │  returns/           │
    │                │   │  pkgphotos/         │
    │                │   │  presence/          │
    │                │   │  security_log/      │
    │                │   │  ocrLive/           │
    │                │   │  _killswitch        │
    └────────────────┘   └─────────────────────┘
```

## 2. File principali

| File | Responsabilità |
|---|---|
| `index.html` | SPA monolitica: HTML markup + CSS inline + JS inline. Contiene tutto (UI, business logic, sync, OCR, foto, export, admin). |
| `sw.js` | Service Worker PWA. Cache-first per anagrafiche e librerie, network-first per la shell. Costante `CACHE` versionata a ogni release. |
| `manifest.json` | Manifest PWA (nome, icone, start_url, display standalone). |
| `netlify/functions/gemini.js` | Proxy HTTP → Gemini API. Riceve `messages` dal client, ritorna il testo generato. Usa `process.env.GEMINI_API_KEY`. |
| `netlify.toml` | Config Netlify: redirect `/api/gemini` → funzione, cartella pubblica, headers CORS. |
| `dev-server.js` | Server locale Express + WebSocket per dev senza Firebase (simula sync via WS). |
| `ocr-config.js` | Endpoint AI + soglie OCR (timeout, retry, temp). |
| `db_tri.json` | Storico "pregresso" (~7k righe). Solo-lettura runtime; le modifiche vanno in `TRI_OVR` locale. |
| `cli_data.json` | Anagrafica clienti Telos (~61k voci): `codCliente → "Nome|codFiliale"`. |
| `client_agents.json` | Mappa `codCliente → agente commerciale`. |
| `resi-generico/` | App white-label indipendente (page builder statico). Non condivide codice con la main app. |

## 3. Ciclo di vita di un reso

```
   ┌─────────────────────────────────────────────────────────────────┐
   │ INSERIMENTO                                                      │
   │                                                                  │
   │  RIC (Ricezione)                                                 │
   │   ├─ 📱 SCA (Scanner Bolle mobile)                               │
   │   │    Foto → OCR AI → invio realtime a RPC via Firebase        │
   │   ├─ 💻 RPC (Ricevimento PC)                                     │
   │   │    Riceve scans dal mobile → completa campi                 │
   │   └─ ✏️ MAN (Manuale)                                            │
   │        Form classico compilato a mano                            │
   └────────────────────────┬─────────────────────────────────────────┘
                            │ addRow / applyOcrConfirm
                            ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ RICEVIMENTO                                                      │
   │  Stati: DA GESTIRE ⏳ · OK PER UFFICIO ·                         │
   │         ANOMALIA RICEVIMENTO · STALLO RICEVIMENTO                │
   │                                                                  │
   │  Auto-avanzamento a UFFICIO RESI se stato "pulito"               │
   │  (nessuna anomalia, no flusso ANOMALIA, no stallo).              │
   │                                                                  │
   │  ANOMALIA RICEVIMENTO → richiede foto obbligatoria +             │
   │  causale + non può restare "DA GESTIRE".                         │
   └────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ UFFICIO RESI (9 stati)                                           │
   │  • DA GESTIRE ⏳ / OK PER UFFICIO                                 │
   │  • RICHIESTA ATTESA APPROVAZIONE ⏳                               │
   │  • RICHIESTA ✅ - ACCUMULARE                                      │
   │  • RICHIESTA ✅ - FARE RNC (FILIALE)                              │
   │  • RNC 🔓 - ACCUMULARE (SOLO DDT SENZA RIF AQ)                    │
   │  • RNC ✅ - FARE RICHIESTA (FILIALE)                              │
   │  • STALLO UFFICIO / ANOMALIA UFFICIO                              │
   │                                                                  │
   │  Blocco: transizione a MAGAZZINO richiede RMA/RNC + data         │
   │  acquisto dal fornitore.                                         │
   └────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ MAGAZZINO                                                        │
   │  Stati: CHIUDERE · PRESA LOGISTICA ·                             │
   │         ANOMALIA MAGAZZINO · STALLO MAGAZZINO                    │
   │                                                                  │
   │  Campi extra: n. colli + tipo imballo                            │
   │  (SCATOLA/BANCALE/A VISTA/SACCO/MISTO).                          │
   │  📷 "Foto pezzo chiusura" auto-imposta stato PRESA LOGISTICA.    │
   └────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ FINALE (23 stati)                                                │
   │  • NOTA CREDITO FORNITORE                                        │
   │  • NON RENDIBILE ×7 (varianti: costi trasporto / fuori tempistica│
   │    / importo inferiore / combinate)                              │
   │  • VENDUTO CLIENTE · STOCK MAGAZZINO · TRASFERITO FILIALE        │
   │  • ROTTAMATO (FILIALE / CLIENTE) · REVISIONATO                   │
   │  • ADDEBITATO VETTORE (PIEMME / CIPI)                            │
   │  • SOSTITUZIONE GARANZIA - STOCK                                 │
   │  • RIFIUTO FORNITORE - STOCK / ROTTAMAZIONE & COMMERCIALE        │
   │  • COMMERCIALE (ROTTAMATO / REN / SCONTO MERCE / BST)            │
   │                                                                  │
   │  BLOCCO transizione a FINALE: foto della bolla FIRMATA           │
   │  dal corriere obbligatoria (eccezione: vettore = GLS accetta     │
   │  foto senza firma). Non si applica ai record pregresso (tri_*).  │
   │                                                                  │
   │  FORZATURA NON RENDIBILE (v34e/v35): se prezzo < valoreMin del   │
   │  fornitore oppure fuori tempistica (giorni_reso), lo stato viene │
   │  forzato alla variante NR corrispondente in fase FINALE.         │
   └─────────────────────────────────────────────────────────────────┘
```

## 4. Ruoli e permessi (matrice `ROLE_PERMS`)

| Ruolo | canAdd | canDelete | canEditFasi | canAdvanceTo | canViewPhases | canViewOwnOnly | canSeeTabs |
|---|:-:|:-:|---|---|---|:-:|---|
| **SCA** | ✗ | ✗ | — | — | * | ✓ | pgIns |
| **RPC** | ✓ | ✗ | RIC | UFF | * | ✗ | pgIns, pgList |
| **RIC** | ✓ | ✗ | RIC | UFF | * | ✓ | pgIns, pgList |
| **UFF** | ✓ | ✗ | tutte | tutte | UFF (default), + tutte | ✗ | * |
| **MAG** | ✓ | ✗ | RIC/UFF/MAG | UFF/MAG/FIN | MAG (default), + tutte | ✗ | * |
| **ADM** | ✓ | ✓ | tutte | tutte | tutte | ✗ | * |

`canSendBack` = true per UFF, MAG, ADM.

## 5. Modalità RICEVIMENTO (mode picker)

Dopo il login del ruolo RIC, l'operatore sceglie tra 3 modalità
(memorizzate in `sessionStorage.devmode`):

- **📱 SCA** — Scanner Bolle: singolo pulsante camera → OCR AI su tutta la
  foto → invio del payload a Firebase `ocrLive/`. Nessuna validazione, zero
  campi obbligatori (deve essere velocissimo sul mobile).
- **💻 RPC** — Ricevimento PC: elenca in tempo reale le scans in arrivo,
  permette di elaborarle una per una nel form completo.
- **✏️ MAN** — Manuale: form classico completo (data listato, codice,
  prezzo, causale, fornitore, fase, stato).

Il CSS a `data-mode="XXX"` nasconde tutto il resto in `pgIns` così ogni
modalità mostra solo il suo pannello.

## 6. OCR AI — pipeline

1. **Camera / file input** → `ocrDocument()`.
2. Foto salvata in `_ocrLastRaw`.
3. **`ocrViaAI(dataUrl, cb)`**:
   - Downscale a 1400px (JPEG 0.75).
   - `POST /api/gemini` con prompt vision italiano specializzato per bolle/DDT:
     - Regole per estrarre `pre` (marca 2-4 lettere) + `codice` intero.
     - Rilevamento anomalie (timbro/etichetta grafica evidente).
     - Rilevamento `tipo_documento` (SCONTRINO/FATTURA/BL/TRA/...).
     - Rilevamento `codice_cliente` (solo scontrini/fatture).
     - Rilevamento `causale_colore` da evidenziatore:
       - 🟠 ARANCIONE → GARANZIA
       - 🔴 ROSSO → ANOMALIA (+ flusso)
       - 🟢 VERDE → CARCASSA
       - 🟡 GIALLO → RENDERE AL FORNITORE
       - ⬜ STOCK / non evidenziato → nessuna causale automatica
   - Timeout 20s. Se trova 1 solo articolo, retry con prompt più insistente.
4. **`normalizeAIResult(obj)`**: mappa i campi al modello interno, auto-fill
   di `fornitore` da storico (via `fornForCod`), auto-riconoscimento cliente
   (via `CLI_DATA`), filtro anti-falso-positivo su anomalie.
5. **`showOcrConfirm(res, dataUrl, source)`**: dialog editabile riga per
   riga (pre/cod/qty/prc/causale/fornitore/flusso/tipoDoc/fase/stato/dataAcq).
6. **`applyOcrConfirm(allArticles)`**: valida (o skippa in SCA), inserisce
   via `addRow` per ogni articolo.

Fallback offline: **Tesseract.js** su immagine pre-elaborata (`ocrPreprocess`)
+ parser regex `parseDDT`.

## 7. Sync Firebase

Al login Firebase (`_fbConnectDb`):

- Collegamento a `returns/` (rows condivisi).
- `.info/connected` → aggiorna pill ONLINE/OFFLINE.
- Presence su `presence/<deviceId>`.
- Killswitch listener su `_killswitch`.
- **Sync incrementale** su `returns/`:
  - `once('value')` per il carico iniziale.
  - `on('child_added' / 'child_changed' / 'child_removed')` per i delta
    (~1KB per modifica vs 5.8MB del vecchio full replay).
- Se il DB è vuoto → upload delle rows locali (bootstrap primo device).

**Offline resilience** (v34w):
- `sendMsg()` bufferizza in `localStorage._ofpBuf` le scritture eseguite
  quando `FB_REF` è `null`.
- Al primo login/riconnessione, `_ofpFlush()` rispedisce tutta la coda in
  ordine (add/update/remove/archive/clear) con snapshot delle rows.
- Buffer analoghi per `security_log`, `chat/messages`, `ocrLive`.

## 8. Blocchi e automazioni principali

**Blocchi** (rifiutano il salvataggio con toast):
- `addRow`: campi obbligatori (data listato, vettore, codice, fornitore,
  causale, fase, stato, data acquisto fornitore, tipo doc). Skippati per
  FILIALE IN (solo codice richiesto).
- `svEdit` (edit dialog): stessi campi + regole di coerenza:
  - RICEVIMENTO + flusso ANOMALIA + stato "DA GESTIRE" → blocco (v34v).
  - STANDARD + doc BL/FIM|BL/TRA|RESO FILIALE → blocco (v29+).
  - UFF → MAG richiede RMA/RNC + data acq. fornitore.
  - FINALE richiede foto bolla firmata corriere (eccezione GLS,
    esente pregresso e legacy).
  - Con anomalia, non-ADM non può stato "DA GESTIRE" o "STALLO".
- OCR bulk insert (in RPC/manuale): valida per-riga tutti i decisionali;
  skip totale in modalità SCA.

**Automazioni**:
- **Auto-stato solo in RICEVIMENTO** (v35): stato = "DA GESTIRE ⏳"
  precompilato. Nelle altre fasi va scelto manualmente.
- **Auto-avanzamento RIC → UFF** (v34z): se il record è "pulito" (nessuna
  anomalia/stallo/flusso ANOMALIA), viene creato direttamente in UFFICIO
  RESI/DA GESTIRE senza passare da RICEVIMENTO.
- **Auto-fornitore da codice** (v34y): al blur del codice, se `fornitore`
  vuoto, viene compilato dallo storico (via `fornForCod(pre, cod)` che
  aggrega DB_TRI + rows + memoria locale).
- **Filiale ≠ 01 → FILIALE IN** (v34ac): quando il cliente scelto ha una
  filiale diversa dalla sede, il flusso diventa automaticamente
  "FILIALE IN" e nessun campo (oltre al codice) è obbligatorio.
- **NON RENDIBILE forzato** (v34e/v35): se `prc < valoreMin` del fornitore
  o giorni > `giorni_reso`, stato forzato alla variante NR corretta.
- **Cambio stato al "Richiedi presa"** (v34x-2): mail al vettore → stato
  auto in MAG CHIUDERE.

## 9. Sicurezza

- **Auth**: Firebase Anonymous. Ogni scrittura passa dalle regole RTDB.
- **Kill switch**: admin scrive `{ts: Date.now()}` in `_killswitch`;
  ogni client legge, confronta con `localStorage._killAck`, se il ts è più
  nuovo → `performLocalWipe()` (rimuove tutto, mostra schermata blocco).
- **Audit log**:
  - `security_log/access` — login/change device.
  - `security_log/mods` — add/update/remove/archive/clear su `returns/`.
  - Buffer offline in `localStorage.secLogBuf` / `secLogAccBuf`, flush
    a riconnessione.
- **Admin panel**: PIN in `admin-config.json`, si sblocca via popup.
  TODO: spostare in env var.
- **Gemini API key**: solo lato Netlify Function, mai nel client.
- **Foto**: dataURL in IndexedDB locale + Firebase `pkgphotos/` (sync
  bidirezionale via `syncPkgPhotosFromFB`).

## 10. PWA

- `manifest.json`: icona logo Telos (freccia blu + scritta), standalone.
- `sw.js`:
  - Cache-name `resi-telos-vXXX` versionato.
  - Pre-cache: shell, icone, librerie scanner, anagrafiche JSON.
  - Fetch strategy: network-first per HTML, cache-first per anagrafiche
    (con refresh in background).
  - `message` listener per `SKIP_WAITING` → self-update.
- Bottone **"🔄 Aggiorna app"** in STORICO → Export invia SKIP_WAITING e
  ricarica.
- **Auto-update**: al boot il client interroga il SW registrato e mostra un
  toast se c'è una nuova versione in attesa.

## 11. Tempi/Versioni

Un release deve bumpare:
1. `sw.js` → `var CACHE = 'resi-telos-vNNN';`
2. `index.html` → `<b id="appVersionLbl">vNNN</b>`
3. `index.html` → il footer link `vNNN · aggiorna app` (già rebased dallo
   stesso valore in v34+, grep unico).

Vedi **[CHANGELOG.md](../CHANGELOG.md)** per la storia completa v34→v35.
