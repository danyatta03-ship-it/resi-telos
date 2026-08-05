// js/ui/spunta/spunta.js — orchestrazione SPUNTA BANCALE.
//
// Dipende da:
//   window._spuntaNorm      (normalize.js)  — normalizeString, similarity
//   window._spuntaMatcher   (matcher.js)    — findMatch, lookupCliData
//
// Opzionale (se presenti nell'app):
//   window.toast(msg,t)                — feedback UI
//   window.CLI_DATA                    — anagrafica clienti Telos
//   window.FB_REF.root                 — Firebase Database root
//   window.idbSet / idbGet             — persistenza IndexedDB dell'app
//   window.deviceName                  — nome operatore corrente
'use strict';

// ══════════════════════════════════════════════════════════════════
// STATO
// ══════════════════════════════════════════════════════════════════
window.spuntaState = window.spuntaState || {
  attiva: false,
  vettore: '',
  data: '',
  bordero: null,          // dataURL della foto (se presente)
  lista: [],              // righe attesa: {id, mittente, citta, colliAttesi, colliLetti, ddt, cod, stato}
  extra: [],              // colli non previsti: {id, mittente, citta, colliLetti, cod}
  filter: 'all',          // 'all' | 'todo' | 'done' | 'issue'
  pendingMulti: null      // { input, options: [rows...] }
};

var LS_KEY = 'spuntaCorrente';

// ── Persistenza locale ────────────────────────────────────────────
function spuntaSaveLocal(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(window.spuntaState)); }catch(e){}
}
function spuntaLoadLocal(){
  try{
    var raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    var s = JSON.parse(raw);
    if(s && Array.isArray(s.lista)){
      window.spuntaState = s;
    }
  }catch(e){}
}

// ── Genera ID progressivo per riga ────────────────────────────────
var _spuntaSeq = 1;
function _newId(){ return 'sp' + Date.now() + '_' + (_spuntaSeq++); }

// ══════════════════════════════════════════════════════════════════
// AZIONI PRINCIPALI
// ══════════════════════════════════════════════════════════════════

// A) Foto Borderò → OCR con Gemini
function spuntaHandleFotoBordero(){
  var el = document.getElementById('spFotoInput');
  if(el) el.click();
}
function spuntaOnFotoSelected(input){
  var file = input && input.files && input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(){
    var dataUrl = reader.result;
    window.spuntaState.bordero = dataUrl;
    spuntaShowLoading('Sto leggendo il borderò con AI…');
    _spuntaCallGemini(dataUrl)
      .then(function(righe){
        spuntaHideLoading();
        if(!righe || !righe.length){
          _spuntaMsg('L\'AI non ha estratto righe. Aggiungi manualmente.', 'y');
          return;
        }
        _spuntaImportaLista(righe);
        _spuntaMsg('Importate ' + righe.length + ' righe dal borderò', 'g');
      })
      .catch(function(err){
        spuntaHideLoading();
        _spuntaMsg('Errore AI: ' + (err && err.message || err) + '. Aggiungi manualmente.', 'r');
      });
  };
  reader.readAsDataURL(file);
  input.value = ''; // reset per poter riscannerizzare stessa immagine
}

