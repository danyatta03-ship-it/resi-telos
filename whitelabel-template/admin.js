/* ═══════════════════════════════════════════════════════════════════════
 *  ADMIN PANEL — configurazione completa dell'app
 *  ─────────────────────────────────────────────────────────────────────
 *  Ogni sezione permette di aggiungere/modificare/eliminare gli elementi
 *  della configurazione (fasi, stati, ruoli, campi, moduli, branding,
 *  template email). Le modifiche salvano in localStorage e vengono
 *  applicate live via WL.saveBrand / WL.saveApp.
 * ═══════════════════════════════════════════════════════════════════════ */

var ADM_SEC = 'branding';

function renderAdmin() {
  if(STATE.user && STATE.user.roleId !== 'ADMIN') {
    $('#viewAdmin').innerHTML = emptyState('🔒', 'Accesso negato',
      'Solo gli amministratori possono accedere alla configurazione.', '');
    return;
  }

  var sections = [
    { id:'branding',  ic:'🎨', label:'Branding' },
    { id:'colors',    ic:'🎨', label:'Colori' },
    { id:'entity',    ic:'📋', label:'Entita\'' },
    { id:'phases',    ic:'🔄', label:'Fasi' },
    { id:'states',    ic:'🎯', label:'Stati' },
    { id:'roles',     ic:'👥', label:'Ruoli' },
    { id:'fields',    ic:'📝', label:'Campi' },
    { id:'dashboard', ic:'📊', label:'Dashboard' },
    { id:'modules',   ic:'🧩', label:'Moduli' },
    { id:'email',     ic:'✉️',  label:'Email' },
    { id:'company',   ic:'🏢', label:'Azienda' },
    { id:'config',    ic:'⚙️',  label:'Import / Export' }
  ];

  var nav = sections.map(function(s){
    return '<button data-adm-sec="'+s.id+'" class="btn '+ (ADM_SEC===s.id?'':'ghost') +' sm" onclick="admGo(\''+s.id+'\')">'+
             s.ic+' '+s.label+
           '</button>';
  }).join(' ');

  $('#viewAdmin').innerHTML =
    '<div class="card"><div style="display:flex;gap:6px;flex-wrap:wrap" id="admNav">' + nav + '</div></div>' +
    '<div id="admBody"></div>';

  admFillBody(ADM_SEC);
}

// admGo aggiorna solo lo stato della nav e ridisegna il body — non rifa
// tutto il layout (evita ricorsione con renderAdmin).
function admGo(sec) {
  ADM_SEC = sec;
  var buttons = document.querySelectorAll('#admNav [data-adm-sec]');
  for(var i=0;i<buttons.length;i++){
    var b = buttons[i];
    if(b.getAttribute('data-adm-sec') === sec) b.classList.remove('ghost');
    else b.classList.add('ghost');
  }
  admFillBody(sec);
}

function admFillBody(sec) {
  var body = $('#admBody');
  if(!body) return;
  var fn = window['admRender_' + sec];
  body.innerHTML = fn ? fn() : '<div class="card">Sezione in sviluppo.</div>';
  if(typeof window['admAfter_' + sec] === 'function') window['admAfter_' + sec]();
}

function admBrandField(path, label, type) {
  type = type || 'text';
  var val = deepGet(window.BRAND, path) || '';
  return '<div class="field">' +
           '<label>' + xe(label) + '</label>' +
           '<input type="'+type+'" data-brand-path="'+xe(path)+'" value="'+xe(val)+'" oninput="admSetBrand(this)">' +
         '</div>';
}
function admBrandTextarea(path, label) {
  var val = deepGet(window.BRAND, path) || '';
  return '<div class="field">' +
           '<label>' + xe(label) + '</label>' +
           '<textarea data-brand-path="'+xe(path)+'" oninput="admSetBrand(this)">'+xe(val)+'</textarea>' +
         '</div>';
}
function admSetBrand(el) {
  var path = el.getAttribute('data-brand-path');
  deepSet(window.BRAND, path, el.value);
  WL.saveBrand(window.BRAND);
}
function admSetApp(el) {
  var path = el.getAttribute('data-app-path');
  deepSet(window.APP, path, el.value);
  WL.saveApp(window.APP);
}

function deepGet(obj, path) {
  var cur = obj;
  path.split('.').forEach(function(k){ if(cur!=null) cur = cur[k]; });
  return cur;
}
function deepSet(obj, path, val) {
  var parts = path.split('.'), cur = obj;
  for(var i=0;i<parts.length-1;i++){
    if(cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length-1]] = val;
}

