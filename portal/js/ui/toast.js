// Toast: notifiche effimere in basso.

import { h } from './dom.js';

let container = null;

function ensure() {
  if (container && document.body.contains(container)) return container;
  container = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
  document.body.appendChild(container);
  return container;
}

export function toast(message, kind = 'info', ms = 3800) {
  const box = ensure();
  const el = h('div.toast.toast-' + kind, [
    h('div', { style: { flex: '1 1 auto' } }, String(message)),
    h('button.toast-x', {
      type: 'button',
      'aria-label': 'Chiudi',
      onclick: () => remove(el)
    }, '×')
  ]);
  box.appendChild(el);
  if (ms > 0) setTimeout(() => remove(el), ms);
  return el;
}

function remove(el) {
  if (!el || !el.parentNode) return;
  el.style.transition = 'opacity .14s ease, transform .14s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(6px)';
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 150);
}

export const ok = (m, ms) => toast(m, 'ok', ms);
export const err = (m, ms) => toast(m, 'err', ms || 6000);
export const warn = (m, ms) => toast(m, 'warn', ms || 5000);
export const info = (m, ms) => toast(m, 'info', ms);
