// RENDER — schema -> DOM
(function(){
  const $ = (s,r=document)=>r.querySelector(s);
  let currentPageId = null;

  function applyTheme(){
    const t = RG.get().theme || {};
    const map = {primary:'--primary',bg:'--bg',panel:'--panel',panel2:'--panel2',
      border:'--border',text:'--text',muted:'--muted',danger:'--danger'};
    for(const k in map) if(t[k]) document.documentElement.style.setProperty(map[k], t[k]);
  }

  function renderHeader(){
    const h = RG.get().header || {};
    const b = RG.get().brand || {};
    const el = $('#appHeader');
    el.className = ''; el.classList.add(h.align||'left');
    el.style.background = h.bg || '';
    el.style.color = h.text || '';
    el.style.display = h.show===false ? 'none' : '';
    let html = '';
    const logoHtml = (b.logo || 'icon.svg')
      ? `<img class="hlogo" src="${b.logo || 'icon.svg'}" style="height:${h.logoSize||36}px" alt="">` : '';
    const txt = `<div class="htxt"><div class="htitle">${escape(h.title||b.name||'')}</div>
      ${h.subtitle?`<div class="hsub">${escape(h.subtitle)}</div>`:''}</div>`;
    if(h.logoPos==='none'){ html = txt; }
    else if(h.logoPos==='right'){ html = txt + logoHtml; }
    else if(h.logoPos==='center'){ html = `<div style="flex:1"></div>${logoHtml}${txt.replace('htxt','htxt center')}<div style="flex:1"></div>`; }
    else { html = logoHtml + txt; }
    el.innerHTML = html;
  }

  function renderNav(){
    const nav = $('#appNav');
    const pages = RG.get().pages || [];
    nav.innerHTML = pages.map(p=>
      `<button data-page="${p.id}" class="${p.id===currentPageId?'active':''}">${p.icon||''} ${escape(p.name)}</button>`
    ).join('');
    nav.querySelectorAll('button').forEach(b=>b.onclick=()=>goto(b.dataset.page));
  }

  function renderFooter(){
    const f = RG.get().footer || {};
    const el = $('#appFooter');
    el.style.display = f.show===false ? 'none' : '';
    el.textContent = f.text || '';
  }

  function renderPage(){
    const pages = RG.get().pages || [];
    if(!pages.length){ $('#appMain').innerHTML='<div class="muted" style="text-align:center;padding:40px">Nessuna pagina. Aggiungine una dall\'editor.</div>'; return; }
    let p = pages.find(x=>x.id===currentPageId) || pages[0];
    currentPageId = p.id;
    const main = $('#appMain');
    main.innerHTML = '';
    (p.blocks||[]).forEach((blk,i)=>{
      const el = renderBlock(blk, p);
      el.dataset.blockIdx = i;
      el.dataset.blockId = blk.id;
      el.dataset.pageId = p.id;
      // controlli editor
      const ctl = document.createElement('div'); ctl.className='blk-controls';
      ctl.innerHTML = `<button data-c="up">▲</button><button data-c="dn">▼</button>
        <button data-c="ed">✎</button><button data-c="rm">✕</button>`;
      ctl.querySelector('[data-c=up]').onclick = e=>{ e.stopPropagation(); moveBlock(p, i, -1); };
      ctl.querySelector('[data-c=dn]').onclick = e=>{ e.stopPropagation(); moveBlock(p, i, 1); };
      ctl.querySelector('[data-c=ed]').onclick = e=>{ e.stopPropagation(); window.RG_editor.editBlock(p, i); };
      ctl.querySelector('[data-c=rm]').onclick = e=>{ e.stopPropagation();
        if(confirm('Rimuovere questo blocco?')){ p.blocks.splice(i,1); RG.save(); rerender(); }
      };
      el.appendChild(ctl);
      main.appendChild(el);
    });
    renderNav();
  }

  function renderBlock(blk, page){
    const w = document.createElement('div'); w.className='blk blk-'+blk.type;
    if(blk.type==='text'){
      const tag = blk.tag||'p';
      const inner = document.createElement(tag);
      inner.textContent = blk.text||'';
      if(blk.color) inner.style.color = blk.color;
      if(blk.fontSize) inner.style.fontSize = blk.fontSize+'px';
      if(blk.fontWeight) inner.style.fontWeight = blk.fontWeight;
      if(blk.align) inner.style.textAlign = blk.align;
      if(blk.padding!=null) inner.style.padding = blk.padding+'px';
      w.appendChild(inner);
    }
    else if(blk.type==='buttons'){
      if(blk.layout==='stack') w.classList.add('stack');
      (blk.items||[]).forEach(it=>{
        const b = document.createElement('button');
        b.className='btn '+(it.style||'default');
        b.textContent = it.label || 'Pulsante';
        b.onclick = e=>{ if(document.body.classList.contains('edit-on')){ e.stopPropagation(); return; } runAction(it.action); };
        w.appendChild(b);
      });
    }
    else if(blk.type==='image'){
      w.innerHTML = `<img src="${blk.src||'icon.svg'}" style="max-width:${blk.width||100}%;display:block;margin:0 ${blk.align==='center'?'auto':blk.align==='right'?'0 0 auto':'0'}">`;
    }
    else if(blk.type==='html'){
      w.innerHTML = blk.html || '';
    }
    else if(blk.type==='table'){
      renderTable(w, blk);
    }
    return w;
  }

  function renderTable(w, blk){
    const rows = RG.dataGet(blk.storageKey);
    const cols = blk.columns||[];
    let html = `<div class="thead"><div class="name">${escape(blk.title||'Tabella')}</div>`;
    if(blk.allowExport) html += `<button class="btn sm" data-t="csv">CSV</button><button class="btn sm" data-t="json">JSON</button>`;
    html += `</div>`;
    if(blk.allowAdd) html += `<div class="tbar"><button class="btn sm primary" data-t="add">➕ Aggiungi riga</button>`+
      (blk.allowDelete?`<button class="btn sm" data-t="clear">🗑 Svuota</button>`:'')+`</div>`;
    if(!rows.length){
      html += `<div class="empty">Nessun dato. ${blk.allowAdd?'Clicca "Aggiungi riga".':''}</div>`;
    } else {
      html += `<div class="tbl-wrap"><table><thead><tr>`+
        cols.map(c=>`<th>${escape(c.label)}</th>`).join('')+
        `${(blk.allowEdit||blk.allowDelete)?'<th></th>':''}</tr></thead><tbody>`;
      rows.forEach((r,i)=>{
        html += '<tr>' + cols.map(c=>`<td>${escape(formatCell(r[c.key], c))}</td>`).join('') +
          `${(blk.allowEdit||blk.allowDelete)?`<td style="text-align:right">
            ${blk.allowEdit?`<button class="row-edit" data-i="${i}">✎</button>`:''}
            ${blk.allowDelete?`<button class="row-del" data-i="${i}">✕</button>`:''}
          </td>`:''}</tr>`;
      });
      html += '</tbody></table></div>';
    }
    w.innerHTML = html;
    w.querySelectorAll('[data-t]').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      const t = b.dataset.t;
      if(t==='add') openRowForm(blk, null);
      if(t==='csv') exportTable(blk, 'csv');
      if(t==='json') exportTable(blk, 'json');
      if(t==='clear'){ if(confirm('Svuotare la tabella?')){ RG.dataSet(blk.storageKey,[]); rerender(); } }
    });
    w.querySelectorAll('.row-del').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      const i = +b.dataset.i;
      const rs = RG.dataGet(blk.storageKey); rs.splice(i,1); RG.dataSet(blk.storageKey, rs); rerender();
    });
    w.querySelectorAll('.row-edit').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      openRowForm(blk, +b.dataset.i);
    });
  }

  function formatCell(v, col){
    if(v==null||v==='') return '';
    if(col.type==='datetime') { const d=new Date(v); return isNaN(d)?v:d.toLocaleString(); }
    if(col.type==='date' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v;
    return String(v);
  }

  function openRowForm(blk, idx){
    const rs = RG.dataGet(blk.storageKey);
    const row = idx==null ? {} : {...rs[idx]};
    const dlg = document.getElementById('dlg');
    dlg.innerHTML = `
      <div class="h">${idx==null?'➕ Nuova riga':'✎ Modifica riga'}<button class="x">×</button></div>
      <div class="b">${blk.columns.map(c=>`
        <div class="fld"><label>${escape(c.label)}</label>${fieldInput(c, row[c.key])}</div>
      `).join('')}</div>
      <div class="f"><button class="btn" data-a="cancel">Annulla</button>
      <button class="btn primary" data-a="ok">${idx==null?'Aggiungi':'Salva'}</button></div>
    `;
    dlg.querySelector('.x').onclick = ()=>dlg.close();
    dlg.querySelector('[data-a=cancel]').onclick = ()=>dlg.close();
    dlg.querySelector('[data-a=ok]').onclick = ()=>{
      blk.columns.forEach(c=>{
        const inp = dlg.querySelector(`[name="${c.key}"]`);
        if(!inp) return;
        row[c.key] = inp.value;
      });
      if(idx==null){
        blk.columns.forEach(c=>{
          if(c.type==='datetime' && !row[c.key]) row[c.key]=new Date().toISOString();
        });
        rs.push(row);
      } else rs[idx] = row;
      RG.dataSet(blk.storageKey, rs);
      dlg.close(); rerender();
    };
    dlg.showModal();
  }

  function fieldInput(c, v){
    v = v==null?'':v;
    if(c.type==='textarea') return `<textarea name="${c.key}" rows="3">${escape(v)}</textarea>`;
    if(c.type==='select') return `<select name="${c.key}">${(c.options||[]).map(o=>`<option ${o==v?'selected':''}>${escape(o)}</option>`).join('')}</select>`;
    if(c.type==='number') return `<input type="number" name="${c.key}" value="${escape(v)}">`;
    if(c.type==='date') return `<input type="date" name="${c.key}" value="${escape(v)}">`;
    if(c.type==='datetime') return `<input type="datetime-local" name="${c.key}" value="${escape(String(v).slice(0,16))}">`;
    return `<input name="${c.key}" value="${escape(v)}">`;
  }

  function exportTable(blk, kind){
    const rs = RG.dataGet(blk.storageKey);
    const cols = blk.columns;
    let content, name, type;
    if(kind==='json'){ content = JSON.stringify(rs,null,2); name = blk.storageKey+'.json'; type='application/json'; }
    else {
      const head = cols.map(c=>c.label).join(',');
      const body = rs.map(r=>cols.map(c=>`"${(r[c.key]==null?'':String(r[c.key])).replace(/"/g,'""')}"`).join(',')).join('\n');
      content = head+'\n'+body; name = blk.storageKey+'.csv'; type='text/csv';
    }
    const b = new Blob([content],{type}); const u=URL.createObjectURL(b);
    const a=document.createElement('a'); a.href=u; a.download=name; a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1000);
  }

  function moveBlock(page, i, dir){
    const arr = page.blocks; const j = i+dir;
    if(j<0||j>=arr.length) return;
    [arr[i],arr[j]] = [arr[j],arr[i]]; RG.save(); rerender();
  }

  function runAction(a){
    if(!a) return;
    if(a.type==='goto') goto(a.page);
    else if(a.type==='alert') alert(a.text||'');
    else if(a.type==='openUrl') window.open(a.url,'_blank');
    else if(a.type==='exportCsv') {
      const blk = findTable(a.storageKey); if(blk) exportTable(blk,'csv');
    }
    else if(a.type==='exportJson') {
      const blk = findTable(a.storageKey); if(blk) exportTable(blk,'json');
    }
    else if(a.type==='addRow'){
      const blk = findTable(a.storageKey); if(blk) openRowForm(blk, null);
    }
    else if(a.type==='clearTable'){
      if(confirm('Svuotare la tabella?')){ RG.dataSet(a.storageKey, []); rerender(); }
    }
    else if(a.type==='logout'){ sessionStorage.removeItem('rg-user'); location.reload(); }
    else if(a.type==='js'){ try{ new Function(a.code)(); }catch(e){ alert('Errore JS: '+e.message); } }
  }

  function findTable(storageKey){
    for(const p of RG.get().pages){
      for(const b of (p.blocks||[])){
        if(b.type==='table' && b.storageKey===storageKey) return b;
      }
    }
    return null;
  }

  function goto(pageId){ currentPageId = pageId; renderPage(); }
  function rerender(){ applyTheme(); renderHeader(); renderPage(); renderFooter(); }
  function escape(s){ return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  window.RG_render = { rerender, goto, applyTheme, get currentPageId(){return currentPageId;}, set currentPageId(v){currentPageId=v;} };
})();