// Chiamata a Gemini via il proxy Netlify esistente
function _spuntaCallGemini(dataUrl){
  var b64 = String(dataUrl).split(',')[1];
  if(!b64) return Promise.reject(new Error('Immagine non valida'));

  var prompt =
    'Analizza questa immagine di un borderò di trasporto/consegna. ' +
    'Estrai una lista JSON di oggetti con queste chiavi: ' +
    'mittente (string, ragione sociale), ' +
    'citta (string, città/CAP), ' +
    'colli (number, numero colli — 1 se non specificato), ' +
    'ddt (string, numero DDT/riferimento se presente, altrimenti stringa vuota). ' +
    'Ignora intestazioni, totali, note, firme. Rispondi SOLO con un array JSON valido, ' +
    'nessun testo aggiuntivo. Esempio: [{"mittente":"CASADEI","citta":"VERRES","colli":1,"ddt":"4592"}]';

  return fetch('/.netlify/functions/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: b64 } }
        ]
      }]
    })
  })
  .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(function(json){
    // La risposta Gemini è annidata; estraggo il testo
    var text = _spuntaExtractText(json);
    if(!text) throw new Error('Risposta AI vuota');
    // Provo a estrarre l'array JSON dal testo (rimuove code fences)
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    var start = text.indexOf('['), end = text.lastIndexOf(']');
    if(start < 0 || end < 0) throw new Error('JSON non trovato');
    var arr = JSON.parse(text.slice(start, end + 1));
    if(!Array.isArray(arr)) throw new Error('Non è un array');
    return arr.map(function(x){
      return {
        mittente: String(x.mittente || '').trim(),
        citta:    String(x.citta || '').trim(),
        colli:    Math.max(1, parseInt(x.colli || 1, 10) || 1),
        ddt:      String(x.ddt || '').trim()
      };
    }).filter(function(x){ return x.mittente; });
  });
}
function _spuntaExtractText(json){
  try{
    return json.candidates[0].content.parts[0].text;
  }catch(e){ return ''; }
}

// Popola lista attesa dalle righe AI
function _spuntaImportaLista(righe){
  var s = window.spuntaState;
  righe.forEach(function(r){
    // arricchisco con codice cliente Telos se trovato
    var cli = _spuntaLookupCli(r.mittente);
    s.lista.push({
      id: _newId(),
      mittente: r.mittente,
      citta: r.citta,
      colliAttesi: r.colli || 1,
      colliLetti: 0,
      ddt: r.ddt || '',
      cod: cli ? cli.codice : '',
      stato: 'pending'
    });
  });
  s.attiva = true;
  spuntaSaveLocal();
  renderSpuntaList();
}
function _spuntaLookupCli(nome){
  if(!window._spuntaMatcher || !window.CLI_DATA) return null;
  try{ return window._spuntaMatcher.lookupCliData(nome, window.CLI_DATA); }
  catch(e){ return null; }
}

// B) Aggiungi riga manuale (senza foto)
function spuntaAggiungiRigaManuale(){
  var mitt = prompt('Mittente:');
  if(!mitt || !mitt.trim()) return;
  var citta = prompt('Città (opzionale):', '') || '';
  var colli = parseInt(prompt('Colli attesi:', '1'), 10) || 1;
  var cli = _spuntaLookupCli(mitt);
  window.spuntaState.lista.push({
    id: _newId(),
    mittente: mitt.trim(),
    citta: citta.trim(),
    colliAttesi: colli,
    colliLetti: 0,
    ddt: '',
    cod: cli ? cli.codice : '',
    stato: 'pending'
  });
  window.spuntaState.attiva = true;
  spuntaSaveLocal();
  renderSpuntaList();
}

// C) Reset totale
function spuntaReset(){
  if(!confirm('Cancellare tutta la spunta corrente?')) return;
  window.spuntaState = {
    attiva:false, vettore:'', data:'', bordero:null,
    lista:[], extra:[], filter:'all', pendingMulti:null
  };
  spuntaSaveLocal();
  renderSpuntaList();
}