// ═══ BRANDING ═══════════════════════════════════════════════════════════
function admRender_branding() {
  return '<div class="card"><div class="card-h">Identita\' applicazione</div>' +
    admBrandField('app.name',        'Nome app') +
    admBrandField('app.shortName',   'Nome breve (PWA)') +
    admBrandField('app.subtitle',    'Sottotitolo') +
    admBrandField('app.description', 'Descrizione') +
    admBrandField('app.copyright',   'Copyright') +
    admBrandField('app.footerText',  'Testo footer') +
    '</div>' +

    '<div class="card"><div class="card-h">Logo</div>' +
    '<div class="field">' +
      '<label>Logo principale (data URL o path)</label>' +
      '<input type="text" data-brand-path="logo.main" value="'+xe(window.BRAND.logo.main||'')+'" oninput="admSetBrand(this)" placeholder="es. data:image/png;base64,... oppure logo.png">' +
      '<input type="file" accept="image/*" onchange="admLogoUpload(this,\'logo.main\')" style="margin-top:6px">' +
    '</div>' +
    (window.BRAND.logo.main ? '<img src="'+xe(window.BRAND.logo.main)+'" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid var(--wl-border);margin-top:8px">' : '') +
    '</div>';
}
function admLogoUpload(input, path) {
  var f = input.files && input.files[0];
  if(!f) return;
  if(f.size > 500 * 1024) { toast('Immagine troppo grande (max 500KB)', 'danger'); return; }
  var r = new FileReader();
  r.onload = function(e){
    deepSet(window.BRAND, path, e.target.result);
    WL.saveBrand(window.BRAND);
    admGo('branding');
    toast('Logo aggiornato', 'success');
  };
  r.readAsDataURL(f);
}

// ═══ COLORI ═════════════════════════════════════════════════════════════
function admRender_colors() {
  var colors = (window.BRAND.theme && window.BRAND.theme.colors) || {};
  var groups = [
    ['Brand',    [['primary','Primario'],['primaryDark','Primario scuro'],['secondary','Secondario'],['accent','Accent']]],
    ['Stato',    [['success','Successo'],['warning','Warning'],['danger','Errore'],['info','Info']]],
    ['Sfondo',   [['bg','Sfondo'],['bg1','Sfondo 1'],['bg2','Sfondo 2'],['bg3','Sfondo 3']]],
    ['Bordi',    [['border','Bordo'],['border2','Bordo 2']]],
    ['Testo',    [['text','Testo'],['text2','Testo 2'],['text3','Testo 3']]],
    ['Sidebar/Header', [['sidebar','Sidebar'],['sidebarText','Sidebar testo'],['header','Header'],['headerText','Header testo']]]
  ];

  var html = '';
  groups.forEach(function(g){
    html += '<div class="card"><div class="card-h">' + xe(g[0]) + '</div>';
    g[1].forEach(function(c){
      var key = c[0], label = c[1], val = colors[key] || '#000000';
      html += '<div class="field-row" style="grid-template-columns:120px 1fr auto;align-items:center;gap:10px;margin-bottom:10px">' +
                '<span style="font-size:11px;color:var(--wl-text2)">' + xe(label) + '</span>' +
                '<input type="text" data-brand-path="theme.colors.'+xe(key)+'" value="'+xe(val)+'" oninput="admSetBrand(this)" style="font-family:monospace">' +
                '<input type="color" value="'+xe(val)+'" onchange="document.querySelector(\'[data-brand-path=&quot;theme.colors.'+xe(key)+'&quot;]\').value=this.value;admSetBrand(document.querySelector(\'[data-brand-path=&quot;theme.colors.'+xe(key)+'&quot;]\'))" style="width:44px;height:32px;padding:0;border:1px solid var(--wl-border2);border-radius:4px;background:none;cursor:pointer">' +
              '</div>';
    });
    html += '</div>';
  });

  return html;
}

// ═══ ENTITA' ════════════════════════════════════════════════════════════
function admRender_entity() {
  var e = window.APP.entity || {};
  return '<div class="card"><div class="card-h">Definizione entita\' principale</div>' +
    '<div class="field"><label>Nome singolare (es. Pratica)</label>' +
      '<input value="'+xe(e.singular||'')+'" data-app-path="entity.singular" oninput="admSetApp(this)"></div>' +
    '<div class="field"><label>Nome plurale (es. Pratiche)</label>' +
      '<input value="'+xe(e.plural||'')+'" data-app-path="entity.plural" oninput="admSetApp(this)"></div>' +
    '<div class="field"><label>Emoji/icona (es. 📋)</label>' +
      '<input value="'+xe(e.iconEmoji||'')+'" data-app-path="entity.iconEmoji" oninput="admSetApp(this)"></div>' +
    '<div class="field"><label>Prefisso ID (es. PRT-)</label>' +
      '<input value="'+xe(e.idPrefix||'')+'" data-app-path="entity.idPrefix" oninput="admSetApp(this)"></div>' +
    '</div>';
}

