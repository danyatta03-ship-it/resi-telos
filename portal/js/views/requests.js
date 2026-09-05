// Richieste di reso: elenco + creazione.
// E' il punto in cui un cliente entra nel processo prima che esista un
// record nel gestionale.

import { h, mount, clear, fmtRelative, withBusy } from '../ui/dom.js';
import { subscribe } from '../core/store.js';
import {
  bindRequests, createRequest, advanceRequest,
  allowedRequestTransitions, reqLabel, reqColor, reqIcon, REQ_STATE
} from '../domain/requests.js';
import { getRole, getScope, getProfile } from '../core/auth.js';
import { can } from '../domain/roles.js';
import { navigate } from '../core/router.js';
import { toast } from '../ui/toast.js';
import { promptDialog, confirmDialog } from '../ui/modal.js';
import { emptyState, skeletonList, pageHeader, banner, avatar } from '../ui/components.js';

let unsubscribe = null;

export function leaveRequests() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

// ── Elenco ──────────────────────────────────────────────────────────────
export function renderRequests(container) {
  leaveRequests();
  clear(container);
  const role = getRole();

  const listZone = h('div', skeletonList(3));
  const actions = can(role, 'createRequest')
    ? [h('a.btn.btn-primary', { href: '#/richieste/nuova' }, '+ Nuova richiesta')]
    : null;

  container.appendChild(pageHeader('Richieste di reso', null, actions));
  container.appendChild(listZone);

  unsubscribe = subscribe('requests', (rows) => {
    if (!rows) return;
    if (!rows.length) {
      mount(listZone, emptyState({
        icon: '📝',
        title: 'Nessuna richiesta',
        message: can(role, 'createRequest')
          ? 'Apri una richiesta per avviare la procedura di reso.'
          : 'Non ci sono richieste da esaminare.',
        action: can(role, 'createRequest')
          ? h('a.btn.btn-primary', { href: '#/richieste/nuova' }, 'Nuova richiesta')
          : null
      }));
      return;
    }
    mount(listZone, h('div.col.gap-2', rows.map((r) => requestCard(r, role))));
  }, bindRequests);
}

function requestCard(req, role) {
  const color = reqColor(req.state);
  const transitions = allowedRequestTransitions(req.state, role);
  const articles = req.articoli || [];

  return h('div.card', [
    h('div.row-t', { style: { marginBottom: '8px' } }, [
      h('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [
        h('div', { style: { fontWeight: '700', fontSize: '14.5px' } },
          articles.length + (articles.length === 1 ? ' articolo' : ' articoli') + ' · ' + (req.causale || '')),
        h('div.muted', { style: { fontSize: '13px' } },
          req.clientName || req.clientCode || ''),
        h('div.dim', { style: { fontSize: '11.5px', marginTop: '2px' } },
          (req.createdName || '') + ' · ' + fmtRelative(req.ts))
      ]),
      h('span.badge', {
        style: {
          background: 'color-mix(in srgb, ' + color + ' 17%, transparent)',
          color,
          borderColor: 'color-mix(in srgb, ' + color + ' 34%, transparent)'
        }
      }, [h('span', reqIcon(req.state)), reqLabel(req.state)])
    ]),

    articles.length ? h('div', {
      style: { fontSize: '12.5px', color: 'var(--text-2)', marginBottom: '8px' }
    }, articles.slice(0, 4).map((a) => h('div', [
      h('b', (a.pre ? a.pre + ' ' : '') + a.cod),
      ' × ' + a.qty + (a.forn ? ' · ' + a.forn : '')
    ])).concat(articles.length > 4 ? [h('div.dim', '+ altri ' + (articles.length - 4))] : [])) : null,

    req.note ? h('div', {
      style: {
        fontSize: '13px', padding: '8px 10px', background: 'var(--surface-2)',
        borderRadius: '8px', marginBottom: '8px', whiteSpace: 'pre-wrap'
      }
    }, req.note) : null,

    req.decisionNote ? banner(
      req.state === REQ_STATE.RIFIUTATA ? 'err' : 'info',
      h('div', [h('b', 'Risposta Telos: '), req.decisionNote])
    ) : null,

    req.returnKey ? h('div', { style: { marginBottom: '8px' } }, [
      h('a.btn.btn-sm', { href: '#/resi/' + encodeURIComponent(req.returnKey) }, 'Apri il reso collegato →')
    ]) : null,

    transitions.length ? h('div.btn-group', transitions.map((to) => h('button.btn.btn-sm.' + (
      to === REQ_STATE.RIFIUTATA || to === REQ_STATE.ANNULLATA ? 'btn-danger'
        : to === REQ_STATE.APPROVATA ? 'btn-ok' : 'btn-primary'
    ), {
      type: 'button',
      onclick: (e) => act(e.currentTarget, req, to)
    }, reqLabel(to)))) : null
  ]);
}

