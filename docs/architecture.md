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
    config.js       ← ROLE_PERMS, STATI, CAULIST, NEXT_FASE, HDR, SLA
    utils.js        ← xe, fd, nprc, eur, gv, ce, uv, addBusinessDays
    bus.js          ← event bus (on/off/emit/once/clear)
  domain/
    rules.js        ← regole di business PURE
  data/
    storage.js      ← wrapper localStorage tipizzato
    firebase.js     ← init FB + ready-promise (STUB, non incluso)
    idb.js          ← wrapper IndexedDB Promise-based
    sync.js         ← reconcile locale↔remote (STUB, non incluso)
  ui/
    virtual-list.js ← virtual scroll componente
    theme.css       ← palette Resi Telos su custom properties
    admin/
      README.md     ← scaffold Fase 8

tests/
  domain-rules.test.js  ← 25 casi (permessi, NR, dup, coerenza)
  bus.test.js           ← 9 casi
  storage.test.js       ← 10 casi
  utils.test.js         ← 7 casi
  config.test.js        ← 10 casi
  sync.test.js          ← 6 casi
                        ─── totale ~67 test ───

scripts/
  check-html.js       ← verifica <script> balanced + syntax
  bump-cache.js       ← aggiorna CACHE=... in sw.js da git SHA
  optimize-assets.js  ← analizza clients.json/db_import duplicati (--apply)

.github/workflows/
  ci.yml   ← check-html + node --test tests/*.test.js
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

## Fasi

- [x] **Fase 3 — Data services** (parziale)
  - `storage.js` estratto + test (10)
  - `idb.js` estratto (Promise-based, fallback localStorage)
  - `firebase.js` STUB con ready-promise (non incluso: sostituzione
    rischiosa, richiede test sul campo)
  - `sync.js` STUB con `mergeSnapshot` (last-write-wins) + test (6)

- [x] **Fase 4 — Ottimizzazione asset** (analisi + tool)
  - `scripts/optimize-assets.js` identifica automaticamente:
    - `clients.json` (4.6 MB) — nel precache SW ma MAI usato da
      index.html → proposta rimozione da SW
    - `db_import.json` == `db_tri.json` (byte-identici, 2.7 MB × 2)
      → proposta dedup
    - `db_tri.json` — lazy-load al primo apertura tab Trimestre
      (richiede refactor index.html linea ~1486, non automatico)
  - `--apply` esegue le modifiche automatiche con backup .bak

- [x] **Fase 5 — Rendering virtual scroll**
  - `js/ui/virtual-list.js` — componente vanilla, altezza fissa,
    buffer configurabile. Sostituisce il pattern
    "render tutte le righe in innerHTML".

- [x] **Fase 6 — CSS light theme pulito**
  - `js/ui/theme.css` — palette Telos completa su custom properties.
    16 var per tema, `data-theme="light|dark"` sul `<html>`,
    fallback `prefers-color-scheme`.

- [x] **Fase 7 — Event bus**
  - `js/core/bus.js` — on/off/emit/once/clear, listener isolati
    (errori non propagano), disiscrizione durante emit sicura.
  - 9 test coprono i corner case.

- [~] **Fase 8 — Admin panel modulare** (scaffold)
  - `js/ui/admin/README.md` — pattern + priorità di estrazione.
    Implementazione delle 7 sezioni rimandata: richiede lettura
    approfondita del monolite, meglio farla incrementale dopo
    che il branch è testato sul campo.

- [x] **Fase 9 — Test e CI**
  - CI verde. ~67 test coprono: config, utils, regole di dominio,
    storage, sync, bus. Da aggiungere: test UI (JSDOM),
    test integrazione IDB (mock).

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
