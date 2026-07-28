/* ═══════════════════════════════════════════════════════════════════════
 *  WHITE-LABEL APP — logica principale
 *  ─────────────────────────────────────────────────────────────────────
 *  - State: window.STATE (user, records, view)
 *  - Storage: localStorage per record + config
 *  - Viste: dashboard, records, add, admin, record
 *  - Admin: editor completo di brand + app config con "+" per aggiungere
 *
 *  Dipende da brand-loader.js che espone window.BRAND, window.APP, window.WL
 * ═══════════════════════════════════════════════════════════════════════ */
'use strict';

// ═══ STATE GLOBALE ═══════════════════════════════════════════════════════
var STATE = {
  user: null,                      // {name, roleId, roleName}
  records: [],                     // caricati da localStorage
  currentView: 'dashboard',
  currentRecord: null,             // id del record aperto in dettaglio
  filter: { q:'', phase:'', priority:'' }
};

// ═══ UTIL ════════════════════════════════════════════════════════════════
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function xe(s) {
  return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function uid(prefix) { return (prefix||'') + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function fmtDate(d) { if(!d) return ''; try { return new Date(d).toLocaleDateString('it-IT'); } catch(e){ return d; } }
function fmtDateTime(d) { if(!d) return ''; try { return new Date(d).toLocaleString('it-IT'); } catch(e){ return d; } }

// SHA-256 per il PIN admin (via Web Crypto)
function sha256(txt){
  if(!(window.crypto && window.crypto.subtle)) return Promise.resolve('');
  var buf = new TextEncoder().encode(String(txt||''));
  return crypto.subtle.digest('SHA-256', buf).then(function(hash){
    var b = new Uint8Array(hash), hex = '';
    for(var i=0;i<b.length;i++) hex += ('00'+b[i].toString(16)).slice(-2);
    return hex;
  });
}

// ═══ TOAST ═══════════════════════════════════════════════════════════════
function toast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast' + (type ? ' '+type : '');
  el.textContent = msg;
  $('#toastArea').appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; setTimeout(function(){ el.remove(); }, 300); },
             (window.APP && APP.notifications && APP.notifications.toastDurationMs) || 3000);
}

// ═══ MODAL ═══════════════════════════════════════════════════════════════
function openModal(title, contentHtml, onReady) {
  closeModal();
  var wrap = document.createElement('div');
  wrap.className = 'modal-bg';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-h">' +
        '<h3>' + xe(title) + '</h3>' +
        '<button class="modal-x" onclick="closeModal()">✕</button>' +
      '</div>' +
      '<div id="modalBody">' + contentHtml + '</div>' +
    '</div>';
  wrap.addEventListener('click', function(e){ if(e.target === wrap) closeModal(); });
  $('#modalRoot').appendChild(wrap);
  if(onReady) onReady();
}
function closeModal() { var m = $('.modal-bg'); if(m) m.remove(); }

// ═══ CONFIRM ═════════════════════════════════════════════════════════════
function confirmModal(msg, onOk) {
  openModal('Conferma',
    '<p style="font-size:13px;margin-bottom:18px;color:var(--wl-text2)">' + xe(msg) + '</p>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn ghost" onclick="closeModal()">Annulla</button>' +
      '<button class="btn danger" id="cfmOk">Conferma</button>' +
    '</div>',
    function(){ $('#cfmOk').onclick = function(){ closeModal(); onOk(); }; });
}

// ═══ STORAGE ═════════════════════════════════════════════════════════════
function loadRecords() {
  try { STATE.records = JSON.parse(localStorage.getItem('wl-records') || '[]'); }
  catch(e) { STATE.records = []; }
}
function saveRecords() {
  try { localStorage.setItem('wl-records', JSON.stringify(STATE.records)); }
  catch(e) { toast('Errore salvataggio: spazio esaurito', 'danger'); }
}

// ═══ LOGIN ═══════════════════════════════════════════════════════════════
document.addEventListener('wl:ready', function(){
  renderLoginRoles();
  // Auto-login se c'e' sessione salvata
  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('wl-user') || 'null'); } catch(e){}
  if(saved && saved.name && saved.roleId) {
    STATE.user = saved;
    startApp();
  }
});

