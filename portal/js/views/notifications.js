// Centro notifiche + attivazione del push.

import { h, mount, clear, fmtRelative, withBusy } from '../ui/dom.js';
import { subscribe } from '../core/store.js';
import {
  bindNotifications, markRead, markAllRead, clearAll,
  enablePush, disablePush, pushSupported, pushPermission, isPushReady
} from '../domain/notifications.js';
import { navigate } from '../core/router.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { emptyState, skeletonList, pageHeader, banner } from '../ui/components.js';

let unsubscribe = null;

export function leaveNotifications() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

export function renderNotifications(container) {
  leaveNotifications();
  clear(container);

  const listZone = h('div', skeletonList(3));
  const pushZone = h('div', { style: { marginBottom: '16px' } });
  let current = [];

  const actions = [
    h('button.btn.btn-sm', {
      type: 'button',
      onclick: () => markAllRead(current).then(() => toast('Tutte segnate come lette', 'ok'))
    }, 'Segna lette'),
    h('button.btn.btn-sm.btn-ghost', {
      type: 'button',
      onclick: async () => {
        const yes = await confirmDialog({
          title: 'Svuota notifiche',
          message: 'Vuoi eliminare tutte le notifiche? L\'operazione non e\' reversibile.',
          confirmLabel: 'Elimina',
          danger: true
        });
        if (yes) {
          await clearAll();
          toast('Notifiche eliminate', 'ok');
        }
      }
    }, 'Svuota')
  ];

  container.appendChild(pageHeader('Notifiche', null, actions));
  container.appendChild(pushZone);
  container.appendChild(listZone);

  drawPush(pushZone);

  unsubscribe = subscribe('notifications', (rows) => {
    if (!rows) return;
    current = rows;
    if (!rows.length) {
      mount(listZone, emptyState({
        icon: '🔔',
        title: 'Nessuna notifica',
        message: 'Qui arriveranno gli aggiornamenti sulle tue pratiche.'
      }));
      return;
    }
    mount(listZone, h('div.col.gap-2', rows.map((n) => notifCard(n))));
  }, bindNotifications);
}

function notifCard(n) {
  const unread = !n.read;
  return h('div.card.card-tight', {
    style: {
      cursor: n.returnKey ? 'pointer' : 'default',
      borderLeft: unread ? '3px solid var(--brand-primary)' : '3px solid transparent'
    },
    onclick: () => {
      if (!n.read) markRead(n.id);
      if (n.returnKey) navigate('/resi/' + encodeURIComponent(n.returnKey));
    }
  }, [
    h('div.row-t', [
      h('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [
        h('div', {
          style: { fontWeight: unread ? '700' : '600', fontSize: '14px' }
        }, n.title || ''),
        n.body ? h('div.muted', { style: { fontSize: '13px', marginTop: '2px' } }, n.body) : null,
        h('div.dim', { style: { fontSize: '11.5px', marginTop: '4px' } }, fmtRelative(n.ts))
      ]),
      unread ? h('span.badge-dot', { style: { background: 'var(--brand-primary)', marginTop: '6px' } }) : null
    ])
  ]);
}

function drawPush(zone) {
  if (!pushSupported()) {
    mount(zone, banner('info', 'Le notifiche push non sono supportate da questo browser. Riceverai comunque gli avvisi qui nel portale.'));
    return;
  }

  const permission = pushPermission();

  if (permission === 'denied') {
    mount(zone, banner('warn', 'Hai bloccato le notifiche per questo sito. Per riattivarle usa le impostazioni del browser (icona del lucchetto accanto all\'indirizzo).'));
    return;
  }

  if (permission === 'granted' && isPushReady()) {
    mount(zone, h('div.card.card-tight', h('div.row', [
      h('span', '🔔'),
      h('div', { style: { flex: '1 1 auto' } }, [
        h('div', { style: { fontWeight: '600', fontSize: '13.5px' } }, 'Notifiche push attive'),
        h('div.dim', { style: { fontSize: '12px' } }, 'Ricevi gli aggiornamenti anche ad app chiusa.')
      ]),
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button',
        onclick: async (e) => {
          await withBusy(e.currentTarget, async () => {
            await disablePush();
            toast('Notifiche push disattivate', 'ok');
            drawPush(zone);
          });
        }
      }, 'Disattiva')
    ])));
    return;
  }

  mount(zone, h('div.card.card-tight', h('div.row', [
    h('span', '🔕'),
    h('div', { style: { flex: '1 1 auto' } }, [
      h('div', { style: { fontWeight: '600', fontSize: '13.5px' } }, 'Attiva le notifiche push'),
      h('div.dim', { style: { fontSize: '12px' } }, 'Ti avvisiamo quando cambia qualcosa sui tuoi resi.')
    ]),
    h('button.btn.btn-sm.btn-primary', {
      type: 'button',
      onclick: async (e) => {
        await withBusy(e.currentTarget, async () => {
          try {
            await enablePush();
            toast('Notifiche push attivate', 'ok');
            drawPush(zone);
          } catch (err) {
            toast(err.message || 'Attivazione non riuscita.', 'err');
          }
        });
      }
    }, 'Attiva')
  ])));
}
