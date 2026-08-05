# js/ui/admin — pannello Admin modulare (Fase 8)

## Stato

Scaffold. Il pannello Admin di oggi in `index.html` ha ~10 sezioni
inline (Utenti, Ruoli, Notifiche, Sicurezza, Statistiche, Agenti,
Fornitori, Cache, Reload DB, PIN). Modificare una di queste richiede
di aprire il monolite.

## Struttura proposta

```
js/ui/admin/
  index.js          ← orchestratore: monta tab e delega
  agenti.js         ← anagrafica agenti (già estraibile per intero)
  fornitori.js      ← anagrafica fornitori (garanzieDb, valoreMin, giorni_reso)
  utenti.js         ← lista utenti + ruoli
  sicurezza.js      ← log accessi + log modifiche
  cache.js          ← reload DB trimestre + bump SW + reset PWA
  notifiche.js      ← preferenze notifiche browser
```

Ogni modulo esporta:

```js
module.exports = {
  id:    'agenti',            // slug interno
  label: 'Agenti',            // testo tab
  mount: function(container, deps){ ... },   // costruisce DOM
  unmount: function(){ ... }                 // opzionale: cleanup
};
```

`deps` iniettato dall'orchestratore contiene:
`{ bus, storage, firebase, rules, config }` — nessun accesso a globali.

## Regole

1. Ogni sezione admin è un file autonomo, ≤ 300 righe.
2. Nessuna sezione mostra dati sensibili (PIN, tokens) direttamente
   nel DOM; usa `<input type="password">` e non logga in console.
3. Le sezioni SCRIVONO su Firebase / storage SOLO tramite i wrapper
   `js/data/*.js` — mai `localStorage.setItem` diretto.
4. Le sezioni si iscrivono al bus con `bus.on(...)` e RITORNANO gli
   unsub in `unmount()` per evitare memory leak.

## Priorità di estrazione (dalla più semplice)

1. `fornitori.js` — struttura CRUD chiara, poche interazioni esterne.
2. `agenti.js` — analogo, ma con auto-seed da `client_agents.json`.
3. `sicurezza.js` — solo lettura tabelle, no CRUD.
4. `cache.js` — pulsanti singoli, wire a funzioni SW.
5. Il resto in ordine di frequenza di modifica.
