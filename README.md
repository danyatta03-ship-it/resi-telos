# Resi Telos

PWA per la gestione operativa del **Reparto Resi** di Telos SPA.
Ricevimento bolle → smistamento in Ufficio Resi → Magazzino → Fase Finale
(nota di credito, non rendibile, addebito vettore, stock, rottamato, ecc.).

- **Utenti**: circa 10-20 operatori del reparto (RIC / UFF / MAG / ADM).
- **Runtime**: browser (installabile su iOS/Android come PWA).
- **Backend**: Firebase Realtime Database + una Netlify Function come proxy a Gemini.
- **Deploy**: automatico su Netlify a ogni push su `main`.

---

## Stack

| Livello | Tecnologia |
|---|---|
| UI + logica client | HTML5 + Vanilla JS (nessun framework), inline in `index.html` |
| Sync multi-utente | Firebase Realtime DB (SDK v10.12 compat) |
| Auth | Firebase Anonymous Auth |
| AI OCR bolle | Google Gemini via proxy Netlify Function (`/api/gemini`) |
| OCR offline (fallback) | Tesseract.js 5, ZXing, html5-qrcode, jsQR |
| Storage locale | localStorage (config/memorie) + IndexedDB (rows cache, foto) |
| PWA | Service Worker (`sw.js`) + manifest.json |
| Dev server locale | `dev-server.js` (Express + WebSocket) |

Nessun build step: `index.html` è servito così com'è. Deploy = `git push`.

---

## Struttura repository

```
resi-telos/
├── index.html                    # SPA monolitica (~14k righe)
├── sw.js                         # Service worker PWA
├── manifest.json                 # PWA manifest
├── icon-192.png, icon-512.png    # Icone PWA
├── dev-server.js                 # Server locale per sviluppo
├── package.json                  # Solo devDependencies (express, ws)
├── netlify.toml                  # Config deploy + funzioni
├── netlify/functions/gemini.js   # Proxy AI (Gemini API)
├── db_tri.json                   # Storico trimestrale (pregresso, ~7k righe)
├── cli_data.json                 # Anagrafica clienti (~61k voci)
├── client_agents.json            # Mappatura cliente → agente commerciale
├── db_import.json                # Snapshot import iniziale
├── admin-config.json             # Config admin (PIN oscurato)
├── ocr-config.js                 # Endpoint AI + soglie OCR
├── html5-qrcode.min.js,          # Librerie scanner offline
│   zxing.min.js, jsqr.js,
│   qrcode-lib.min.js
├── resi-generico/                # App white-label (page builder autonomo)
└── docs/                         # ARCHITECTURE.md, DATA-MODEL.md
```

---

## Quick start (sviluppo locale)

```bash
git clone https://github.com/danyatta03-ship-it/resi-telos.git
cd resi-telos
npm install
node dev-server.js         # http://localhost:3000
```

Il dev-server serve `index.html`, monta le anagrafiche e simula il socket
di sync (in produzione lo sync avviene via Firebase RTDB).

Per testare **con Firebase reale** basta aprire l'app e inserire nel popup
iniziale la coppia `apiKey` + `dbUrl`. Le credenziali vengono salvate in
localStorage (`fbcfg`).

---

## Deploy

Push su `main` → Netlify build → deploy automatico.

- **Netlify Function** `gemini.js` viene esposta su `/api/gemini` (vedi
  `netlify.toml`). Serve la variabile d'ambiente `GEMINI_API_KEY`.
- **Service Worker** ha un cache-name versionato (`resi-telos-vXXX`).
  Ogni release deve bumpare `CACHE` in `sw.js` **e** l'etichetta
  `appVersionLbl` in `index.html`, così i client scaricano la nuova
  versione (bottone "🔄 Aggiorna app" nella tab STORICO → Export forza
  il refresh anche senza aspettare).

---

## Ruoli utente

| Ruolo | Descrizione | Vede fase | Può inserire in | Note |
|---|---|---|---|---|
| **RIC** | Ricezione bolle | tutte (read-only oltre RIC) | RICEVIMENTO | Vede solo i propri record |
| **UFF** | Ufficio Resi | UFFICIO RESI (default), + tutte | tutte | Può modificare pregresso |
| **MAG** | Magazzino | MAGAZZINO (default), + tutte | UFF+MAG+FIN | Chiude i colli |
| **ADM** | Admin | tutte | tutte | PIN richiesto |

Modalità aggiuntive selezionabili al login del ruolo RIC:
- **📱 SCA** (Scanner Bolle) — foto della bolla → invio in tempo reale al PC
- **💻 RPC** (Ricevimento PC) — riceve gli scans dal mobile e li completa
- **✏️ MAN** (Manuale) — form classico compilato a mano

---

## Flusso di un reso

```
RICEVIMENTO ─┬──▶ UFFICIO RESI ──▶ MAGAZZINO ──▶ FINALE
             │                                    ├─ NOTA CREDITO FORNITORE
             │                                    ├─ NON RENDIBILE (7 varianti)
             │                                    ├─ VENDUTO CLIENTE
             │                                    ├─ STOCK MAGAZZINO
             │                                    ├─ ADDEBITATO VETTORE (PIEMME/CIPI)
             │                                    ├─ ROTTAMATO (FILIALE/CLIENTE)
             │                                    └─ ... (23 stati totali)
             │
             └──▶ ANOMALIA RICEVIMENTO (blocco: richiede foto + causale)
```

Dettagli in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Documentazione

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — diagramma dei blocchi, ciclo
  di vita di un reso, ruoli, blocchi/automazioni, sicurezza, PWA.
- **[DATA-MODEL.md](docs/DATA-MODEL.md)** — schema dei record, chiavi
  localStorage/IndexedDB, path Firebase.
- **[PORTALE.md](docs/PORTALE.md)** — Portale Tracking Resi: architettura,
  ruoli, isolamento dei dati, messa in produzione.
- **[CHANGELOG.md](CHANGELOG.md)** — storia delle versioni v34→v35.

---

## Portale Tracking Resi

Applicazione **separata** in `portal/`, rivolta a clienti, agenti e corrieri.
Usa lo stesso Firebase del gestionale ma con autenticazione reale
(email/password + custom claims) e Security Rules per ruolo.

Il gestionale **non è stato modificato**: `index.html`, `sw.js`,
`js/taxonomies.js` e `firebase-rules.json` restano invariati.

```bash
npm install     # aggiunge firebase-admin (solo per le Netlify Functions)
npm test        # 178 test sul portale
```

Messa in produzione, variabili d'ambiente e creazione del primo
amministratore: vedi **[docs/PORTALE.md](docs/PORTALE.md)**.

---

## Sicurezza (in breve)

- Auth Firebase anonima (nessuna password utente).
- Login anonimo scade dopo 30gg → riconnessione automatica gestita in
  `onAuthStateChanged`.
- **Kill switch remoto**: l'admin scrive un timestamp in `_killswitch` su
  Firebase → ogni client azzera memoria locale e mostra schermata di blocco.
- **Audit log**: `security_log/access` (login) e `security_log/mods`
  (modifiche). Retention client-side ultimi 500 eventi.
- **PIN admin**: in `admin-config.json` (da spostare a environment variable
  in futuro).
- Gemini API key: solo lato Netlify Function, mai esposta al client.

---

## Contatti tecnici

Repo: <https://github.com/danyatta03-ship-it/resi-telos>
