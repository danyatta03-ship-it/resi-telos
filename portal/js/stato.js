// Conferma di invio e consultazione dello stato.
//
// Dopo l'invio mostriamo un RIFERIMENTO (RS-XXXXXX) e un link diretto.
// Quel riferimento e' l'unica chiave per rileggere la pratica: e' casuale e
// non indovinabile, e chi non ce l'ha non puo' arrivare a quell'invio ne' a
// nessun altro — l'app pubblica non ha proprio modo di interrogare l'elenco.

import { h, mount, clear, fmtDateTime, fmtRelative, withBusy, toast } from './dom.js';
import { loadStato, inviaMessaggio } from './api.js';
import { statoLabel, statoColore, statoDesc, ORDINE_STATI, LIMITI } from './costanti.js';

const ULTIMI = 'portal_ultimi';

// ── Schermata di conferma ───────────────────────────────────────────────
export function renderConferma(container, res, { onNuovo }) {
  clear(container);
  ricordaRiferimento(res.ref);

  const link = location.origin + location.pathname + '#/stato/' + encodeURIComponent(res.ref);

  container.appendChild(h('div.esito', [
    h('div.esito-ico', '✅'),
    h('h1', 'Reso inviato'),
    h('p.sub', 'L\'ufficio resi Telos ha ricevuto la tua richiesta.'),

    h('div.card.rif-card', [
      h('div.rif-label', 'Il tuo riferimento'),
      h('div.rif', res.ref),
      h('p.hint', 'Conservalo: ti serve per controllare come procede la pratica.'),
      h('div.btn-row', [
        h('button.btn', {
          type: 'button',
          onclick: (e) => copia(link, e.currentTarget)
        }, '🔗 Copia il link'),
        h('a.btn.btn-primary', { href: '#/stato/' + encodeURIComponent(res.ref) }, 'Vedi lo stato')
      ])
    ]),

    h('button.btn.btn-block', { type: 'button', style: { marginTop: '18px' }, onclick: onNuovo },
      'Invia un altro reso')
  ]));
}