// ═══ FASI ══════════════════════════════════════════════════════════════
function admRender_phases() {
  var phases = (window.APP.phases || []).slice().sort(function(a,b){ return (a.order||0)-(b.order||0); });
  var html = '<div class="card"><div class="card-h">' +
    '<span>Fasi workflow</span>' +
    '<button class="btn sm" onclick="admPhaseEdit()">➕ Nuova fase</button>' +
    '</div>';
  if(!phases.length) {
    html += '<p style="color:var(--wl-text3);font-size:12px">Nessuna fase configurata.</p>';
  }
  phases.forEach(function(p, i){
    html += '<div class="list-item">' +
              '<div class="li-ic">' + xe(p.icon||'📄') + '</div>' +
              '<div class="li-body">' +
                '<div class="li-title" style="color:'+xe(p.color||'#fff')+'">' + xe(p.name) + '</div>' +
                '<div class="li-sub">ID: ' + xe(p.id) + ' · ordine ' + xe(p.order||i+1) + '</div>' +
              '</div>' +
              '<div class="li-actions">' +
                '<button class="btn ghost sm" onclick="admPhaseEdit(\''+xe(p.id)+'\')">✎</button>' +
                '<button class="btn ghost sm" onclick="admPhaseDel(\''+xe(p.id)+'\')">🗑</button>' +
              '</div>' +
            '</div>';
  });
  html += '</div>';
  return html;
}
function admPhaseEdit(id) {
  var p = id ? (window.APP.phases||[]).filter(function(x){return x.id===id;})[0] : { id:'', name:'', icon:'📄', color:'#3B9FD4', order:(window.APP.phases||[]).length+1 };
  if(!p) return;
  openModal(id?'Modifica fase':'Nuova fase',
    '<div class="field"><label>ID (identificatore univoco)</label><input id="phId" value="'+xe(p.id)+'" '+(id?'disabled':'')+'></div>' +
    '<div class="field"><label>Nome</label><input id="phName" value="'+xe(p.name)+'"></div>' +
    '<div class="field"><label>Icona (emoji)</label><input id="phIcon" value="'+xe(p.icon||'')+'"></div>' +
    '<div class="field-row">' +
      '<div class="field"><label>Colore</label><input id="phColor" type="text" value="'+xe(p.color||'#3B9FD4')+'"></div>' +
      '<div class="field"><label>Ordine</label><input id="phOrder" type="number" value="'+xe(p.order||1)+'"></div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn ghost" onclick="closeModal()">Annulla</button>' +
      '<button class="btn success" onclick="admPhaseSave('+(id?"'"+xe(id)+"'":'null')+')">💾 Salva</button>' +
    '</div>');
}
function admPhaseSave(id) {
  var newId = $('#phId').value.trim();
  if(!newId) { toast('ID obbligatorio', 'danger'); return; }
  var p = {
    id: newId,
    name: $('#phName').value.trim() || newId.toUpperCase(),
    icon: $('#phIcon').value.trim() || '📄',
    color: $('#phColor').value.trim() || '#3B9FD4',
    order: parseInt($('#phOrder').value) || 1
  };
  window.APP.phases = window.APP.phases || [];
  if(id) {
    var i = window.APP.phases.findIndex(function(x){ return x.id === id; });
    if(i >= 0) window.APP.phases[i] = p;
  } else {
    if(window.APP.phases.some(function(x){ return x.id === newId; })) {
      toast('ID gia\' esistente', 'danger'); return;
    }
    window.APP.phases.push(p);
    if(!window.APP.states) window.APP.states = {};
    if(!window.APP.states[newId]) window.APP.states[newId] = [];
  }
  WL.saveApp(window.APP);
  closeModal();
  admGo('phases');
  toast('Fase salvata', 'success');
}
function admPhaseDel(id) {
  confirmModal('Eliminare la fase "'+id+'"? Anche gli stati associati verranno rimossi.', function(){
    window.APP.phases = (window.APP.phases||[]).filter(function(x){ return x.id !== id; });
    if(window.APP.states) delete window.APP.states[id];
    WL.saveApp(window.APP);
    admGo('phases');
  });
}

