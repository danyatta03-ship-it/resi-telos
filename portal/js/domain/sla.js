// SLA: quanto tempo un reso puo' restare in uno stato prima che diventi
// prima un avviso (warn) e poi una criticita' (crit).
//
// Le soglie sono configurabili dall'Admin e vivono in portal_config/sla.
// I default qui sotto sono quelli con cui il portale parte "gia' sensato"
// se nessuno ha ancora configurato nulla.
//
// Il tempo si misura in ORE LAVORATIVE, non in ore solari: un reso consegnato
// venerdi' alle 17 non deve risultare in ritardo lunedi' mattina solo perche'
// nel mezzo c'e' stato un weekend. Sono i clienti a leggere questi numeri e
// devono corrispondere alla loro percezione.

import { paths } from '../core/firebase.js';
import { STATE, isTerminal, stateLabel } from './workflow.js';

export const DEFAULT_SLA = {
  RICHIESTO:      { warnHours: 8,   critHours: 24 },
  APPROVATO:      { warnHours: 16,  critHours: 48 },
  ATTESA_RITIRO:  { warnHours: 24,  critHours: 72 },
  RITIRATO:       { warnHours: 24,  critHours: 72 },
  IN_TRANSITO:    { warnHours: 48,  critHours: 96 },
  CONSEGNATO:     { warnHours: 16,  critHours: 40 },
  IN_VERIFICA:    { warnHours: 40,  critHours: 80 },
  IN_LAVORAZIONE: { warnHours: 40,  critHours: 80 },
  CONTESTATO:     { warnHours: 8,   critHours: 24 }
};

export const LEVEL = { OK: 'OK', WARN: 'WARN', CRIT: 'CRIT', NONE: 'NONE' };

export const LEVEL_META = {
  OK:   { label: 'Nei tempi',   color: '#2ECC71', icon: '🟢' },
  WARN: { label: 'In ritardo',  color: '#E6B03C', icon: '🟡' },
  CRIT: { label: 'Critico',     color: '#E05555', icon: '🔴' },
  NONE: { label: '—',           color: '#8FA4B8', icon: '⚪' }
};

let config = Object.assign({}, DEFAULT_SLA);

export function getSlaConfig() {
  return JSON.parse(JSON.stringify(config));
}

export function setSlaConfig(next) {
  if (!next || typeof next !== 'object') return;
  const merged = Object.assign({}, DEFAULT_SLA);
  for (const state in next) {
    const row = next[state];
    if (!row) continue;
    const warn = Number(row.warnHours);
    const crit = Number(row.critHours);
    if (!isFinite(warn) || !isFinite(crit) || warn < 0 || crit < 0) continue;
    merged[state] = { warnHours: warn, critHours: Math.max(warn, crit) };
  }
  config = merged;
}

export async function loadSlaConfig() {
  try {
    const snap = await paths.configSla().once('value');
    const val = snap.val();
    if (val) setSlaConfig(val);
  } catch (e) {
    // Nodo assente o non leggibile: restano i default. Non e' un errore
    // bloccante — il portale funziona lo stesso.
  }
  return getSlaConfig();
}

export async function saveSlaConfig(next) {
  const clean = {};
  for (const state in next) {
    const row = next[state] || {};
    const warn = Math.max(0, Number(row.warnHours) || 0);
    const crit = Math.max(warn, Number(row.critHours) || 0);
    clean[state] = { warnHours: warn, critHours: crit };
  }
  await paths.configSla().set(clean);
  setSlaConfig(clean);
  return getSlaConfig();
}

// ── Ore lavorative ──────────────────────────────────────────────────────
// Lun-Ven, 08:00-18:00. Non modelliamo le festivita': aggiungerebbero un
// calendario da mantenere per un guadagno di precisione marginale.

const WORK_START = 8;
const WORK_END = 18;
const WORK_HOURS_PER_DAY = WORK_END - WORK_START;

function isWorkday(d) {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

// Ore lavorative fra due istanti. Itera per giorni: gli intervalli in gioco
// sono giorni o settimane, mai anni, quindi il ciclo resta corto.
export function businessHoursBetween(fromTs, toTs) {
  let from = new Date(fromTs);
  const to = new Date(toTs);
  if (!(to > from)) return 0;

  let total = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  const guard = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
  let iterations = 0;

  while (cursor <= guard && iterations < 3660) {
    iterations++;
    if (isWorkday(cursor)) {
      const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), WORK_START, 0, 0, 0);
      const dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), WORK_END, 0, 0, 0);
      const start = from > dayStart ? from : dayStart;
      const end = to < dayEnd ? to : dayEnd;
      if (end > start) total += (end - start) / 3600000;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(0, total);
}

// Valuta lo SLA di un reso fermo in `state` da `sinceTs`.
export function evaluate(state, sinceTs, nowTs) {
  const now = nowTs || Date.now();
  if (!state || isTerminal(state)) {
    return { level: LEVEL.NONE, hours: 0, warnHours: 0, critHours: 0, overBy: 0, state };
  }
  const thresholds = config[state];
  if (!thresholds || !sinceTs) {
    return { level: LEVEL.NONE, hours: 0, warnHours: 0, critHours: 0, overBy: 0, state };
  }
  const hours = businessHoursBetween(sinceTs, now);
  let level = LEVEL.OK;
  let overBy = 0;
  if (hours >= thresholds.critHours) {
    level = LEVEL.CRIT;
    overBy = hours - thresholds.critHours;
  } else if (hours >= thresholds.warnHours) {
    level = LEVEL.WARN;
    overBy = hours - thresholds.warnHours;
  }
  return {
    level,
    hours,
    warnHours: thresholds.warnHours,
    critHours: thresholds.critHours,
    overBy,
    state,
    // Percentuale di consumo del budget critico: alimenta la barra di avanzamento.
    pct: thresholds.critHours > 0 ? Math.min(100, Math.round((hours / thresholds.critHours) * 100)) : 0
  };
}

export function levelColor(level) {
  return (LEVEL_META[level] || LEVEL_META.NONE).color;
}

export function levelLabel(level) {
  return (LEVEL_META[level] || LEVEL_META.NONE).label;
}

export function levelIcon(level) {
  return (LEVEL_META[level] || LEVEL_META.NONE).icon;
}

// "12h" · "2g 4h" · "—"
export function formatHours(hours) {
  if (!isFinite(hours) || hours <= 0) return '—';
  if (hours < 1) return Math.round(hours * 60) + 'min';
  if (hours < WORK_HOURS_PER_DAY) return Math.round(hours) + 'h';
  const days = Math.floor(hours / WORK_HOURS_PER_DAY);
  const rest = Math.round(hours - days * WORK_HOURS_PER_DAY);
  return rest > 0 ? days + 'g ' + rest + 'h' : days + 'g';
}

export function describe(result) {
  if (!result || result.level === LEVEL.NONE) return '';
  const base = formatHours(result.hours) + ' in ' + stateLabel(result.state);
  if (result.level === LEVEL.OK) return base;
  const limit = result.level === LEVEL.CRIT ? result.critHours : result.warnHours;
  return base + ' (limite ' + limit + 'h, superato di ' + formatHours(result.overBy) + ')';
}

// Elenco degli stati configurabili, per la schermata Admin.
export function configurableStates() {
  return Object.keys(DEFAULT_SLA).filter((s) => !isTerminal(s) && s !== STATE.RIFIUTATO);
}