function copia(testo, btn) {
  const done = () => {
    const old = btn.textContent;
    btn.textContent = '✓ Copiato';
    setTimeout(() => { btn.textContent = old; }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(testo).then(done, () => fallback(testo, done));
  } else {
    fallback(testo, done);
  }
}

// Safari su iOS senza HTTPS, e i browser piu' vecchi, non hanno la clipboard API.
function fallback(testo, done) {
  const ta = h('textarea', { value: testo, style: { position: 'fixed', opacity: '0' } });
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Copia non riuscita', 'err'); }
  ta.remove();
}

// ── Consultazione ───────────────────────────────────────────────────────
export function renderStato(container, ref) {
  clear(container);
  const zona = h('div', h('div.skel'));
  container.appendChild(h('div', [
    h('a.back', { href: '#/' }, '← Invia un nuovo reso'),
    zona
  ]));

  loadStato(ref)
    .then((dati) => {
      ricordaRiferimento(ref);
      disegna(zona, dati, ref);
    })
    .catch((err) => {
      mount(zona, h('div.esito', [
        h('div.esito-ico', err.status === 404 ? '🔍' : '⚠️'),
        h('h1', err.status === 404 ? 'Riferimento non trovato' : 'Non riesco a leggere'),
        h('p.sub', err.status === 404
          ? 'Controlla il codice: deve essere nel formato RS-XXXXXX, come te l\'abbiamo dato dopo l\'invio.'
          : (err.message || 'Riprova fra poco.')),
        h('a.btn.btn-primary', { href: '#/cerca' }, 'Cerca un altro riferimento')
      ]));
    });
}

function disegna(zona, d, ref) {
  const colore = statoColore(d.stato);
  const passo = ORDINE_STATI.indexOf(d.stato);

  const messaggi = (d.messaggi || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const testo = h('textarea.textarea', { rows: 2, placeholder: 'Scrivi all\'ufficio resi…' });
  const inviaBtn = h('button.btn.btn-primary', {
    type: 'button',
    onclick: (e) => spedisci(e.currentTarget)
  }, 'Invia');

  async function spedisci(btn) {
    const t = testo.value.trim();
    if (!t) return;
    if (t.length > LIMITI.messaggio) {
      toast('Messaggio troppo lungo.', 'err');
      return;
    }
    await withBusy(btn, async () => {
      try {
        await inviaMessaggio(ref, t, d.mittente && d.mittente.nome);
        testo.value = '';
        toast('Messaggio inviato', 'ok');
        renderStato(zona.parentNode.parentNode || zona, ref);
      } catch (err) {
        toast(err.message || 'Invio non riuscito.', 'err');
      }
    });
  }

  mount(zona, [
    h('div.stato-hd', [
      h('div.rif-mini', ref),
      h('span.pill', { style: { background: colore } }, statoLabel(d.stato))
    ]),
    h('p.sub', statoDesc(d.stato)),

    h('div.passi', ORDINE_STATI.map((s, i) => h('div.passo' + (
      d.stato === 'RIFIUTATO' ? (i === 0 ? '.fatto' : '')
        : (i <= passo ? '.fatto' : '')
    ), { title: statoLabel(s) }))),

    d.esito ? h('div.banner.banner-' + (d.stato === 'RIFIUTATO' ? 'err' : 'ok'),
      [h('b', 'Risposta di Telos: '), d.esito]) : null,

    h('section.card', [
      h('h2', 'Riepilogo'),
      riga('Inviato il', fmtDateTime(d.ts)),
      riga('Da', (d.mittente && d.mittente.nome) || '—'),
      riga('Azienda', (d.mittente && d.mittente.azienda) || '—'),
      riga('Motivo', d.causale),
      d.codiceCliente ? riga('Codice cliente', d.codiceCliente) : null,
      d.note ? riga('Note', d.note) : null
    ]),

    h('section.card', [
      h('h2', 'Articoli'),
      h('div.col-2', (d.articoli || []).map((a, i) => h('div.art-row', [
        h('b', (a.marca ? a.marca + ' ' : '') + a.cod),
        h('span.dim', '× ' + a.qty + (a.forn ? ' · ' + a.forn : ''))
      ])))
    ]),

    d.nFoto ? h('section.card', [
      h('h2', 'Foto'),
      h('p.sub', d.nFoto + (d.nFoto === 1 ? ' foto allegata' : ' foto allegate') + ' all\'invio.')
    ]) : null,

    h('section.card', [
      h('h2', 'Messaggi'),
      messaggi.length
        ? h('div.msgs', messaggi.map((m) => h('div.msg' + (m.da === 'TELOS' ? '.telos' : ''), [
            h('div.msg-hd', (m.autore || (m.da === 'TELOS' ? 'Ufficio resi' : 'Tu')) + ' · ' + fmtRelative(m.ts)),
            h('div.msg-b', m.testo)
          ])))
        : h('p.sub', 'Nessun messaggio. Scrivi qui sotto se hai bisogno.'),
      h('div.compose', [testo, inviaBtn])
    ])
  ]);
}

function riga(k, v) {
  return h('div.kv', [h('span.k', k), h('span.v', v || '—')]);
}

// ── Ricerca per riferimento ─────────────────────────────────────────────
export function renderCerca(container, { onApri }) {
  clear(container);
  const input = h('input.input', {
    type: 'text', placeholder: 'RS-XXXXXX',
    autocapitalize: 'characters', spellcheck: false,
    style: { textTransform: 'uppercase' }
  });
  const err = h('p.err-msg.hidden');

  function apri() {
    const v = input.value.trim().toUpperCase();
    if (!/^RS-[A-Z0-9]{6,}$/.test(v)) {
      err.textContent = 'Il riferimento ha il formato RS-XXXXXX.';
      err.classList.remove('hidden');
      return;
    }
    onApri(v);
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apri(); } });

  const recenti = leggiRiferimenti();

  container.appendChild(h('div', [
    h('a.back', { href: '#/' }, '← Invia un nuovo reso'),
    h('section.card', [
      h('h2', 'Controlla un reso'),
      h('p.sub', 'Inserisci il riferimento che hai ricevuto dopo l\'invio.'),
      h('label.f', [h('span', 'Riferimento'), input]),
      err,
      h('button.btn.btn-primary.btn-block', { type: 'button', onclick: apri }, 'Apri')
    ]),
    recenti.length ? h('section.card', [
      h('h2', 'I tuoi invii recenti'),
      h('div.col-2', recenti.map((r) => h('a.rif-link', { href: '#/stato/' + encodeURIComponent(r.ref) }, [
        h('b', r.ref),
        h('span.dim', fmtRelative(r.ts))
      ])))
    ]) : null
  ]));
}

// I riferimenti restano sul dispositivo di chi ha inviato, cosi' non deve
// riscriverli a mano. Non li vede nessun altro: e' localStorage, non il server.
function ricordaRiferimento(ref) {
  try {
    const lista = leggiRiferimenti().filter((r) => r.ref !== ref);
    lista.unshift({ ref, ts: Date.now() });
    localStorage.setItem(ULTIMI, JSON.stringify(lista.slice(0, 12)));
  } catch (e) { /* modalita' privata */ }
}

export function leggiRiferimenti() {
  try {
    const v = JSON.parse(localStorage.getItem(ULTIMI) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}