// ═══ STATI ══════════════════════════════════════════════════════════════
function admRender_states() {
  var phases = window.APP.phases || [];
  var states = window.APP.states || {};
  var html = '';
  phases.forEach(function(p){
    var list = states[p.id] || [];
    html += '<div class="card">' +
              '<div class="card-h">' +
                '<span>' + xe(p.icon||'') + ' ' + xe(p.name) + '</span>' +
                '<button class="btn sm" onclick="admStateAdd(\''+xe(p.id)+'\')">➕ Aggiungi stato</button>' +
              '</div>';
    if(!list.length) {
      html += '<p style="color:var(--wl-text3);font-size:12px">Nessuno stato per questa fase.</p>';
    }
    list.forEach(function(s, i){
      html += '<div class="list-item">' +
                '<div class="li-body"><div class="li-title">' + xe(s) + '</div></div>' +
                '<div class="li-actions">' +
                  '<button class="btn ghost sm" onclick="admStateRename(\''+xe(p.id)+'\','+i+')">✎</button>' +
                  '<button class="btn ghost sm" onclick="admStateDel(\''+xe(p.id)+'\','+i+')">🗑</button>' +
                '</div>' +
              '</div>';
    });
    html += '</div>';
  });
  return html;
}
function admStateAdd(phaseId) {
  openModal('Nuovo stato',
    '<div class="field"><label>Nome stato</label><input id="stName" placeholder="es. IN LAVORAZIONE"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn ghost" onclick="closeModal()">Annulla</button>' +
      '<button class="btn success" onclick="admStateAddSave(\''+xe(phaseId)+'\')">💾 Salva</button>' +
    '</div>');
}
function admStateAddSave(phaseId) {
  var name = $('#stName').value.trim();
  if(!name) { toast('Nome obbligatorio', 'danger'); return; }
  if(!window.APP.states) window.APP.states = {};
  if(!window.APP.states[phaseId]) window.APP.states[phaseId] = [];
  window.APP.states[phaseId].push(name);
  WL.saveApp(window.APP);
  closeModal();
  admGo('states');
}
function admStateRename(phaseId, i) {
  var old = window.APP.states[phaseId][i];
  openModal('Modifica stato',
    '<div class="field"><label>Nome</label><input id="stName" value="'+xe(old)+'"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn ghost" onclick="closeModal()">Annulla</button>' +
      '<button class="btn success" onclick="admStateRenameSave(\''+xe(phaseId)+'\','+i+')">💾 Salva</button>' +
    '</div>');
}
function admStateRenameSave(phaseId, i) {
  var name = $('#stName').value.trim();
  if(!name) { toast('Nome obbligatorio', 'danger'); return; }
  window.APP.states[phaseId][i] = name;
  WL.saveApp(window.APP);
  closeModal();
  admGo('states');
}
function admStateDel(phaseId, i) {
  window.APP.states[phaseId].splice(i, 1);
  WL.saveApp(window.APP);
  admGo('states');
}

