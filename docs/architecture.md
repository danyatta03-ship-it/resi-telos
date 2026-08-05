# Resi Telos — Refactoring foundation

Questo file descrive lo stato del branch `refactor/foundation`.
`main` è intoccato — la produzione continua a girare con `index.html`
monolitico.

## Obiettivo del branch

Applicare il piano di refactoring in modo **incrementale e senza rischi**:

1. Le funzioni originali in `index.html` restano dove sono.
2. Vengono estratte in file JS separati sotto `js/`.
3. I nuovi moduli sono importabili in Node (unit test) **e** su window
   (retro-compat con onclick inline).
4. Solo quando i moduli estratti sono coperti da test si potrà
   sostituire progressivamente il codice inline.

## Struttura

```
js/
  core/
    config.js   ← ROLE_PERMS, STATI, CAULIST, NEXT_FASE, HDR, SLA
    utils.js    ← xe, fd, nprc, eur, gv, ce, uv, addBusinessDays
  domain/
    rules.js    ← regole di business PURE (permessi, forza NR, dup, ...)
  data/         ← (TODO: firebase, idb, storage, sync)
  services/     ← (TODO: mail, ocr, ai)
  ui/           ← (TODO: renderList, renderQueue, renderDB)

tests/
  domain-rules.test.js  ← 25 casi

scripts/
  check-html.js   ← verifica <script> balanced + syntax
  bump-cache.js   ← aggiorna CACHE=... in sw.js da git SHA

.github/workflows/
  ci.yml   ← esegue check-html + node --test tests/*.test.js
```

## Fasi completate

- [x] **Fase 0 — Foundation** (commit `5adbf34`)
  - script `check-html.js`, `bump-cache.js`
  - GitHub Actions CI
  - script npm: `check`, `test`, `bump-cache`, `precommit`

- [x] **Fase 1 — Config + Utils** (commit `e7a8944`)
  - `js/core/config.js`
  - `js/core/utils.js`

- [x] **Fase 2 — Regole di dominio + test** (commit `e7a8944`)
  - `js/domain/rules.js` — 6 funzioni pure con dependency injection
  - `tests/domain-rules.test.js` — 25 test, 0 fail

## Fasi da fare

- [ ] **Fase 3 — Data services** (`js/data/*.js`)
  - `firebase.js` — init auth + `FB_REF` (async)
  - `sync.js` — reconcile FB ↔ local
  - `idb.js` — IndexedDB (foto pacco, snapshot)
  - `storage.js` — read/write localStorage tipizzato

- [ ] **Fase 4 — Ottimizzazione asset**
  - togliere `clients.json` (4.6 MB, mai usato)
  - deduplicare `db_import` / `db_tri`
  - lazy-load `db_tri` (solo se tab Trimestre aperto)

- [ ] **Fase 5 — Rendering virtual scroll**
  - `renderList`, `renderContatti`, `renderDB`
  - target: < 100 righe DOM anche con 10 000 record

- [ ] **Fase 6 — CSS light theme pulito**
  - convertire da `!important` sparso a custom properties per tema
  - `data-theme="light"` / `data-theme="dark"` sul `<html>`

- [ ] **Fase 7 — Event bus**
  - disaccoppiare renderer da store (oggi `renderList` è chiamata da
    ~30 punti; con un event bus basta emettere `rows:changed`)

- [ ] **Fase 8 — Admin panel modulare**
  - oggi ha ~10 modal inline; estrarre in `js/ui/admin/*.js`

- [ ] **Fase 9 — Test suite**
  - CI già configurata; aggiungere test per data services e UI
    (JSDOM per il DOM, mock Firebase)

## Come testare in locale

```bash
npm test           # 25 unit test
npm run check      # sanity check su index.html
npm run bump-cache --dry   # anteprima bump SW
node dev-server.js         # server dev su :3000
```

## Regole invariabili (business)

Elencate qui in un solo posto per evitare che il refactor le muti
involontariamente. Ogni regola ha almeno un test dedicato in
`tests/domain-rules.test.js`.

1. **Flusso fasi**: `RICEVIMENTO → UFFICIO RESI → MAGAZZINO → FINALE`
   (mai saltare).
2. **Permessi ruolo**:
   - `RIC`: solo `RICEVIMENTO`, avanzamento a `UFFICIO RESI`.
   - `UFF`: modifica tutte le fasi (comprese FINALE).
   - `MAG`: modifica fino a `MAGAZZINO`, non FINALE.
   - `ADM`: tutto + rimando `UFFICIO RESI → RICEVIMENTO`.
3. **Record storico** (`_frozen: true`): modifica riservata a UFF / ADM.
4. **Forza NON RENDIBILE**:
   - se `prezzo < fornitore.valoreMin` → motivo `PREZZO INFERIORE`
   - se `giorni da datAcqForn > fornitore.giorni_reso` → `FUORI TEMPISTICHE`
   - prezzo ha precedenza su tempistiche
5. **Coerenza flusso** (v34v): flusso `ANOMALIA` incompatibile con stato
   `DA GESTIRE` in `RICEVIMENTO`.
6. **Anti-duplicato**: stessa `(codice, fornitore)` con `fase != FINALE`
   → l'inserimento va bloccato o segnalato.
7. **RMA obbligatoria** per passaggio a `MAGAZZINO` (regola nel codice
   di `svEdit` / `advFase` — Fase 3 la porterà in `rules.js`).
8. **Firma FINALE** per chi chiude una pratica.
9. **Foto obbligatoria** per anomalia in RICEVIMENTO.

## Vincolo assoluto

`index.html` e `sw.js` NON vanno modificati su questo branch finché
l'utente non ha testato l'app sul campo. Ogni PR verso `main` da questo
branch va approvata a valle di test manuale.
