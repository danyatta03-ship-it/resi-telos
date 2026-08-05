// js/domain/rules.js — regole di dominio pure (nessun DOM, nessun IO).
//
// Fonte unica di verità per le regole di business Resi Telos.
// Ogni funzione riceve TUTTO ciò di cui ha bisogno come argomento
// (record + config + garanzieDb + role): niente accesso a globali.
// Questo le rende testabili con `node --test` senza JSDOM.
//
// Estratto da index.html:
//   - canEditRow, canAdv, canBack (linee ~2894-2912)
//   - checkForzaNonRendibile     (linee ~2919-2951)
//   - parseGiorniReso            (linee ~4468-4478)
//
// ATTENZIONE: NON ancora incluso da index.html. Serve alla Fase 2
// del refactor per garantire un'implementazione delle regole COERENTE
// tra addRow / svEdit / advFase (che oggi la duplicano).
'use strict';

var cfg = (typeof require === 'function') ? require('../core/config.js') : window;
var NEXT_FASE   = cfg.NEXT_FASE;
var PREV_FASE   = cfg.PREV_FASE;
var ROLE_PERMS  = cfg.ROLE_PERMS;

// ── Permessi ────────────────────────────────────────────────────────

// Può modificare i CAMPI di una riga?
// - record STORICO (_frozen): solo UFF e ADM
// - altrimenti la fase del record deve essere fra canEditFasi del ruolo
function canEditRow(r, role){
  var p = ROLE_PERMS[role] || ROLE_PERMS['RIC'];
  if(!r || !r.fase) return false;
  if(r._frozen) return (role === 'UFF' || role === 'ADM');
  return (p.canEditFasi || []).indexOf(r.fase) >= 0;
}

// Avanzamento: ritorna la prossima fase se il ruolo può portarcela, '' altrimenti
function canAdv(r, role){
  if(!r) return '';
  var nf = NEXT_FASE[r.fase];
  var p = ROLE_PERMS[role] || {};
  return (nf && (p.canAdvanceTo || []).indexOf(nf) >= 0) ? nf : '';
}

// Rimando indietro: ritorna la fase precedente se consentito, '' altrimenti
// Regola aggiuntiva: da UFFICIO RESI a RICEVIMENTO solo ADM
function canBack(r, role){
  if(!r) return '';
  var pf = PREV_FASE[r.fase]; if(!pf) return '';
  var p = ROLE_PERMS[role] || {}; if(!p.canSendBack) return '';
  if(r.fase === 'UFFICIO RESI' && pf === 'RICEVIMENTO' && role !== 'ADM') return '';
  return pf;
}

// ── Parsing giorni-reso fornitore ("48 H" → 2, "10" → 10) ───────────
function parseGiorniReso(g){
  if(!g && g !== 0) return null;
  var s = String(g).trim().toUpperCase();
  if(!s) return null;
  var mH = s.match(/^(\d+)\s*H$/);
  if(mH) return Math.max(1, Math.round(parseInt(mH[1], 10) / 24));
  var mN = s.match(/^\d+$/);
  if(mN) return parseInt(s, 10);
  return null;
}

// ── Forza NON RENDIBILE (regole automatiche fornitore) ──────────────
// Ritorna null se rendibile, altrimenti { motivo, why }.
// Il chiamante deve poi forzare fase=FINALE, stato='NON RENDIBILE', motivoNR=motivo.
//
// Firma dependency-injection: passa garanzieDb come secondo arg.
// garanzieDb: mappa nomeFornitore(UPPER) → { valoreMin, giorni }
// La lookup è case-insensitive: usiamo direttamente ctx.forn UPPER.
function checkForzaNonRendibile(ctx, garanzieDb, nowMs){
  if(!ctx) return null;
  var forn = String(ctx.forn || '').trim();
  if(!forn) return null;
  if(!garanzieDb) return null;
  var g = garanzieDb[forn.toUpperCase()] || garanzieDb[forn] || null;
  if(!g) return null;

  // 1) PREZZO INFERIORE al minimo del fornitore
  var prc  = parseFloat(ctx.prc);
  var vmin = parseFloat(g.valoreMin);
  if(isFinite(prc) && isFinite(vmin) && vmin > 0 && prc > 0 && prc < vmin){
    return {
      motivo: 'PREZZO INFERIORE',
      why: 'prezzo €' + prc.toFixed(2) + ' inferiore al minimo €' + vmin.toFixed(2) + ' del fornitore ' + forn
    };
  }

  // 2) FUORI TEMPISTICHE (richiede datAcqForn + giorni_reso)
  var gg = parseGiorniReso(g.giorni);
  var dAcq = String(ctx.datAcqForn || '').trim();
  if(gg && gg > 0 && dAcq){
    var acq = new Date(dAcq + 'T00:00:00');
    if(!isNaN(acq.getTime())){
      var now = new Date(nowMs || Date.now()); now.setHours(0, 0, 0, 0);
      var pas = Math.floor((now - acq) / 86400000);
      if(pas > gg){
        return {
          motivo: 'FUORI TEMPISTICHE',
          why: 'acquisto del ' + dAcq + ' (' + pas + ' gg fa) oltre i ' + gg + ' gg ammessi da ' + forn
        };
      }
    }
  }

  return null;
}

// ── Anti-duplicato: esiste già una riga con stesso cod + forn attive? ─
// activeRows: array di record già presenti nel sistema (non archiviati).
// Ritorna il primo match trovato o null.
function findDuplicate(newRow, activeRows){
  if(!newRow || !newRow.cod) return null;
  var cod = String(newRow.cod).trim().toUpperCase();
  var forn = String(newRow.forn || '').trim().toUpperCase();
  if(!cod) return null;
  for(var i = 0; i < (activeRows || []).length; i++){
    var r = activeRows[i]; if(!r) continue;
    if(r.fase === 'FINALE') continue; // pratiche chiuse non contano
    var rCod = String(r.cod || '').trim().toUpperCase();
    var rForn = String(r.forn || '').trim().toUpperCase();
    if(rCod && rCod === cod && rForn === forn) return r;
  }
  return null;
}

// ── Coerenza flusso ↔ documento ─────────────────────────────────────
// Flusso 'ANOMALIA' non è compatibile con stato 'DA GESTIRE' in ricevimento
// (regola v34v). Ritorna null se OK, {err, why} se incoerente.
function checkCoerenzaFlusso(r){
  if(!r) return null;
  var flu = String(r.flusso || '').toUpperCase();
  var st  = String(r.stato  || '').toUpperCase();
  var fase = String(r.fase  || '').toUpperCase();
  if(fase === 'RICEVIMENTO' && flu === 'ANOMALIA' && st.indexOf('DA GESTIRE') === 0){
    return {
      err: 'FLUSSO_INCOERENTE',
      why: "Flusso ANOMALIA non compatibile con 'DA GESTIRE' in RICEVIMENTO"
    };
  }
  return null;
}

// ── Export ──────────────────────────────────────────────────────────
if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    canEditRow, canAdv, canBack,
    parseGiorniReso,
    checkForzaNonRendibile,
    findDuplicate,
    checkCoerenzaFlusso
  };
}
if(typeof window !== 'undefined'){
  window._rules = {
    canEditRow, canAdv, canBack,
    parseGiorniReso,
    checkForzaNonRendibile,
    findDuplicate,
    checkCoerenzaFlusso
  };
}
