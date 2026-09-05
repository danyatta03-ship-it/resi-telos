// Store reattivo minimale + cache offline su IndexedDB.
//
// Le viste non parlano direttamente con Firebase: si abbonano a una collezione
// dello store. Lo store tiene un solo listener Firebase per collezione anche
// se piu' viste la osservano, e serve subito la copia in cache mentre la rete
// risponde (il portale si apre pieno di dati anche in metropolitana).

import { kvGet, kvSet } from './idb.js';

const state = new Map();      // name -> { data, loaded, error }
const subscribers = new Map(); // name -> Set<fn>
const binders = new Map();     // name -> { ref, handler, count }

function ensure(name) {
  if (!state.has(name)) state.set(name, { data: null, loaded: false, error: null });
  return state.get(name);
}

export function get(name) {
  return ensure(name).data;
}

export function isLoaded(name) {
  return ensure(name).loaded;
}

export function getError(name) {
  return ensure(name).error;
}

export function set(name, data, opts = {}) {
  const slot = ensure(name);
  slot.data = data;
  slot.loaded = true;
  slot.error = null;
  notify(name);
  if (opts.persist !== false) {
    kvSet('store:' + name, data);
  }
}

export function setError(name, error) {
  const slot = ensure(name);
  slot.error = error;
  slot.loaded = true;
  notify(name);
}

function notify(name) {
  const subs = subscribers.get(name);
  if (!subs) return;
  const slot = ensure(name);
  for (const fn of Array.from(subs)) {
    try {
      fn(slot.data, slot);
    } catch (err) {
      console.error('[store] subscriber fallito per "' + name + '"', err);
    }
  }
}

// Sottoscrive una collezione. Se e' la prima sottoscrizione, monta il listener
// Firebase tramite la factory `bind` fornita dal chiamante.
// Ritorna una funzione di unsubscribe che smonta il listener quando l'ultimo
// osservatore se ne va.
export function subscribe(name, fn, bind) {
  if (!subscribers.has(name)) subscribers.set(name, new Set());
  subscribers.get(name).add(fn);

  const slot = ensure(name);
  if (slot.loaded) {
    // Consegna sincrona di cio' che gia' abbiamo.
    try { fn(slot.data, slot); } catch (e) { console.error(e); }
  } else {
    hydrate(name, fn);
  }

  if (bind && !binders.has(name)) {
    const entry = { count: 0, teardown: null };
    binders.set(name, entry);
    try {
      entry.teardown = bind({
        next: (data) => set(name, data),
        fail: (err) => setError(name, err)
      });
    } catch (err) {
      setError(name, err);
    }
  }
  if (binders.has(name)) binders.get(name).count++;

  return function unsubscribe() {
    const subs = subscribers.get(name);
    if (subs) subs.delete(fn);
    const entry = binders.get(name);
    if (entry) {
      entry.count--;
      if (entry.count <= 0) {
        if (typeof entry.teardown === 'function') {
          try { entry.teardown(); } catch (e) { /* gia' staccato */ }
        }
        binders.delete(name);
      }
    }
  };
}

async function hydrate(name, fn) {
  const cached = await kvGet('store:' + name);
  const slot = ensure(name);
  // Se nel frattempo la rete ha risposto, la cache e' vecchia: la ignoro.
  if (cached !== undefined && !slot.loaded) {
    slot.data = cached;
    try { fn(cached, { data: cached, loaded: false, error: null, fromCache: true }); } catch (e) { console.error(e); }
  }
}

export function clear(name) {
  if (name) {
    state.delete(name);
    const entry = binders.get(name);
    if (entry && typeof entry.teardown === 'function') {
      try { entry.teardown(); } catch (e) { /* gia' staccato */ }
    }
    binders.delete(name);
  } else {
    for (const [, entry] of binders) {
      if (typeof entry.teardown === 'function') {
        try { entry.teardown(); } catch (e) { /* gia' staccato */ }
      }
    }
    binders.clear();
    state.clear();
  }
}

// Utility: trasforma uno snapshot Firebase in array di oggetti con _key.
export function snapToArray(snap) {
  const out = [];
  const val = snap && typeof snap.val === 'function' ? snap.val() : snap;
  if (!val) return out;
  for (const key in val) {
    if (!Object.prototype.hasOwnProperty.call(val, key)) continue;
    const row = val[key];
    if (row && typeof row === 'object') out.push(Object.assign({}, row, { _key: row._key || key }));
  }
  return out;
}
