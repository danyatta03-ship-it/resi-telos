// Admin — gestione utenti del portale.
//
// La creazione di un utente e l'assegnazione del ruolo passano SEMPRE dalla
// Netlify Function portal-claims: solo il server, con l'Admin SDK, puo'
// scrivere un custom claim. Il client si limita a chiedere.

import { h, mount, clear, fmtDateTime, initials, colorFor, withBusy, debounce } from '../ui/dom.js';
import { paths, auth } from '../core/firebase.js';
import { getRole, getUid } from '../core/auth.js';
import { ROLE_LIST, ROLE_META, roleLabel } from '../domain/roles.js';
import { toast } from '../ui/toast.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { pageHeader, emptyState, skeletonList, roleBadge, banner, avatar } from '../ui/components.js';

let ref = null;
let handler = null;

export function leaveAdminUsers() {
  if (ref && handler) { try { ref.off('value', handler); } catch (e) { /* gia' staccato */ } }
  ref = null; handler = null;
}

export function renderAdminUsers(container) {
  leaveAdminUsers();
  clear(container);

  if (getRole() !== 'ADMIN') {
    container.appendChild(emptyState({ icon: '⛔', title: 'Accesso negato', message: 'Sezione riservata agli amministratori.' }));
    return;
  }

  const listZone = h('div', skeletonList(4));
  const searchInput = h('input.input', { type: 'search', placeholder: 'Cerca per nome, email o azienda…' });
  let all = [];
  let filter = '';

  searchInput.addEventListener('input', debounce((e) => {
    filter = e.target.value.trim().toUpperCase();
    draw();
  }, 200));

  container.appendChild(pageHeader('Utenti del portale', null, [
    h('button.btn.btn-primary', { type: 'button', onclick: () => openUserDialog(null) }, '+ Nuovo utente')
  ]));

  container.appendChild(banner('info',
    'Creando un utente qui gli viene inviata una email per impostare la password. Il ruolo e il perimetro sono applicati lato server come custom claim.'));

  container.appendChild(h('div', { style: { marginBottom: '14px' } }, searchInput));
  container.appendChild(listZone);

  function draw() {
    const rows = filter
      ? all.filter((u) => [u.displayName, u.email, u.company, u.role]
          .map((v) => String(v || '').toUpperCase()).join(' ').indexOf(filter) >= 0)
      : all;

    if (!rows.length) {
      mount(listZone, emptyState({
        icon: '👥',
        title: filter ? 'Nessun risultato' : 'Nessun utente',
        message: filter ? 'Nessun utente corrisponde alla ricerca.' : 'Crea il primo utente del portale.'
      }));
      return;
    }

    // Raggruppo per ruolo: e' il modo in cui un admin pensa a questa lista.
    const byRole = {};
    for (const u of rows) {
      const r = u.role || 'ALTRO';
      (byRole[r] = byRole[r] || []).push(u);
    }

    const sections = [];
    for (const r of ROLE_LIST) {
      if (!byRole[r]) continue;
      sections.push(h('section', { style: { marginBottom: '20px' } }, [
        h('div.row', { style: { marginBottom: '8px' } }, [
          h('h3', { style: { margin: '0' } }, roleLabel(r)),
          h('span.dim', { style: { fontSize: '12.5px' } }, byRole[r].length + ' utenti')
        ]),
        h('div.col.gap-2', byRole[r].map(userCard))
      ]));
    }
    mount(listZone, sections);
  }

  function userCard(u) {
    const scope = u.scope ? Object.keys(u.scope).filter((k) => u.scope[k] === true) : [];
    const inactive = u.active === false;

    return h('div.card.card-tight', { style: inactive ? { opacity: '.55' } : {} }, [
      h('div.row-t', [
        h('div.avatar', { style: { background: colorFor(u.displayName || u.email) } }, initials(u.displayName || u.email)),
        h('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [
          h('div.row', { style: { gap: '8px' } }, [
            h('div', { style: { fontWeight: '700', fontSize: '14px' } }, u.displayName || '—'),
            inactive ? h('span.badge', { style: { background: 'var(--surface-3)', color: 'var(--text-3)' } }, 'Disattivato') : null
          ]),
          h('div.muted', { style: { fontSize: '12.5px' } }, u.email || ''),
          u.company ? h('div.dim', { style: { fontSize: '12px' } }, u.company) : null,
          scope.length ? h('div.chip-row', { style: { marginTop: '6px' } },
            scope.slice(0, 6).map((s) => h('span.chip', { style: { cursor: 'default', fontSize: '11px', padding: '2px 8px' } }, s))
              .concat(scope.length > 6 ? [h('span.dim', { style: { fontSize: '11px' } }, '+' + (scope.length - 6))] : [])
          ) : null,
          u.lastLogin ? h('div.dim', { style: { fontSize: '11px', marginTop: '4px' } }, 'Ultimo accesso ' + fmtDateTime(u.lastLogin)) : null
        ]),
        h('div.col-2', [
          h('button.btn.btn-sm', { type: 'button', onclick: () => openUserDialog(u) }, 'Modifica')
        ])
      ])
    ]);
  }

  ref = paths.users();
  handler = ref.on('value', (snap) => {
    const val = snap.val() || {};
    all = Object.keys(val).map((uid) => Object.assign({ uid }, val[uid]))
      .sort((a, b) => String(a.displayName || a.email || '').localeCompare(String(b.displayName || b.email || '')));
    draw();
  }, (err) => {
    mount(listZone, banner('err', 'Elenco non leggibile: ' + (err.message || '')));
  });
}

