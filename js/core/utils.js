// js/core/utils.js — funzioni helper pure (no side effect esterni).
//
// Estratto da index.html (linee ~2201-2642 + ~12152-12227).
//
// ATTENZIONE — file in refactor foundation:
//   - non ancora incluso da index.html (produzione usa ancora le fn inline)
//   - le funzioni sono esposte anche su window.* per retro-compat futuro
//     (l'app originale usa onclick inline che richiedono globali)
'use strict';

// ── HTML escape (evita XSS nelle celle tabella) ─────────────────────
function xe(v){
  return String(v==null?'':v)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Format data ISO (YYYY-MM-DD o YYYY-MM-DDTHH:MM) → DD/MM/YYYY ────
function fd(iso){
  if(!iso) return '';
  var s = String(iso);
  if(s.indexOf('T') > 0) s = s.slice(0,10);
  return s.split('-').reverse().join('/');
}

// ── Timestamp → DD/MM/YYYY (default: now) ───────────────────────────
function _fmtDDMMYYYY(ts){
  var d = new Date(ts || Date.now());
  return ('0'+d.getDate()).slice(-2) + '/' +
         ('0'+(d.getMonth()+1)).slice(-2) + '/' +
         d.getFullYear();
}

// ── Parsing prezzo (accetta virgola o punto) ────────────────────────
function nprc(v){
  if(typeof v === 'number') return isFinite(v) ? v : 0;
  if(v == null || v === '') return 0;
  var n = parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : 0;
}

// ── Format euro (vuoto se ≤ 0) ──────────────────────────────────────
function eur(v){
  var n = nprc(v);
  return n > 0 ? '€' + n.toFixed(2) : '';
}

// ── Aggiunge N giorni lavorativi (lun-ven) a una data ───────────────
function addBusinessDays(date, n){
  var d = new Date(date);
  var added = 0;
  while(added < n){
    d.setDate(d.getDate() + 1);
    var day = d.getDay();
    if(day !== 0 && day !== 6) added++;
  }
  return d;
}

// ── DOM helpers (richiedono window/document, sicuri in Node solo se guardati) ─
function gv(id){
  if(typeof document === 'undefined') return '';
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function ce(el){ if(el && el.classList) el.classList.remove('err'); }
function uv(el){ if(el) el.value = String(el.value||'').toUpperCase(); }

// ── Esporto per CommonJS (tests) e window (browser) ─────────────────
if(typeof module !== 'undefined' && module.exports){
  module.exports = { xe, fd, _fmtDDMMYYYY, nprc, eur, addBusinessDays, gv, ce, uv };
}
if(typeof window !== 'undefined'){
  window.xe = xe;
  window.fd = fd;
  window._fmtDDMMYYYY = _fmtDDMMYYYY;
  window.nprc = nprc;
  window.eur = eur;
  window.addBusinessDays = addBusinessDays;
  window.gv = gv;
  window.ce = ce;
  window.uv = uv;
}