// ═══ RUOLI ══════════════════════════════════════════════════════════════
function admRender_roles() {
  var roles = window.APP.roles || [];
  var html = '<div class="card"><div class="card-h">' +
    '<span>Ruoli</span>' +
    '<button class="btn sm" onclick="admRoleEdit()">➕ Nuovo ruolo</button>' +
    '</div>';
  roles.forEach(function(r){
    var p = r.permissions || {};
    var permLabels = [];
    if(p.canAdd) permLabels.push('aggiunge');
    if(p.canEdit) permLabels.push('modifica');
    if(p.canDelete) permLabels.push('elimina');
    if(p.canViewAll) permLabels.push('vede tutti');
    html += '<div class="list-item">' +
              '<div class="li-ic">' + xe(r.icon||'👤') + '</div>' +
              '<div class="li-body">' +
                '<div class="li-title" style="color:'+xe(r.color||'#fff')+'">' + xe(r.name) + ' <span style="color:var(--wl-text3);font-weight:400">('+xe(r.id)+')</span></div>' +
                '<div class="li-sub">' + xe(permLabels.join(' · ')||'nessun permesso') + '</div>' +
              '</div>' +
              '<div class="li-actions">' +
                '<button class="btn ghost sm" onclick="admRoleEdit(\''+xe(r.id)+'\')">✎</button>' +
                '<button class="btn ghost sm" onclick="admRoleDel(\''+xe(r.id)+'\')">🗑</button>' +
              '</div>' +
            '</div>';
  });
  html += '</div>';
  return html;
}
function admRoleEdit(id) {
  var r = id ? (window.APP.roles||[]).filter(function(x){return x.id===id;})[0]
             : { id:'', name:'', icon:'👤', color:'#3B9FD4',
                 permissions:{ canAdd:false, canEdit:false, canDelete:false, canViewAll:false, canAdvancePhases:[] } };
  if(!r) return;
  var p = r.permissions || {};
  var phases = window.APP.phases || [];
  openModal(id?'Modifica ruolo':'Nuovo ruolo',
    '<div class="field-row">' +
      '<div class="field"><label>ID</label><input id="roleId" value="'+xe(r.id)+'" '+(id?'disabled':'')+'></div>' +
      '<div class="field"><label>Nome</label><input id="roleName" value="'+xe(r.name)+'"></div>' +
    '</div>' +
    '<div class="field-row">' +
      '<div class="field"><label>Icona</label><input id="roleIcon" value="'+xe(r.icon||'')+'"></div>' +
      '<div class="field"><label>Colore</label><input id="roleColor" value="'+xe(r.color||'#3B9FD4')+'"></div>' +
    '</div>' +
    '<div class="field"><label>Permessi</label>' +
      permCheckbox('canAdd', 'Puo\' aggiungere', p.canAdd) +
      permCheckbox('canEdit', 'Puo\' modificare', p.canEdit) +
      permCheckbox('canDelete', 'Puo\' eliminare', p.canDelete) +
      permCheckbox('canViewAll', 'Vede tutti i record', p.canViewAll) +
    '</div>' +
    '<div class="field"><label>Puo\' avanzare a queste fasi</label>' +
      phases.map(function(ph){
        var checked = (p.canAdvancePhases||[]).indexOf(ph.id)>=0;
        return '<label style="display:inline-flex;align-items:center;gap:5px;margin-right:10px;font-size:12px">'+
                 '<input type="checkbox" data-perm-phase="'+xe(ph.id)+'"'+(checked?' checked':'')+'> '+
                 xe(ph.icon||'')+' '+xe(ph.name)+
               '</label>';
      }).join('') +
    '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn ghost" onclick="closeModal()">Annulla</button>' +
      '<button class="btn success" onclick="admRoleSave('+(id?"'"+xe(id)+"'":'null')+')">💾 Salva</button>' +
    '</div>');
}
function permCheckbox(key, label, checked) {
  return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0">' +
           '<input type="checkbox" data-perm="'+xe(key)+'"'+(checked?' checked':'')+'>' +
           '<span style="font-size:13px">'+xe(label)+'</span>' +
         '</label>';
}
function admRoleSave(id) {
  var newId = $('#roleId').value.trim().toUpperCase();
  if(!newId) { toast('ID obbligatorio', 'danger'); return; }
  var perms = {};
  document.querySelectorAll('[data-perm]').forEach(function(cb){
    perms[cb.getAttribute('data-perm')] = cb.checked;
  });
  var advPhases = [];
  document.querySelectorAll('[data-perm-phase]').forEach(function(cb){
    if(cb.checked) advPhases.push(cb.getAttribute('data-perm-phase'));
  });
  perms.canAdvancePhases = advPhases;
  var r = {
    id: newId,
    name: $('#roleName').value.trim() || newId,
    icon: $('#roleIcon').value.trim() || '👤',
    color: $('#roleColor').value.trim() || '#3B9FD4',
    permissions: perms
  };
  window.APP.roles = window.APP.roles || [];
  if(id) {
    var i = window.APP.roles.findIndex(function(x){ return x.id === id; });
    if(i>=0) window.APP.roles[i] = r;
  } else {
    if(window.APP.roles.some(function(x){ return x.id === newId; })) { toast('ID gia\' esistente','danger'); return; }
    window.APP.roles.push(r);
  }
  WL.saveApp(window.APP);
  closeModal();
  admGo('roles');
  toast('Ruolo salvato', 'success');
}
function admRoleDel(id) {
  confirmModal('Eliminare il ruolo '+id+'?', function(){
    window.APP.roles = (window.APP.roles||[]).filter(function(x){ return x.id !== id; });
    WL.saveApp(window.APP);
    admGo('roles');
  });
}

