// Shell dell'applicazione: header, sidebar desktop, tab bar mobile.
// Costruita una volta sola al login; le viste montano dentro <main>.

import { h, clear, mount, initials, colorFor } from './dom.js';
import { getBrand } from '../core/config.js';
import { getRole, getDisplayName, getProfile, signOut } from '../core/auth.js';
import { navFor, roleLabel } from '../domain/roles.js';
import { isConnected } from '../core/firebase.js';
import { getPendingCount } from '../core/offline.js';
import { on, EVENTS } from '../core/bus.js';
import { connPill } from './components.js';
import { navigate } from '../core/router.js';
import { confirmDialog } from './modal.js';

let root = null;
let mainEl = null;
let navEl = null;
let sideEl = null;
let connEl = null;
let notifBadgeEl = null;
let themeBtn = null;
let unreadNotifs = 0;

export function buildShell(container) {
  root = container;
  clear(root);

  const brand = getBrand();
  const role = getRole();

  // ── Header ──
  const logo = brand.logoUrl
    ? h('div.hdr-logo', h('img', { src: brand.logoUrl, alt: '' }))
    : h('div.hdr-logo', (brand.companyName || 'T').charAt(0).toUpperCase());

  connEl = h('span', connPill(isConnected(), getPendingCount()));

  notifBadgeEl = h('span.hdr-dot.hidden', '0');

  const header = h('header.hdr', [
    h('a.hdr-brand', { href: '#/' }, [
      logo,
      h('span.truncate', brand.appName || 'Tracking Resi')
    ]),
    h('span.hdr-spacer'),
    h('div.hdr-actions', [
      connEl,
      h('button.hdr-icon-btn', {
        type: 'button',
        'aria-label': 'Notifiche',
        onclick: () => navigate('/notifiche')
      }, [h('span', '🔔'), notifBadgeEl]),
      themeBtn = h('button.hdr-icon-btn', {
        type: 'button',
        'aria-label': 'Cambia tema',
        title: 'Cambia tema',
        onclick: toggleTheme
      }, themeGlyph()),
      h('button.hdr-icon-btn', {
        type: 'button',
        'aria-label': 'Menu utente',
        onclick: openUserMenu,
        style: { padding: '0' }
      }, h('div.avatar.avatar-sm', {
        style: { background: colorFor(getDisplayName()) }
      }, initials(getDisplayName())))
    ])
  ]);

  // ── Sidebar (desktop) + tab bar (mobile) ──
  const items = navFor(role);
  sideEl = h('aside.side', renderSideItems(items));
  navEl = h('nav.nav', { 'aria-label': 'Navigazione principale' }, renderNavItems(items));

  mainEl = h('main.main', { id: 'view', role: 'main' });

  root.appendChild(h('div.app', [
    header,
    h('div.body', [sideEl, mainEl]),
    navEl
  ]));

  bindShellEvents();
  return mainEl;
}

function renderSideItems(items) {
  const nodes = [];
  let adminSeparatorAdded = false;
  for (const it of items) {
    if (it.path.startsWith('/admin') && !adminSeparatorAdded) {
      nodes.push(h('div.side-sep', 'Amministrazione'));
      adminSeparatorAdded = true;
    }
    nodes.push(h('a.side-item', {
      href: '#' + it.path,
      dataset: { path: it.path }
    }, [
      h('span.ico', it.icon),
      h('span.truncate', it.label),
      it.path === '/notifiche' ? h('span.side-badge.hidden', { dataset: { role: 'notif' } }, '0') : null
    ]));
  }
  return nodes;
}

function renderNavItems(items) {
  // In tab bar il profilo sta nel menu utente dell'header: toglierlo lascia
  // spazio alle voci operative, che sono quelle che si toccano davvero.
  return items.filter((it) => it.path !== '/profilo').map((it) => h('a.nav-item', {
    href: '#' + it.path,
    dataset: { path: it.path }
  }, [
    h('span.ico', it.icon),
    h('span.lbl', it.label),
    it.path === '/notifiche' ? h('span.nav-badge.hidden', { dataset: { role: 'notif' } }, '0') : null
  ]));
}

function bindShellEvents() {
  on(EVENTS.ROUTE_CHANGED, (route) => setActive(route && route.path));
  on(EVENTS.CONN_CHANGED, () => refreshConn());
  on(EVENTS.QUEUE_CHANGED, () => refreshConn());
  on(EVENTS.NOTIF_CHANGED, (count) => {
    if (count >= 0) setNotifCount(count);
  });
  on(EVENTS.BRAND_CHANGED, () => {
    // Il nome app e il logo cambiano solo dall'admin: ricostruire l'intera
    // shell sarebbe sprecato, aggiorno i due nodi interessati.
    const brand = getBrand();
    const label = root && root.querySelector('.hdr-brand .truncate');
    if (label) label.textContent = brand.appName || 'Tracking Resi';
  });
}