function renderLoginRoles() {
  var grid = $('#roleGrid');
  if(!grid) return;
  var roles = (window.APP && APP.roles) || [];
  grid.innerHTML = roles.map(function(r, i){
    return '<div class="role-btn" data-role="'+xe(r.id)+'" onclick="pickRole(\''+xe(r.id)+'\')">'+
             '<div class="role-ic">'+xe(r.icon||'👤')+'</div>'+
             '<div class="role-nm">'+xe(r.name)+'</div>'+
           '</div>';
  }).join('');
}

var _selectedRole = null;
function pickRole(id) {
  _selectedRole = id;
  $$('.role-btn').forEach(function(b){ b.classList.toggle('on', b.dataset.role === id); });
}

function doLogin() {
  var name = $('#loginName').value.trim();
  if(!name) { toast('Inserisci il tuo nome', 'danger'); return; }

  // PIN admin: se il "nome" corrisponde all'hash SHA-256 del pinHash, apri admin diretto
  sha256(name).then(function(h){
    var pinHash = (window.APP && APP.admin && APP.admin.pinHash) || '';
    if(h === pinHash) {
      STATE.user = { name:'ADMIN', roleId:'ADMIN', roleName:'Amministratore', icon:'🔑' };
      try { sessionStorage.setItem('wl-user', JSON.stringify(STATE.user)); } catch(e){}
      startApp();
      showView('admin');
      return;
    }
    if(!_selectedRole) { toast('Seleziona un ruolo', 'danger'); return; }
    var role = ((APP.roles||[]).filter(function(r){ return r.id === _selectedRole; })[0]) || null;
    if(!role) { toast('Ruolo non trovato', 'danger'); return; }
    STATE.user = { name: name, roleId: role.id, roleName: role.name, icon: role.icon || '👤' };
    try { sessionStorage.setItem('wl-user', JSON.stringify(STATE.user)); } catch(e){}
    startApp();
  });
}

function doLogout() {
  try { sessionStorage.removeItem('wl-user'); } catch(e){}
  STATE.user = null;
  $('#app').classList.add('hidden');
  $('#loginScreen').style.display = 'flex';
}

function startApp() {
  $('#loginScreen').style.display = 'none';
  $('#app').classList.remove('hidden');
  loadRecords();
  renderHeader();
  showView('dashboard');
}

function renderHeader() {
  if(!STATE.user) return;
  $('#hdrUserName').textContent = STATE.user.name;
  $('#hdrUserRole').textContent = STATE.user.roleName || '—';
}

function showUserMenu() {
  openModal('Utente',
    '<div style="text-align:center;margin-bottom:16px">' +
      '<div style="font-size:32px">' + xe(STATE.user.icon||'👤') + '</div>' +
      '<div style="font-size:15px;font-weight:700;margin-top:6px">' + xe(STATE.user.name) + '</div>' +
      '<div style="font-size:11px;color:var(--wl-text3);margin-top:2px">' + xe(STATE.user.roleName||'') + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;justify-content:center">' +
      '<button class="btn ghost" onclick="closeModal()">Chiudi</button>' +
      '<button class="btn danger" onclick="closeModal();doLogout()">🚪 Esci</button>' +
    '</div>');
}

// ═══ VIEWS ═══════════════════════════════════════════════════════════════
function showView(name) {
  STATE.currentView = name;
  $$('.nav-item').forEach(function(el){ el.classList.toggle('on', el.dataset.view === name); });
  $$('.view').forEach(function(v){ v.classList.add('hidden'); });
  var target = $('#view' + name.charAt(0).toUpperCase() + name.slice(1));
  if(target) target.classList.remove('hidden');
  var titles = { dashboard:'Dashboard', records:(APP.entity&&APP.entity.plural)||'Record', add:'Nuovo', admin:'Configurazione', record:'Dettaglio' };
  $('#hdrTitle').textContent = titles[name] || name;

  if(name === 'dashboard') renderDashboard();
  else if(name === 'records') renderRecords();
  else if(name === 'add') renderAddForm();
  else if(name === 'admin') renderAdmin();
}