// ══════════════════════════════════════════════════════════════════
// SPUNTA (input + match)
// ══════════════════════════════════════════════════════════════════
function spuntaOnSearchInput(v){
  var hint = document.getElementById('spHint');
  if(!hint) return;
  var s = String(v || '').trim();
  if(s.length < 3){
    hint.textContent = 'Digita almeno 3 caratteri o scansiona l\'etichetta.';
    _spuntaClearMatches();
    return;
  }
  // Suggerimento live (non conferma ancora)
  var out = _spuntaFind(s);
  if(out.match === 'none'){
    hint.innerHTML = '<span style="color:var(--red,#E05555)">Nessun match. Enter per aggiungere come EXTRA.</span>';
  } else if(out.match === 'single'){
    var r = out.rows[0];
    hint.innerHTML = 'Trovato: <b>' + _esc(r.mittente) + '</b> - ' + _esc(r.citta) +
                     ' (' + r.colliLetti + '/' + r.colliAttesi + '). Enter per confermare.';
  } else {
    hint.textContent = out.rows.length + ' possibili match. Enter per aprire la scelta.';
  }
}

function _spuntaFind(input){
  if(!window._spuntaMatcher) return { match:'none', rows:[] };
  return window._spuntaMatcher.findMatch(input, window.spuntaState.lista);
}

function spuntaConfermaMatch(){
  var el = document.getElementById('spSearch');
  var input = el ? el.value.trim() : '';
  if(!input) return;
  var out = _spuntaFind(input);
  if(out.match === 'none'){
    _spuntaAddExtra(input);
    _feedback('err');
    el.value = '';
    return;
  }
  if(out.match === 'single'){
    _spuntaSpuntaRiga(out.rows[0]);
    _feedback('ok');
    el.value = '';
    return;
  }
  // multi: apri popup
  _spuntaShowPopupMulti(input, out.rows);
}

function _spuntaSpuntaRiga(riga){
  riga.colliLetti++;
  if(riga.colliLetti >= riga.colliAttesi){
    riga.stato = 'ok';
  } else {
    riga.stato = 'partial';
  }
  spuntaSaveLocal();
  renderSpuntaList();
}

function _spuntaAddExtra(input){
  var parts = String(input || '').split(/\s*[-,;]\s*/);
  var mitt = (parts[0] || input).trim();
  var citta = (parts[1] || '').trim();
  var cli = _spuntaLookupCli(mitt);
  window.spuntaState.extra.push({
    id: _newId(),
    mittente: mitt,
    citta: citta,
    colliLetti: 1,
    cod: cli ? cli.codice : ''
  });
  spuntaSaveLocal();
  renderSpuntaList();
}

// Popup match multiplo (riusa il div #spPopupMulti)
function _spuntaShowPopupMulti(input, options){
  var pop = document.getElementById('spPopupMulti');
  var list = document.getElementById('spPopupList');
  if(!pop || !list) return;
  window.spuntaState.pendingMulti = { input: input, options: options };
  list.innerHTML = options.map(function(r, i){
    return '<div class="sp-match-opt" onclick="spuntaSelezionaMulti(' + i + ')">'+
      '<div><b>' + _esc(r.mittente) + '</b><br><small>' + _esc(r.citta) + '</small></div>'+
      '<div class="sp-count"><span class="letti">' + r.colliLetti + '</span><span class="attesi">/' + r.colliAttesi + '</span></div>'+
      '</div>';
  }).join('');
  pop.style.display = 'flex';
}
window.spuntaSelezionaMulti = function(i){
  var pm = window.spuntaState.pendingMulti;
  if(!pm || !pm.options || !pm.options[i]) return;
  var riga = pm.options[i];
  _spuntaSpuntaRiga(riga);
  _feedback('ok');
  window.spuntaState.pendingMulti = null;
  var pop = document.getElementById('spPopupMulti');
  if(pop) pop.style.display = 'none';
  var el = document.getElementById('spSearch');
  if(el){ el.value = ''; el.focus(); }
};
function spuntaChiudiPopup(){
  var p1 = document.getElementById('spPopupMulti');
  var p2 = document.getElementById('spPopupReport');
  if(p1) p1.style.display = 'none';
  if(p2) p2.style.display = 'none';
}
function _spuntaClearMatches(){
  var m = document.getElementById('spMatches');
  if(m) m.style.display = 'none';
}

