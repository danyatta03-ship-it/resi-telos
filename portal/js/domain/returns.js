// Accesso ai resi, con la sorgente giusta per ogni ruolo.
//
//   ADMIN / TELOS  → leggono returns/ (il nodo del gestionale) e vedono tutto.
//   CLIENTE        → legge portal_view/client/<codiceCliente>
//   AGENTE         → legge portal_view/agent/<nomeAgente>
//   CORRIERE       → legge portal_view/courier/<vettore>
//
// Le proiezioni portal_view sono costruite dalla Netlify Function portal-sync
// e contengono SOLO i campi ammessi dal ruolo (vedi roles.js VISIBLE_FIELDS).
// Un cliente non riceve mai il record completo: non e' filtrato dalla UI, non
// gli viene proprio trasmesso.
//
// Un utente esterno puo' avere piu' scope (un cliente con piu' codici, un
// agente con piu' zone): leggiamo tutti i suoi rami e li uniamo deduplicando
// per _key.

import { paths, safeKey } from '../core/firebase.js';
import { getRole, getScope } from '../core/auth.js';
import { ROLE_SOURCE } from './roles.js';
import { snapToArray } from '../core/store.js';
import { effectiveState, deriveFromGestionale } from './workflow.js';
import { evaluate } from './sla.js';

// Il gestionale ha decine di migliaia di righe storiche: gli interni ne
// leggono le piu' recenti, non tutte. Chi cerca oltre usa la ricerca.
const STAFF_LIMIT = 1500;

function scopeRefs() {
  const role = getRole();
  const source = ROLE_SOURCE[role];
  if (!source) return [];
  if (source.kind === 'returns') return [paths.returns().limitToLast(STAFF_LIMIT)];
  const scope = getScope();
  if (!scope.length) return [];
  const factory = {
    client: paths.viewClient,
    agent: paths.viewAgent,
    courier: paths.viewCourier
  }[source.scopeType];
  if (!factory) return [];
  return scope.map((id) => factory(safeKey(id)));
}

// Sottoscrizione live all'elenco resi visibile all'utente corrente.
export function bindReturns({ next, fail }) {
  const refs = scopeRefs();
  if (!refs.length) {
    next([]);
    return () => {};
  }
  // Con piu' rami tengo un buffer per ramo e riemetto l'unione a ogni update:
  // altrimenti l'ultimo ramo che risponde cancellerebbe gli altri.
  const buffers = refs.map(() => []);
  const handlers = [];

  function emitMerged() {
    const seen = new Map();
    for (const buf of buffers) {
      for (const row of buf) {
        if (!row || !row._key) continue;
        const prev = seen.get(row._key);
        // Se lo stesso reso arriva da due scope, tengo la copia piu' recente.
        if (!prev || (row._syncTs || 0) >= (prev._syncTs || 0)) seen.set(row._key, row);
      }
    }
    next(Array.from(seen.values()).map(decorate).sort(byRecency));
  }

  refs.forEach((ref, i) => {
    const h = ref.on('value', (snap) => {
      buffers[i] = snapToArray(snap);
      emitMerged();
    }, (err) => fail(err));
    handlers.push({ ref, h });
  });

  return () => handlers.forEach(({ ref, h }) => {
    try { ref.off('value', h); } catch (e) { /* gia' staccato */ }
  });
}

// Arricchisce il record con stato di tracking e SLA calcolati.
export function decorate(row) {
  const trackingState = effectiveState(row, row.trackingState);
  const since = row.trackingTs || row.datStaTs || row._lastEditTs || row._ts || 0;
  const sla = evaluate(trackingState, since);
  return Object.assign({}, row, {
    trackingState,
    trackingSince: since,
    derivedState: deriveFromGestionale(row),
    sla
  });
}

function byRecency(a, b) {
  const ta = a.trackingSince || a._ts || 0;
  const tb = b.trackingSince || b._ts || 0;
  return tb - ta;
}

