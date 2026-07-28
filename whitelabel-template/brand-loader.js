/* ═══════════════════════════════════════════════════════════════════════
 *  WHITE-LABEL BOOTSTRAPPER
 *  Legge brand-config.json + app-config.json e li applica prima del render.
 *  ├─ window.BRAND   — branding (nome, colori, logo, PWA, moduli attivi)
 *  ├─ window.APP     — workflow (fasi, stati, ruoli, campi, dashboard)
 *  └─ window.CFG     — override dinamici salvati dall'admin (localStorage)
 *
 *  Ogni file di config puo' essere assente: si usa il default hardcoded qui.
 *  L'admin sovrascrive tutto salvando in localStorage['cfg-overrides'].
 * ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var BRAND_DEFAULTS = {
    version: 1,
    app: { name:'My App', shortName:'App', subtitle:'', description:'', copyright:'', footerText:'', tagline:'' },
    company: { name:'', address:'', phone:'', email:'', website:'', emailSignature:'' },
    logo: { main:'', login:'', sidebar:'', dashboard:'', print:'', email:'' },
    favicon: { svg:'icon.svg', appleTouch:'icon.svg', png192:'', png512:'', ico:'' },
    theme: {
      mode:'dark',
      font:"-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
      fontSize:'16px', borderRadius:'10px', borderRadiusSm:'7px',
      colors: {
        primary:'#3B9FD4', primaryDark:'#2980B9', secondary:'#5BB8E0', accent:'#2ECC71',
        success:'#2ECC71', warning:'#E6B03C', danger:'#E05555', info:'#3B9FD4',
        bg:'#080808', bg1:'#111', bg2:'#1a1a1a', bg3:'#222',
        border:'#2a2a2a', border2:'#333',
        text:'#fff', text2:'#e0e0e0', text3:'#999',
        sidebar:'#0f1826', sidebarText:'#c6d4e2', header:'#111', headerText:'#fff'
      }
    },
    pwa: { themeColor:'#111', backgroundColor:'#080808', display:'standalone', orientation:'portrait', lang:'it' },
    modules: {
      dashboard:true, records:true, admin:true, search:true, filters:true,
      export:true, import:true, print:true, email:true, whatsapp:false,
      ocr:false, ai:false, scanner:false, qr:false, chat:false,
      notifications:true, firebase:false, offline:true, log:true
    },
    ai: { provider:'gemini', model:'gemini-2.5-flash-lite', temperature:0.2, timeoutMs:45000, retries:2, endpoint:'/api/gemini', systemPrompt:'' },
    firebase: { apiKey:'', databaseURL:'' }
  };

  var APP_DEFAULTS = {
    version: 1,
    entity: { singular:'Record', plural:'Record', iconEmoji:'📋', idPrefix:'REC-' },
    phases: [
      { id:'new',     name:'NUOVO',    icon:'📥', color:'#3B9FD4', order:1 },
      { id:'closed',  name:'CHIUSO',   icon:'✅', color:'#2ECC71', order:2 }
    ],
    states: { new:['DA GESTIRE'], closed:['COMPLETATO'] },
    roles: [
      { id:'USER',  name:'Operatore', icon:'👤', color:'#3B9FD4',
        permissions:{ canAdd:true, canEdit:true, canDelete:false, canAdvancePhases:['new'], canViewAll:false } },
      { id:'ADMIN', name:'Amministratore', icon:'🔑', color:'#E05555',
        permissions:{ canAdd:true, canEdit:true, canDelete:true, canAdvancePhases:['new','closed'], canViewAll:true } }
    ],
    fields: [
      { key:'title', label:'Titolo', type:'text', required:true, showInList:true }
    ],
    dashboard: { widgets: [] },
    email: { templates: [] },
    notifications: { toastDurationMs:3000, slaWarnDays:7, slaCritDays:14 },
    admin: { pinHash:'92cf4b9034b653432b922dcd907b2f11b4a30051007e2c7552ca391796043f9d' }
  };

  // Deep merge — source vince sui campi che dichiara, target conserva il resto.
  function merge(target, source){
    if(!source || typeof source !== 'object') return target;
    for(var k in source){
      if(!Object.prototype.hasOwnProperty.call(source, k)) continue;
      var sv = source[k], tv = target[k];
      if(sv && typeof sv==='object' && !Array.isArray(sv) &&
         tv && typeof tv==='object' && !Array.isArray(tv)){
        merge(tv, sv);
      } else if(sv !== undefined) {
        target[k] = Array.isArray(sv) ? sv.slice() : sv;
      }
    }
    return target;
  }

  function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }

  // Accesso "path.dot.notation": BRAND.get('company.email','fb')
  function get(obj, path, fb){
    var cur = obj;
    var parts = String(path||'').split('.');
    for(var i=0;i<parts.length;i++){
      if(cur == null) return fb;
      cur = cur[parts[i]];
    }
    return (cur == null || cur === '') ? fb : cur;
  }

  // Applica i colori del brand come CSS variables in :root
  function applyCssVars(colors, theme){
    if(!colors) return;
    var root = document.documentElement;
    var map = {
      '--wl-primary': colors.primary, '--wl-primary-dark': colors.primaryDark,
      '--wl-secondary': colors.secondary, '--wl-accent': colors.accent,
      '--wl-success': colors.success, '--wl-warning': colors.warning,
      '--wl-danger': colors.danger, '--wl-info': colors.info,
      '--wl-bg': colors.bg, '--wl-bg1': colors.bg1, '--wl-bg2': colors.bg2, '--wl-bg3': colors.bg3,
      '--wl-border': colors.border, '--wl-border2': colors.border2,
      '--wl-text': colors.text, '--wl-text2': colors.text2, '--wl-text3': colors.text3,
      '--wl-sidebar': colors.sidebar, '--wl-sidebar-text': colors.sidebarText,
      '--wl-header': colors.header, '--wl-header-text': colors.headerText
    };
    for(var k in map){ if(map[k]) root.style.setProperty(k, map[k]); }
    if(theme){
      if(theme.font)          root.style.setProperty('--wl-font', theme.font);
      if(theme.fontSize)      root.style.setProperty('--wl-font-size', theme.fontSize);
      if(theme.borderRadius)  root.style.setProperty('--wl-rad', theme.borderRadius);
      if(theme.borderRadiusSm)root.style.setProperty('--wl-rad-sm', theme.borderRadiusSm);
    }
  }

  function applyHead(brand){
    var app = brand.app||{}, pwa = brand.pwa||{}, favi = brand.favicon||{};
    var comp = get(brand,'company.name','');
    var titleStr = (app.name||'') + (comp ? ' · '+comp : '');
    if(titleStr.trim()) document.title = titleStr;

    setMeta('name','theme-color', pwa.themeColor);
    setMeta('name','apple-mobile-web-app-title', app.shortName || app.name);
    setMeta('name','application-name', app.name);
    setMeta('name','description', app.description);

    setLink('icon', favi.svg || favi.png192 || favi.ico, favi.svg?'image/svg+xml':undefined);
    setLink('apple-touch-icon', favi.appleTouch || favi.png192);
  }

  function setMeta(attr, name, val){
    if(!val) return;
    var el = document.querySelector('meta['+attr+'="'+name+'"]');
    if(!el){ el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', String(val));
  }

  function setLink(rel, href, type){
    if(!href) return;
    var el = document.head.querySelector('link[rel="'+rel+'"]');
    if(!el){ el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
    el.setAttribute('href', href);
    if(type) el.setAttribute('type', type);
  }

  // Sostituisce nel DOM ogni [data-brand="path"] con il valore corrispondente
  function applyDom(brand, app){
    try{
      document.querySelectorAll('[data-brand]').forEach(function(el){
        var v = get(brand, el.getAttribute('data-brand'), '');
        if(v) el.textContent = v;
      });
      document.querySelectorAll('[data-brand-src]').forEach(function(el){
        var v = get(brand, el.getAttribute('data-brand-src'), '');
        if(v) el.setAttribute('src', v);
        else if(el.tagName==='IMG') el.style.display = 'none';
      });
      document.querySelectorAll('[data-app]').forEach(function(el){
        var v = get(app, el.getAttribute('data-app'), '');
        if(v!=='') el.textContent = v;
      });
    }catch(e){}
  }

  // Carica JSON con override localStorage. Non blocca il render se manca il file.
  function loadJson(path, localKey, defaults){
    var out = deepCopy(defaults);
    // Sync default subito
    var localOverride = null;
    try { localOverride = JSON.parse(localStorage.getItem(localKey)||'null'); } catch(e){}
    // Fetch async del file
    return fetch(path, { cache:'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .catch(function(){ return null; })
      .then(function(fileCfg){
        merge(out, fileCfg||{});
        merge(out, localOverride||{});
        return out;
      });
  }

  // Boot: applica default per il primo paint, poi fetcha e ri-applica
  var brand = deepCopy(BRAND_DEFAULTS);
  var app = deepCopy(APP_DEFAULTS);
  applyCssVars(brand.theme.colors, brand.theme);
  applyHead(brand);
  window.BRAND = brand;
  window.APP = app;

  Promise.all([
    loadJson('brand-config.json', 'brand-overrides', BRAND_DEFAULTS),
    loadJson('app-config.json',   'app-overrides',   APP_DEFAULTS)
  ]).then(function(res){
    window.BRAND = res[0];
    window.APP   = res[1];
    applyCssVars(window.BRAND.theme.colors, window.BRAND.theme);
    applyHead(window.BRAND);
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ applyDom(window.BRAND, window.APP); dispatchReady(); });
    } else {
      applyDom(window.BRAND, window.APP); dispatchReady();
    }
  });

  function dispatchReady(){
    try{ document.dispatchEvent(new CustomEvent('wl:ready', { detail:{ brand:window.BRAND, app:window.APP } })); }catch(e){}
  }

  // API pubblica per l'admin panel
  window.WL = {
    get: function(obj, path, fb){ return get(obj, path, fb); },
    saveBrand: function(brand){
      try{ localStorage.setItem('brand-overrides', JSON.stringify(brand)); }catch(e){}
      window.BRAND = brand;
      applyCssVars(brand.theme.colors, brand.theme);
      applyHead(brand);
      applyDom(brand, window.APP);
    },
    saveApp: function(app){
      try{ localStorage.setItem('app-overrides', JSON.stringify(app)); }catch(e){}
      window.APP = app;
      applyDom(window.BRAND, app);
    },
    resetBrand: function(){ try{ localStorage.removeItem('brand-overrides'); }catch(e){} location.reload(); },
    resetApp:   function(){ try{ localStorage.removeItem('app-overrides');   }catch(e){} location.reload(); },
    exportBrand: function(){ download('brand-config.json', JSON.stringify(window.BRAND, null, 2)); },
    exportApp:   function(){ download('app-config.json',   JSON.stringify(window.APP,   null, 2)); },
    exportAll:   function(){ download('white-label-config.json',
                                 JSON.stringify({ brand:window.BRAND, app:window.APP }, null, 2)); }
  };

  function download(name, content){
    var blob = new Blob([content], { type:'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  }
})();
