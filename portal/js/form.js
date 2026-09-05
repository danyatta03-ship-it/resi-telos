// Modulo di invio reso.
//
// E' la pagina che vedono corrieri, agenti e clienti quando aprono il link.
// Deve essere compilabile da un telefono, in piedi in magazzino, da qualcuno
// che non ha mai visto l'applicazione prima. Quindi: campi pochi e chiari,
// obbligatori segnati, errori che dicono cosa fare, e la bozza salvata in
// locale perche' una telefonata a meta' compilazione non deve far perdere
// tutto.

import { h, mount, clear, withBusy, toast } from './dom.js';
import { submitReso } from './api.js';
import { comprimi, pesoTotale, formatBytes, MAX_FOTO, MAX_BYTES_TOTALI, isImmagine } from './photos.js';
import { CAUSALI, TIPI_MITTENTE } from './costanti.js';

const BOZZA = 'portal_bozza';

export function renderForm(container, { onInviato }) {
  clear(container);

  const bozza = leggiBozza();
  const foto = [];

  // ── Chi invia ──
  const nome = campo('text', 'Il tuo nome e cognome', bozza.nome, { autocomplete: 'name' });
  const azienda = campo('text', 'Azienda / officina / vettore', bozza.azienda, { autocomplete: 'organization' });
  const tipo = h('select.select', TIPI_MITTENTE.map((t) =>
    h('option', { value: t.value, selected: bozza.tipo === t.value }, t.label)));
  const telefono = campo('tel', 'Telefono', bozza.telefono, { autocomplete: 'tel' });
  const email = campo('email', 'Email (per ricevere il riferimento)', bozza.email, { autocomplete: 'email' });
  const codiceCliente = campo('text', 'Codice cliente (se lo conosci)', bozza.codiceCliente);

  // ── Il reso ──
  const causale = h('select.select', [h('option', { value: '' }, '— Seleziona il motivo —')]
    .concat(CAUSALI.map((c) => h('option', { value: c, selected: bozza.causale === c }, c))));
  const note = h('textarea.textarea', {
    rows: 3,
    placeholder: 'Aggiungi qualsiasi cosa possa servirci (numero bolla, targa, riferimento ordine…)',
    value: bozza.note || ''
  });

  const articoliZone = h('div.col-2');
  let righe = [];

  function aggiungiArticolo(dati) {
    const id = 'a' + Date.now() + Math.random().toString(36).slice(2, 6);
    const cod = campo('text', 'Codice articolo *', dati && dati.cod);
    const marca = campo('text', 'Marca', dati && dati.marca);
    const qty = h('input.input', {
      type: 'number', min: '1', step: '1',
      value: (dati && dati.qty) || '1',
      inputmode: 'numeric', 'aria-label': 'Quantita'
    });
    const forn = campo('text', 'Fornitore', dati && dati.forn);

    const riga = h('div.art', [
      h('div.art-hd', [
        h('span.art-n', ''),
        h('button.btn-x', {
          type: 'button', 'aria-label': 'Rimuovi articolo',
          onclick: () => {
            righe = righe.filter((r) => r.id !== id);
            riga.remove();
            if (!righe.length) aggiungiArticolo();
            rinumera();
            salvaBozza();
          }
        }, '×')
      ]),
      h('div.art-grid', [
        h('label.f.f-cod', [h('span', 'Codice articolo *'), cod]),
        h('label.f', [h('span', 'Marca'), marca]),
        h('label.f.f-qty', [h('span', 'Q.tà'), qty]),
        h('label.f', [h('span', 'Fornitore'), forn])
      ])
    ]);

    [cod, marca, qty, forn].forEach((i) => i.addEventListener('input', salvaBozza));

    righe.push({ id, leggi: () => ({
      cod: cod.value.trim().toUpperCase(),
      marca: marca.value.trim().toUpperCase(),
      qty: Math.max(1, parseInt(qty.value, 10) || 1),
      forn: forn.value.trim()
    }), campi: { cod } });

    articoliZone.appendChild(riga);
    rinumera();
    return riga;
  }

  function rinumera() {
    const nodi = articoliZone.querySelectorAll('.art-n');
    for (let i = 0; i < nodi.length; i++) nodi[i].textContent = 'Articolo ' + (i + 1);
  }

  (bozza.articoli && bozza.articoli.length ? bozza.articoli : [null]).forEach(aggiungiArticolo);

  // ── Foto ──
  const fotoZone = h('div.foto-grid');
  const fotoInput = h('input', {
    type: 'file', accept: 'image/*', multiple: true,
    style: { display: 'none' },
    onchange: (e) => aggiungiFoto(Array.from(e.target.files || []))
  });

  const fotoBtn = h('button.btn.btn-foto', {
    type: 'button',
    onclick: () => fotoInput.click()
  }, ['📷 ', h('span', 'Aggiungi foto')]);

  async function aggiungiFoto(files) {
    for (const file of files) {
      if (foto.length >= MAX_FOTO) {
        toast('Massimo ' + MAX_FOTO + ' foto.', 'warn');
        break;
      }
      if (!isImmagine(file)) {
        toast('"' + file.name + '" non è un\'immagine.', 'err');
        continue;
      }
      try {
        const c = await comprimi(file);
        if (pesoTotale(foto) + c.bytes > MAX_BYTES_TOTALI) {
          toast('Le foto sono troppo pesanti in totale. Rimuovine una.', 'warn');
          break;
        }
        foto.push(c);
      } catch (err) {
        toast(err.message || 'Foto non caricata.', 'err');
      }
    }
    fotoInput.value = '';
    disegnaFoto();
  }

  function disegnaFoto() {
    mount(fotoZone, foto.map((f, i) => h('div.foto', [
      h('img', { src: f.dataUrl, alt: 'Foto ' + (i + 1) }),
      h('button.btn-x.foto-x', {
        type: 'button', 'aria-label': 'Rimuovi foto',
        onclick: () => { foto.splice(i, 1); disegnaFoto(); }
      }, '×')
    ])));
    fotoBtn.querySelector('span').textContent = foto.length
      ? foto.length + '/' + MAX_FOTO + ' · ' + formatBytes(pesoTotale(foto))
      : 'Aggiungi foto';
    fotoBtn.disabled = foto.length >= MAX_FOTO;
  }

  // ── Bozza ──
  function salvaBozza() {
    try {
      localStorage.setItem(BOZZA, JSON.stringify({
        nome: nome.value, azienda: azienda.value, tipo: tipo.value,
        telefono: telefono.value, email: email.value,
        codiceCliente: codiceCliente.value,
        causale: causale.value, note: note.value,
        articoli: righe.map((r) => r.leggi())
      }));
    } catch (e) { /* spazio esaurito o modalita' privata: pazienza */ }
  }
  [nome, azienda, tipo, telefono, email, codiceCliente, causale, note]
    .forEach((i) => i.addEventListener('input', salvaBozza));

  // ── Invio ──
  const errore = h('div.banner.banner-err.hidden');
  const inviaBtn = h('button.btn.btn-primary.btn-lg.btn-block', { type: 'submit' }, 'Invia il reso');

  function mostraErrori(lista) {
    mount(errore, [
      h('b', lista.length === 1 ? 'Manca un dato:' : 'Mancano alcuni dati:'),
      h('ul', lista.map((m) => h('li', m)))
    ]);
    errore.classList.remove('hidden');
    errore.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function invia(e) {
    e.preventDefault();
    errore.classList.add('hidden');

    const articoli = righe.map((r) => r.leggi()).filter((a) => a.cod);
    const problemi = [];
    if (!nome.value.trim()) problemi.push('Il tuo nome e cognome.');
    if (!azienda.value.trim()) problemi.push('Il nome della tua azienda.');
    if (!causale.value) problemi.push('Il motivo del reso.');
    if (!articoli.length) problemi.push('Almeno un articolo con il codice.');
    if (problemi.length) {
      mostraErrori(problemi);
      return;
    }

    const payload = {
      mittente: {
        nome: nome.value.trim(),
        azienda: azienda.value.trim(),
        tipo: tipo.value,
        telefono: telefono.value.trim(),
        email: email.value.trim()
      },
      codiceCliente: codiceCliente.value.trim(),
      causale: causale.value,
      note: note.value.trim(),
      articoli,
      foto: foto.map((f) => f.dataUrl)
    };

    await withBusy(inviaBtn, async () => {
      try {
        const res = await submitReso(payload);
        try { localStorage.removeItem(BOZZA); } catch (err) { /* niente */ }
        onInviato(res);
      } catch (err) {
        mount(errore, h('div', err.message || 'Invio non riuscito.'));
        errore.classList.remove('hidden');
        errore.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  disegnaFoto();

  container.appendChild(h('form', { onsubmit: invia, novalidate: true }, [
    h('section.card', [
      h('h2', 'Chi invia il reso'),
      h('p.sub', 'Ci serve per sapere con chi parlare quando lavoriamo la pratica.'),
      h('label.f', [h('span', 'Nome e cognome *'), nome]),
      h('label.f', [h('span', 'Azienda / officina / vettore *'), azienda]),
      h('label.f', [h('span', 'In qualità di'), tipo]),
      h('div.due', [
        h('label.f', [h('span', 'Telefono'), telefono]),
        h('label.f', [h('span', 'Email'), email])
      ]),
      h('label.f', [h('span', 'Codice cliente'), codiceCliente]),
      h('p.hint', 'Il codice cliente non è obbligatorio: se non lo sai, lascialo vuoto.')
    ]),

    h('section.card', [
      h('h2', 'Cosa stai rendendo'),
      h('label.f', [h('span', 'Motivo del reso *'), causale]),
      h('div.art-hd-main', [
        h('h3', 'Articoli'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => { aggiungiArticolo(); salvaBozza(); } }, '+ Aggiungi')
      ]),
      articoliZone,
      h('label.f', { style: { marginTop: '14px' } }, [h('span', 'Note'), note])
    ]),

    h('section.card', [
      h('h2', 'Foto'),
      h('p.sub', 'Fotografa la bolla e il pezzo: ci fa risparmiare un giro di telefonate.'),
      fotoZone,
      fotoBtn,
      fotoInput
    ]),

    errore,
    inviaBtn,
    h('p.hint.txt-c', { style: { marginTop: '10px' } },
      'Quello che scrivi qui arriva direttamente all\'ufficio resi Telos.')
  ]));
}

function campo(type, placeholder, value, extra) {
  return h('input.input', Object.assign({
    type, placeholder: placeholder || '', value: value || ''
  }, extra || {}));
}

function leggiBozza() {
  try {
    return JSON.parse(localStorage.getItem(BOZZA) || '{}') || {};
  } catch (e) {
    return {};
  }
}
