// Elenco resi con ricerca, filtri e ordinamento.
// Tutto lato client sull'elenco gia' in memoria: reattivo e utilizzabile
// anche offline sui dati in cache.

import { h, mount, clear, debounce } from '../ui/dom.js';
import { subscribe } from '../core/store.js';
import { bindReturns, filterReturns, sortReturns } from '../domain/returns.js';
import { getRole } from '../core/auth.js';
import { can, isTrackingOnly } from '../domain/roles.js';
import { STATE_META, STATE_ORDER, STATE, isTerminal } from '../domain/workflow.js';
import { LEVEL } from '../domain/sla.js';
import { returnCard, emptyState, skeletonList, pageHeader, filterChips, kpiTile } from '../ui/components.js';
import { navigate } from '../core/router.js';

let unsubscribe = null;
const PAGE = 30;

export function renderReturns(container, { query }) {
  clear(container);
  const role = getRole();

  const state = {
    q: query.q || '',
    state: query.state || '',
    sla: query.sla || '',
    sort: query.sort || 'recent',
    limit: PAGE,
    rows: []
  };

  const searchInput = h('input.input', {
    type: 'search',
    placeholder: 'Cerca codice, cliente, fornitore, RMA…',
    value: state.q,
    'aria-label': 'Cerca fra i resi'
  });

  const chipsZone = h('div', { style: { marginBottom: '12px' } });
  const listZone = h('div', skeletonList(4));
  const countEl = h('div.dim', { style: { fontSize: '12.5px', marginBottom: '10px' } });

  const sortSelect = h('select.select', {
    style: { width: 'auto', minWidth: '150px' },
    'aria-label': 'Ordina',
    onchange: (e) => { state.sort = e.target.value; state.limit = PAGE; draw(); }
  }, [
    h('option', { value: 'recent', selected: state.sort === 'recent' }, 'Piu\' recenti'),
    h('option', { value: 'oldest', selected: state.sort === 'oldest' }, 'Meno recenti'),
    h('option', { value: 'sla', selected: state.sort === 'sla' }, 'Urgenza SLA'),
    h('option', { value: 'client', selected: state.sort === 'client' }, 'Cliente'),
    h('option', { value: 'state', selected: state.sort === 'state' }, 'Stato')
  ]);

  searchInput.addEventListener('input', debounce((e) => {
    state.q = e.target.value;
    state.limit = PAGE;
    draw();
  }, 220));

  const solo = isTrackingOnly(role);

  const actions = [];
  if (can(role, 'createRequest')) {
    actions.push(h('a.btn.btn-primary', { href: '#/richieste/nuova' }, '+ Richiesta'));
  }
  // Senza barra di navigazione, le altre sezioni devono essere raggiungibili
  // da qui: e' l'unica pagina che questi ruoli vedono.
  if (solo && can(role, 'createRequest')) {
    actions.push(h('a.btn', { href: '#/richieste' }, 'Le mie richieste'));
  }

  container.appendChild(pageHeader(
    solo ? (role === 'CORRIERE' ? 'I tuoi ritiri' : 'I tuoi resi') : 'Resi',
    solo ? subtitleFor(role) : null,
    actions.length ? actions : null
  ));

  // Riepilogo in cima: senza dashboard, questi numeri devono stare qui.
  const summaryZone = solo ? h('div.grid.grid-4', { style: { marginBottom: '16px' } }) : null;
  if (summaryZone) container.appendChild(summaryZone);
  container.appendChild(h('div.row-w', { style: { marginBottom: '12px' } }, [
    h('div', { style: { flex: '1 1 240px', minWidth: '0' } }, searchInput),
    sortSelect
  ]));
  container.appendChild(chipsZone);
  container.appendChild(countEl);
  container.appendChild(listZone);

  function drawChips() {
    const counts = {};
    for (const r of state.rows) counts[r.trackingState] = (counts[r.trackingState] || 0) + 1;

    const stateOptions = [{ value: '', label: 'Tutti', count: state.rows.length }];
    const ordered = STATE_ORDER.concat([STATE.CONTESTATO, STATE.RIFIUTATO, STATE.CHIUSO_NR]);
    const seen = new Set();
    for (const s of ordered) {
      if (seen.has(s) || !counts[s]) continue;
      seen.add(s);
      stateOptions.push({
        value: s,
        label: (STATE_META[s] && STATE_META[s].label) || s,
        count: counts[s],
        color: (STATE_META[s] && STATE_META[s].color) || '#888'
      });
    }

    const slaOptions = [
      { value: '', label: 'Tutti gli SLA' },
      { value: LEVEL.CRIT, label: 'Critici', color: 'var(--danger)' },
      { value: LEVEL.WARN, label: 'In ritardo', color: 'var(--warn)' },
      { value: LEVEL.OK, label: 'Nei tempi', color: 'var(--ok)' }
    ];

    mount(chipsZone, [
      filterChips(stateOptions, state.state, (v) => {
        state.state = v; state.limit = PAGE; syncUrl(); draw();
      }),
      h('div', { style: { height: '8px' } }),
      filterChips(slaOptions, state.sla, (v) => {
        state.sla = v; state.limit = PAGE; syncUrl(); draw();
      })
    ]);
  }

  function syncUrl() {
    const params = [];
    if (state.q) params.push('q=' + encodeURIComponent(state.q));
    if (state.state) params.push('state=' + encodeURIComponent(state.state));
    if (state.sla) params.push('sla=' + encodeURIComponent(state.sla));
    // replace: filtrare non deve riempire la cronologia del browser.
    const hash = '#/resi' + (params.length ? '?' + params.join('&') : '');
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  function drawSummary() {
    if (!summaryZone) return;
    const rows = state.rows;
    const open = rows.filter((r) => !isTerminal(r.trackingState)).length;
    const closed = rows.length - open;
    const late = rows.filter((r) => r.sla && (r.sla.level === LEVEL.WARN || r.sla.level === LEVEL.CRIT)).length;
    const contested = rows.filter((r) => r.trackingState === STATE.CONTESTATO).length;

    mount(summaryZone, [
      kpiTile({
        value: open, label: role === 'CORRIERE' ? 'Da gestire' : 'In corso',
        color: 'var(--brand-primary)',
        onClick: () => { state.state = ''; state.sla = ''; state.limit = PAGE; syncUrl(); draw(); }
      }),
      kpiTile({
        value: late, label: 'In ritardo',
        color: late > 0 ? 'var(--warn)' : null,
        onClick: () => { state.sla = LEVEL.WARN; state.limit = PAGE; syncUrl(); draw(); }
      }),
      kpiTile({
        value: contested, label: 'Contestati',
        color: contested > 0 ? 'var(--danger)' : null,
        onClick: () => { state.state = STATE.CONTESTATO; state.limit = PAGE; syncUrl(); draw(); }
      }),
      kpiTile({ value: closed, label: 'Conclusi', color: 'var(--ok)' })
    ]);
  }

  function draw() {
    drawSummary();
    drawChips();
    const filtered = sortReturns(
      filterReturns(state.rows, { q: state.q, state: state.state, sla: state.sla }),
      state.sort
    );

    countEl.textContent = filtered.length === state.rows.length
      ? filtered.length + ' resi'
      : filtered.length + ' di ' + state.rows.length + ' resi';

    if (!filtered.length) {
      mount(listZone, emptyState({
        icon: '🔍',
        title: 'Nessun risultato',
        message: state.q || state.state || state.sla
          ? 'Nessun reso corrisponde ai filtri impostati.'
          : 'Non ci sono resi da mostrare.',
        action: (state.q || state.state || state.sla)
          ? h('button.btn', {
              type: 'button',
              onclick: () => {
                state.q = ''; state.state = ''; state.sla = '';
                searchInput.value = '';
                state.limit = PAGE;
                syncUrl(); draw();
              }
            }, 'Azzera filtri')
          : null
      }));
      return;
    }

    const page = filtered.slice(0, state.limit);
    const nodes = page.map((r) => returnCard(r, { showClient: getRole() !== 'CLIENTE' }));

    if (filtered.length > state.limit) {
      nodes.push(h('button.btn.btn-block', {
        type: 'button',
        style: { marginTop: '8px' },
        onclick: () => { state.limit += PAGE; draw(); }
      }, 'Mostra altri ' + Math.min(PAGE, filtered.length - state.limit)));
    }

    mount(listZone, h('div.col.gap-2', nodes));
  }

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribe('returns', (rows) => {
    if (!rows) return;
    state.rows = rows;
    draw();
  }, bindReturns);
}

export function leaveReturns() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function subtitleFor(role) {
  const map = {
    CLIENTE: 'Stato aggiornato in tempo reale. Tocca un reso per la cronologia completa.',
    AGENTE: 'I resi dei clienti della tua zona.',
    CORRIERE: 'I ritiri assegnati al tuo vettore. Tocca un ritiro per aggiornarne lo stato.'
  };
  return map[role] || '';
}
