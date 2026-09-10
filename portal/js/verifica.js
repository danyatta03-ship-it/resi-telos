// Pagina di verifica del sito — #/verifica
//
// Serve nei primi cinque minuti di vita del sito, subito dopo averlo creato
// su Netlify. Se le variabili d'ambiente non sono a posto, senza questa
// pagina il primo a scoprirlo sarebbe un cliente che invia un reso e lo
// vede sparire: l'invio fallisce con un messaggio generico, e nessuno in
// Telos si accorge che quel reso non e' mai arrivato.
//
// Non scrive niente sul database e non espone niente: interroga un
// riferimento di forma valida che non puo' esistere, e legge il codice di
// risposta.

import { h, clear } from './dom.js';
import { verificaCollegamento } from './api.js';

const CAUSE = {
  credenziali: {
    titolo: 'Il sito non riesce a raggiungere il database',
    cosa: 'Le function rispondono, ma le credenziali Firebase mancano o non sono valide.',
    passi: [
      'Netlify → questo sito → Site configuration → Environment variables',
      'FIREBASE_DB_URL = l\'indirizzo del Realtime Database (finisce per .firebasedatabase.app)',
      'FIREBASE_SERVICE_ACCOUNT = il JSON del service account, oppure la sua versione base64',
      'Poi Deploys → Trigger deploy: le variabili non valgono per un deploy gia\' fatto'
    ],
    nota: 'Se Netlify rovina gli a-capo della chiave privata — capita spesso — converti il file in base64 e incolla quello: il server accetta entrambe le forme.'
  },
  instradamento: {
    titolo: 'Le function non rispondono',
    cosa: 'La richiesta a /api/portal-status non e\' arrivata a una function: e\' tornata una pagina.',
    passi: [
      'Netlify → Site configuration → Build & deploy → Base directory deve essere: portal',
      'Con la base directory sbagliata, Netlify non trova netlify.toml ne\' le function',
      'Dopo la correzione: Deploys → Trigger deploy'
    ],
    nota: ''
  },
  rete: {
    titolo: 'Il sito non risponde',
    cosa: 'Non e\' arrivata nessuna risposta.',
    passi: ['Controlla la connessione e ricarica la pagina.'],
    nota: ''
  },
  inatteso: {
    titolo: 'Risposta inattesa dal server',
    cosa: 'Il sito risponde, ma non come previsto.',
    passi: ['Manda a chi segue il progetto il dettaglio qui sotto.'],
    nota: ''
  }
};

export function renderVerifica(target) {
  clear(target);

  target.appendChild(h('div.intro', [
    h('h1', 'Verifica del sito'),
    h('p', 'Controlla che questo sito sia collegato correttamente. Non invia niente e non modifica niente.')
  ]));

  const esito = h('div', h('p.hint', 'Controllo in corso…'));
  target.appendChild(esito);

  verificaCollegamento().then((r) => {
    clear(esito);
    esito.appendChild(r.ok ? riquadroOk() : riquadroErrore(r));
  });
}

function riquadroOk() {
  return h('div', { style: riquadro('#1e5a35', 'rgba(46,204,113,.08)') }, [
    h('div', { style: 'font-size:15px;font-weight:800;color:#2e9e5b;margin-bottom:8px' },
      '✓ Il sito è collegato'),
    h('p', { style: 'margin:0 0 10px;line-height:1.6' },
      'Le function rispondono e il database è raggiungibile. Gli invii arriveranno nel gestionale.'),
    h('p', { style: 'margin:0;font-size:12.5px;opacity:.75;line-height:1.6' },
      'Ultima prova da fare: manda un reso di prova da questo sito e controlla che compaia nella scheda PORTALE del gestionale.')
  ]);
}

function riquadroErrore(r) {
  const c = CAUSE[r.causa] || CAUSE.inatteso;
  const figli = [
    h('div', { style: 'font-size:15px;font-weight:800;color:#c0392b;margin-bottom:8px' }, '✕ ' + c.titolo),
    h('p', { style: 'margin:0 0 12px;line-height:1.6' }, c.cosa),
    h('div', { style: 'font-size:12.5px;font-weight:700;margin-bottom:6px' }, 'Come sistemarlo:'),
    h('ol', { style: 'margin:0 0 10px;padding-left:20px;line-height:1.75;font-size:13px' },
      c.passi.map((p) => h('li', p)))
  ];
  if (c.nota) {
    figli.push(h('p', { style: 'margin:0 0 10px;font-size:12.5px;opacity:.8;line-height:1.6' }, c.nota));
  }
  figli.push(h('div', {
    style: 'font-family:ui-monospace,monospace;font-size:11.5px;opacity:.65;border-top:1px solid rgba(128,128,128,.25);padding-top:8px'
  }, 'dettaglio: ' + (r.stato ? 'HTTP ' + r.stato + ' · ' : '') + (r.dettaglio || '')));

  return h('div', { style: riquadro('#8b3a30', 'rgba(224,85,85,.08)') }, figli);
}

function riquadro(bordo, sfondo) {
  return 'border:1px solid ' + bordo + ';background:' + sfondo +
         ';border-radius:12px;padding:16px 18px;margin-bottom:14px';
}
