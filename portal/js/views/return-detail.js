// Dettaglio reso: anagrafica, avanzamento, timeline, messaggi, documenti,
// e le azioni di workflow permesse al ruolo corrente.
//
// E' la schermata su cui si concentra il valore del portale: tutto cio' che
// riguarda una pratica sta qui, e ogni azione lascia una traccia in timeline.

import { h, mount, clear, fmtDateTime, fmtRelative, fmtIsoDate, withBusy } from '../ui/dom.js';
import { loadReturn, articleLabel, clientLabel } from '../domain/returns.js';
import { bindTimeline, logStateChange, logNote, currentPortalState } from '../domain/timeline.js';
import { bindMessages, sendMessage, markSeen, isMine } from '../domain/messages.js';
import { bindDocuments, uploadDocument, getDownloadUrl, deleteDocument, isImage, formatSize, typeIcon, typeLabel, DOC_TYPE } from '../domain/documents.js';
import { effectiveState, allowedTransitions, actionLabel, requiresNote, stateLabel, isTerminal } from '../domain/workflow.js';
import { evaluate, describe, formatHours, LEVEL } from '../domain/sla.js';
import { getRole, getUid, getDisplayName } from '../core/auth.js';
import { can } from '../domain/roles.js';
import { hasStorage } from '../core/firebase.js';
import { requestNotify } from '../domain/notifications.js';
import { toast } from '../ui/toast.js';
import { promptDialog, confirmDialog, imageViewer } from '../ui/modal.js';
import {
  statusBadge, slaBadge, stepper, timelineView, emptyState,
  skeletonList, infoRow, avatar, banner, pageHeader
} from '../ui/components.js';

let teardowns = [];

function cleanup() {
  teardowns.forEach((fn) => { try { fn(); } catch (e) { /* gia' staccato */ } });
  teardowns = [];
}

export function leaveReturnDetail() {
  cleanup();
}

