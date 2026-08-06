// RENDER — traversal + registro blocchi
(function(){
  const $ = s=>document.querySelector(s);
  let currentPageId=null;

  const esc = s => String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function applyTheme(){
    const t = RG.get().theme||{};
    ['primary','bg','panel','panel2','border','text','muted','danger','ok','warn'].forEach(k=>{
      if(t[k]) document.documentElement.style.setProperty('--'+k, t[k]);
    });
    // custom CSS
    const s = RG.get().site||{};
    let styleEl = document.getElementById('__customcss');
    if(!styleEl){ styleEl=document.createElement('style'); styleEl.id='__customcss'; document.head.appendChild(styleEl); }
    styleEl.textContent = s.customCss || '';
    if(s.themeColor) document.querySelector('meta[name=theme-color]')?.setAttribute('content', s.themeColor);
    if(s.favicon) document.querySelector('link[rel=icon]')?.setAttribute('href', s.favicon);
    document.title = s.name || 'App';
  }

  function renderHeader(){
    const h=RG.get().header||{}, b=RG.get().brand||{};
    const el=$('#appHeader');
    el.className=''; el.classList.add(h.align||'left');
    el.style.background=h.bg||''; el.style.color=h.text||'';
    el.style.position = h.sticky===false ? 'static' : 'sticky';
    const page = RG.get().pages.find(p=>p.id===currentPageId);
    el.style.display = (h.show===false || page?.settings?.hideHeader) ? 'none' : '';
    const logoHtml = (b.logo||'icon.svg') ? `<img class="hlogo" src="${b.logo||'icon.svg'}" style="height:${h.logoSize||36}px" alt="">` : '';
    const txt = `<div class="htxt"><div class="htitle">${esc(h.title||b.name||'')}</div>${h.subtitle?`<div class="hsub">${esc(h.subtitle)}</div>`:''}</div>`;
    let html;
    if(h.logoPos==='none') html = txt;
    else if(h.logoPos==='right') html = txt + logoHtml;
    else if(h.logoPos==='center') html = `<div style="flex:1"></div>${logoHtml}${txt}<div style="flex:1"></div>`;
    else html = logoHtml + txt;
    // user chip
    const u = sessionStorage.getItem('rg-user')||'';
    if(u){ html += `<button class="icon-btn" title="Esci" onclick="sessionStorage.removeItem('rg-user');location.reload()">⎋</button>`; }
    el.innerHTML = html;
  }

  function renderNav(){
    const h=RG.get().header||{};
    const nav=$('#appNav');
    const page = RG.get().pages.find(p=>p.id===currentPageId);
    if(h.showNav===false || page?.settings?.hideHeader){ nav.style.display='none'; return; }
    nav.style.display='';
    const pages=(RG.get().pages||[]).filter(p=>!p.hideFromNav);
    nav.innerHTML=pages.map(p=>`<button data-page="${p.id}" class="${p.id===currentPageId?'active':''}">${esc(p.icon||'')} ${esc(p.name)}</button>`).join('');
    nav.querySelectorAll('button').forEach(b=>b.onclick=()=>goto(b.dataset.page));
  }

  function renderFooter(){
    const f=RG.get().footer||{};
    const page = RG.get().pages.find(p=>p.id===currentPageId);
    const el=$('#appFooter');
    if(f.show===false || page?.settings?.hideFooter){ el.style.display='none'; return; }
    el.style.display=''; el.style.background=f.bg||''; el.style.color=f.text||'';
    let html='';
    if(f.cols && f.cols.length){
      html += `<div class="footer-grid">${f.cols.map(c=>`
        <div><div class="fcol-t">${esc(c.title||'')}</div>${(c.items||[]).map(x=>`<div class="fcol-i">${esc(x)}</div>`).join('')}</div>
      `).join('')}</div>`;
    }
    if(f.copy) html += `<div class="fcopy">${esc(f.copy)}</div>`;
    el.innerHTML = html;
  }

  function renderPage(){
    const pages=RG.get().pages||[];
    if(!pages.length){ $('#appMain').innerHTML='<div class="muted" style="text-align:center;padding:40px">Nessuna pagina.</div>'; return; }
    let p=pages.find(x=>x.id===currentPageId)||pages[0]; currentPageId=p.id;
    const main=$('#appMain');
    main.innerHTML=''; main.style.background=p.settings?.bg||'';
    main.style.paddingTop=(p.settings?.padding||0)+'px';
    renderInto(main, p.blocks||[], null, 'root', p);
    renderNav(); renderFooter(); renderHeader();
  }

  const ctx = { renderInto: (parent, arr, container, path)=>renderInto(parent, arr, container, path) };

  function renderInto(parent, arr, container, path, page){
    (arr||[]).forEach((blk,i)=>{
      const el = renderBlock(blk, container, i, arr);
      parent.appendChild(el);
    });
    if(document.body.classList.contains('edit-on')){
      const add = document.createElement('button');
      add.className='btn sm add-here';
      add.textContent='➕ blocco qui';
      add.onclick = e=>{ e.stopPropagation(); RG_editor.pickAndAdd(arr, container); };
      parent.appendChild(add);
    }
  }

  function renderBlock(blk, container, index, arr){
    const type = RG_BLOCKS[blk.type];
    const el = document.createElement('div');
    el.className = 'blk blk-'+blk.type;
    el.dataset.blockId = blk.id;
    if(!type){ el.textContent='(blocco sconosciuto: '+blk.type+')'; return el; }
    try { type.render(el, blk, ctx); }
    catch(e){ el.textContent='Errore rendering '+blk.type+': '+e.message; }
    // controlli
    const ctl = document.createElement('div'); ctl.className='blk-controls';
    ctl.innerHTML=`<button data-c="up">▲</button><button data-c="dn">▼</button><button data-c="ed">✎</button><button data-c="rm">✕</button>`;
    ctl.querySelector('[data-c=up]').onclick=e=>{e.stopPropagation();RG.moveById(blk.id,-1);rerender();};
    ctl.querySelector('[data-c=dn]').onclick=e=>{e.stopPropagation();RG.moveById(blk.id, 1);rerender();};
    ctl.querySelector('[data-c=ed]').onclick=e=>{e.stopPropagation();RG_editor.editBlock(blk);};
    ctl.querySelector('[data-c=rm]').onclick=e=>{e.stopPropagation(); if(confirm('Rimuovere questo blocco?')){RG.deleteById(blk.id);rerender();}};
    el.appendChild(ctl);
    return el;
  }

  function goto(id){ currentPageId=id; renderPage(); }
  function rerender(){ applyTheme(); renderHeader(); renderPage(); }

  window.RG_render = { rerender, goto, applyTheme,
    get currentPageId(){return currentPageId;}, set currentPageId(v){currentPageId=v;} };
})();