// ═══ CAMPI RECORD ═══════════════════════════════════════════════════════
function admRender_fields() {
  var fields = window.APP.fields || [];
  var html = '<div class="card"><div class="card-h">' +
    '<span>Campi dell\'entita\'</span>' +
    '<button class="btn sm" onclick="admFieldEdit()">➕ Nuovo campo</button>' +
    '</div>';
  fields.forEach(function(f, i){
    html += '<div class="list-item">' +
              '<div class="li-body">' +
                '<div class="li-title">' + xe(f.label) + ' <span style="color:var(--wl-text3);font-weight:400">('+xe(f.key)+')</span></div>' +
                '<div class="li-sub">tipo: ' + xe(f.type) +
                  (f.required?' · obbligatorio':'') +
                  (f.showInList?' · in lista':'') + '</div>' +
              '</div>' +
              '<div class="li-actions">' +
                '<button class="btn ghost sm" onclick="admFieldEdit('+i+')">✎</button>' +
                '<button class="btn ghost sm" onclick="admFieldDel('+i+')">🗑</button>' +
              '</div>' +
            '</div>';
  });
  html += '</div>';
  return html;
}
function admFieldEdit(i) {
  var f = (i!=null) ? window.APP.fields[i] : { key:'', label:'', type:'text', required:false, showInList:true, options:[] };
  if(!f) return;
  openModal(i!=null?'Modifica campo':'Nuovo campo',
    '<div class="field-row">' +
      '<div class="field"><label>Key</label><input id="fdKey" value="'+xe(f.key)+'" '+(i!=null?'disabled':'')+'></div>' +
      '<div class="field"><label>Label</label><input id="fdLabel" value="'+xe(f.label)+'"></div>' +
    '</div>' +
    '<div class="field"><label>Tipo</label>' +
      '<select id="fdType">' +
        ['text','textarea','number','date','select'].map(function(t){
          return '<option'+(f.type===t?' selected':'')+'>'+t+'</option>';
        }).join('') +
      '</select>' +
    '</div>' +
    '<div class="field"><label>Opzioni (solo select — separate da virgola)</label>' +
      '<input id="fdOpt" value="'+xe((f.options||[]).join(', '))+'" placeholder="es. Bassa, Media, Alta">' +
    '</div>' +
    '<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><input type="checkbox" id="fdReq"'+(f.required?' checked':'')+'> Obbligatorio</label>' +
    '<label style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><input type="checkbox" id="fdList"'+(f.showInList?' checked':'')+'> Mostra in lista</label>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn ghost" onclick="closeModal()">Annulla</button>' +
      '<button class="btn success" onclick="admFieldSave('+(i!=null?i:'null')+')">💾 Salva</button>' +
    '</div>');
}
function admFieldSave(i) {
  var key = $('#fdKey').value.trim();
  if(!key) { toast('Key obbligatoria', 'danger'); return; }
  var opts = $('#fdOpt').value.split(',').map(function(s){return s.trim();}).filter(Boolean);
  var f = {
    key: key,
    label: $('#fdLabel').value.trim() || key,
    type: $('#fdType').value,
    required: $('#fdReq').checked,
    showInList: $('#fdList').checked,
    options: opts
  };
  window.APP.fields = window.APP.fields || [];
  if(i != null) window.APP.fields[i] = f;
  else {
    if(window.APP.fields.some(function(x){ return x.key === key; })) { toast('Key gia\' esistente','danger'); return; }
    window.APP.fields.push(f);
  }
  WL.saveApp(window.APP);
  closeModal();
  admGo('fields');
}
function admFieldDel(i) {
  confirmModal('Eliminare questo campo?', function(){
    window.APP.fields.splice(i, 1);
    WL.saveApp(window.APP);
    admGo('fields');
  });
}

// ═══ DASHBOARD WIDGETS ══════════════════════════════════════════════════
function admRender_dashboard() {
  var widgets = (window.APP.dashboard && window.APP.dashboard.widgets) || [];
  var html = '<div class="card"><div class="card-h">' +
    '<span>Widget dashboard</span>' +
    '<button class="btn sm" onclick="admWidgetEdit()">➕ Nuovo widget</button>' +
    '</div>';
  widgets.forEach(function(w, i){
    html += '<div class="list-item">' +
              '<div class="li-ic">' + (w.type==='counter'?'🔢':w.type==='chart'?'📊':'📃') + '</div>' +
              '<div class="li-body">' +
                '<div class="li-title">' + xe(w.title) + '</div>' +
                '<div class="li-sub">' + xe(w.type) + (w.enabled===false?' · disattivato':' · attivo') + '</div>' +
              '</div>' +
              '<div class="li-actions">' +
                '<label class="switch"><input type="checkbox"'+(w.enabled!==false?' checked':'')+' onchange="admWidgetToggle('+i+',this.checked)"><span class="slider"></span></label>' +
                '<button class="btn ghost sm" onclick="admWidgetDel('+i+')">🗑</button>' +
              '</div>' +
            '</div>';
  });
  html += '</div>';
  return html;
}
function admWidgetEdit() {
  openModal('Nuovo widget',
    '<div class="field"><label>Titolo</label><input id="wgTitle" placeholder="es. Aperti"></div>' +
    '<div class="field"><label>Tipo</label>' +
      '<select id="wgType">' +
        '<option value="counter">Contatore</option>' +
        '<option value="chart">Grafico</option>' +
        '<option value="list">Lista</option>' +
      '</select>' +
    '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn ghost" onclick="closeModal()">Annulla</button>' +
      '<button class="btn success" onclick="admWidgetSave()">💾 Salva</button>' +
    '</div>');
}
function admWidgetSave() {
  var w = { id: uid('w-'), title: $('#wgTitle').value.trim() || 'Widget', type: $('#wgType').value, enabled:true, filter:{} };
  if(w.type === 'chart') { w.chartType = 'bar'; w.groupBy = 'phase'; }
  if(w.type === 'list')  { w.limit = 5; }
  if(!window.APP.dashboard) window.APP.dashboard = { widgets:[] };
  window.APP.dashboard.widgets = window.APP.dashboard.widgets || [];
  window.APP.dashboard.widgets.push(w);
  WL.saveApp(window.APP);
  closeModal();
  admGo('dashboard');
}
function admWidgetToggle(i, on) {
  window.APP.dashboard.widgets[i].enabled = on;
  WL.saveApp(window.APP);
}
function admWidgetDel(i) {
  window.APP.dashboard.widgets.splice(i, 1);
  WL.saveApp(window.APP);
  admGo('dashboard');
}

