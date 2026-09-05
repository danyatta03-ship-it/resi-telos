// Helper DOM.
//
// Il portale non usa framework: costruisce nodi con h() e li monta. La regola
// non negoziabile e' che ogni dato proveniente da Firebase passi da esc()
// prima di finire in innerHTML. I contenuti sono scritti da clienti, agenti e
// corrieri — vale a dire da utenti di cui non ci fidiamo.

export function esc(value) {
  const s = value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// h('div.card', {onclick: fn}, 'testo' | nodo | [nodi])
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
      } else if (key === 'dataset' && typeof val === 'object') {
        Object.assign(el.dataset, val);
      } else if (key === 'html') {
        el.innerHTML = val;
      } else if (key.startsWith('on') && typeof val === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (key in el && key !== 'list' && typeof val !== 'object') {
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

export function frag(children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

export function clear(el) {
  if (!el) return el;
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(target, content) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return null;
  clear(el);
  append(el, content);
  return el;
}

export function $(sel, root) {
  return (root || document).querySelector(sel);
}

export function $$(sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
}

// ── Formattazione ───────────────────────────────────────────────────────

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
  return fmtDate(ts) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// "3 min fa" · "2 g fa" · data piena oltre la settimana
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

// Data ISO 'YYYY-MM-DD' → 'DD/MM/YYYY'
export function fmtIsoDate(iso) {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso);
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Colore stabile derivato dal nome: la stessa persona ha sempre lo stesso
// avatar senza doverlo memorizzare da nessuna parte.
export function colorFor(seed) {
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = ['#3B9FD4', '#2ECC71', '#E6B03C', '#9B6BD4', '#E0708C', '#5BB8E0', '#E08A55', '#57C4B0'];
  return palette[h % palette.length];
}

export function debounce(fn, ms = 250) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// Blocca il bottone mentre l'azione e' in corso: evita il doppio invio e
// mostra all'utente che sta succedendo qualcosa.
export function withBusy(btn, fn) {
  if (!btn) return fn();
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = original;
    });
}