// Un singolo reso. Gli interni lo leggono dal nodo vero; gli esterni lo
// cercano nella loro proiezione — se non c'e', non hanno il diritto di vederlo
// e la risposta e' null (non un errore di permesso: e' semplicemente fuori
// dal loro perimetro).
export async function loadReturn(key) {
  const role = getRole();
  const source = ROLE_SOURCE[role];
  if (!source) return null;
  if (source.kind === 'returns') {
    const snap = await paths.aReturn(key).once('value');
    const val = snap.val();
    return val ? decorate(Object.assign({}, val, { _key: val._key || key })) : null;
  }
  const scope = getScope();
  const factory = {
    client: paths.viewClient,
    agent: paths.viewAgent,
    courier: paths.viewCourier
  }[source.scopeType];
  if (!factory) return null;
  for (const id of scope) {
    try {
      const snap = await factory(safeKey(id)).child(key).once('value');
      const val = snap.val();
      if (val) return decorate(Object.assign({}, val, { _key: val._key || key }));
    } catch (e) { /* scope non leggibile: provo il prossimo */ }
  }
  return null;
}

// ── Filtri e ricerca (client-side, sull'elenco gia' caricato) ───────────

export function filterReturns(rows, filters = {}) {
  const q = String(filters.q || '').trim().toUpperCase();
  const state = filters.state || '';
  const slaLevel = filters.sla || '';
  const from = filters.from ? new Date(filters.from).getTime() : 0;
  const to = filters.to ? new Date(filters.to).getTime() + 86399999 : 0;

  return rows.filter((r) => {
    if (state && r.trackingState !== state) return false;
    if (slaLevel && (!r.sla || r.sla.level !== slaLevel)) return false;
    if (from || to) {
      const ts = r.trackingSince || r._ts || 0;
      if (from && ts < from) return false;
      if (to && ts > to) return false;
    }
    if (q) {
      const hay = [r.cod, r.pre, r.forn, r.sogg, r.rma, r.agente, r.vetRic, r.vetUsc, r._key]
        .map((v) => String(v || '').toUpperCase())
        .join(' ');
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
}

export function sortReturns(rows, sortBy = 'recent') {
  const copy = rows.slice();
  const cmp = {
    recent: byRecency,
    oldest: (a, b) => (a.trackingSince || 0) - (b.trackingSince || 0),
    sla: (a, b) => {
      const rank = { CRIT: 0, WARN: 1, OK: 2, NONE: 3 };
      const ra = rank[(a.sla && a.sla.level) || 'NONE'];
      const rb = rank[(b.sla && b.sla.level) || 'NONE'];
      if (ra !== rb) return ra - rb;
      return (b.sla && b.sla.hours || 0) - (a.sla && a.sla.hours || 0);
    },
    client: (a, b) => String(a.sogg || '').localeCompare(String(b.sogg || '')),
    state: (a, b) => String(a.trackingState || '').localeCompare(String(b.trackingState || ''))
  }[sortBy] || byRecency;
  return copy.sort(cmp);
}

// Descrizione compatta dell'articolo per liste e card.
export function articleLabel(row) {
  const parts = [];
  if (row.pre) parts.push(row.pre);
  if (row.cod) parts.push(row.cod);
  const label = parts.join(' ');
  return label || row._key || '—';
}

export function clientLabel(row) {
  const raw = String(row.sogg || '').trim();
  if (!raw) return '—';
  // Il gestionale scrive "007183 - AUTOFFICINA ROSSI": per il cliente stesso
  // il codice e' rumore, mostro la ragione sociale quando c'e'.
  const m = /^(\d{4,8})\s*[-–]\s*(.+)$/.exec(raw);
  return m ? m[2] : raw;
}

export function clientCode(row) {
  const raw = String(row.sogg || '').trim();
  const m = /^(\d{4,8})\b/.exec(raw);
  return m ? m[1] : '';
}