// ═══ MODULI ═════════════════════════════════════════════════════════════
function admRender_modules() {
  var mods = window.BRAND.modules || {};
  var groups = [
    ['Core',       ['dashboard','records','admin','search','filters']],
    ['Azioni',     ['export','import','print','email','whatsapp']],
    ['Avanzati',   ['ocr','ai','scanner','qr','chat']],
    ['Sistema',    ['notifications','firebase','offline','log']]
  ];
  var html = '';
  groups.forEach(function(g){
    html += '<div class="card"><div class="card-h">' + g[0] + '</div>';
    g[1].forEach(function(m){
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--wl-border)">' +
                '<span style="font-size:13px">' + xe(m) + '</span>' +
                '<label class="switch"><input type="checkbox"'+(mods[m]?' checked':'')+' onchange="admModuleToggle(\''+xe(m)+'\',this.checked)"><span class="slider"></span></label>' +
              '</div>';
    });
    html += '</div>';
  });
  return html;
}
function admModuleToggle(m, on) {
  if(!window.BRAND.modules) window.BRAND.modules = {};
  window.BRAND.modules[m] = on;
  WL.saveBrand(window.BRAND);
}

// ═══ EMAIL TEMPLATES ════════════════════════════════════════════════════
function admRender_email() {
  var tpls = (window.APP.email && window.APP.email.templates) || [];
  var html = '<div class="card"><div class="card-h">' +
    '<span>Template email</span>' +
    '<button class="btn sm" onclick="admEmailEdit()">➕ Nuovo template</button>' +
    '</div>';
  tpls.forEach(function(t, i){
    html += '<div class="list-item">' +
              '<div class="li-body">' +
                '<div class="li-title">' + xe(t.name) + '</div>' +
                '<div class="li-sub">' + xe(t.subject||'') + '</div>' +
              '</div>' +
              '<div class="li-actions">' +
                '<button class="btn ghost sm" onclick="admEmailEdit('+i+')">✎</button>' +
                '<button class="btn ghost sm" onclick="admEmailDel('+i+')">🗑</button>' +
              '</div>' +
            '</div>';
  });
  html += '<p style="font-size:11px;color:var(--wl-text3);margin-top:12px">Variabili disponibili: <code>{{id}}</code>, <code>{{title}}</code>, <code>{{customer}}</code>, ecc. (i nomi dei campi definiti nella sezione Campi).</p>';
  html += '</div>';
  return html;
}
function admEmailEdit(i) {
  var t = (i!=null) ? window.APP.email.templates[i] : { id:'', name:'', subject:'', body:'' };
  if(!t) return;
  openModal(i!=null?'Modifica template':'Nuovo template',
    '<div class="field"><label>ID</label><input id="emId" value="'+xe(t.id||'')+'" '+(i!=null?'disabled':'')+'></div>' +
    '<div class="field"><label>Nome</label><input id="emName" value="'+xe(t.name||'')+'"></div>' +
    '<div class="field"><label>Oggetto</label><input id="emSubj" value="'+xe(t.subject||'')+'"></div>' +
    '<div class="field"><label>Corpo</label><textarea id="emBody" style="min-height:120px">'+xe(t.body||'')+'</textarea></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn ghost" onclick="closeModal()">Annulla</button>' +
      '<button class="btn success" onclick="admEmailSave('+(i!=null?i:'null')+')">💾 Salva</button>' +
    '</div>');
}
function admEmailSave(i) {
  var t = {
    id: $('#emId').value.trim() || uid('tpl-'),
    name: $('#emName').value.trim() || 'Template',
    subject: $('#emSubj').value,
    body: $('#emBody').value
  };
  if(!window.APP.email) window.APP.email = { templates:[] };
  window.APP.email.templates = window.APP.email.templates || [];
  if(i!=null) window.APP.email.templates[i] = t;
  else window.APP.email.templates.push(t);
  WL.saveApp(window.APP);
  closeModal();
  admGo('email');
}
function admEmailDel(i) {
  confirmModal('Eliminare questo template?', function(){
    window.APP.email.templates.splice(i, 1);
    WL.saveApp(window.APP);
    admGo('email');
  });
}

