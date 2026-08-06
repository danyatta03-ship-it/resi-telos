# App Aziendale — configurabile 360°

Page-builder in un singolo pacchetto statico. Nessun Firebase.

## Cosa puoi fare (dall'editor)

- **Header**: titolo, sottotitolo, colore sfondo, colore testo, allineamento, **upload logo dalla galleria** (o URL), posizione logo (sinistra/centro/destra/nessuno), dimensione logo, mostra/nascondi.
- **Tema**: tutti i colori dell'app (primary, sfondo, pannelli, bordi, testo, muted, danger).
- **Pagine**: aggiungi/rimuovi/riordina pagine, icona emoji, nome, id.
- **Blocchi** per pagina (aggiungi, riordina ▲▼, elimina ✕, modifica ✎):
  - **Testo/Titolo**: contenuto, tag (h1/h2/h3/p/div), font-size, weight, allineamento, colore, padding.
  - **Pulsanti**: layout orizzontale/verticale; per ogni pulsante: etichetta, stile (primary/default/danger/ghost), **azione**:
    - `goto` (vai ad altra pagina)
    - `alert` (mostra messaggio)
    - `openUrl` (apri link)
    - `addRow` (aggiungi riga a una tabella)
    - `exportCsv` / `exportJson` (esporta una tabella)
    - `clearTable` (svuota una tabella)
    - `logout`
    - `js` (codice libero)
  - **Tabella**: titolo, chiave di storage, **colonne** (aggiungi/rimuovi/riordina; tipo text/textarea/number/date/datetime/select con opzioni), **righe** (aggiungi/modifica/elimina), flag consenti aggiunta/modifica/eliminazione/export.
  - **Immagine**: upload o URL, larghezza %, allineamento.
  - **HTML libero**: incolla HTML custom.
- **Import/Export**: scarica `schema.json` (solo config) o `schema-full.json` (config + dati); ricarica per portare la config su un altro dispositivo.
- **Reset**: ripristina i default (i dati delle tabelle restano).

## Come si attiva l'editor

1. Apri `index.html`.
2. Nella login scrivi **`admin`** (o `admin260403`) → parte l'editor.
3. Barra arancione in basso: **🎨 Header · 🌈 Tema · 📄 Pagine · ➕ Blocco · 📥 Import/Export · ↺ Reset · ✕**.
4. In modalità editor ogni blocco mostra i controlli ▲▼✎✕ in alto a destra. I click sui pulsanti normali sono disabilitati (per non attivare le azioni mentre modifichi).

## File

- `index.html` — shell.
- `style.css` — tema e componenti.
- `schema.js` — storage + schema di default.
- `render.js` — motore di rendering delle pagine.
- `editor.js` — pannelli editor (header, tema, pagine, blocchi, tabelle).
- `app.js` — login + boot.
- `manifest.json`, `icon.svg` — PWA.

## Persistenza (localStorage)

- `app-schema` — configurazione completa dell'app.
- `app-data:<storageKey>` — righe di ogni tabella.
- `sessionStorage['rg-user']` — utente loggato.

## Deploy

Statico. Qualunque hosting (Netlify drag&drop, GitHub Pages, S3, …). Nessuna build.