export async function renderReturnDetail(container, { params }) {
  cleanup();
  clear(container);
  const key = params.key;
  const role = getRole();

  container.appendChild(h('div', { style: { marginBottom: '14px' } }, [
    h('a.btn.btn-ghost.btn-sm', { href: '#/resi' }, '← Torna ai resi')
  ]));

  const loading = h('div', skeletonList(3));
  container.appendChild(loading);

  let row;
  try {
    row = await loadReturn(key);
  } catch (err) {
    mount(loading, emptyState({
      icon: '⛔',
      title: 'Accesso negato',
      message: 'Non hai il permesso di consultare questa pratica.'
    }));
    return;
  }

  if (!row) {
    mount(loading, emptyState({
      icon: '🔍',
      title: 'Reso non trovato',
      message: 'La pratica non esiste oppure non rientra nel tuo perimetro di visibilita\'.',
      action: h('a.btn', { href: '#/resi' }, 'Torna ai resi')
    }));
    return;
  }

  clear(loading);

  // Stato condiviso della vista: la timeline e' la fonte dello stato portale.
  const view = {
    row,
    events: [],
    portalState: null,
    effective: row.trackingState
  };

  const headerZone = h('div');
  const timelineZone = h('div', skeletonList(2));
  const messagesZone = h('div', skeletonList(1));
  const documentsZone = h('div');
  const actionsZone = h('div');

  container.appendChild(headerZone);
  container.appendChild(h('div.split', [
    h('div.col.gap-4', [
      h('section.card', [h('h3', 'Cronologia'), timelineZone]),
      h('section.card', [h('h3', 'Messaggi'), messagesZone])
    ]),
    h('div.col.gap-4', [
      actionsZone,
      h('section.card', [
        h('div.card-hd', [h('h3', { style: { margin: '0' } }, 'Documenti'), h('span.spacer')]),
        documentsZone
      ]),
      detailsCard(row, role)
    ])
  ]));

  function drawHeader() {
    const st = view.effective;
    const sla = evaluate(st, lastChangeTs(), Date.now());
    mount(headerZone, h('div.card', { style: { marginBottom: '16px' } }, [
      h('div.row-t', [
        h('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [
          h('h1', { style: { marginBottom: '2px', fontSize: '21px' } }, articleLabel(row)),
          h('div.muted', { style: { fontSize: '13.5px' } }, clientLabel(row))
        ]),
        h('div.col-2', { style: { alignItems: 'flex-end' } }, [
          statusBadge(st),
          slaBadge(sla)
        ])
      ]),
      stepper(st),
      sla.level === LEVEL.CRIT || sla.level === LEVEL.WARN
        ? h('div', { style: { marginTop: '8px' } }, banner(sla.level === LEVEL.CRIT ? 'err' : 'warn', describe(sla)))
        : null
    ]));
  }

  function lastChangeTs() {
    for (let i = view.events.length - 1; i >= 0; i--) {
      if (view.events[i].action === 'STATE_CHANGE') return view.events[i].ts;
    }
    return row.trackingSince || row._ts || Date.now();
  }

  function drawActions() {
    const st = view.effective;
    const options = allowedTransitions(st, role);

    const buttons = options.map((to) => h('button.btn.btn-sm.' + buttonStyleFor(to), {
      type: 'button',
      onclick: (e) => doTransition(e.currentTarget, st, to)
    }, actionLabel(to)));

    const extras = [];
    if (can(role, 'sendMessages')) {
      extras.push(h('button.btn.btn-sm.btn-ghost', {
        type: 'button',
        onclick: (e) => addNote(e.currentTarget)
      }, '📝 Aggiungi nota'));
    }

    if (!buttons.length && !extras.length) {
      mount(actionsZone, h('div.card', [
        h('h3', 'Azioni'),
        h('div.dim', { style: { fontSize: '13px' } },
          isTerminal(st)
            ? 'La pratica e\' chiusa. Nessuna azione disponibile.'
            : 'Nessuna azione disponibile per il tuo ruolo in questo stato.')
      ]));
      return;
    }

    mount(actionsZone, h('div.card', [
      h('h3', 'Azioni'),
      h('div.btn-group', buttons.concat(extras))
    ]));
  }

  async function doTransition(btn, from, to) {
    let note = '';
    if (requiresNote(to)) {
      note = await promptDialog({
        title: actionLabel(to),
        label: 'Motivazione',
        hint: 'Obbligatoria: resta agli atti nella cronologia della pratica.',
        multiline: true,
        required: true,
        confirmLabel: 'Conferma'
      });
      if (note == null) return;
    } else {
      const yes = await confirmDialog({
        title: actionLabel(to),
        message: h('div', [
          'Confermi il passaggio a ',
          h('b', stateLabel(to)),
          '?'
        ]),
        confirmLabel: 'Conferma'
      });
      if (!yes) return;
    }

    await withBusy(btn, async () => {
      try {
        const res = await logStateChange(key, from, to, note);
        if (res.queued) {
          toast('Sei offline: l\'aggiornamento partira\' alla riconnessione.', 'warn');
        } else {
          toast('Stato aggiornato: ' + stateLabel(to), 'ok');
        }
        // Notifica gli altri attori. Se fallisce non e' un problema:
        // il cambio di stato e' gia' registrato.
        requestNotify({
          returnKey: key,
          title: articleLabel(row) + ' · ' + stateLabel(to),
          body: getDisplayName() + ' ha aggiornato lo stato del reso.',
          excludeUid: getUid()
        });
      } catch (err) {
        toast(err.message || 'Aggiornamento non riuscito.', 'err');
      }
    });
  }

  async function addNote(btn) {
    const note = await promptDialog({
      title: 'Aggiungi nota',
      label: 'Nota',
      multiline: true,
      required: true,
      confirmLabel: 'Salva'
    });
    if (!note) return;
    await withBusy(btn, async () => {
      try {
        await logNote(key, note);
        toast('Nota aggiunta', 'ok');
      } catch (err) {
        toast(err.message || 'Salvataggio non riuscito.', 'err');
      }
    });
  }

  // ── Sottoscrizione timeline ──
  teardowns.push(bindTimeline(key, {
    next: (events) => {
      view.events = events;
      view.portalState = currentPortalState(events);
      view.effective = effectiveState(row, view.portalState);
      mount(timelineZone, timelineView(events, { newestFirst: true }));
      drawHeader();
      drawActions();
    },
    fail: (err) => {
      mount(timelineZone, banner('err', 'Cronologia non leggibile: ' + (err.message || '')));
      drawHeader();
      drawActions();
    }
  }));

  // ── Messaggi ──
  buildMessages(messagesZone, key, role);

  // ── Documenti ──
  buildDocuments(documentsZone, key, role);

  drawHeader();
  drawActions();
}

