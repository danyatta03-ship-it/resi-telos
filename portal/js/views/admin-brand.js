// Admin — configurazione white-label.
// Salva su portal_config/brand; ogni client la applica al boot e in tempo
// reale tramite il listener sul nodo.

import { h, mount, clear, withBusy } from '../ui/dom.js';
import { getRole } from '../core/auth.js';
import { paths } from '../core/firebase.js';
import { getBrand, applyBrand } from '../core/config.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { pageHeader, emptyState, banner } from '../ui/components.js';

const FIELDS = [
  { key: 'appName',        label: 'Nome applicazione', type: 'text', hint: 'Compare nell\'intestazione, nel titolo della scheda e nella schermata di accesso.' },
  { key: 'companyName',    label: 'Ragione sociale',   type: 'text' },
  { key: 'companyAddress', label: 'Indirizzo',         type: 'text' },
  { key: 'companyEmail',   label: 'Email aziendale',   type: 'email' },
  { key: 'companyPhone',   label: 'Telefono',          type: 'tel' },
  { key: 'supportEmail',   label: 'Email di supporto', type: 'email', hint: 'Mostrata nella schermata di accesso a chi non riesce a entrare.' },
  { key: 'logoUrl',        label: 'URL del logo',      type: 'url',  hint: 'Immagine quadrata, idealmente 256×256. Lascia vuoto per usare l\'iniziale.' },
  { key: 'loginTagline',   label: 'Slogan di accesso', type: 'text' },
  { key: 'footerNote',     label: 'Nota a pie\' pagina', type: 'text' },
  { key: 'privacyUrl',     label: 'URL privacy policy', type: 'url' },
  { key: 'termsUrl',       label: 'URL termini di servizio', type: 'url' }
];

const COLORS = [
  { key: 'colorPrimary', label: 'Colore principale', fallback: '#3B9FD4' },
  { key: 'colorAccent',  label: 'Colore accento',    fallback: '#2ECC71' },
  { key: 'colorWarn',    label: 'Colore avviso',     fallback: '#E6B03C' },
  { key: 'colorDanger',  label: 'Colore critico',    fallback: '#E05555' }
];

export function renderAdminBrand(container) {
  clear(container);

  if (getRole() !== 'ADMIN') {
    container.appendChild(emptyState({ icon: '⛔', title: 'Accesso negato', message: 'Sezione riservata agli amministratori.' }));
    return;
  }

  const brand = getBrand();
  const inputs = {};

  const textFields = FIELDS.map((f) => {
    const input = h('input.input', { type: f.type, value: brand[f.key] || '' });
    inputs[f.key] = input;
    return h('div.field', [
      h('label.label', f.label),
      input,
      f.hint ? h('div.hint', f.hint) : null
    ]);
  });

  const colorFields = COLORS.map((c) => {
    const value = brand[c.key] || c.fallback;
    const picker = h('input', {
      type: 'color', value,
      style: { width: '46px', height: '38px', padding: '2px', border: '1px solid var(--border-2)', borderRadius: '8px', background: 'var(--bg-2)', cursor: 'pointer' }
    });
    const text = h('input.input', { type: 'text', value, style: { flex: '1 1 auto' } });

    // I due campi si tengono allineati: si puo' scegliere col picker o
    // incollare un esadecimale preso dal manuale del brand.
    picker.addEventListener('input', () => { text.value = picker.value.toUpperCase(); previewColors(); });
    text.addEventListener('input', () => {
      const v = text.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) { picker.value = v; previewColors(); }
    });

    inputs[c.key] = text;
    return h('div.field', [
      h('label.label', c.label),
      h('div.row.gap-2', [picker, text])
    ]);
  });

  function previewColors() {
    const root = document.documentElement;
    for (const c of COLORS) {
      const v = inputs[c.key].value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
        root.style.setProperty('--brand-' + c.key.replace('color', '').toLowerCase(), v);
      }
    }
  }

  const saveBtn = h('button.btn.btn-primary.btn-lg', { type: 'button' }, 'Salva configurazione');

  saveBtn.addEventListener('click', async () => {
    const next = { ts: Date.now() };
    for (const key in inputs) next[key] = inputs[key].value.trim();

    for (const c of COLORS) {
      if (next[c.key] && !/^#[0-9A-Fa-f]{6}$/.test(next[c.key])) {
        toast('"' + c.label + '" deve essere un colore esadecimale, es. #3B9FD4', 'err');
        return;
      }
    }
    for (const key of ['logoUrl', 'privacyUrl', 'termsUrl']) {
      const v = next[key];
      // http:// su una pagina https verrebbe bloccato dal browser: meglio
      // dirlo adesso che lasciare un logo invisibile.
      if (v && !/^https:\/\//i.test(v)) {
        toast('Gli indirizzi devono iniziare con https://', 'err');
        return;
      }
    }

    await withBusy(saveBtn, async () => {
      try {
        await paths.configBrand().set(next);
        applyBrand(next);
        toast('Configurazione salvata', 'ok');
      } catch (err) {
        toast(err.message || 'Salvataggio non riuscito.', 'err');
      }
    });
  });

  const resetBtn = h('button.btn', {
    type: 'button',
    onclick: async () => {
      const yes = await confirmDialog({
        title: 'Ripristina',
        message: 'La personalizzazione viene rimossa e il portale torna all\'aspetto di fabbrica. Confermi?',
        confirmLabel: 'Ripristina',
        danger: true
      });
      if (!yes) return;
      await paths.configBrand().remove();
      toast('Configurazione ripristinata. Ricarica la pagina.', 'ok', 6000);
    }
  }, 'Ripristina default');

  container.appendChild(pageHeader('Personalizzazione', 'Aspetto e identita\' del portale per tutti gli utenti.'));
  container.appendChild(banner('info', 'Le modifiche sono immediate per tutti gli utenti collegati.'));

  container.appendChild(h('div.split', [
    h('div.card', [h('h3', 'Identita\''), textFields]),
    h('div.col.gap-4', [
      h('div.card', [h('h3', 'Colori'), colorFields]),
      h('div.card', [
        h('h3', 'Anteprima'),
        h('div.row', { style: { marginBottom: '12px' } }, [
          h('div', {
            style: {
              width: '44px', height: '44px', borderRadius: '10px',
              background: 'var(--brand-primary)', color: '#fff',
              display: 'grid', placeItems: 'center', fontSize: '19px', fontWeight: '800'
            }
          }, (brand.companyName || 'T').charAt(0).toUpperCase()),
          h('div', [
            h('div', { style: { fontWeight: '700' } }, brand.appName || 'Tracking Resi'),
            h('div.dim', { style: { fontSize: '12px' } }, brand.companyName || '')
          ])
        ]),
        h('div.btn-group', [
          h('button.btn.btn-primary.btn-sm', { type: 'button' }, 'Principale'),
          h('button.btn.btn-ok.btn-sm', { type: 'button' }, 'Positivo'),
          h('button.btn.btn-warn.btn-sm', { type: 'button' }, 'Avviso'),
          h('button.btn.btn-danger.btn-sm', { type: 'button' }, 'Critico')
        ])
      ])
    ])
  ]));

  container.appendChild(h('div.row.gap-2', { style: { marginTop: '20px' } }, [saveBtn, resetBtn]));
}
