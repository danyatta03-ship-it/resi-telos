# App Aziendale — page builder completo

Sito/app aziendale statico configurabile al 100% dall'admin. Nessun backend, nessun Firebase, nessuna build.

## Attivazione editor
Login con **`admin`** (o `admin260403`) → compare la barra arancione.

## Cosa puoi fare
- **🎨 Header**: titolo, sottotitolo, upload logo dalla galleria, posizione/dimensione logo, colori, sticky/non, mostra menu, mostra/nascondi
- **🌈 Tema**: primary, sfondo, pannelli, bordi, testo, muted, danger, ok, warn
- **📄 Pagine**: aggiungi/rimuovi/riordina, icona, id, "nascondi dal menu", **impostazioni per pagina** (sfondo, padding, nascondi header/footer, SEO title/desc)
- **⚙ Sito**: nome PWA, colore tema mobile, **favicon** (upload), **footer con colonne** (aggiungi/rimuovi/riordina, ogni colonna con titolo + voci), copyright, **Custom CSS** globale
- **➕ Blocco**: aggiungi in fondo a una pagina; in pagina compare **➕ blocco qui** dentro sezioni/colonne
- **📥 IO**: esporta `schema.json` (solo config) o `schema-full.json` (config + dati tabelle + invii form); importa un backup
- **↺**: reset ai default (i dati restano)

## Blocchi disponibili
| Icona | Nome | Cosa fa |
|---|---|---|
| ⭐ | Hero | Banner con titolo, sottotitolo, immagine di sfondo (upload), overlay, CTA multipli |
| 📦 | Sezione | Contenitore con titolo/sottotitolo + blocchi annidati |
| ▦ | Colonne | 1-6 colonne, ognuna con blocchi annidati |
| 📝 | Testo/titolo | tag h1-h4/p/div, size, weight, allineamento, colore, padding |
| 🔘 | Pulsanti | Etichetta + stile + **azione** (goto pagina · alert · apri URL · aggiungi riga tabella · export CSV/JSON · svuota tabella · logout · JS libero) |
| 🃏 | Griglia di card | Card con immagine (upload), titolo, testo, link |
| 🗂 | Card singola | Card riutilizzabile in qualsiasi punto |
| 📈 | Statistiche | Numeri grandi con etichetta (griglia) |
| 💬 | Testimonianze | Testo, autore, ruolo, avatar |
| 🖼️ | Galleria | Upload multiplo immagini in griglia |
| ▼ | Accordion/FAQ | Domanda + risposta |
| ▶️ | Video | YouTube / Vimeo / MP4, aspect-ratio |
| 🌐 | Iframe | Embed qualsiasi URL |
| 📍 | Mappa | Google Maps con indirizzo/query |
| ☎️ | Info contatto | Icona + etichetta + valore |
| 🌐 | Social | Cerchi con emoji linkati (linkedin/instagram/facebook/…) |
| 📮 | Form | Campi configurabili (text/email/tel/number/date/textarea/select), invii **salvati in localStorage** e visualizzabili/esportabili dall'editor |
| 🖼 | Immagine | Upload/URL, larghezza %, link on-click, alt |
| </> | HTML libero | Incolla HTML/JS custom |
| 📊 | Tabella | Colonne (text/textarea/number/date/datetime/select) + righe con edit/delete/export |
| ↕ | Spaziatore | Altezza fissa |
| — | Divisore | Linea con colore/spessore/margine |

## Blocchi annidati
Sezioni e Colonne sono contenitori: in modalità editor mostrano `➕ blocco qui` per aggiungere qualsiasi tipo (anche altri contenitori) al loro interno.

## Persistenza (tutto in localStorage)
- `app-schema` — configurazione del sito
- `app-data:<key>` — righe di ogni tabella
- `app-subm:<key>` — invii di ogni form
- `sessionStorage['rg-user']` — utente loggato

## File
- `index.html` — shell
- `style.css` — stili base (sovrascrivibili da Custom CSS)
- `schema.js` — storage + defaults
- `ui.js` — helper (dialog, azioni, tabella, item-list)
- `blocks.js` — registro di tutti i tipi di blocco
- `render.js` — traversal e rendering
- `editor.js` — barra strumenti e pannelli
- `app.js` — login + boot
- `manifest.json`, `icon.svg` — PWA

## Deploy
Statico. Trascinabile su Netlify/GitHub Pages/S3/qualsiasi hosting.
