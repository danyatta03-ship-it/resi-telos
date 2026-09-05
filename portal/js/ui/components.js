// Componenti riusabili. Tutti puri: ricevono dati, restituiscono nodi DOM.
// Nessuno legge da Firebase o dallo store — sono le viste a farlo.

import { h, fmtRelative, fmtDate, initials, colorFor } from './dom.js';
import { STATE_META, stateLabel, stateColor, stateIcon, stateStep, TOTAL_STEPS, isTerminal } from '../domain/workflow.js';
import { LEVEL, levelColor, levelLabel, formatHours } from '../domain/sla.js';
import { roleLabel, roleColor, roleIcon } from '../domain/roles.js';
import { articleLabel, clientLabel } from '../domain/returns.js';

// ── Badge di stato ──────────────────────────────────────────────────────
export function statusBadge(state, opts = {}) {
  const color = stateColor(state);
  return h('span.badge', {
    style: {
      background: 'color-mix(in srgb, ' + color + ' 17%, transparent)',
      color,
      borderColor: 'color-mix(in srgb, ' + color + ' 34%, transparent)'
    },
    title: (STATE_META[state] && STATE_META[state].desc) || ''
  }, [
    opts.icon !== false ? h('span', stateIcon(state)) : null,
    stateLabel(state)
  ]);
}

// ── Badge SLA ───────────────────────────────────────────────────────────
export function slaBadge(sla, opts = {}) {
  if (!sla || sla.level === LEVEL.NONE) return null;
  const color = levelColor(sla.level);
  const label = opts.compact
    ? formatHours(sla.hours)
    : levelLabel(sla.level) + ' · ' + formatHours(sla.hours);
  return h('span.badge', {
    style: {
      background: 'color-mix(in srgb, ' + color + ' 17%, transparent)',
      color,
      borderColor: 'color-mix(in srgb, ' + color + ' 34%, transparent)'
    },
    title: 'Fermo da ' + formatHours(sla.hours) + ' · soglia avviso ' + sla.warnHours + 'h · soglia critica ' + sla.critHours + 'h'
  }, [
    h('span.badge-dot', { style: { background: color } }),
    label
  ]);
}

// ── Badge ruolo ─────────────────────────────────────────────────────────
export function roleBadge(role) {
  const color = roleColor(role);
  return h('span.badge', {
    style: {
      background: 'color-mix(in srgb, ' + color + ' 17%, transparent)',
      color,
      borderColor: 'color-mix(in srgb, ' + color + ' 34%, transparent)'
    }
  }, [h('span', roleIcon(role)), roleLabel(role)]);
}

// ── Avatar ──────────────────────────────────────────────────────────────
export function avatar(name, size = '') {
  return h('div.avatar' + (size ? '.avatar-' + size : ''), {
    style: { background: colorFor(name) },
    title: name || ''
  }, initials(name));
}

// ── Stepper di avanzamento ──────────────────────────────────────────────
export function stepper(state) {
  const current = stateStep(state);
  const terminal = isTerminal(state);
  const steps = [];
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    let cls = '.step';
    if (i < current || (terminal && current >= i)) cls += '.done';
    else if (i === current) cls += '.cur';
    steps.push(h('div' + cls));
  }
  return h('div.stepper', { title: 'Fase ' + current + ' di ' + TOTAL_STEPS }, steps);
}