// ═══ DASHBOARD ═══════════════════════════════════════════════════════════
function renderDashboard() {
  var v = $('#viewDashboard');
  var widgets = ((APP.dashboard && APP.dashboard.widgets) || []).filter(function(w){ return w.enabled !== false; });

  if(!widgets.length) {
    v.innerHTML = emptyState('📊', 'Dashboard vuota',
      'Aggiungi widget dalla configurazione admin.',
      '<button class="btn" onclick="showView(\'admin\');setTimeout(function(){ admGo(\'dashboard\'); },50)">⚙️ Configura dashboard</button>');
    return;
  }

  var recs = STATE.records;
  var html = '<div class="dash-grid" style="margin-bottom:18px">';
  widgets.filter(function(w){ return w.type === 'counter'; }).forEach(function(w){
    var n = recs.filter(function(r){ return matchFilter(r, w.filter||{}); }).length;
    html += '<div class="stat-card" onclick="jumpToRecords('+JSON.stringify(w.filter||{}).replace(/"/g,'&quot;')+')" style="cursor:pointer">' +
              '<div class="n">' + n + '</div>' +
              '<div class="l">' + xe(w.title) + '</div>' +
            '</div>';
  });
  html += '</div>';

  // Chart widgets: barre semplici (no libreria esterna)
  widgets.filter(function(w){ return w.type === 'chart'; }).forEach(function(w){
    var groups = {};
    recs.forEach(function(r){
      var key = r[w.groupBy] || '—';
      if(w.groupBy === 'phase') {
        var ph = (APP.phases||[]).filter(function(p){ return p.id === key; })[0];
        key = ph ? ph.name : key;
      }
      groups[key] = (groups[key]||0) + 1;
    });
    var keys = Object.keys(groups);
    var max = Math.max.apply(null, keys.length ? keys.map(function(k){ return groups[k]; }) : [1]);
    html += '<div class="card">' +
              '<div class="card-h">' + xe(w.title) + '</div>';
    if(!keys.length) {
      html += '<div style="color:var(--wl-text3);font-size:12px;text-align:center;padding:20px">Nessun dato</div>';
    } else {
      keys.forEach(function(k){
        var pct = Math.round(groups[k]/max*100);
        html += '<div style="margin-bottom:8px">' +
                  '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">' +
                    '<span>' + xe(k) + '</span>' +
                    '<span style="color:var(--wl-text3)">' + groups[k] + '</span>' +
                  '</div>' +
                  '<div style="height:8px;background:var(--wl-bg2);border-radius:4px;overflow:hidden">' +
                    '<div style="height:100%;width:'+pct+'%;background:var(--wl-primary)"></div>' +
                  '</div>' +
                '</div>';
      });
    }
    html += '</div>';
  });

  // Recent list
  widgets.filter(function(w){ return w.type === 'list'; }).forEach(function(w){
    var limit = w.limit || 5;
    var sorted = recs.slice().sort(function(a,b){ return (b._ts||0) - (a._ts||0); }).slice(0, limit);
    html += '<div class="card"><div class="card-h">' + xe(w.title) + '</div>';
    if(!sorted.length) {
      html += '<div style="color:var(--wl-text3);font-size:12px;text-align:center;padding:20px">Nessun ' + xe((APP.entity&&APP.entity.singular)||'record').toLowerCase() + '</div>';
    } else {
      html += '<div>';
      sorted.forEach(function(r){
        var ph = (APP.phases||[]).filter(function(p){ return p.id === r.phase; })[0];
        var title = r.title || r[Object.keys(r)[0]] || '—';
        html += '<div class="list-item" onclick="openRecord(\''+xe(r.id)+'\')" style="cursor:pointer">' +
                  '<div class="li-ic">' + xe((ph&&ph.icon)||'📄') + '</div>' +
                  '<div class="li-body">' +
                    '<div class="li-title">' + xe(title) + '</div>' +
                    '<div class="li-sub">' + xe(r.id) + (ph ? ' · ' + xe(ph.name) : '') + '</div>' +
                  '</div>' +
                '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
  });

  v.innerHTML = html;
}

function matchFilter(rec, f) {
  if(!f) return true;
  if(f.phase && rec.phase !== f.phase) return false;
  if(f.phaseNot && rec.phase === f.phaseNot) return false;
  if(f.overdue) {
    if(!rec.dueDate) return false;
    if(new Date(rec.dueDate) >= new Date()) return false;
    if(rec.phase === 'closed') return false;
  }
  return true;
}

function jumpToRecords(filter) {
  STATE.filter = { q:'', phase: filter.phase || '', priority: '' };
  showView('records');
}

// ═══ RECORDS LIST ════════════════════════════════════════════════════════
function renderRecords() {
  var v = $('#viewRecords');
  var recs = STATE.records.slice();

  // Filtri
  if(STATE.filter.phase) recs = recs.filter(function(r){ return r.phase === STATE.filter.phase; });
  if(STATE.filter.q) {
    var q = STATE.filter.q.toLowerCase();
    recs = recs.filter(function(r){
      return Object.keys(r).some(function(k){
        return String(r[k]||'').toLowerCase().indexOf(q) >= 0;
      });
    });
  }
  recs.sort(function(a,b){ return (b._ts||0) - (a._ts||0); });

  var perms = getPerms();
  var listCols = (APP.fields||[]).filter(function(f){ return f.showInList; });

  var html =
    '<div class="card">' +
      '<div class="card-h">' +
        '<span>' + (APP.entity&&APP.entity.plural||'Record') + ' (' + recs.length + ')</span>' +
        '<div class="actions">' +
          (perms.canAdd ? '<button class="btn sm" onclick="showView(\'add\')">➕ Nuovo</button>' : '') +
        '</div>' +
      '</div>' +

      '<div class="field-row" style="margin-bottom:12px">' +
        '<input class="field-inp" oninput="filterList(\'q\', this.value)" value="'+xe(STATE.filter.q)+'" placeholder="🔍 Cerca..." style="background:var(--wl-bg2);color:var(--wl-text);border:1px solid var(--wl-border2);border-radius:var(--wl-rad-sm);padding:9px 11px;font-size:13px;outline:none;font-family:inherit">' +
        '<select onchange="filterList(\'phase\', this.value)" style="background:var(--wl-bg2);color:var(--wl-text);border:1px solid var(--wl-border2);border-radius:var(--wl-rad-sm);padding:9px 11px;font-size:13px;outline:none;font-family:inherit;-webkit-appearance:none">' +
          '<option value="">Tutte le fasi</option>' +
          (APP.phases||[]).map(function(p){
            return '<option value="'+xe(p.id)+'"'+(STATE.filter.phase===p.id?' selected':'')+'>'+xe(p.icon||'')+' '+xe(p.name)+'</option>';
          }).join('') +
        '</select>' +
      '</div>';

  if(!recs.length) {
    html += emptyState((APP.entity&&APP.entity.iconEmoji)||'📋',
      'Nessun ' + ((APP.entity&&APP.entity.singular)||'record').toLowerCase(),
      'Aggiungi il primo ' + ((APP.entity&&APP.entity.singular)||'record').toLowerCase() + ' per iniziare.',
      perms.canAdd ? '<button class="btn" onclick="showView(\'add\')">➕ Nuovo</button>' : '');
  } else {
    html += '<div class="tbl-scroll"><table class="tbl">' +
              '<thead><tr>' +
                '<th>ID</th>' +
                '<th>Fase</th>' +
                listCols.map(function(f){ return '<th>' + xe(f.label) + '</th>'; }).join('') +
                '<th></th>' +
              '</tr></thead>' +
              '<tbody>';
    recs.forEach(function(r){
      var ph = (APP.phases||[]).filter(function(p){ return p.id === r.phase; })[0];
      html += '<tr onclick="openRecord(\''+xe(r.id)+'\')" style="cursor:pointer">' +
                '<td><b>' + xe(r.id) + '</b></td>' +
                '<td>' + (ph ? '<span class="chip" style="background:'+xe(ph.color||'#333')+'22;color:'+xe(ph.color||'#fff')+';border-color:'+xe(ph.color||'#333')+'44">'+xe(ph.icon||'')+' '+xe(ph.name)+'</span>' : '—') + '</td>' +
                listCols.map(function(f){
                  var val = r[f.key];
                  if(f.type === 'date') val = fmtDate(val);
                  return '<td>' + xe(val||'') + '</td>';
                }).join('') +
                '<td>' + (perms.canDelete ? '<button class="btn ghost sm" onclick="event.stopPropagation();deleteRecord(\''+xe(r.id)+'\')">🗑</button>' : '') + '</td>' +
              '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';
  v.innerHTML = html;
}

function filterList(k, v) {
  STATE.filter[k] = v;
  renderRecords();
}

function deleteRecord(id) {
  if(!getPerms().canDelete) { toast('Non autorizzato', 'danger'); return; }
  confirmModal('Eliminare definitivamente questo record?', function(){
    STATE.records = STATE.records.filter(function(r){ return r.id !== id; });
    saveRecords();
    renderRecords();
    toast('Record eliminato', 'success');
  });
}

// ═══ ADD / EDIT RECORD ═══════════════════════════════════════════════════
function renderAddForm(editRec) {
  var v = $('#viewAdd');
  var fields = APP.fields || [];
  var phases = APP.phases || [];
  var isEdit = !!editRec;
  var rec = editRec || {};

  var html = '<div class="card">' +
    '<div class="card-h">' + (isEdit ? '✎ Modifica record' : '➕ Nuovo ' + ((APP.entity&&APP.entity.singular)||'record').toLowerCase()) + '</div>';

  fields.forEach(function(f){
    html += '<div class="field">' +
              '<label>' + xe(f.label) + (f.required?' <span style="color:var(--wl-danger)">*</span>':'') + '</label>';
    if(f.type === 'select' && Array.isArray(f.options)) {
      html += '<select id="fld-'+xe(f.key)+'">' +
                '<option value="">—</option>' +
                f.options.map(function(o){
                  return '<option'+(rec[f.key]===o?' selected':'')+'>'+xe(o)+'</option>';
                }).join('') +
              '</select>';
    } else if(f.type === 'textarea') {
      html += '<textarea id="fld-'+xe(f.key)+'">'+xe(rec[f.key]||'')+'</textarea>';
    } else if(f.type === 'date') {
      html += '<input id="fld-'+xe(f.key)+'" type="date" value="'+xe(rec[f.key]||'')+'">';
    } else if(f.type === 'number') {
      html += '<input id="fld-'+xe(f.key)+'" type="number" step="0.01" value="'+xe(rec[f.key]||'')+'">';
    } else {
      html += '<input id="fld-'+xe(f.key)+'" type="text" value="'+xe(rec[f.key]||'')+'">';
    }
    html += '</div>';
  });

  html += '<div class="field">' +
            '<label>Fase iniziale</label>' +
            '<select id="fld-phase">' +
              phases.map(function(p){
                var sel = (isEdit ? rec.phase===p.id : p.order===1) ? ' selected' : '';
                return '<option value="'+xe(p.id)+'"'+sel+'>'+xe(p.icon||'')+' '+xe(p.name)+'</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end">' +
            '<button class="btn ghost" onclick="showView(\'records\')">Annulla</button>' +
            '<button class="btn success" onclick="saveRecord('+(isEdit?"'"+xe(rec.id)+"'":'null')+')">💾 Salva</button>' +
          '</div>' +
        '</div>';

  v.innerHTML = html;
}

function saveRecord(editId) {
  var perms = getPerms();
  if(editId ? !perms.canEdit : !perms.canAdd) { toast('Non autorizzato', 'danger'); return; }

  var fields = APP.fields || [];
  var rec = editId ? (STATE.records.filter(function(r){ return r.id===editId; })[0] || {}) : {};
  var errors = [];

  fields.forEach(function(f){
    var el = $('#fld-'+f.key);
    var val = el ? el.value.trim() : '';
    if(f.required && !val) errors.push(f.label);
    rec[f.key] = val;
  });

  if(errors.length) { toast('Campi obbligatori: ' + errors.join(', '), 'danger'); return; }

  var phaseEl = $('#fld-phase');
  rec.phase = phaseEl ? phaseEl.value : (APP.phases[0]&&APP.phases[0].id);
  rec._ts = rec._ts || Date.now();
  rec._who = rec._who || (STATE.user && STATE.user.name);

  if(!editId) {
    var pref = (APP.entity && APP.entity.idPrefix) || 'REC-';
    rec.id = pref + (STATE.records.length + 1).toString().padStart(4, '0');
    STATE.records.push(rec);
    toast(rec.id + ' creato', 'success');
  } else {
    toast(rec.id + ' aggiornato', 'success');
  }
  saveRecords();
  showView('records');
}

function openRecord(id) {
  var rec = STATE.records.filter(function(r){ return r.id === id; })[0];
  if(!rec) { toast('Record non trovato', 'danger'); return; }
  STATE.currentRecord = id;
  renderRecordDetail(rec);
  showView('record');
}

function renderRecordDetail(rec) {
  var v = $('#viewRecord');
  var perms = getPerms();
  var phase = (APP.phases||[]).filter(function(p){ return p.id === rec.phase; })[0];
  var currStates = (APP.states||{})[rec.phase] || [];

  var html = '<div class="card">' +
    '<div class="card-h">' +
      '<span>' + xe(rec.id) + '</span>' +
      '<div class="actions">' +
        '<button class="btn ghost sm" onclick="showView(\'records\')">← Torna</button>' +
        (perms.canEdit ? '<button class="btn sm" onclick="renderAddForm('+JSON.stringify(rec).replace(/"/g,'&quot;')+');showView(\'add\')">✎ Modifica</button>' : '') +
      '</div>' +
    '</div>';

  html += '<div style="margin-bottom:14px">' +
    (phase ? '<span class="chip" style="background:'+xe(phase.color||'#333')+'22;color:'+xe(phase.color||'#fff')+';border-color:'+xe(phase.color||'#333')+'">'+xe(phase.icon||'')+' '+xe(phase.name)+'</span>' : '') +
    (rec.stato ? '<span class="chip" style="margin-left:6px">'+xe(rec.stato)+'</span>' : '') +
    '</div>';

  (APP.fields||[]).forEach(function(f){
    if(rec[f.key]) {
      var val = f.type === 'date' ? fmtDate(rec[f.key]) : rec[f.key];
      html += '<div class="field"><label>'+xe(f.label)+'</label><div style="padding:6px 0;font-size:13px">'+xe(val)+'</div></div>';
    }
  });

  // Fase successive (avanzamento)
  var idx = (APP.phases||[]).findIndex(function(p){ return p.id === rec.phase; });
  var nextPhase = (APP.phases||[])[idx+1];
  if(nextPhase && (perms.canAdvancePhases||[]).indexOf(nextPhase.id) >= 0) {
    html += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--wl-border)">' +
              '<button class="btn success" onclick="advancePhase(\''+xe(rec.id)+'\',\''+xe(nextPhase.id)+'\')">' +
                '→ Avanza a ' + xe(nextPhase.icon||'') + ' ' + xe(nextPhase.name) +
              '</button>' +
            '</div>';
  }

  // Cambio stato manuale
  if(currStates.length && perms.canEdit) {
    html += '<div style="margin-top:12px">' +
              '<label style="font-size:11px;color:var(--wl-text3);letter-spacing:.3px">Cambia stato</label>' +
              '<select onchange="changeState(\''+xe(rec.id)+'\',this.value)" style="width:100%;background:var(--wl-bg2);color:var(--wl-text);border:1px solid var(--wl-border2);border-radius:var(--wl-rad-sm);padding:9px 11px;font-size:13px;outline:none;font-family:inherit;-webkit-appearance:none;margin-top:4px">' +
                '<option value="">— seleziona —</option>' +
                currStates.map(function(s){ return '<option'+(rec.stato===s?' selected':'')+'>'+xe(s)+'</option>'; }).join('') +
              '</select>' +
            '</div>';
  }

  html += '<div style="margin-top:14px;font-size:10px;color:var(--wl-text3)">' +
    'Creato: ' + fmtDateTime(rec._ts) + (rec._who?' · da '+xe(rec._who):'') +
    '</div>';

  html += '</div>';
  v.innerHTML = html;
}

function advancePhase(id, nextPhaseId) {
  var rec = STATE.records.filter(function(r){ return r.id === id; })[0];
  if(!rec) return;
  rec.phase = nextPhaseId;
  rec.stato = ((APP.states||{})[nextPhaseId]||[])[0] || '';
  rec._lastChange = Date.now();
  saveRecords();
  renderRecordDetail(rec);
  toast('→ ' + nextPhaseId, 'success');
}

function changeState(id, state) {
  if(!state) return;
  var rec = STATE.records.filter(function(r){ return r.id === id; })[0];
  if(!rec) return;
  rec.stato = state;
  rec._lastChange = Date.now();
  saveRecords();
  toast('Stato: ' + state, 'success');
}

// ═══ PERMISSIONS ═════════════════════════════════════════════════════════
function getPerms() {
  if(!STATE.user) return {};
  var role = (APP.roles||[]).filter(function(r){ return r.id === STATE.user.roleId; })[0];
  return (role && role.permissions) || {};
}

// ═══ EMPTY STATE HELPER ══════════════════════════════════════════════════
function emptyState(icon, title, subtitle, btnHtml) {
  return '<div class="empty">' +
           '<div class="icon">' + xe(icon) + '</div>' +
           '<h4>' + xe(title) + '</h4>' +
           '<p>' + xe(subtitle) + '</p>' +
           (btnHtml||'') +
         '</div>';
}

// ═══ ADMIN PANEL ═════════════════════════════════════════════════════════
// Definito in file separato per chiarezza: admin.js
