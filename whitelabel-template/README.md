# White Label App

Piattaforma **completamente configurabile** per gestione pratiche/record con workflow personalizzabile. Un solo file `brand-config.json` + un solo file `app-config.json` per creare una nuova app per qualsiasi cliente, senza toccare il codice.

---

## Contenuto

```
whitelabel-template/
├─ index.html            Layout SPA (login, sidebar, header, dashboard, lista, admin)
├─ app.js                Logica principale (state, views, storage, permessi)
├─ admin.js              Pannello admin (branding, workflow, ruoli, campi, moduli)
├─ brand-loader.js       Bootstrapper: legge le config e applica CSS/DOM/meta
├─ brand-config.json     Identita' del cliente (nome, colori, logo, azienda)
├─ app-config.json       Workflow (fasi, stati, ruoli, campi, dashboard)
├─ icon.svg              Logo/favicon SVG (personalizzabile)
├─ manifest.json         PWA manifest
├─ sw.js                 Service Worker (offline + precache)
├─ dev-server.js         Server locale per test (node dev-server.js)
├─ netlify.toml          Config deploy Netlify
├─ netlify/functions/
│  └─ gemini.js          Proxy AI Gemini (opzionale, richiede GEMINI_KEYS in env)
└─ README.md             Questa guida
```

---

## Come replicare per un nuovo cliente

1. **Copia la cartella** `whitelabel-template/` con un nuovo nome (es. `app-cliente-x/`).
2. **Modifica `brand-config.json`** — nome app, colori, logo, azienda.
3. **Modifica `app-config.json`** — fasi del workflow, ruoli, campi record.
4. **Sostituisci `icon.svg`** con il logo del cliente (o lascia il default).
5. **Deploy su Netlify** (drag&drop della cartella o collega la repo GitHub).
6. **Configura la variabile d'ambiente** `GEMINI_KEYS` se vuoi l'AI attiva.

Zero riga di codice modificata.

---

## Test locale

```bash
cd whitelabel-template
node dev-server.js
# apri http://localhost:3000
```

Il PIN admin di default e' `AttaDani260403` (SHA-256 dell'hash e' in `app-config.json`). Al login, scrivi il PIN nel campo nome e apri direttamente il pannello di configurazione.

---

## Cosa e' configurabile (dal pannello admin)

### Branding
- Nome app, nome breve (PWA), sottotitolo, descrizione, copyright, footer
- Logo principale (upload immagine → data URL persistente)
- Favicon (SVG)

### Colori
- Primario, secondario, accent, success, warning, danger, info
- Sfondi (4 livelli), bordi (2 livelli), testi (3 livelli)
- Sidebar, header — con testo dedicato
- Color picker + input HEX per ogni voce

### Entita'
- Nome singolare/plurale, icona emoji, prefisso ID (es. `PRT-`)

### Workflow (fasi)
- Aggiungere/modificare/eliminare fasi
- Nome, icona, colore, ordine

### Stati per fase
- Per ogni fase, aggiungere/modificare/eliminare stati (es. "IN LAVORO", "STALLO")

### Ruoli
- Nome, icona, colore
- Permessi granulari: puo' aggiungere, modificare, eliminare, vede tutti
- Per ogni ruolo: elenco delle fasi in cui puo' avanzare i record

### Campi record
- Aggiungere/modificare/eliminare campi (tipo: text, textarea, number, date, select)
- Obbligatorio si/no
- Mostrato in lista si/no
- Per i select: elenco opzioni

### Dashboard
- Aggiungere/rimuovere widget
- Tipi: contatore, grafico (a barre), lista recenti
- Toggle attivo/disattivo per widget

### Moduli
- Toggle on/off per: dashboard, records, admin, search, filters,
  export, import, print, email, whatsapp, ocr, ai, scanner, qr, chat,
  notifications, firebase, offline, log

### Template email
- Aggiungere template con oggetto + corpo
- Variabili: `{{id}}`, `{{title}}`, ecc. (i nomi dei campi definiti)

### Azienda
- Ragione sociale, indirizzo, telefono, email, PEC, P.IVA, sito, firma email

### Import / Export
- Esporta `brand-config.json`, `app-config.json`, o entrambi in un file unico
- Importa un file precedente per ripristinare una config
- Reset ai default

---

## Architettura

```
brand-loader.js  →  fetcha brand-config.json + app-config.json
                    →  applica CSS variables in :root
                    →  applica title, meta, favicon
                    →  espone window.BRAND, window.APP
                    →  espone window.WL (API per save/export/reset)

app.js           →  legge BRAND/APP per costruire l'UI (login, dashboard,
                    lista, form dinamico coi campi configurati)

admin.js         →  editor visuale per BRAND e APP; ogni modifica salva in
                    localStorage['brand-overrides' | 'app-overrides'] e
                    ricarica l'UI live via WL.saveBrand / WL.saveApp

Persistenza      →  localStorage['wl-records']         → i record dell'utente
                    localStorage['brand-overrides']    → override runtime BRAND
                    localStorage['app-overrides']      → override runtime APP
                    sessionStorage['wl-user']          → sessione login
```

Il file `brand-config.json` (statico, deployato) e' il default. Le modifiche fatte dal pannello admin sovrascrivono in `localStorage` — vince l'override. Per rendere una modifica permanente per tutti: esporta il file dall'admin, sostituisci quello nel repo, ridispiega.

---

## AI / Gemini (opzionale)

Se vuoi l'AI attiva:

1. Crea una chiave API su https://aistudio.google.com/apikey
2. Su Netlify → Site settings → Environment variables:
   - **Key**: `GEMINI_KEYS`
   - **Value**: la chiave (o piu' chiavi separate da virgola per fallback)
3. Trigger re-deploy.

Il proxy `netlify/functions/gemini.js` prova le chiavi a rotazione, con fallback automatico su 429 (quota esaurita).

---

## Deploy

### Netlify (consigliato)
- Build command: *(vuoto — l'app e' statica)*
- Publish directory: `.`
- Functions directory: `netlify/functions`

### Qualsiasi hosting statico
Basta pubblicare i file. Le Netlify Functions non sono obbligatorie (il modulo AI si spegne se `/api/gemini` non risponde).

---

## Personalizzazione avanzata

Per aggiungere **nuove sezioni admin** o **nuovi tipi di campo**, modifica `admin.js` e `app.js`. Le sezioni admin sono funzioni `admRender_<sezione>()` — aggiungine una nuova nell'array `sections` di `renderAdmin()` e implementa il render.

Per aggiungere **integrazioni** (webhook, DB esterno, ecc.), aggiungi Netlify Functions in `netlify/functions/` e chiamale da `app.js` con `fetch('/api/<nome>')`.

---

## Licenza

Uso privato. Modificare liberamente per progetti propri.