// ── Card reso ───────────────────────────────────────────────────────────
export function returnCard(row, opts = {}) {
  const meta = [];
  if (row.forn) meta.push(h('span', [h('b', 'Fornitore '), row.forn]));
  if (row.qty) meta.push(h('span', [h('b', 'Qta '), String(row.qty)]));
  if (row.rma) meta.push(h('span', [h('b', 'RMA '), row.rma]));
  if (row.vetRic) meta.push(h('span', [h('b', 'Vettore '), row.vetRic]));
  if (row.datArr) meta.push(h('span', [h('b', 'Arrivo '), fmtDate(new Date(row.datArr).getTime())]));

  const card = h('a.card.card-link', {
    href: '#/resi/' + encodeURIComponent(row._key),
    'aria-label': 'Apri reso ' + articleLabel(row)
  }, [
    h('div.rcard', [
      h('div.rcard-top', [
        h('div.rcard-main', [
          h('div.rcard-code', articleLabel(row)),
          opts.showClient !== false ? h('div.rcard-cli', clientLabel(row)) : null
        ]),
        statusBadge(row.trackingState)
      ]),
      meta.length ? h('div.rcard-meta', meta) : null,
      stepper(row.trackingState),
      h('div.rcard-foot', [
        slaBadge(row.sla, { compact: true }),
        h('span.dim', { style: { fontSize: '11.5px' } }, fmtRelative(row.trackingSince || row._ts)),
        h('span.spacer'),
        opts.badge || null
      ])
    ])
  ]);
  return card;
}

// ── KPI tile ────────────────────────────────────────────────────────────
export function kpiTile({ value, label, sub, color, onClick, title }) {
  const el = h('div.kpi' + (onClick ? '.kpi-clickable' : ''), {
    title: title || '',
    onclick: onClick || null,
    role: onClick ? 'button' : null,
    tabindex: onClick ? '0' : null,
    onkeydown: onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : null
  }, [
    h('div.kpi-v', { style: color ? { color } : {} }, String(value)),
    h('div.kpi-l', label),
    sub ? h('div.kpi-s', sub) : null
  ]);
  return el;
}

// ── Stato vuoto ─────────────────────────────────────────────────────────
export function emptyState({ icon = '📭', title, message, action }) {
  return h('div.empty', [
    h('div.empty-ico', icon),
    title ? h('h3', title) : null,
    message ? h('p', message) : null,
    action || null
  ]);
}

// ── Skeleton di caricamento ─────────────────────────────────────────────
export function skeletonList(count = 3) {
  const items = [];
  for (let i = 0; i < count; i++) items.push(h('div.skel.skel-card'));
  return h('div', items);
}

// ── Banner ──────────────────────────────────────────────────────────────
export function banner(kind, content, icon) {
  const icons = { info: 'ℹ️', warn: '⚠️', err: '⛔', ok: '✅' };
  return h('div.banner.banner-' + kind, [
    h('div', { style: { flex: '0 0 auto' } }, icon || icons[kind] || 'ℹ️'),
    h('div', { style: { flex: '1 1 auto' } }, content)
  ]);
}

// ── Timeline ────────────────────────────────────────────────────────────
export function timelineView(events, opts = {}) {
  if (!events || !events.length) {
    return emptyState({ icon: '🕐', title: 'Nessun evento', message: 'La cronologia di questa pratica e\' ancora vuota.' });
  }
  const list = opts.newestFirst ? events.slice().reverse() : events.slice();
  return h('div.tl', list.map((ev) => timelineItem(ev)));
}

function timelineItem(ev) {
  const isState = ev.action === 'STATE_CHANGE';
  const color = isState && ev.to ? stateColor(ev.to) : 'var(--text-3)';
  const icons = {
    CREATED: '➕', STATE_CHANGE: '🔄', MESSAGE: '💬',
    DOCUMENT: '📎', NOTE: '📝', SLA_BREACH: '⏰'
  };

  let description;
  if (isState) {
    description = h('span', [
      ev.from ? h('span', [stateLabel(ev.from), ' → ']) : null,
      h('b', { style: { color } }, stateLabel(ev.to))
    ]);
  } else if (ev.action === 'DOCUMENT') {
    description = h('span', ['ha caricato ', h('b', ev.note || 'un documento')]);
  } else if (ev.action === 'MESSAGE') {
    description = h('span', 'ha scritto un messaggio');
  } else if (ev.action === 'CREATED') {
    description = h('span', 'ha aperto la pratica');
  } else if (ev.action === 'SLA_BREACH') {
    description = h('span', { style: { color: 'var(--warn)' } }, ev.note || 'SLA superato');
  } else {
    description = h('span', 'ha aggiunto una nota');
  }

  const showNote = ev.note && ev.action !== 'DOCUMENT' && ev.action !== 'SLA_BREACH';

  return h('div.tl-item', [
    h('div.tl-dot', {
      style: isState ? { borderColor: color, background: 'color-mix(in srgb, ' + color + ' 22%, var(--surface-2))' } : {}
    }, icons[ev.action] || '•'),
    h('div', [
      h('div.tl-hd', [
        h('span.tl-actor', ev.actorName || 'Utente'),
        h('span.tl-time', fmtRelative(ev.ts)),
        ev.actorRole ? h('span.badge', {
          style: {
            fontSize: '10px', padding: '1px 6px',
            background: 'color-mix(in srgb, ' + roleColor(ev.actorRole) + ' 15%, transparent)',
            color: roleColor(ev.actorRole)
          }
        }, roleLabel(ev.actorRole)) : null
      ]),
      h('div.tl-body', description),
      showNote ? h('div.tl-note', ev.note) : null
    ])
  ]);
}

