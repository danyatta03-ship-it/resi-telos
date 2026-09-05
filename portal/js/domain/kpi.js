// Aggregazioni KPI per le dashboard.
//
// Tutto si calcola sull'elenco resi gia' in memoria: nessuna query extra,
// nessun nodo di contatori da tenere sincronizzato. Con i volumi in gioco
// (poche centinaia di righe per un esterno, ~1500 per gli interni) e'
// istantaneo e sempre coerente con cio' che l'utente sta guardando.

import { STATE, STATE_META, STATE_ORDER, isTerminal, stateLabel } from './workflow.js';
import { LEVEL } from './sla.js';

export function summarize(rows) {
  const total = rows.length;
  let open = 0;
  let closed = 0;
  let disputed = 0;
  let slaWarn = 0;
  let slaCrit = 0;
  let value = 0;

  for (const r of rows) {
    const st = r.trackingState;
    if (st === STATE.CONTESTATO) disputed++;
    if (isTerminal(st)) closed++;
    else open++;
    const lvl = r.sla && r.sla.level;
    if (lvl === LEVEL.WARN) slaWarn++;
    else if (lvl === LEVEL.CRIT) slaCrit++;
    const p = parseFloat(String(r.prc || '').replace(',', '.'));
    const q = parseInt(r.qty, 10) || 1;
    if (isFinite(p)) value += p * q;
  }

  return {
    total,
    open,
    closed,
    disputed,
    slaWarn,
    slaCrit,
    slaOk: total - slaWarn - slaCrit,
    value,
    closureRate: total > 0 ? Math.round((closed / total) * 100) : 0,
    slaCompliance: total > 0 ? Math.round(((total - slaWarn - slaCrit) / total) * 100) : 100
  };
}

// Distribuzione per stato, nell'ordine del ciclo di vita.
export function byState(rows) {
  const counts = {};
  for (const r of rows) {
    const st = r.trackingState || 'ALTRO';
    counts[st] = (counts[st] || 0) + 1;
  }
  const ordered = STATE_ORDER.concat([STATE.CONTESTATO, STATE.RIFIUTATO, STATE.CHIUSO_NR]);
  const seen = new Set();
  const out = [];
  for (const st of ordered) {
    if (seen.has(st)) continue;
    seen.add(st);
    if (counts[st]) {
      out.push({
        state: st,
        label: stateLabel(st),
        count: counts[st],
        color: (STATE_META[st] && STATE_META[st].color) || '#888'
      });
    }
  }
  for (const st in counts) {
    if (!seen.has(st)) out.push({ state: st, label: st, count: counts[st], color: '#888' });
  }
  return out;
}

export function bySla(rows) {
  const counts = { OK: 0, WARN: 0, CRIT: 0, NONE: 0 };
  for (const r of rows) {
    const lvl = (r.sla && r.sla.level) || 'NONE';
    counts[lvl] = (counts[lvl] || 0) + 1;
  }
  return counts;
}

// Raggruppa per un campo e restituisce le prime N voci.
export function topBy(rows, field, limit = 5) {
  const counts = new Map();
  for (const r of rows) {
    const key = String(r[field] || '').trim() || '—';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Serie temporale degli ultimi N giorni: alimenta lo sparkline "aperture".
export function timeline(rows, days = 30) {
  const now = new Date();
  const buckets = [];
  const index = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const bucket = { date: key, label: ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2), count: 0 };
    buckets.push(bucket);
    index.set(key, bucket);
  }
  for (const r of rows) {
    const ts = r._ts || r.trackingSince;
    if (!ts) continue;
    const key = new Date(ts).toISOString().slice(0, 10);
    const bucket = index.get(key);
    if (bucket) bucket.count++;
  }
  return buckets;
}

// Tempo medio di attraversamento (in giorni solari) sui resi chiusi.
export function avgCycleDays(rows) {
  const closed = rows.filter((r) => isTerminal(r.trackingState) && r._ts && r.trackingSince);
  if (!closed.length) return null;
  let sum = 0;
  for (const r of closed) sum += Math.max(0, r.trackingSince - r._ts);
  return Math.round((sum / closed.length) / 86400000 * 10) / 10;
}

// I resi che meritano attenzione ORA: prima i critici, poi i piu' fermi.
export function attentionList(rows, limit = 8) {
  return rows
    .filter((r) => r.sla && (r.sla.level === LEVEL.CRIT || r.sla.level === LEVEL.WARN))
    .sort((a, b) => {
      const rank = { CRIT: 0, WARN: 1 };
      const ra = rank[a.sla.level];
      const rb = rank[b.sla.level];
      if (ra !== rb) return ra - rb;
      return b.sla.hours - a.sla.hours;
    })
    .slice(0, limit);
}

export function formatCurrency(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function formatNumber(value) {
  return (Number(value) || 0).toLocaleString('it-IT');
}
