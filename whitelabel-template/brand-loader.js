/* ═══════════════════════════════════════════════════════════════════════
 * BRAND LOADER — white-label bootstrapper per Resi Telos e derivate
 * ═══════════════════════════════════════════════════════════════════════
 * Legge brand-config.json (statico o override in localStorage["brand"]) e
 * lo espone come window.BRAND. Applica automaticamente:
 *   - CSS variables in :root  (colori, font, raggi bordo)
 *   - <title>, <meta name="theme-color">, apple-mobile-web-app-title
 *   - <link rel="icon"> / <link rel="apple-touch-icon">
 *   - Sostituisce nel DOM ogni elemento con attributo data-brand="path.to.key"
 *
 * Se il file manca o non parsa, resta il branding predefinito nell'HTML —
 * l'app non si rompe (fallback puro). Il pannello admin puo' sovrascrivere
 * brand runtime salvando in localStorage['brand'] (JSON con la stessa
 * struttura di brand-config.json): quello vince sul file statico.
 * ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  // Default sincrono: garantisce che window.BRAND sia sempre disponibile
  // anche prima che il fetch di brand-config.json risolva.
  var DEFAULTS = {
    version: 1,
    app: { name:'Resi Telos', shortName:'Resi', subtitle:'Gestione reparto resi',
           description:'', tagline:'', copyright:'', footerText:'' },
    company: { name:'', legalName:'', address:'', addressShort:'', city:'', province:'',
               postalCode:'', country:'IT', phone:'', email:'', pec:'', vat:'',
               fiscalCode:'', website:'', emailSignature:'' },
    logo: { main:'', login:'', sidebar:'', dashboard:'', print:'', email:'' },
    favicon: { ico:'', svg:'', png192:'icon-192.png', png512:'icon-512.png', appleTouch:'icon-192.png' },
    theme: {
      mode:'dark', font:"-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
      fontSize:'16px', borderRadius:'10px', borderRadiusSm:'7px',
      shadowStrength:'medium', animationSpeed:'normal',
      colors: {
        primary:'#3B9FD4', primaryDark:'#2980B9', secondary:'#5BB8E0', accent:'#2ECC71',
        success:'#2ECC71', warning:'#E6B03C', danger:'#E05555', info:'#3B9FD4',
        bg:'#080808', bg1:'#111111', bg2:'#1a1a1a', bg3:'#222222',
        border:'#2a2a2a', border2:'#333333',
        text:'#FFFFFF', text2:'#E0E0E0', text3:'#999999',
        sidebar:'#0f1826', sidebarText:'#c6d4e2', header:'#111111', headerText:'#FFFFFF'
      },
      colorsDesktop: {}
    },
    pwa: { themeColor:'#000000', backgroundColor:'#000000', display:'standalone',
           orientation:'portrait', startUrl:'./index.html', scope:'./', lang:'it' },
    modules: {
      ocr:true, ai:true, scanner:true, whatsapp:true, email:true, timeline:true,
      storico:true, analytics:true, dashboard:true, bulk:true, ecommerce:true,
      richiestaPresa:true, firebase:true, chat:true, copilot:true, qr:true,
      pwa:true, offline:true, log:true
    },
    ai: { provider:'gemini', model:'gemini-2.5-flash-lite', temperature:0.2,
          timeoutMs:45000, retries:2, endpoint:'/api/gemini', systemPromptSuffix:'' },
    ocr: { provider:'gemini', language:'it', autoCrop:true, quality:'high', minConfidence:0.6 },
    notifications: { toast:true, popup:true, email:false, reminders:true, sla:true, sound:false },
    sla: { warnDays:7, critDays:14 }
  };

  // Deep merge: source (nuovo) sovrascrive target (default), preservando le
  // chiavi target che il source non menziona. Cosi' una brand-config parziale
  // rimane valida (i campi mancanti prendono i default).
  function merge(target, source){
    if(!source || typeof source !== 'object') return target;
    for(var k in source){
      if(!Object.prototype.hasOwnProperty.call(source, k)) continue;
      var sv = source[k], tv = target[k];
      if(sv && typeof sv === 'object' && !Array.isArray(sv) &&
         tv && typeof tv === 'object' && !Array.isArray(tv)){
        merge(tv, sv);
      } else {
        target[k] = sv;
      }
    }
    return target;
  }

  // Accesso "path.dot.notation" al brand (es. BRAND.get('company.email'))
  function get(brand, path, fallback){
    var cur = brand;
    var parts = String(path||'').split('.');
    for(var i=0;i<parts.length;i++){
      if(cur == null) return fallback;
      cur = cur[parts[i]];
    }
    return (cur == null || cur === '') ? fallback : cur;
  }

  // Applica una mappa {var-css: valore-brand} a :root
  function applyCssVars(colors){
    if(!colors) return;
    var map = {
      '--blu': colors.primary, '--grn': colors.primary, '--grn2': colors.primaryDark,
      '--yel': colors.secondary, '--red': colors.danger, '--ora': colors.warning,
      '--pur': colors.accent,
      '--bg': colors.bg, '--bg1': colors.bg1, '--bg2': colors.bg2, '--bg3': colors.bg3,
      '--brd': colors.border, '--brd2': colors.border2,
      '--txt': colors.text, '--txt2': colors.text2, '--txt3': colors.text3,
      // Nuove variabili semantiche (non usate ancora dall'app storica, ma
      // disponibili per componenti futuri e sostituzioni progressive).
      '--brand-primary': colors.primary, '--brand-secondary': colors.secondary,
      '--brand-accent': colors.accent, '--brand-success': colors.success,
      '--brand-warning': colors.warning, '--brand-danger': colors.danger,
      '--brand-info': colors.info,
      '--brand-sidebar': colors.sidebar, '--brand-sidebar-text': colors.sidebarText,
      '--brand-header': colors.header, '--brand-header-text': colors.headerText
    };
    var root = document.documentElement;
    for(var k in map){ if(map[k]) root.style.setProperty(k, map[k]); }
  }

  function applyTheme(theme){
    if(!theme) return;
    applyCssVars(theme.colors);
    // Media query desktop: applico override quando la viewport lo permette
    if(theme.colorsDesktop && typeof window.matchMedia === 'function'){
      try{
        var mq = window.matchMedia('(min-width:900px)');
        var doDesktop = function(){ if(mq.matches) applyCssVars(theme.colorsDesktop); };
        doDesktop(); if(mq.addEventListener) mq.addEventListener('change', doDesktop);
      }catch(e){}
    }
    var root = document.documentElement;
    if(theme.font)          root.style.setProperty('--brand-font', theme.font);
    if(theme.fontSize)      root.style.setProperty('--brand-font-size', theme.fontSize);
    if(theme.borderRadius){ root.style.setProperty('--rad',  theme.borderRadius); }
    if(theme.borderRadiusSm){root.style.setProperty('--rad2', theme.borderRadiusSm); }
  }

  function applyHead(brand){
    if(!brand) return;
    var app = brand.app||{}, pwa = brand.pwa||{}, favi = brand.favicon||{};

    // <title>: "AppName · CompanyName" se entrambe presenti
    var comp = get(brand,'company.name','');
    var titleStr = (app.name||'') + (comp?(' · '+comp):'');
    if(titleStr.trim()) document.title = titleStr;

    // Meta theme-color per barra browser mobile
    setMeta('name','theme-color', pwa.themeColor);
    setMeta('name','apple-mobile-web-app-title', app.shortName || app.name);
    setMeta('name','application-name', app.name);
    setMeta('name','description', app.description);

    // Favicon / apple-touch — accetta path relativi, URL o data:URI
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
    var els = document.head.querySelectorAll('link[rel="'+rel+'"]');
    var el = els[0];
    if(!el){ el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
    el.setAttribute('href', href);
    if(type) el.setAttribute('type', type);
  }

  // Sostituisce nel DOM ogni <span data-brand="app.name"> col valore del brand.
  // Se e' un <img data-brand-src="logo.main"> setta src invece del testo.
  function applyDom(brand){
    try{
      var spans = document.querySelectorAll('[data-brand]');
      for(var i=0;i<spans.length;i++){
        var el = spans[i], key = el.getAttribute('data-brand');
        var v = get(brand, key, '');
        if(v) el.textContent = v;
      }
      var imgs = document.querySelectorAll('[data-brand-src]');
      for(var j=0;j<imgs.length;j++){
        var img = imgs[j], src = get(brand, img.getAttribute('data-brand-src'), '');
        if(src) img.setAttribute('src', src);
        else img.style.display = 'none'; // niente logo → non lasciare l'icona rotta
      }
    }catch(e){ /* DOM non ancora pronto: applica al ready */ }
  }

  // Carica il file statico + eventuale override localStorage. L'override
  // arriva dal pannello admin quando l'utente edita il branding a caldo.
  function load(){
    var brand = JSON.parse(JSON.stringify(DEFAULTS));
    // Fetch bloccante lo evitiamo: uso async ma applico DEFAULTS subito,
    // poi ri-applico al ricevimento del JSON — nessun flash percettibile
    // perche' il primo paint usa il CSS statico che coincide col default.
    applyTheme(brand.theme); applyHead(brand);
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ applyDom(brand); });
    } else { applyDom(brand); }

    var applied = function(src){
      merge(brand, src||{});
      applyTheme(brand.theme); applyHead(brand); applyDom(brand);
      window.BRAND = brand;
      try{ document.dispatchEvent(new CustomEvent('brand:ready',{detail:brand})); }catch(e){}
    };

    // 1) file statico brand-config.json
    fetch('brand-config.json', { cache:'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(fileCfg){
        // 2) override localStorage (dal pannello admin) — vince sul file
        var localCfg = null;
        try{ localCfg = JSON.parse(localStorage.getItem('brand')||'null'); }catch(e){}
        merge(brand, fileCfg||{});
        merge(brand, localCfg||{});
        applied(brand);
      })
      .catch(function(){
        // Nessun file: prova solo l'override locale
        var localCfg = null;
        try{ localCfg = JSON.parse(localStorage.getItem('brand')||'null'); }catch(e){}
        merge(brand, localCfg||{});
        applied(brand);
      });

    window.BRAND = brand; // disponibile subito coi default
  }

  // API pubblica: BrandLoader.set(newBrand) applica override live e persiste
  window.BrandLoader = {
    get: function(path, fb){ return get(window.BRAND, path, fb); },
    apply: function(brand){
      if(!brand) return;
      window.BRAND = brand;
      applyTheme(brand.theme); applyHead(brand); applyDom(brand);
    },
    save: function(brand){
      try{ localStorage.setItem('brand', JSON.stringify(brand)); }catch(e){}
      this.apply(brand);
    },
    reset: function(){ try{ localStorage.removeItem('brand'); }catch(e){} location.reload(); },
    export: function(){
      var s = JSON.stringify(window.BRAND||{}, null, 2);
      var blob = new Blob([s], {type:'application/json'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'brand-config.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  };

  load();
})();
