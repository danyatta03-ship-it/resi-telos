# Resi Generico — app configurabile

Stessa struttura del progetto **automazione resi**, ma completamente generica e personalizzabile in tempo reale via editor visuale con doppio tap.
Nessun Firebase.

## Come si usa

1. Apri `index.html` (o servila con qualunque static server: `python3 -m http.server 3000`).
2. Nella schermata di login scrivi la parola magica **`admin260403`** e premi "Entra".
3. Compare la barra arancione dell'editor in basso.
4. **Doppio tap** su qualunque elemento (titolo, pulsante, logo, campo, riga...) per aprire il modificatore: cambi testo, colore, sfondo, dimensione font, padding, arrotondamento, posizione X/Y, o lo nascondi.
5. Pulsante **⚙ Admin** → cambia i colori globali del tema, esporta/importa la configurazione.
6. Pulsante **💾 Salva** → conferma. Le modifiche sono già persistenti su questo dispositivo (localStorage).
7. Pulsante **✕ Esci** → chiudi l'editor. Ricarica la pagina: le modifiche restano.

## File
- `index.html` — layout (ogni elemento editabile ha `data-edit-id`).
- `style.css` — tema base (variabili CSS sovrascrivibili dal pannello Admin).
- `app.js` — logica app (login, ricevimento, scan, elenco, export).
- `overrides.js` — applica gli override salvati al caricamento.
- `editor.js` — editor visuale + pannello admin.
- `icon.svg`, `manifest.json` — PWA basic.

## Dati
- `localStorage['rg-overrides']` — personalizzazione (testi/stili/posizioni + tema).
- `localStorage['rg-practs']` — pratiche.
- `localStorage['rg-scans']` — scan.
- `sessionStorage['rg-user']` — utente loggato.

## Reset
Barra editor → **↺ Reset**. Oppure: DevTools → Application → LocalStorage → rimuovi `rg-overrides`.

## PIN admin
Cambia la costante `ADMIN_PIN` in `app.js`.
