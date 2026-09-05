// Profilo utente: dati, tema, cambio password, scope assegnati.

import { h, mount, clear, fmtDateTime, initials, colorFor, withBusy } from '../ui/dom.js';
import { getProfile, getRole, getScope, getDisplayName, changePassword, signOut, authErrorText } from '../core/auth.js';
import { roleLabel, roleIcon, ROLE_META } from '../domain/roles.js';
import { getPendingCount, flush } from '../core/offline.js';
import { isConnected } from '../core/firebase.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { pageHeader, infoRow, roleBadge, banner } from '../ui/components.js';

export function renderProfile(container) {
  clear(container);
  const profile = getProfile();
  const role = getRole();
  const scope = getScope();

  container.appendChild(pageHeader('Profilo'));

  container.appendChild(h('div.card', { style: { marginBottom: '16px' } }, [
    h('div.row', [
      h('div.avatar.avatar-lg', { style: { background: colorFor(getDisplayName()) } }, initials(getDisplayName())),
      h('div', { style: { minWidth: '0' } }, [
        h('div', { style: { fontSize: '17px', fontWeight: '700' } }, getDisplayName()),
        h('div.muted', { style: { fontSize: '13.5px' } }, (profile && profile.email) || ''),
        h('div', { style: { marginTop: '6px' } }, roleBadge(role))
      ])
    ])
  ]));

  container.appendChild(h('div.card', { style: { marginBottom: '16px' } }, [
    h('h3', 'Dati account'),
    infoRow('Nome', (profile && profile.displayName) || '—', { always: true }),
    infoRow('Email', (profile && profile.email) || '—', { always: true }),
    infoRow('Azienda', (profile && profile.company) || '—', { always: true }),
    infoRow('Telefono', (profile && profile.phone) || '—', { always: true }),
    infoRow('Ruolo', roleLabel(role), { always: true }),
    infoRow('Ultimo accesso', (profile && profile.lastLogin) ? fmtDateTime(profile.lastLogin) : '—', { always: true }),
    h('div.hint', { style: { marginTop: '10px' } },
      'Per modificare nome, azienda o ruolo contatta l\'amministratore.')
  ]));

  if (scope.length) {
    const scopeTitle = {
      CLIENTE: 'Codici cliente associati',
      AGENTE: 'Zone / agenti associati',
      CORRIERE: 'Vettori associati'
    }[role] || 'Perimetro assegnato';

    container.appendChild(h('div.card', { style: { marginBottom: '16px' } }, [
      h('h3', scopeTitle),
      h('div.chip-row', scope.map((s) => h('span.chip', { style: { cursor: 'default' } }, s))),
      h('div.hint', { style: { marginTop: '10px' } },
        'Vedi solo i resi che rientrano in questo perimetro.')
    ]));
  }

  // ── Aspetto ──
  const currentTheme = document.documentElement.getAttribute('data-theme') || '';
  const themeSelect = h('select.select', {
    onchange: (e) => {
      const v = e.target.value;
      if (v) document.documentElement.setAttribute('data-theme', v);
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('portal_theme', v); } catch (err) { /* quota */ }
      toast('Tema aggiornato', 'ok', 1800);
    }
  }, [
    h('option', { value: '', selected: currentTheme === '' }, 'Automatico (come il sistema)'),
    h('option', { value: 'dark', selected: currentTheme === 'dark' }, 'Scuro'),
    h('option', { value: 'light', selected: currentTheme === 'light' }, 'Chiaro')
  ]);

  container.appendChild(h('div.card', { style: { marginBottom: '16px' } }, [
    h('h3', 'Aspetto'),
    h('div.field', [h('label.label', 'Tema'), themeSelect])
  ]));

  // ── Sincronizzazione ──
  const pending = getPendingCount();
  container.appendChild(h('div.card', { style: { marginBottom: '16px' } }, [
    h('h3', 'Sincronizzazione'),
    h('div.row', [
      h('div', { style: { flex: '1 1 auto' } }, [
        h('div', { style: { fontSize: '13.5px' } },
          isConnected() ? 'Connesso al server' : 'Non connesso'),
        h('div.dim', { style: { fontSize: '12px' } },
          pending > 0
            ? pending + ' ' + (pending === 1 ? 'operazione in attesa' : 'operazioni in attesa') + ' di invio'
            : 'Nessuna operazione in sospeso')
      ]),
      pending > 0 ? h('button.btn.btn-sm', {
        type: 'button',
        onclick: async (e) => {
          await withBusy(e.currentTarget, async () => {
            const res = await flush();
            toast(res.sent + ' operazioni inviate', res.failed ? 'warn' : 'ok');
            renderProfile(container);
          });
        }
      }, 'Invia ora') : null
    ])
  ]));

  // ── Sicurezza ──
  container.appendChild(h('div.card', { style: { marginBottom: '16px' } }, [
    h('h3', 'Sicurezza'),
    h('div.btn-group', [
      h('button.btn', { type: 'button', onclick: openPasswordDialog }, 'Cambia password'),
      h('button.btn.btn-danger', {
        type: 'button',
        onclick: async () => {
          const yes = await confirmDialog({
            title: 'Esci',
            message: 'Vuoi uscire dal portale?',
            confirmLabel: 'Esci',
            danger: true
          });
          if (yes) await signOut();
        }
      }, 'Esci')
    ])
  ]));
}

function openPasswordDialog() {
  const currentInput = h('input.input', { type: 'password', autocomplete: 'current-password' });
  const newInput = h('input.input', { type: 'password', autocomplete: 'new-password' });
  const confirmInput = h('input.input', { type: 'password', autocomplete: 'new-password' });
  const errBox = h('div.err-msg.hidden');

  function showErr(msg) {
    errBox.textContent = msg;
    errBox.classList.remove('hidden');
  }

  const saveBtn = h('button.btn.btn-primary', { type: 'button' }, 'Aggiorna');

  const ref = openModal({
    title: 'Cambia password',
    body: h('div', [
      h('div.field', [h('label.label', 'Password attuale'), currentInput]),
      h('div.field', [h('label.label', 'Nuova password'), newInput, h('div.hint', 'Almeno 8 caratteri.')]),
      h('div.field', [h('label.label', 'Conferma nuova password'), confirmInput]),
      errBox
    ]),
    footer: [
      h('button.btn', { type: 'button', onclick: () => ref.close() }, 'Annulla'),
      saveBtn
    ]
  });

  saveBtn.addEventListener('click', async () => {
    errBox.classList.add('hidden');
    const cur = currentInput.value;
    const next = newInput.value;
    const conf = confirmInput.value;

    if (!cur || !next) { showErr('Compila tutti i campi.'); return; }
    if (next.length < 8) { showErr('La nuova password deve avere almeno 8 caratteri.'); return; }
    if (next !== conf) { showErr('Le due password non coincidono.'); return; }
    if (next === cur) { showErr('La nuova password deve essere diversa da quella attuale.'); return; }

    await withBusy(saveBtn, async () => {
      try {
        await changePassword(cur, next);
        ref.close();
        toast('Password aggiornata', 'ok');
      } catch (err) {
        showErr(authErrorText(err));
      }
    });
  });
}