function buttonStyleFor(to) {
  if (to === 'RIFIUTATO' || to === 'CHIUSO_NR') return 'btn-danger';
  if (to === 'CONTESTATO') return 'btn-warn';
  if (to === 'CHIUSO_OK' || to === 'APPROVATO') return 'btn-ok';
  return 'btn-primary';
}

// ── Messaggi ────────────────────────────────────────────────────────────
function buildMessages(zone, key, role) {
  const list = h('div.msgs');
  const input = h('textarea.textarea', {
    placeholder: 'Scrivi un messaggio…',
    rows: 2,
    'aria-label': 'Nuovo messaggio'
  });

  const sendBtn = h('button.btn.btn-primary', {
    type: 'button',
    onclick: (e) => send(e.currentTarget)
  }, 'Invia');

  input.addEventListener('keydown', (e) => {
    // Invio manda, Shift+Invio va a capo: comportamento atteso in chat.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(sendBtn);
    }
  });

  async function send(btn) {
    const text = input.value.trim();
    if (!text) return;
    await withBusy(btn, async () => {
      try {
        const res = await sendMessage(key, text);
        input.value = '';
        if (res.queued) toast('Offline: il messaggio partira\' alla riconnessione.', 'warn');
      } catch (err) {
        toast(err.message || 'Invio non riuscito.', 'err');
      }
    });
  }

  mount(zone, [
    list,
    can(role, 'sendMessages')
      ? h('div.msg-compose', [
          h('div', { style: { flex: '1 1 auto' } }, input),
          sendBtn
        ])
      : null
  ]);

  teardowns.push(bindMessages(key, {
    next: (messages) => {
      if (!messages.length) {
        mount(list, h('div.dim', { style: { fontSize: '13px', padding: '8px 0' } },
          'Nessun messaggio. Scrivi per iniziare la conversazione.'));
      } else {
        mount(list, messages.map((m) => h('div.msg' + (isMine(m) ? '.mine' : ''), [
          h('div.msg-hd', (m.fromName || 'Utente') + ' · ' + fmtRelative(m.ts)),
          h('div.msg-bubble', m.text)
        ])));
        // Scroll all'ultimo messaggio solo se l'utente era gia' in fondo:
        // altrimenti gli strappiamo la lettura sotto gli occhi.
        const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
        if (nearBottom) list.scrollTop = list.scrollHeight;
      }
      markSeen(key);
    },
    fail: (err) => {
      mount(list, banner('err', 'Messaggi non leggibili: ' + (err.message || '')));
    }
  }));
}

