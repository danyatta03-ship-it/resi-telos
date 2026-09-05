// Modali: conferme, prompt e dialog personalizzati.
// Gestisce focus trap, Esc e click sullo sfondo.

import { h, clear } from './dom.js';

let openCount = 0;

function lock() {
  openCount++;
  document.body.style.overflow = 'hidden';
}

function unlock() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.body.style.overflow = '';
}

export function openModal({ title, body, footer, wide, onClose, dismissible = true }) {
  const previouslyFocused = document.activeElement;

  const panel = h('div.modal' + (wide ? '.modal-wide' : ''), {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title || 'Finestra di dialogo'
  });

  if (title) {
    panel.appendChild(h('div.modal-hd', [
      h('h3', title),
      dismissible ? h('button.hdr-icon-btn', {
        type: 'button', 'aria-label': 'Chiudi', onclick: () => close()
      }, '×') : null
    ]));
  }

  const bodyEl = h('div.modal-bd');
  if (body) bodyEl.appendChild(body instanceof Node ? body : h('div', body));
  panel.appendChild(bodyEl);

  let footEl = null;
  if (footer) {
    footEl = h('div.modal-ft');
    footEl.appendChild(footer instanceof Node ? footer : h('div', footer));
    panel.appendChild(footEl);
  }

  const back = h('div.modal-back', {
    onclick: (e) => { if (dismissible && e.target === back) close(); }
  }, panel);

  function onKey(e) {
    if (e.key === 'Escape' && dismissible) {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      trap(e);
    }
  }

  // Focus trap: senza, Tab porta dietro alla modale e l'utente si perde.
  function trap(e) {
    const focusables = panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    if (back.parentNode) back.parentNode.removeChild(back);
    unlock();
    if (previouslyFocused && previouslyFocused.focus) {
      try { previouslyFocused.focus(); } catch (e) { /* nodo rimosso nel frattempo */ }
    }
    if (typeof onClose === 'function') onClose(result);
  }

  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(back);
  lock();

  const auto = panel.querySelector('[autofocus], input, textarea, button.btn-primary, button');
  if (auto) setTimeout(() => { try { auto.focus(); } catch (e) { /* ignora */ } }, 40);

  return {
    close,
    panel,
    body: bodyEl,
    footer: footEl,
    setBody(content) { clear(bodyEl); bodyEl.appendChild(content instanceof Node ? content : h('div', content)); }
  };
}

export function confirmDialog({ title = 'Conferma', message, confirmLabel = 'Conferma', cancelLabel = 'Annulla', danger = false }) {
  return new Promise((resolve) => {
    let decided = false;
    const ref = openModal({
      title,
      body: h('div', { style: { fontSize: '14px', lineHeight: '1.6' } }, message),
      footer: [
        h('button.btn', { type: 'button', onclick: () => { decided = true; ref.close(); resolve(false); } }, cancelLabel),
        h('button.btn.' + (danger ? 'btn-danger' : 'btn-primary'), {
          type: 'button',
          onclick: () => { decided = true; ref.close(); resolve(true); }
        }, confirmLabel)
      ],
      onClose: () => { if (!decided) resolve(false); }
    });
  });
}

export function promptDialog({ title = 'Inserisci', label, placeholder = '', value = '', required = false, multiline = false, confirmLabel = 'Conferma', hint = '' }) {
  return new Promise((resolve) => {
    const input = multiline
      ? h('textarea.textarea', { placeholder, value, rows: 4 })
      : h('input.input', { type: 'text', placeholder, value });

    const errEl = h('div.err-msg.hidden');

    function submit() {
      const v = String(input.value || '').trim();
      if (required && !v) {
        errEl.textContent = 'Questo campo e\' obbligatorio.';
        errEl.classList.remove('hidden');
        input.classList.add('field-err');
        input.focus();
        return;
      }
      decided = true;
      ref.close();
      resolve(v);
    }

    if (!multiline) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
    }

    let decided = false;
    const ref = openModal({
      title,
      body: h('div', [
        label ? h('label.label', label + (required ? ' *' : '')) : null,
        input,
        hint ? h('div.hint', hint) : null,
        errEl
      ]),
      footer: [
        h('button.btn', { type: 'button', onclick: () => { decided = true; ref.close(); resolve(null); } }, 'Annulla'),
        h('button.btn.btn-primary', { type: 'button', onclick: submit }, confirmLabel)
      ],
      onClose: () => { if (!decided) resolve(null); }
    });
  });
}

// Visualizzatore immagine a tutto schermo.
export function imageViewer(url, caption) {
  return openModal({
    title: caption || 'Immagine',
    wide: true,
    body: h('div', { style: { textAlign: 'center' } }, [
      h('img', {
        src: url,
        alt: caption || '',
        style: { maxWidth: '100%', maxHeight: '68vh', margin: '0 auto', borderRadius: '10px' }
      })
    ]),
    footer: [
      h('a.btn', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Apri originale')
    ]
  });
}