function openUserDialog(existing) {
  const isNew = !existing;

  const emailInput = h('input.input', {
    type: 'email', value: (existing && existing.email) || '',
    readonly: !isNew, autocapitalize: 'off', spellcheck: false
  });
  const nameInput = h('input.input', { type: 'text', value: (existing && existing.displayName) || '' });
  const companyInput = h('input.input', { type: 'text', value: (existing && existing.company) || '' });
  const phoneInput = h('input.input', { type: 'tel', value: (existing && existing.phone) || '' });

  const roleSelect = h('select.select', ROLE_LIST.map((r) => h('option', {
    value: r, selected: existing && existing.role === r
  }, roleLabel(r) + ' — ' + ROLE_META[r].desc.slice(0, 46) + '…')));

  const scopeList = existing && existing.scope
    ? Object.keys(existing.scope).filter((k) => existing.scope[k] === true)
    : [];
  const scopeInput = h('textarea.textarea', {
    rows: 3,
    placeholder: 'Un valore per riga.\nEsempio cliente: 007183\nEsempio agente: Direzionali Torino\nEsempio corriere: PIEMME',
    value: scopeList.join('\n')
  });

  const activeCheck = h('input', { type: 'checkbox', checked: !existing || existing.active !== false });

  const scopeHint = h('div.hint');
  function updateScopeHint() {
    const r = roleSelect.value;
    const map = {
      CLIENTE: 'Codici cliente che l\'utente puo\' vedere (uno per riga).',
      AGENTE: 'Nomi agente/zona di competenza (uno per riga).',
      CORRIERE: 'Vettori assegnati (uno per riga).',
      TELOS: 'Non serve: gli utenti Telos vedono tutte le pratiche.',
      ADMIN: 'Non serve: gli amministratori vedono tutto.'
    };
    scopeHint.textContent = map[r] || '';
    const internal = r === 'ADMIN' || r === 'TELOS';
    scopeInput.disabled = internal;
    scopeInput.style.opacity = internal ? '.5' : '1';
  }
  roleSelect.addEventListener('change', updateScopeHint);
  updateScopeHint();

  const errBox = h('div.banner.banner-err.hidden');
  const saveBtn = h('button.btn.btn-primary', { type: 'button' }, isNew ? 'Crea utente' : 'Salva');

  function showErr(msg) {
    mount(errBox, [h('div', '⛔'), h('div', msg)]);
    errBox.classList.remove('hidden');
  }

  const ref2 = openModal({
    title: isNew ? 'Nuovo utente' : 'Modifica utente',
    wide: true,
    body: h('div', [
      h('div.field', [h('label.label', ['Email', h('span.req', '*')]), emailInput]),
      h('div.field', [h('label.label', ['Nome e cognome', h('span.req', '*')]), nameInput]),
      h('div.field', [h('label.label', ['Ruolo', h('span.req', '*')]), roleSelect]),
      h('div.field', [h('label.label', 'Azienda'), companyInput]),
      h('div.field', [h('label.label', 'Telefono'), phoneInput]),
      h('div.field', [h('label.label', 'Perimetro di visibilita\''), scopeInput, scopeHint]),
      h('div.field', h('label.check', [activeCheck, h('span', 'Account attivo')])),
      errBox
    ]),
    footer: [
      !isNew ? h('button.btn.btn-danger', {
        type: 'button',
        onclick: async () => {
          if (existing.uid === getUid()) {
            toast('Non puoi disattivare il tuo stesso account.', 'err');
            return;
          }
          const yes = await confirmDialog({
            title: 'Revoca accesso',
            message: 'L\'utente non potra\' piu\' accedere al portale. Confermi?',
            confirmLabel: 'Revoca',
            danger: true
          });
          if (!yes) return;
          try {
            await callClaims({ action: 'revoke', uid: existing.uid });
            ref2.close();
            toast('Accesso revocato', 'ok');
          } catch (err) {
            showErr(err.message);
          }
        }
      }, 'Revoca accesso') : null,
      h('span.spacer'),
      h('button.btn', { type: 'button', onclick: () => ref2.close() }, 'Annulla'),
      saveBtn
    ]
  });

  saveBtn.addEventListener('click', async () => {
    errBox.classList.add('hidden');
    const email = emailInput.value.trim().toLowerCase();
    const name = nameInput.value.trim();
    const role = roleSelect.value;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showErr('Inserisci un indirizzo email valido.'); return; }
    if (!name) { showErr('Il nome e\' obbligatorio.'); return; }

    const scope = {};
    if (role !== 'ADMIN' && role !== 'TELOS') {
      const values = scopeInput.value.split('\n').map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (!values.length) { showErr('Indica almeno un valore nel perimetro di visibilita\' per questo ruolo.'); return; }
      for (const v of values) scope[v.replace(/[.#$/[\]]/g, '_')] = true;
    }

    await withBusy(saveBtn, async () => {
      try {
        await callClaims({
          action: isNew ? 'create' : 'update',
          uid: existing ? existing.uid : undefined,
          email,
          displayName: name,
          role,
          company: companyInput.value.trim(),
          phone: phoneInput.value.trim(),
          active: activeCheck.checked,
          scope
        });
        ref2.close();
        toast(isNew ? 'Utente creato: email di attivazione inviata.' : 'Utente aggiornato', 'ok', 6000);
      } catch (err) {
        showErr(err.message || 'Operazione non riuscita.');
      }
    });
  });
}

// Ogni chiamata porta l'ID token dell'admin: la function verifica lato server
// che chi chiede sia davvero un amministratore.
async function callClaims(payload) {
  const user = auth().currentUser;
  if (!user) throw new Error('Sessione scaduta. Rifai il login.');
  const token = await user.getIdToken();

  const res = await fetch('/api/portal-claims', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(payload)
  });

  let json = null;
  try { json = await res.json(); } catch (e) { /* risposta non JSON */ }

  if (!res.ok || (json && json.error)) {
    throw new Error((json && json.error) || 'Errore del server (' + res.status + ').');
  }
  return json;
}
