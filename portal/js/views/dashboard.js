// Dashboard. Il contenuto cambia per ruolo: un corriere vuole sapere quanti
// ritiri ha in coda, un agente come stanno i clienti della sua zona, Telos
// dove sta bruciando gli SLA. Stessi dati, tagli diversi.

import { h, mount, clear } from '../ui/dom.js';
import { subscribe } from '../core/store.js';
import { bindReturns } from '../domain/returns.js';
import { getRole, getDisplayName, getScope } from '../core/auth.js';
import { can } from '../domain/roles.js';
import { STATE } from '../domain/workflow.js';
import { LEVEL } from '../domain/sla.js';
import * as kpi from '../domain/kpi.js';
import { navigate } from '../core/router.js';
import {
  kpiTile, returnCard, emptyState, skeletonList,
  segmentBar, sparkline, pageHeader, banner
} from '../ui/components.js';

let unsubscribe = null;

export function renderDashboard(container) {
  clear(container);
  const role = getRole();

  const kpiZone = h('div.grid.grid-4', { style: { marginBottom: '20px' } }, skeletonList(1));
  const bodyZone = h('div', skeletonList(3));

  container.appendChild(pageHeader(
    'Ciao, ' + getDisplayName().split(' ')[0],
    subtitleFor(role)
  ));
  container.appendChild(kpiZone);
  container.appendChild(bodyZone);

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribe('returns', (rows) => {
    if (!rows) return;
    render(kpiZone, bodyZone, rows, role);
  }, bindReturns);
}

export function leaveDashboard() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function subtitleFor(role) {
  const map = {
    ADMIN: 'Vista completa su tutte le pratiche e la configurazione.',
    TELOS: 'Le pratiche in lavorazione e quelle che richiedono attenzione.',
    CLIENTE: 'Lo stato dei tuoi resi in tempo reale.',
    AGENTE: 'I resi dei clienti della tua zona.',
    CORRIERE: 'I ritiri assegnati al tuo vettore.'
  };
  return map[role] || '';
}

