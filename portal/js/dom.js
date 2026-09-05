// Helper DOM minimali.
// I contenuti che arrivano dal server (risposte di Telos, nomi) finiscono
// sempre in nodi di testo tramite h(): createTextNode neutralizza l'HTML da
// solo, quindi non serve — anzi non si deve — codificarli a mano, o si
// vedrebbero le entita' grezze.

export function h(spec, props, children) {
  const parts = String(spec).split(/(?=[.#])/);
  const tag = parts[0] && !/^[.#]/.test(parts[0]) ? parts[0] : 'div';
  const el = document.createElement(tag);

  for (const p of parts) {
    if (p.startsWith('.')) el.classList.add(p.slice(1));
    else if (p.startsWith('#')) el.id = p.slice(1);
  }

  if (props && typeof props === 'object' && !Array.isArray(props) && !(props instanceof Node)) {
    for (const key in props) {
      const val = props[key];
      if (val == null || val === false) continue;
      if (key === 'class' || key === 'className') {
        String(val).split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
      } else if (key === 'style' && typeof val === 'object') {
        Object.assign(el.style, val);
      } else if (key.startsWith('on') && typeof val === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (key in el && typeof val !== 'object') {
        try { el[key] = val; } catch (e) { el.setAttribute(key, val); }
      } else {
        el.setAttribute(key, val === true ? '' : val);
      }
    }
  } else if (props !== undefined && children === undefined) {
    children = props;
  }

  append(el, children);
  return el;
}

export function append(parent, child) {
  if (child == null || child === false) return parent;
  if (Array.isArray(child)) {
    child.forEach((c) => append(parent, c));
    return parent;
  }
  if (child instanceof Node) {
    parent.appendChild(child);
    return parent;
  }
  parent.appendChild(document.createTextNode(String(child)));
  return parent;
}

export function clear(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(target, content) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return null;
  clear(el);
  append(el, content);
  return el;
}

export function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return '—';
  return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
}

export function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return '—';
  return fmtDate(ts) + ' alle ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

export function fmtRelative(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 0) return fmtDateTime(ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return min + ' min fa';
  const hours = Math.floor(min / 60);
  if (hours < 24) return hours + (hours === 1 ? ' ora fa' : ' ore fa');
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return days + ' giorni fa';
  return fmtDate(ts);
}

export function withBusy(btn, fn) {
  if (!btn) return Promise.resolve().then(fn);
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Attendi…';
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      btn.disabled = false;
      btn.textContent = original;
    });
}

let toastBox = null;
export function toast(message, kind = 'info', ms = 4000) {
  if (!toastBox || !document.body.contains(toastBox)) {
    toastBox = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastBox);
  }
  const el = h('div.toast.toast-' + kind, message);
  toastBox.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, ms);
  return el;
}