// D) Scan etichetta con Gemini (foto → OCR → estrai mittente+città)
function spuntaScanEtichetta(){
  // Trigger fileInput on-the-fly per la scan
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.capture = 'environment';
  inp.style.display = 'none';
  inp.onchange = function(){
    var f = inp.files && inp.files[0];
    if(!f){ return; }
    var rd = new FileReader();
    rd.onload = function(){
      spuntaShowLoading('Leggo etichetta…');
      _spuntaCallGeminiEtichetta(rd.result)
        .then(function(txt){
          spuntaHideLoading();
          if(!txt){ _spuntaMsg('AI non ha letto testo dall\'etichetta', 'y'); return; }
          var el = document.getElementById('spSearch');
          if(el){ el.value = txt; spuntaOnSearchInput(txt); }
        })
        .catch(function(err){
          spuntaHideLoading();
          _spuntaMsg('Errore AI: ' + (err && err.message || err), 'r');
        });
    };
    rd.readAsDataURL(f);
  };
  document.body.appendChild(inp);
  inp.click();
  setTimeout(function(){ inp.remove(); }, 60000);
}
function _spuntaCallGeminiEtichetta(dataUrl){
  var b64 = String(dataUrl).split(',')[1];
  var prompt =
    'Analizza questa foto di un\'etichetta di spedizione. ' +
    'Estrai il MITTENTE (ragione sociale) e la CITTÀ di partenza. ' +
    'Rispondi SOLO nel formato: "MITTENTE - CITTA" (in maiuscolo, senza altro testo). ' +
    'Se non trovi la città, rispondi solo con il mittente.';
  return fetch('/.netlify/functions/gemini', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      contents:[{ parts:[
        { text: prompt },
        { inline_data:{ mime_type:'image/jpeg', data:b64 } }
      ]}]
    })
  })
  .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(function(json){
    var t = _spuntaExtractText(json);
    return String(t || '').replace(/[`\n\r]/g, ' ').trim();
  });
}

// ══════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════
function renderSpuntaList(){
  var s = window.spuntaState;
  var cntOk=0, cntPart=0, cntMiss=0, cntExtra=s.extra.length;
  var totAttesi=0;
  s.lista.forEach(function(r){
    totAttesi += r.colliAttesi;
    if(r.stato === 'ok') cntOk++;
    else if(r.colliLetti > 0 && r.colliLetti < r.colliAttesi) cntPart++;
    else if(r.stato === 'miss' || (r.colliLetti === 0 && r.stato !== 'pending')) cntMiss++;
    else if(r.stato === 'pending') cntMiss++;  // "da spuntare" trattato come miss finché non parte
  });
  _setText('spCntOk', '✅ ' + cntOk);
  _setText('spCntPart', '⚠ ' + cntPart);
  _setText('spCntMiss', '❌ ' + cntMiss);
  _setText('spCntExtra', '➕ ' + cntExtra);
  _setText('spTotAttesi', '(' + totAttesi + ' colli)');

  var el = document.getElementById('spLista');
  if(el){
    if(!s.lista.length){
      el.innerHTML = '<div class="sp-empty">Nessuna riga. Fotografa il borderò o aggiungi una riga manuale per iniziare.</div>';
    } else {
      el.innerHTML = s.lista
        .filter(_filterFn(s.filter))
        .map(_renderRow)
        .join('');
    }
  }

  // Card extra visibile solo se ci sono
  var cx = document.getElementById('spCardExtra');
  var xEl = document.getElementById('spExtra');
  if(cx) cx.style.display = s.extra.length ? '' : 'none';
  if(xEl && s.extra.length){
    xEl.innerHTML = s.extra.map(_renderExtra).join('');
  }

  // Card chiusura visibile se c'è una spunta attiva
  var cc = document.getElementById('spCardClose');
  if(cc) cc.style.display = (s.attiva && (s.lista.length || s.extra.length)) ? '' : 'none';

  // Card input visibile solo se c'è una lista
  var ci = document.getElementById('spCardInput');
  if(ci) ci.style.display = s.lista.length ? '' : 'none';
}
function _filterFn(kind){
  return function(r){
    if(kind === 'todo') return r.stato !== 'ok';
    if(kind === 'done') return r.stato === 'ok';
    if(kind === 'issue') return r.stato === 'miss' || (r.colliLetti > 0 && r.colliLetti < r.colliAttesi);
    return true;
  };
}
function _renderRow(r){
  var cls = _rowClass(r);
  var ico = _rowIcon(r);
  var codHtml = r.cod ? ('<span class="sp-row-cod">'+_esc(r.cod)+'</span>') : '';
  var ddtHtml = r.ddt ? ('<span><span class="k">DDT:</span> '+_esc(r.ddt)+'</span>') : '';
  return ''+
    '<div class="sp-row '+cls+'">'+
      '<div class="sp-row-icon">'+ico+'</div>'+
      '<div class="sp-row-info">'+
        '<div class="sp-row-name">'+_esc(r.mittente)+'</div>'+
        '<div class="sp-row-meta">'+
          '<span><span class="k">Città:</span> '+_esc(r.citta||'—')+'</span>'+
          ddtHtml + codHtml +
        '</div>'+
      '</div>'+
      '<div class="sp-count"><span class="letti">'+r.colliLetti+'</span><span class="attesi">/'+r.colliAttesi+'</span></div>'+
      '<div class="sp-row-actions">'+
        '<button onclick="spuntaDecRiga(\''+r.id+'\')" title="Rimuovi lettura">−</button>'+
        '<button onclick="spuntaMarkMiss(\''+r.id+'\')" title="Segna mancante">✖</button>'+
      '</div>'+
    '</div>';
}
function _renderExtra(r){
  return ''+
    '<div class="sp-row st-extra">'+
      '<div class="sp-row-icon">➕</div>'+
      '<div class="sp-row-info">'+
        '<div class="sp-row-name">'+_esc(r.mittente)+'</div>'+
        '<div class="sp-row-meta">'+
          '<span><span class="k">Città:</span> '+_esc(r.citta||'—')+'</span>'+
          (r.cod ? '<span class="sp-row-cod">'+_esc(r.cod)+'</span>' : '')+
        '</div>'+
      '</div>'+
      '<div class="sp-count"><span class="letti">'+r.colliLetti+'</span><span class="attesi">/'+r.colliLetti+'</span></div>'+
      '<div class="sp-row-actions">'+
        '<button onclick="spuntaRimuoviExtra(\''+r.id+'\')" title="Rimuovi">🗑</button>'+
      '</div>'+
    '</div>';
}
function _rowClass(r){
  if(r.stato === 'ok') return 'st-ok';
  if(r.stato === 'miss') return 'st-miss';
  if(r.colliLetti > 0 && r.colliLetti < r.colliAttesi) return 'st-partial';
  return '';
}
function _rowIcon(r){
  if(r.stato === 'ok') return '✅';
  if(r.stato === 'miss') return '❌';
  if(r.colliLetti > 0 && r.colliLetti < r.colliAttesi) return '⚠';
  return '⬜';
}

// Azioni riga
window.spuntaDecRiga = function(id){
  var r = _findRiga(id); if(!r) return;
  if(r.colliLetti > 0) r.colliLetti--;
  r.stato = r.colliLetti === 0 ? 'pending' :
            (r.colliLetti < r.colliAttesi ? 'partial' : 'ok');
  spuntaSaveLocal(); renderSpuntaList();
};
window.spuntaMarkMiss = function(id){
  var r = _findRiga(id); if(!r) return;
  r.stato = 'miss'; r.colliLetti = 0;
  spuntaSaveLocal(); renderSpuntaList();
};
window.spuntaRimuoviExtra = function(id){
  window.spuntaState.extra = window.spuntaState.extra.filter(function(x){ return x.id !== id; });
  spuntaSaveLocal(); renderSpuntaList();
};
function _findRiga(id){
  for(var i=0; i<window.spuntaState.lista.length; i++){
    if(window.spuntaState.lista[i].id === id) return window.spuntaState.lista[i];
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════
// FILTRO
// ══════════════════════════════════════════════════════════════════
function spuntaToggleFilter(){
  var order = ['all','todo','issue','done'];
  var lbl = {all:'Tutti', todo:'Da fare', issue:'Problemi', done:'Fatti'};
  var i = order.indexOf(window.spuntaState.filter);
  var next = order[(i+1) % order.length];
  window.spuntaState.filter = next;
  var b = document.getElementById('spFilterBtn');
  if(b) b.textContent = lbl[next];
  renderSpuntaList();
}

// ══════════════════════════════════════════════════════════════════
// CHIUSURA
// ══════════════════════════════════════════════════════════════════
function spuntaMostraReport(){
  var s = window.spuntaState;
  var body = document.getElementById('spReportBody');
  if(!body) return;
  var stats = _spuntaStats();
  var html =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'+
    '<div><b>Vettore:</b> '+_esc(s.vettore||'—')+'</div>'+
    '<div><b>Data:</b> '+_esc(s.data||new Date().toISOString().slice(0,10))+'</div>'+
    '<div><b>Righe attese:</b> '+s.lista.length+'</div>'+
    '<div><b>Colli attesi:</b> '+stats.attesi+'</div>'+
    '<div><b>Colli letti:</b> '+stats.letti+'</div>'+
    '<div><b>Colli extra:</b> '+stats.extra+'</div>'+
    '</div>';
  html += '<div style="margin-top:10px"><b>Mancanti/Parziali:</b></div>';
  var probl = s.lista.filter(function(r){ return r.stato !== 'ok'; });
  if(probl.length){
    html += '<ul style="margin:6px 0 0 20px;font-size:12px">' +
      probl.map(function(r){
        return '<li>'+_esc(r.mittente)+' — '+_esc(r.citta||'—')+' ('+r.colliLetti+'/'+r.colliAttesi+') '+_rowIcon(r)+'</li>';
      }).join('') +
    '</ul>';
  } else {
    html += '<div style="color:var(--grn,#4CAF50);margin-top:4px">Nessun problema.</div>';
  }
  if(s.extra.length){
    html += '<div style="margin-top:10px"><b>Colli extra:</b></div>' +
      '<ul style="margin:6px 0 0 20px;font-size:12px">' +
      s.extra.map(function(r){ return '<li>'+_esc(r.mittente)+' — '+_esc(r.citta||'—')+'</li>'; }).join('') +
      '</ul>';
  }
  body.innerHTML = html;
  var pop = document.getElementById('spPopupReport');
  if(pop) pop.style.display = 'flex';
}
function _spuntaStats(){
  var s = window.spuntaState;
  var attesi=0, letti=0;
  s.lista.forEach(function(r){ attesi += r.colliAttesi; letti += r.colliLetti; });
  return { attesi:attesi, letti:letti, extra:s.extra.length };
}

function spuntaChiudi(){
  if(!window.spuntaState.attiva){ _spuntaMsg('Nessuna spunta attiva', 'y'); return; }
  if(!confirm('Chiudere la spunta corrente? Un riepilogo sarà salvato.')) return;
  spuntaMostraReport();
}

function spuntaSalvaSuFirebase(){
  var s = window.spuntaState;
  var vSel = document.getElementById('spVet');
  var dSel = document.getElementById('spDate');
  s.vettore = s.vettore || (vSel ? vSel.value : '');
  s.data    = s.data    || (dSel ? dSel.value : new Date().toISOString().slice(0,10));

  var payload = {
    vettore: s.vettore,
    data: s.data,
    operatore: (window.deviceName || '') + '',
    ts: Date.now(),
    stats: _spuntaStats(),
    lista: s.lista,
    extra: s.extra,
    bordero: s.bordero || null
  };
  var done = function(){
    spuntaChiudiPopup();
    // reset per nuovo giro
    window.spuntaState = {
      attiva:false, vettore:s.vettore, data:s.data, bordero:null,
      lista:[], extra:[], filter:'all', pendingMulti:null
    };
    spuntaSaveLocal();
    renderSpuntaList();
    _spuntaMsg('Spunta salvata', 'g');
  };
  try{
    if(window.FB_REF && window.FB_REF.root){
      window.FB_REF.root.child('arrivi_bancale').push(payload)
        .then(done)
        .catch(function(err){
          console.error('FB save error', err);
          _spuntaMsg('Firebase offline — spunta rimasta in locale', 'y');
        });
    } else {
      _spuntaMsg('Firebase non pronto — spunta rimasta in locale', 'y');
    }
  }catch(e){
    console.error(e);
    _spuntaMsg('Errore salvataggio', 'r');
  }
}

// ══════════════════════════════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════════════════════════════
function spuntaShowLoading(msg){
  var el = document.getElementById('spLoading');
  var m  = document.getElementById('spLoadingMsg');
  if(m) m.textContent = msg || 'Caricamento…';
  if(el) el.style.display = '';
}
function spuntaHideLoading(){
  var el = document.getElementById('spLoading');
  if(el) el.style.display = 'none';
}
function _spuntaMsg(msg, t){
  if(typeof window.toast === 'function'){ window.toast(msg, t); return; }
  console.log('[spunta] ' + msg);
}
function _feedback(kind){
  try{
    if(navigator.vibrate){
      navigator.vibrate(kind === 'ok' ? 50 : [100, 50, 100]);
    }
  }catch(e){}
}
function _setText(id, txt){ var el = document.getElementById(id); if(el) el.textContent = txt; }
function _esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════
function spuntaInit(){
  spuntaLoadLocal();
  // Popola vettore/data se presenti
  var v = document.getElementById('spVet');
  var d = document.getElementById('spDate');
  if(v && window.spuntaState.vettore) v.value = window.spuntaState.vettore;
  if(d) d.value = window.spuntaState.data || new Date().toISOString().slice(0,10);
  if(v) v.onchange = function(){ window.spuntaState.vettore = v.value; spuntaSaveLocal(); };
  if(d) d.onchange = function(){ window.spuntaState.data = d.value; spuntaSaveLocal(); };
  renderSpuntaList();
}
if(typeof document !== 'undefined'){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', spuntaInit);
  } else {
    setTimeout(spuntaInit, 0);
  }
}

// Export utili anche in CommonJS (per test futuri)
if(typeof module !== 'undefined' && module.exports){
  module.exports = { spuntaInit, renderSpuntaList };
}
// Espongo le funzioni onclick sul global
if(typeof window !== 'undefined'){
  window.spuntaHandleFotoBordero = spuntaHandleFotoBordero;
  window.spuntaOnFotoSelected = spuntaOnFotoSelected;
  window.spuntaAggiungiRigaManuale = spuntaAggiungiRigaManuale;
  window.spuntaReset = spuntaReset;
  window.spuntaOnSearchInput = spuntaOnSearchInput;
  window.spuntaConfermaMatch = spuntaConfermaMatch;
  window.spuntaScanEtichetta = spuntaScanEtichetta;
  window.spuntaToggleFilter = spuntaToggleFilter;
  window.spuntaMostraReport = spuntaMostraReport;
  window.spuntaChiudi = spuntaChiudi;
  window.spuntaSalvaSuFirebase = spuntaSalvaSuFirebase;
  window.spuntaChiudiPopup = spuntaChiudiPopup;
  window.renderSpuntaList = renderSpuntaList;
  window.spuntaInit = spuntaInit;
}