function render(kpiZone, bodyZone, rows, role) {
  const stats = kpi.summarize(rows);

  // ── KPI ──
  const tiles = [];
  if (role === 'CORRIERE') {
    const daRitirare = rows.filter((r) => r.trackingState === STATE.ATTESA_RITIRO || r.trackingState === STATE.APPROVATO).length;
    const inViaggio = rows.filter((r) => r.trackingState === STATE.RITIRATO || r.trackingState === STATE.IN_TRANSITO).length;
    tiles.push(
      kpiTile({ value: daRitirare, label: 'Da ritirare', color: 'var(--warn)', onClick: () => navigate('/resi?state=' + STATE.ATTESA_RITIRO) }),
      kpiTile({ value: inViaggio, label: 'In viaggio', color: 'var(--info)', onClick: () => navigate('/resi?state=' + STATE.IN_TRANSITO) }),
      kpiTile({ value: stats.closed, label: 'Consegnati' }),
      kpiTile({ value: stats.total, label: 'Totale' })
    );
  } else {
    tiles.push(
      kpiTile({ value: stats.open, label: 'Aperti', color: 'var(--brand-primary)', onClick: () => navigate('/resi') }),
      kpiTile({
        value: stats.slaCrit, label: 'Critici', color: 'var(--danger)',
        sub: stats.slaWarn > 0 ? '+' + stats.slaWarn + ' in ritardo' : null,
        onClick: () => navigate('/resi?sla=' + LEVEL.CRIT)
      }),
      kpiTile({ value: stats.closed, label: 'Chiusi', color: 'var(--ok)' }),
      can(role, 'viewFinancials')
        ? kpiTile({ value: kpi.formatCurrency(stats.value), label: 'Valore', sub: stats.total + ' articoli' })
        : kpiTile({ value: stats.total, label: 'Totale resi' })
    );
  }
  mount(kpiZone, tiles);

  // ── Corpo ──
  clear(bodyZone);

  if (!rows.length) {
    bodyZone.appendChild(emptyState({
      icon: '📦',
      title: 'Nessun reso',
      message: emptyMessageFor(role),
      action: can(role, 'createRequest')
        ? h('a.btn.btn-primary', { href: '#/richieste/nuova' }, 'Apri una richiesta')
        : null
    }));
    return;
  }

  const attention = kpi.attentionList(rows, 5);
  const recent = rows.slice(0, 6);
  const states = kpi.byState(rows);

  const left = h('div.col.gap-4');
  const right = h('div.col.gap-4');

  if (attention.length) {
    left.appendChild(h('section', [
      h('div.card-hd', [
        h('h2', 'Richiedono attenzione'),
        h('span.spacer'),
        h('a', { href: '#/resi?sla=' + LEVEL.CRIT, style: { fontSize: '13px' } }, 'Vedi tutti')
      ]),
      banner('warn', attention.length + ' ' + (attention.length === 1 ? 'pratica ha' : 'pratiche hanno') + ' superato la soglia di tempo prevista.'),
      h('div.col.gap-2', attention.map((r) => returnCard(r, { showClient: role !== 'CLIENTE' })))
    ]));
  }

  left.appendChild(h('section', [
    h('div.card-hd', [
      h('h2', 'Attivita\' recente'),
      h('span.spacer'),
      h('a', { href: '#/resi', style: { fontSize: '13px' } }, 'Tutti i resi')
    ]),
    h('div.col.gap-2', recent.map((r) => returnCard(r, { showClient: role !== 'CLIENTE' })))
  ]));

  right.appendChild(h('div.card', [
    h('h3', 'Distribuzione per stato'),
    segmentBar(states, rows.length)
  ]));

  if (role !== 'CORRIERE') {
    const cycle = kpi.avgCycleDays(rows);
    right.appendChild(h('div.card', [
      h('h3', 'Andamento aperture'),
      h('div.dim', { style: { fontSize: '12px', marginBottom: '10px' } }, 'Ultimi 30 giorni'),
      sparkline(kpi.timeline(rows, 30)),
      h('div.row', { style: { marginTop: '14px', gap: '20px' } }, [
        h('div', [
          h('div.kpi-l', 'Rispetto SLA'),
          h('div', { style: { fontSize: '19px', fontWeight: '800', color: stats.slaCompliance >= 90 ? 'var(--ok)' : stats.slaCompliance >= 70 ? 'var(--warn)' : 'var(--danger)' } },
            stats.slaCompliance + '%')
        ]),
        cycle != null ? h('div', [
          h('div.kpi-l', 'Ciclo medio'),
          h('div', { style: { fontSize: '19px', fontWeight: '800' } }, cycle + ' gg')
        ]) : null
      ])
    ]));
  }

  if (can(role, 'viewAllReturns')) {
    const topClients = kpi.topBy(rows, 'sogg', 5);
    if (topClients.length) {
      right.appendChild(h('div.card', [
        h('h3', 'Clienti piu\' attivi'),
        h('div.list', topClients.map((c) => h('div.list-item', [
          h('div.list-main', h('div.list-title.truncate', c.label)),
          h('b', String(c.count))
        ])))
      ]));
    }
  }

  if (role === 'AGENTE' || role === 'CORRIERE' || role === 'CLIENTE') {
    const scope = getScope();
    if (scope.length) {
      right.appendChild(h('div.card', [
        h('h3', role === 'CORRIERE' ? 'Vettori assegnati' : role === 'AGENTE' ? 'Zone assegnate' : 'Codici cliente'),
        h('div.chip-row', scope.map((s) => h('span.chip', { style: { cursor: 'default' } }, s)))
      ]));
    }
  }

  bodyZone.appendChild(h('div.split', [left, right]));
}

function emptyMessageFor(role) {
  const map = {
    CLIENTE: 'Non risultano resi associati al tuo account. Quando aprirai una richiesta la troverai qui.',
    AGENTE: 'Nessun reso per i clienti della tua zona al momento.',
    CORRIERE: 'Nessun ritiro assegnato al tuo vettore.',
    TELOS: 'Nessuna pratica nel perimetro visibile.',
    ADMIN: 'Il database non contiene ancora resi sincronizzati sul portale.'
  };
  return map[role] || 'Nessun dato disponibile.';
}