// ── Barra a segmenti ────────────────────────────────────────────────────
export function segmentBar(segments, total) {
  const sum = total || segments.reduce((acc, s) => acc + s.count, 0);
  if (!sum) return h('div.segbar');
  return h('div', [
    h('div.segbar', segments.map((s) => h('span', {
      style: { width: (s.count / sum * 100) + '%', background: s.color },
      title: s.label + ': ' + s.count
    }))),
    h('div.seg-legend', segments.map((s) => h('div', [
      h('span.seg-key', { style: { background: s.color } }),
      h('span', s.label),
      h('b', { style: { marginLeft: '2px' } }, String(s.count))
    ])))
  ]);
}

// ── Sparkline ───────────────────────────────────────────────────────────
export function sparkline(buckets) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return h('div.spark', buckets.map((b) => h('span', {
    style: { height: Math.max(2, (b.count / max) * 44) + 'px' },
    title: b.label + ': ' + b.count
  })));
}

// ── Riga chiave/valore ──────────────────────────────────────────────────
export function infoRow(label, value, opts = {}) {
  if (value == null || value === '' || value === '—') {
    if (!opts.always) return null;
  }
  return h('div', {
    style: {
      display: 'flex', gap: '12px', padding: '7px 0',
      borderBottom: '1px solid var(--border)', fontSize: '13.5px'
    }
  }, [
    h('div', { style: { color: 'var(--text-3)', flex: '0 0 40%', maxWidth: '170px' } }, label),
    h('div', { style: { flex: '1 1 auto', fontWeight: '600', wordBreak: 'break-word' } },
      value instanceof Node ? value : String(value || '—'))
  ]);
}

// ── Pill connessione ────────────────────────────────────────────────────
export function connPill(online, pending) {
  if (!online) {
    return h('span.conn.conn-off', [h('span.badge-dot', { style: { background: 'currentColor' } }), 'Offline']);
  }
  if (pending > 0) {
    return h('span.conn.conn-q', [
      h('span.badge-dot', { style: { background: 'currentColor' } }),
      pending + ' in coda'
    ]);
  }
  return h('span.conn.conn-on', [h('span.badge-dot', { style: { background: 'currentColor' } }), 'Online']);
}

// ── Chip di filtro ──────────────────────────────────────────────────────
export function filterChips(options, current, onChange) {
  return h('div.chip-scroll', options.map((opt) => h('button.chip' + (current === opt.value ? '.on' : ''), {
    type: 'button',
    onclick: () => onChange(opt.value)
  }, [
    opt.color ? h('span.badge-dot', { style: { background: opt.color } }) : null,
    opt.label,
    opt.count != null ? h('span', { style: { opacity: '.65', marginLeft: '2px' } }, String(opt.count)) : null
  ])));
}

// ── Intestazione di pagina ──────────────────────────────────────────────
export function pageHeader(title, subtitle, actions) {
  return h('div.page-hd', [
    h('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [
      h('h1', title),
      subtitle ? h('div.sub', subtitle) : null
    ]),
    actions ? h('div.row.gap-2', actions) : null
  ]);
}
