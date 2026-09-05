// Elenco resi con ricerca, filtri e ordinamento.
// Tutto lato client sull'elenco gia' in memoria: reattivo e utilizzabile
// anche offline sui dati in cache.

import { h, mount, clear, debounce } from '../ui/dom.js';
import { subscribe } from '../core/store.js';
import { bindReturns, filterReturns, sortReturns } from '../domain/returns.js';
import { getRole } from '../core/auth.js';
import { can } from '../domain/roles.js';
import { STATE_META, STATE_ORDER, STATE } from '../domain/workflow.js';
import { LEVEL } from '../domain/sla.js';
import { returnCard, emptyState, skeletonList, pageHeader, filterChips } from '../ui/components.js';
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

  const actions = can(role, 'createRequest')
    ? [h('a.btn.btn-primary', { href: '#/richieste/nuova' }, '+ Richiesta')]
    : null;

  container.appendChild(pageHeader('Resi', null, actions));
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

  function draw() {
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