// ═══ AZIENDA ════════════════════════════════════════════════════════════
function admRender_company() {
  return '<div class="card"><div class="card-h">Dati azienda</div>' +
    admBrandField('company.name',       'Ragione sociale') +
    admBrandField('company.legalName',  'Denominazione legale') +
    admBrandField('company.address',    'Indirizzo completo') +
    admBrandField('company.addressShort','Indirizzo breve') +
    '<div class="field-row">' +
      admBrandField('company.city',     'Citta\'') +
      admBrandField('company.province', 'Provincia') +
    '</div>' +
    '<div class="field-row">' +
      admBrandField('company.postalCode','CAP') +
      admBrandField('company.country',  'Paese') +
    '</div>' +
    '<div class="field-row">' +
      admBrandField('company.phone',    'Telefono') +
      admBrandField('company.pec',      'PEC') +
    '</div>' +
    admBrandField('company.email',      'Email') +
    admBrandField('company.website',    'Sito web') +
    '<div class="field-row">' +
      admBrandField('company.vat',      'Partita IVA') +
      admBrandField('company.fiscalCode','Codice fiscale') +
    '</div>' +
    admBrandTextarea('company.emailSignature', 'Firma email') +
    '</div>';
}

// ═══ CONFIG (IMPORT/EXPORT/RESET) ═══════════════════════════════════════
function admRender_config() {
  return '<div class="card"><div class="card-h">Import / Export</div>' +
    '<p style="font-size:12px;color:var(--wl-text3);margin-bottom:12px">' +
      'La configurazione include branding + workflow. Esportala per replicare l\'app su un altro dispositivo o backup.' +
    '</p>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">' +
      '<button class="btn" onclick="WL.exportBrand()">📥 Esporta brand-config.json</button>' +
      '<button class="btn" onclick="WL.exportApp()">📥 Esporta app-config.json</button>' +
      '<button class="btn ghost" onclick="WL.exportAll()">📦 Esporta tutto</button>' +
    '</div>' +
    '<div class="field">' +
      '<label>Importa configurazione (JSON)</label>' +
      '<input type="file" accept=".json" onchange="admImportFile(this)">' +
    '</div>' +
    '<hr style="border:none;border-top:1px solid var(--wl-border);margin:16px 0">' +
    '<div class="card-h" style="color:var(--wl-danger)">Zona pericolosa</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      '<button class="btn danger" onclick="admReset(\'brand\')">🔄 Reset branding</button>' +
      '<button class="btn danger" onclick="admReset(\'app\')">🔄 Reset workflow</button>' +
      '<button class="btn danger" onclick="admReset(\'records\')">🗑 Cancella tutti i record</button>' +
    '</div>' +
    '</div>';
}
function admImportFile(input) {
  var f = input.files && input.files[0];
  if(!f) return;
  var r = new FileReader();
  r.onload = function(e){
    try {
      var d = JSON.parse(e.target.result);
      if(d.brand && d.app) { WL.saveBrand(d.brand); WL.saveApp(d.app); }
      else if(d.app || d.company) WL.saveBrand(d);
      else if(d.entity || d.phases) WL.saveApp(d);
      toast('Configurazione importata — ricarica la pagina', 'success');
    } catch(err) { toast('JSON non valido', 'danger'); }
  };
  r.readAsText(f);
}
function admReset(what) {
  var lbl = what==='brand'?'branding':what==='app'?'workflow':'record';
  confirmModal('Ripristinare i default per '+lbl+'? L\'operazione ricarica la pagina.', function(){
    if(what==='brand') WL.resetBrand();
    else if(what==='app') WL.resetApp();
    else if(what==='records') {
      try { localStorage.removeItem('wl-records'); } catch(e){}
      location.reload();
    }
  });
}
