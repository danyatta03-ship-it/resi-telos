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
import { CAUSALI, TIPI_MITTENTE, TIPI_DOCUMENTO, AVVISI_CAUSALE, ALLEGATI_GARANZIA, inGaranzia } from './costanti.js';

const BOZZA = 'portal_bozza';

export function renderForm(container, { onInviato }) {
  clear(container);

  const bozza = leggiBozza();
  const foto = [];

  // ── Sezione 1 — Dati cliente / documento ──
  const nome = campo('text', 'Il tuo nome e cognome', bozza.nome, { autocomplete: 'name' });
  const azienda = campo('text', 'Ragione sociale', bozza.azienda, { autocomplete: 'organization' });
  const tipo = h('select.select', TIPI_MITTENTE.map((t) =>
    h('option', { value: t.value, selected: bozza.tipo === t.value }, t.label)));
  const telefono = campo('tel', 'Telefono', bozza.telefono, { autocomplete: 'tel' });
  const email = campo('email', 'Email (per ricevere il riferimento)', bozza.email, { autocomplete: 'email' });
  const codiceCliente = campo('text', 'Codice cliente', bozza.codiceCliente);
  const ddtNumero = campo('text', 'Numero DDT di reso', bozza.ddtNumero);
  const ddtData = campo('date', '', bozza.ddtData);
  const docTipo = h('select.select', [h('option', { value: '' }, '— Tipo documento —')]
    .concat(TIPI_DOCUMENTO.map((t) =>
      h('option', { value: t, selected: bozza.docTipo === t }, etichetta(t)))));
  const docNumero = campo('text', 'Numero documento', bozza.docNumero);
  const docData = campo('date', '', bozza.docData);

  // ── Sezione 3 — Causale reso ──
  const causale = h('select.select', [h('option', { value: '' }, '— Seleziona la causale —')]
    .concat(CAUSALI.map((c) => h('option', { value: c, selected: bozza.causale === c }, etichetta(c)))));
  const note = h('textarea.textarea', {
    rows: 3,
    placeholder: 'Descrivi il difetto, e aggiungi qualsiasi cosa possa servirci',
    value: bozza.note || ''
  });
  const avviso = h('div.banner.banner-warn.hidden');

  // ── Sezione 4 — Reso in garanzia ──
  // Sul cartaceo e' sempre stampata e quasi sempre vuota. Online si apre solo
  // quando la causale la richiede: cosi' chi rende un pezzo per errore
  // d'ordine non si trova davanti a quattro campi che non lo riguardano.
  const dataInst = campo('date', '', bozza.dataInst);
  const kmInst = campo('number', 'Km', bozza.kmInst, { inputmode: 'numeric', min: '0' });
  const dataDisinst = campo('date', '', bozza.dataDisinst);
  const kmDisinst = campo('number', 'Km', bozza.kmDisinst, { inputmode: 'numeric', min: '0' });
  const sezGaranzia = h('section.card.hidden', [
    h('h2', 'Reso in garanzia'),
    h('p.sub', 'Serve per le causali di garanzia. Senza questi dati la pratica si ferma.'),
    h('div.due', [
      h('label.f', [h('span', 'Data installazione'), dataInst]),
      h('label.f', [h('span', 'Km all\'installazione'), kmInst])
    ]),
    h('div.due', [
      h('label.f', [h('span', 'Data disinstallazione'), dataDisinst]),
      h('label.f', [h('span', 'Km alla disinstallazione'), kmDisinst])
    ]),
    h('div.banner.banner-info', [
      h('b', 'Da allegare (usa le foto qui sotto):'),
      h('ul', ALLEGATI_GARANZIA.map((a) => h('li', a)))
    ])
  ]);

  function aggiornaCausale() {
    sezGaranzia.classList.toggle('hidden', !inGaranzia(causale.value));
    const testo = AVVISI_CAUSALE[causale.value];
    if (testo) {
      mount(avviso, h('div', testo));
      avviso.classList.remove('hidden');
    } else {
      avviso.classList.add('hidden');
    }
  }
  causale.addEventListener('change', aggiornaCausale);

  const articoliZone = h('div.col-2');
  let righe = [];

  function aggiungiArticolo(dati) {
    const id = 'a' + Date.now() + Math.random().toString(36).slice(2, 6);
    const cod = campo('text', 'Codice prodotto *', dati && dati.cod);
    const marca = campo('text', 'Marca', dati && dati.marca);
    const qty = h('input.input', {
      type: 'number', min: '1', step: '1',
      value: (dati && dati.qty) || '1',
      inputmode: 'numeric', 'aria-label': 'Quantita'
    });
    // Il fornitore non c'e': il cliente non lo sa, e chiederglielo produce
    // solo campi vuoti o sbagliati. Lo assegna l'ufficio resi.
    const descr = campo('text', 'Descrizione del pezzo', dati && dati.descr);

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
        h('label.f.f-qty', [h('span', 'Q.tà'), qty]),
        h('label.f.f-cod', [h('span', 'Codice prodotto *'), cod]),
        h('label.f', [h('span', 'Marca'), marca])
      ]),
      h('label.f', [h('span', 'Descrizione'), descr])
    ]);

    [cod, marca, qty, descr].forEach((i) => i.addEventListener('input', salvaBozza));

    righe.push({ id, leggi: () => ({
      cod: cod.value.trim().toUpperCase(),
      marca: marca.value.trim().toUpperCase(),
      qty: Math.max(1, parseInt(qty.value, 10) || 1),
      descr: descr.value.trim()
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
        ddtNumero: ddtNumero.value, ddtData: ddtData.value,
        docTipo: docTipo.value, docNumero: docNumero.value, docData: docData.value,
        causale: causale.value, note: note.value,
        dataInst: dataInst.value, kmInst: kmInst.value,
        dataDisinst: dataDisinst.value, kmDisinst: kmDisinst.value,
        articoli: righe.map((r) => r.leggi())
      }));
    } catch (e) { /* spazio esaurito o modalita' privata: pazienza */ }
  }
  [nome, azienda, tipo, telefono, email, codiceCliente,
   ddtNumero, ddtData, docTipo, docNumero, docData,
   causale, note, dataInst, kmInst, dataDisinst, kmDisinst]
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
    if (!azienda.value.trim()) problemi.push('La ragione sociale.');
    if (!causale.value) problemi.push('La causale del reso.');
    if (!articoli.length) problemi.push('Almeno un articolo con il codice prodotto.');
    // Per la garanzia il cartaceo pretende date e chilometri: senza, la
    // pratica si ferma comunque, ed e' meglio dirlo adesso che dopo.
    if (inGaranzia(causale.value)) {
      if (!dataInst.value) problemi.push('La data di installazione (reso in garanzia).');
      if (!dataDisinst.value) problemi.push('La data di disinstallazione (reso in garanzia).');
    }
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
      documento: {
        ddtNumero: ddtNumero.value.trim(),
        ddtData: ddtData.value,
        tipo: docTipo.value,
        numero: docNumero.value.trim(),
        data: docData.value
      },
      causale: causale.value,
      note: note.value.trim(),
      garanzia: inGaranzia(causale.value) ? {
        dataInst: dataInst.value,
        kmInst: kmInst.value,
        dataDisinst: dataDisinst.value,
        kmDisinst: kmDisinst.value
      } : null,
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
      h('h2', '1 · Dati cliente e documento'),
      h('div.due', [
        h('label.f', [h('span', 'Codice cliente'), codiceCliente]),
        h('label.f', [h('span', 'In qualità di'), tipo])
      ]),
      h('label.f', [h('span', 'Ragione sociale *'), azienda]),
      h('label.f', [h('span', 'Nome e cognome di chi compila *'), nome]),
      h('div.due', [
        h('label.f', [h('span', 'Telefono'), telefono]),
        h('label.f', [h('span', 'Email'), email])
      ]),
      h('p.hint', 'L\'email serve a ricevere il riferimento della pratica.'),
      h('div.due', [
        h('label.f', [h('span', 'DDT di reso numero'), ddtNumero]),
        h('label.f', [h('span', 'Data DDT'), ddtData])
      ]),
      h('label.f', [h('span', 'Documento di acquisto'), docTipo]),
      h('div.due', [
        h('label.f', [h('span', 'Numero documento'), docNumero]),
        h('label.f', [h('span', 'Data documento'), docData])
      ])
    ]),

    h('section.card', [
      h('h2', '2 · Materiale reso'),
      h('div.art-hd-main', [
        h('h3', 'Articoli'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => { aggiungiArticolo(); salvaBozza(); } }, '+ Aggiungi')
      ]),
      articoliZone
    ]),

    h('section.card', [
      h('h2', '3 · Causale del reso'),
      h('label.f', [h('span', 'Causale *'), causale]),
      avviso,
      h('label.f', { style: { marginTop: '14px' } },
        [h('span', 'Descrizione del difetto e note'), note])
    ]),

    sezGaranzia,

    h('section.card', [
      h('h2', '4 · Foto e allegati'),
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

  aggiornaCausale();
}

// Le costanti sono in maiuscolo perche' cosi' finiscono nel database e nel
// gestionale. A schermo un elenco tutto maiuscolo si legge peggio: qui torna
// leggibile, senza toccare il valore che viene inviato.
function etichetta(v) {
  const s = String(v || '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
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