// ── Documenti ───────────────────────────────────────────────────────────
function buildDocuments(zone, key, role) {
  const grid = h('div.doc-grid');
  const progress = h('div.hidden');

  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*,application/pdf',
    multiple: true,
    style: { display: 'none' },
    onchange: (e) => handleFiles(Array.from(e.target.files || []))
  });

  const dropzone = h('div.dropzone', {
    tabindex: '0',
    role: 'button',
    onclick: () => fileInput.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } },
    ondragover: (e) => { e.preventDefault(); dropzone.classList.add('over'); },
    ondragleave: () => dropzone.classList.remove('over'),
    ondrop: (e) => {
      e.preventDefault();
      dropzone.classList.remove('over');
      handleFiles(Array.from(e.dataTransfer.files || []));
    }
  }, [
    h('div', { style: { fontSize: '24px', marginBottom: '6px' } }, '📎'),
    h('div', { style: { fontSize: '13.5px', fontWeight: '600' } }, 'Carica foto o documenti'),
    h('div.dim', { style: { fontSize: '12px', marginTop: '2px' } }, 'Tocca o trascina · JPG, PNG, PDF · max 15 MB')
  ]);

  async function handleFiles(files) {
    if (!files.length) return;
    if (!hasStorage()) {
      toast('Caricamento non disponibile: Firebase Storage non e\' configurato.', 'err');
      return;
    }
    progress.classList.remove('hidden');
    for (const file of files) {
      mount(progress, h('div.row', { style: { fontSize: '13px', padding: '8px 0' } }, [
        h('span.spinner'),
        h('span.truncate', file.name)
      ]));
      try {
        await uploadDocument(key, file, { type: guessType(file) });
        toast('Caricato: ' + file.name, 'ok');
      } catch (err) {
        toast('Errore su ' + file.name + ': ' + (err.message || ''), 'err');
      }
    }
    progress.classList.add('hidden');
    clear(progress);
    fileInput.value = '';
  }

  mount(zone, [grid, progress, can(role, 'uploadDocuments') ? dropzone : null, fileInput]);

  teardowns.push(bindDocuments(key, {
    next: async (docs) => {
      if (!docs.length) {
        mount(grid, h('div.dim', { style: { fontSize: '13px', paddingBottom: '10px' } }, 'Nessun documento allegato.'));
        return;
      }
      const cards = await Promise.all(docs.map(async (d) => {
        const url = await getDownloadUrl(d.storagePath);
        const thumb = isImage(d) && url
          ? h('div.doc-thumb', h('img', { src: url, alt: d.filename, loading: 'lazy' }))
          : h('div.doc-thumb', typeIcon(d.type));

        const card = h('a.doc', {
          href: url || '#',
          target: url ? '_blank' : null,
          rel: 'noopener noreferrer',
          onclick: (e) => {
            if (isImage(d) && url) { e.preventDefault(); imageViewer(url, d.filename); }
          }
        }, [
          thumb,
          h('div.doc-info', [
            h('div.doc-name', d.filename),
            h('div.doc-meta', typeLabel(d.type) + ' · ' + formatSize(d.size)),
            h('div.doc-meta', (d.uploaderName || '—') + ' · ' + fmtRelative(d.ts))
          ])
        ]);
        return card;
      }));
      mount(grid, cards);
    },
    fail: (err) => {
      mount(grid, banner('err', 'Documenti non leggibili: ' + (err.message || '')));
    }
  }));
}

function guessType(file) {
  const name = String(file.name || '').toLowerCase();
  if (/bolla|ddt|documento/.test(name)) return DOC_TYPE.BOLLA;
  if (/firm/.test(name)) return DOC_TYPE.FIRMA;
  if (/imball|pacco|collo/.test(name)) return DOC_TYPE.FOTO_IMBALLO;
  if (/^image\//.test(file.type)) return DOC_TYPE.FOTO_PEZZO;
  return DOC_TYPE.DOCUMENTO;
}

// ── Scheda anagrafica ───────────────────────────────────────────────────
function detailsCard(row, role) {
  const rows = [
    infoRow('Codice articolo', row.cod),
    infoRow('Marca', row.pre),
    infoRow('Quantita\'', row.qty),
    can(role, 'viewFinancials') ? infoRow('Prezzo', row.prc ? Number(String(row.prc).replace(',', '.')).toFixed(2) + ' €' : null) : null,
    infoRow('Fornitore', row.forn),
    infoRow('Cliente', row.sogg),
    infoRow('Agente', row.agente),
    infoRow('Causale', row.causale),
    infoRow('Anomalia', row.anomalia),
    infoRow('RMA / RNC', row.rma),
    infoRow('Vettore ingresso', row.vetRic),
    infoRow('Vettore uscita', row.vetUsc),
    infoRow('Colli', row.colli),
    infoRow('Imballo', row.tipoImb),
    infoRow('Data arrivo', row.datArr ? fmtIsoDate(row.datArr) : null),
    infoRow('Ultimo aggiornamento', row.datSta ? fmtIsoDate(row.datSta) : null)
  ].filter(Boolean);

  // Lo stato interno del gestionale e' rumore per un cliente: lo mostro solo
  // a chi lavora la pratica.
  if (role === 'ADMIN' || role === 'TELOS' || role === 'AGENTE') {
    rows.push(infoRow('Fase gestionale', row.fase));
    rows.push(infoRow('Stato gestionale', row.stato));
  }

  return h('section.card', [
    h('h3', 'Dettagli'),
    h('div', rows)
  ]);
}
