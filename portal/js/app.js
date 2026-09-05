// Avvio dell'app pubblica.
//
// Tre schermate, un router di dieci righe: modulo di invio, conferma,
// consultazione stato. Nessun login, nessun SDK Firebase, nessuna
// configurazione da inserire: si apre il link e si usa.

import { h, mount, clear } from './dom.js';
import { renderForm } from './form.js';
import { renderConferma, renderStato, renderCerca, leggiRiferimenti } from './stato.js';

const app = document.getElementById('app');
const vista = h('div.vista');

function boot() {
  clear(app);
  app.appendChild(h('div.wrap', [intestazione(), vista, pieDiPagina()]));
  window.addEventListener('hashchange', instrada);
  instrada();
  const boot = document.getElementById('boot');
  if (boot) boot.remove();
}

function intestazione() {
  return h('header.hdr', [
    h('a.brand', { href: '#/' }, [
      h('span.logo', 'T'),
      h('span', [h('b', 'Reso Telos'), h('small', 'Ufficio Resi · Venaria')])
    ]),
    h('a.hdr-link', { href: '#/cerca' }, 'Controlla un reso')
  ]);
}

function pieDiPagina() {
  return h('footer.pie', [
    h('div', 'TELOS SPA · Via Aosta 5, 10078 Venaria Reale (TO)'),
    h('div', [h('a', { href: 'mailto:resi.torino@telosgroup.it' }, 'resi.torino@telosgroup.it')])
  ]);
}

function instrada() {
  const hash = (location.hash || '#/').slice(1);
  const parti = hash.split('/').filter(Boolean);
  window.scrollTo(0, 0);

  if (parti[0] === 'stato' && parti[1]) {
    renderStato(vista, decodeURIComponent(parti[1]));
    return;
  }
  if (parti[0] === 'cerca') {
    renderCerca(vista, { onApri: (ref) => { location.hash = '#/stato/' + encodeURIComponent(ref); } });
    return;
  }
  mostraForm();
}

function mostraForm() {
  clear(vista);

  const recenti = leggiRiferimenti();
  vista.appendChild(h('div.intro', [
    h('h1', 'Invia un reso a Telos'),
    h('p', 'Compila i dati del pezzo che vuoi rendere. Riceverai un riferimento per seguire la pratica.'),
    recenti.length
      ? h('p.hint', ['Hai già inviato dei resi. ', h('a', { href: '#/cerca' }, 'Controlla lo stato')])
      : null
  ]));

  const zonaForm = h('div');
  vista.appendChild(zonaForm);

  renderForm(zonaForm, {
    onInviato: (res) => renderConferma(vista, res, { onNuovo: () => { location.hash = '#/'; mostraForm(); } })
  });
}

boot();