function refreshConn() {
  if (!connEl) return;
  mount(connEl, connPill(isConnected(), getPendingCount()));
}

export function setNotifCount(count) {
  unreadNotifs = Math.max(0, count | 0);
  const text = unreadNotifs > 99 ? '99+' : String(unreadNotifs);
  const targets = [notifBadgeEl].concat(
    Array.prototype.slice.call(root ? root.querySelectorAll('[data-role="notif"]') : [])
  );
  for (const el of targets) {
    if (!el) continue;
    el.textContent = text;
    el.classList.toggle('hidden', unreadNotifs === 0);
  }
}

// Evidenzia la voce attiva. '/resi/xyz' deve accendere '/resi'.
function setActive(path) {
  if (!root || !path) return;
  const links = root.querySelectorAll('[data-path]');
  let bestLen = -1;
  let best = null;
  for (const link of links) {
    const p = link.dataset.path;
    const matches = p === '/' ? path === '/' : (path === p || path.startsWith(p + '/'));
    link.classList.remove('on');
    if (matches && p.length > bestLen) {
      bestLen = p.length;
      best = link;
    }
  }
  // Piu' link possono avere lo stesso path (sidebar + tab bar): accendo tutti
  // quelli che corrispondono al match migliore.
  if (best) {
    const chosen = best.dataset.path;
    for (const link of links) {
      if (link.dataset.path === chosen) link.classList.add('on');
    }
  }
}

// Il glifo mostra il tema in cui si PASSERA' col prossimo tocco: e' il modo
// in cui la gente legge questo bottone ("premo la luna per andare al buio").
function themeGlyph() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'dark') return '☀️';
  if (current === 'light') return '🌗';
  return '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  // Ciclo: automatico → scuro → chiaro → automatico
  const next = current === 'dark' ? 'light' : (current === 'light' ? '' : 'dark');
  if (next) document.documentElement.setAttribute('data-theme', next);
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('portal_theme', next); } catch (e) { /* quota */ }
  if (themeBtn) {
    themeBtn.textContent = themeGlyph();
    themeBtn.title = next === 'dark' ? 'Tema scuro' : next === 'light' ? 'Tema chiaro' : 'Tema automatico';
  }
}

export function restoreTheme() {
  try {
    const saved = localStorage.getItem('portal_theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch (e) { /* private mode */ }
}

function openUserMenu() {
  const profile = getProfile();
  const role = getRole();
  import('./modal.js').then(({ openModal }) => {
    const ref = openModal({
      title: 'Account',
      body: h('div', [
        h('div.row', { style: { marginBottom: '16px' } }, [
          h('div.avatar.avatar-lg', { style: { background: colorFor(getDisplayName()) } }, initials(getDisplayName())),
          h('div', { style: { minWidth: '0' } }, [
            h('div', { style: { fontWeight: '700', fontSize: '15px' } }, getDisplayName()),
            h('div.muted', { style: { fontSize: '13px' } }, (profile && profile.email) || ''),
            h('div.dim', { style: { fontSize: '12px', marginTop: '2px' } }, roleLabel(role))
          ])
        ]),
        h('div.list', [
          h('a.list-item', { href: '#/profilo', onclick: () => ref.close() }, [
            h('span', { style: { fontSize: '17px' } }, '👤'),
            h('div.list-main', [h('div.list-title', 'Profilo e preferenze')])
          ])
        ])
      ]),
      footer: [
        h('button.btn', { type: 'button', onclick: () => ref.close() }, 'Chiudi'),
        h('button.btn.btn-danger', {
          type: 'button',
          onclick: async () => {
            ref.close();
            const yes = await confirmDialog({
              title: 'Esci',
              message: 'Vuoi uscire dal portale?',
              confirmLabel: 'Esci',
              danger: true
            });
            if (yes) await signOut();
          }
        }, 'Esci')
      ]
    });
  });
}

export function getMain() {
  return mainEl;
}

export function teardownShell() {
  if (root) clear(root);
  root = null;
  mainEl = null;
  navEl = null;
  sideEl = null;
  connEl = null;
  notifBadgeEl = null;
  themeBtn = null;
}