async function act(btn, req, to) {
  let note = '';
  if (to === REQ_STATE.RIFIUTATA) {
    note = await promptDialog({
      title: 'Rifiuta richiesta',
      label: 'Motivazione',
      hint: 'Il cliente la vedra\' nella sua richiesta.',
      multiline: true,
      required: true,
      confirmLabel: 'Rifiuta'
    });
    if (note == null) return;
  } else {
    const yes = await confirmDialog({
      title: reqLabel(to),
      message: 'Confermi il passaggio della richiesta a "' + reqLabel(to) + '"?',
      confirmLabel: 'Conferma',
      danger: to === REQ_STATE.ANNULLATA
    });
    if (!yes) return;
  }
  await withBusy(btn, async () => {
    try {
      await advanceRequest(req.id, req.state, to, note);
      toast('Richiesta aggiornata: ' + reqLabel(to), 'ok');
    } catch (err) {
      toast(err.message || 'Aggiornamento non riuscito.', 'err');
    }
  });
}

// ── Nuova richiesta ─────────────────────────────────────────────────────
export function renderNewRequest(container) {
  clear(container);
  const role = getRole();

  if (!can(role, 'createRequest')) {
    container.appendChild(emptyState({
      icon: '⛔',
      title: 'Non disponibile',
      message: 'Il tuo ruolo non puo\' aprire richieste di reso.'
    }));
    return;
  }

  const profile = getProfile();
  const scope = getScope();

  const clientSelect = scope.length > 1
    ? h('select.select', scope.map((c) => h('option', { value: c }, c)))
    : h('input.input', {
        type: 'text',
        value: scope[0] || '',
        readonly: scope.length === 1,
        placeholder: 'Codice cliente'
      });

  const causaleInput = h('select.select', [
    h('option', { value: '' }, '— Seleziona —'),
    h('option', 'ERRATO ORDINE'),
    h('option', 'ERRATA SPEDIZIONE'),
    h('option', 'ORDINE DISDETTO CLIENTE'),
    h('option', 'DIVERSO DA OE/INCOMPATIBILE'),
    h('option', 'ERRATO CONFEZIONAMENTO'),
    h('option', 'CARCASSA'),
    h('option', 'GARANZIA'),
    h('option', 'DANNEGGIATO'),
    h('option', 'ALTRO')
  ]);

  const noteInput = h('textarea.textarea', {
    placeholder: 'Dettagli utili alla lavorazione (facoltativo)',
    rows: 3
  });

  const contattoInput = h('input.input', {
    type: 'text',
    placeholder: 'Nome e telefono di riferimento',
    value: (profile && profile.phone) ? getDisplayNameSafe(profile) + ' · ' + profile.phone : ''
  });

  const indirizzoInput = h('input.input', {
    type: 'text',
    placeholder: 'Indirizzo di ritiro (se diverso dalla sede)',
    value: (profile && profile.company) || ''
  });

  const articlesZone = h('div.col.gap-2');
  const errBox = h('div.banner.banner-err.hidden');

  let articleRows = [];

  function addArticle(data) {
    const id = 'a' + Date.now() + Math.random().toString(36).slice(2, 6);
    const codInput = h('input.input', { type: 'text', placeholder: 'Codice articolo *', value: (data && data.cod) || '' });
    const preInput = h('input.input', { type: 'text', placeholder: 'Marca', value: (data && data.pre) || '', style: { maxWidth: '110px' } });
    const qtyInput = h('input.input', { type: 'number', min: '1', value: (data && data.qty) || '1', style: { maxWidth: '90px' } });
    const fornInput = h('input.input', { type: 'text', placeholder: 'Fornitore', value: (data && data.forn) || '' });

    const rowEl = h('div.card.card-tight', [
      h('div.row-w', { style: { gap: '8px' } }, [
        h('div', { style: { flex: '2 1 160px' } }, codInput),
        preInput,
        qtyInput,
        h('div', { style: { flex: '1 1 140px' } }, fornInput),
        h('button.btn.btn-ghost.btn-icon', {
          type: 'button',
          'aria-label': 'Rimuovi articolo',
          onclick: () => {
            articleRows = articleRows.filter((r) => r.id !== id);
            rowEl.remove();
            if (!articleRows.length) addArticle();
          }
        }, '🗑')
      ])
    ]);

    articleRows.push({
      id,
      read: () => ({
        cod: codInput.value.trim(),
        pre: preInput.value.trim(),
        qty: parseInt(qtyInput.value, 10) || 1,
        forn: fornInput.value.trim()
      })
    });
    articlesZone.appendChild(rowEl);
  }

  addArticle();

  const submitBtn = h('button.btn.btn-primary.btn-lg', { type: 'submit' }, 'Invia richiesta');

  async function onSubmit(e) {
    e.preventDefault();
    errBox.classList.add('hidden');

    const payload = {
      clientCode: clientSelect.value.trim().toUpperCase(),
      clientName: (profile && profile.company) || '',
      causale: causaleInput.value,
      note: noteInput.value.trim(),
      contatto: contattoInput.value.trim(),
      indirizzoRitiro: indirizzoInput.value.trim(),
      articoli: articleRows.map((r) => r.read()).filter((a) => a.cod)
    };

    await withBusy(submitBtn, async () => {
      try {
        const res = await createRequest(payload);
        if (res.queued) toast('Sei offline: la richiesta partira\' alla riconnessione.', 'warn', 6000);
        else toast('Richiesta inviata', 'ok');
        navigate('/richieste');
      } catch (err) {
        mount(errBox, [h('div', '⛔'), h('div', err.message || 'Invio non riuscito.')]);
        errBox.classList.remove('hidden');
        errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  container.appendChild(pageHeader('Nuova richiesta di reso', 'Compila i dati: Telos la esaminera\' e ti rispondera\' dal portale.'));

  container.appendChild(h('form', { onsubmit: onSubmit, novalidate: true }, [
    h('div.card', { style: { marginBottom: '16px' } }, [
      h('h3', 'Dati generali'),
      h('div.field', [h('label.label', ['Codice cliente', h('span.req', '*')]), clientSelect]),
      h('div.field', [h('label.label', ['Causale del reso', h('span.req', '*')]), causaleInput]),
      h('div.field', [h('label.label', 'Riferimento contatto'), contattoInput]),
      h('div.field', [h('label.label', 'Indirizzo di ritiro'), indirizzoInput]),
      h('div.field', [h('label.label', 'Note'), noteInput])
    ]),

    h('div.card', { style: { marginBottom: '16px' } }, [
      h('div.card-hd', [
        h('h3', { style: { margin: '0' } }, 'Articoli'),
        h('span.spacer'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => addArticle() }, '+ Aggiungi')
      ]),
      articlesZone,
      h('div.hint', 'Il codice articolo e\' obbligatorio. Marca e fornitore aiutano la lavorazione ma sono facoltativi.')
    ]),

    errBox,

    h('div.row.gap-2', [
      submitBtn,
      h('a.btn', { href: '#/richieste' }, 'Annulla')
    ])
  ]));
}

function getDisplayNameSafe(profile) {
  return (profile && profile.displayName) || '';
}
