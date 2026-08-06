// UI — helper condivisi tra editor e blocchi (dialog, azioni, tabella, item list)
(function(){
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const dlgEl = ()=>document.getElementById('dlg');

// dlg(htmlString, onOk?, onMount?)  -> apre dialog. Il tasto con id=_ok o data-a=ok scatena onOk(query).
// Il tasto con class .x o data-x chiude.
function dlg(html, onOk, onMount){
  const d = dlgEl();
  d.innerHTML = html;
  d.querySelectorAll('.x,[data-x]').forEach(x=>x.onclick=()=>d.close());
  const okBtn = d.querySelector('#_ok,[data-a=ok]');
  if(okBtn && onOk) okBtn.onclick = ()=>{
    try{ onOk(sel=>d.querySelector(sel)); d.close(); }catch(e){ alert('Errore: '+e.message); }
  };
  if(onMount) try{ onMount(d); }catch(e){}
  if(!d.open) d.showModal();
  return d;
}

// download blob
function download(name, content, type='application/json'){
  const b=new Blob([content],{type}); const u=URL.createObjectURL(b);
  const a=document.createElement('a'); a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
}

// -------- action editor (usato in pulsanti / hero CTA) --------
function actionEditor(a, i){
  a = a || {type:'alert', text:''};
  const types = ['goto','alert','openUrl','addRow','exportCsv','exportJson','clearTable','logout','js'];
  return `<select data-a="type" data-i="${i}" style="width:110px">
    ${types.map(t=>`<option ${a.type===t?'selected':''} value="${t}">${t}</option>`).join('')}
  </select><span data-a="params" style="flex:1;display:flex;gap:4px">${actionParams(a,i)}</span>`;
}
function actionParams(a, i){
  const pages = RG.get().pages;
  if(a.type==='goto') return `<select data-p="page" data-i="${i}" style="flex:1">${pages.map(p=>`<option value="${p.id}" ${a.page===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`;
  if(a.type==='alert') return `<input data-p="text" data-i="${i}" style="flex:1" placeholder="Messaggio" value="${esc(a.text||'')}">`;
  if(a.type==='openUrl') return `<input data-p="url" data-i="${i}" style="flex:1" placeholder="https://..." value="${esc(a.url||'')}">`;
  if(['addRow','exportCsv','exportJson','clearTable'].includes(a.type)){
    const tables = tablesAll();
    if(!tables.length) return `<span class="muted" style="flex:1">nessuna tabella nello schema</span>`;
    return `<select data-p="storageKey" data-i="${i}" style="flex:1">${tables.map(t=>`<option value="${t.storageKey}" ${a.storageKey===t.storageKey?'selected':''}>${esc(t.title||t.storageKey)}</option>`).join('')}</select>`;
  }
  if(a.type==='js') return `<input data-p="code" data-i="${i}" style="flex:1" placeholder="alert('hi')" value="${esc(a.code||'')}">`;
  if(a.type==='logout') return `<span class="muted" style="flex:1">nessun parametro</span>`;
  return '';
}
function tablesAll(){ const arr=[]; walkAll(b=>{ if(b.type==='table') arr.push(b); }); return arr; }
function walkAll(cb){
  const rec = arr => (arr||[]).forEach(b=>{ cb(b); if(b.type==='section') rec(b.children); if(b.type==='columns') (b.cols_content||[]).forEach(c=>rec(c)); });
  RG.get().pages.forEach(p=>rec(p.blocks));
}

// -------- runner azioni --------
const actions = {
  run(a){
    if(!a) return;
    if(a.type==='goto') RG_render.goto(a.page);
    else if(a.type==='alert') alert(a.text||'');
    else if(a.type==='openUrl') window.open(a.url,'_blank');
    else if(a.type==='exportCsv'){ const b=tablesAll().find(x=>x.storageKey===a.storageKey); if(b) exportTable(b,'csv'); }
    else if(a.type==='exportJson'){ const b=tablesAll().find(x=>x.storageKey===a.storageKey); if(b) exportTable(b,'json'); }
    else if(a.type==='addRow'){ const b=tablesAll().find(x=>x.storageKey===a.storageKey); if(b) openRowForm(b, null); }
    else if(a.type==='clearTable'){ if(confirm('Svuotare?')){ RG.dataSet(a.storageKey, []); RG_render.rerender(); } }
    else if(a.type==='logout'){ sessionStorage.removeItem('rg-user'); location.reload(); }
    else if(a.type==='js'){ try{ new Function(a.code||'')(); }catch(e){ alert('Errore JS: '+e.message); } }
  }
};

// -------- pulsanti (editor condiviso) --------
function editButtons(blk, done){
  const render = ()=>{
    const capture = ()=>{
      document.querySelectorAll('#dlg #_bl .it').forEach(it=>{
        const i=+it.dataset.i, item=blk.items[i]; if(!item) return;
        item.label = it.querySelector('[data-f=label]').value;
        item.style = it.querySelector('[data-f=style]').value;
        const type = it.querySelector('[data-a=type]').value;
        const params = {};
        it.querySelectorAll('[data-p]').forEach(p=>params[p.dataset.p]=p.value);
        item.action = Object.assign({type}, params);
      });
    };
    dlg(`
      <div class="h">✎ Pulsanti<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>Layout</label>
          <select id="_layout"><option value="row" ${blk.layout!=='stack'?'selected':''}>orizzontale</option><option value="stack" ${blk.layout==='stack'?'selected':''}>verticale</option></select></div>
        <div class="fld"><label>Allineamento</label>
          <select id="_align">${['left','center','right'].map(a=>`<option ${blk.align===a?'selected':''}>${a}</option>`).join('')}</select></div>
        <div class="list" id="_bl">
          ${blk.items.map((it,i)=>`
            <div class="it" data-i="${i}" style="flex-direction:column;align-items:stretch">
              <div style="display:flex;gap:6px;align-items:center">
                <input style="flex:2" data-f="label" value="${esc(it.label)}" placeholder="Etichetta">
                <select data-f="style" style="width:100px">${['primary','default','danger','ghost'].map(s=>`<option ${it.style===s?'selected':''}>${s}</option>`).join('')}</select>
                <button class="btn sm" data-a="up">▲</button><button class="btn sm" data-a="dn">▼</button><button class="btn sm danger" data-a="rm">✕</button>
              </div>
              <div style="display:flex;gap:6px;align-items:center;margin-top:6px" data-act-wrap>
                <label style="font-size:11px;color:var(--muted)">Azione:</label>
                ${actionEditor(it.action, i)}
              </div>
            </div>
          `).join('')}
        </div>
        <button class="btn" id="_add">➕ Aggiungi pulsante</button>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{
      capture();
      blk.layout = ok('#_layout').value;
      blk.align = ok('#_align').value;
      done();
    }, dlgEl=>{
      dlgEl.querySelectorAll('#_bl .it').forEach(it=>{
        const i=+it.dataset.i;
        it.querySelector('[data-a=up]').onclick=()=>{if(i<=0)return;[blk.items[i-1],blk.items[i]]=[blk.items[i],blk.items[i-1]];render();};
        it.querySelector('[data-a=dn]').onclick=()=>{if(i>=blk.items.length-1)return;[blk.items[i+1],blk.items[i]]=[blk.items[i],blk.items[i+1]];render();};
        it.querySelector('[data-a=rm]').onclick=()=>{blk.items.splice(i,1);render();};
        const sel = it.querySelector('[data-a=type]');
        sel.onchange = ()=>{
          const w = it.querySelector('[data-act-wrap] [data-a=params]');
          w.innerHTML = actionParams({type:sel.value}, i);
        };
      });
      dlgEl.querySelector('#_add').onclick = ()=>{ capture(); blk.items.push({label:'Pulsante',style:'default',action:{type:'alert',text:''}}); render(); };
    });
  };
  render();
}

// -------- item list generico (usato da card-grid, stat-grid, gallery, accordion, testimonial, social, contact) --------
// opts: {title, extraTop?, itemDefaults(), itemFields(it,i), onCaptureExtra?(ok), onMount?(dlg,reRender), fields:[...]}
function editItemList(blk, opts, done){
  if(!Array.isArray(blk.items)) blk.items = [];
  function render(){
    const capture = ()=>{
      document.querySelectorAll('#dlg #_il .it').forEach(it=>{
        const i=+it.dataset.i; const item=blk.items[i]; if(!item) return;
        opts.fields.forEach(f=>{
          const inp = it.querySelector(`[data-f="${f}:${i}"]`);
          if(inp && inp.type!=='file') item[f] = inp.value;
        });
      });
    };
    const d = dlg(`
      <div class="h">✎ ${esc(opts.title||'Elementi')}<button class="x">×</button></div>
      <div class="b">
        ${opts.extraTop||''}
        <div class="list" id="_il">
          ${blk.items.map((it,i)=>`
            <div class="it" data-i="${i}" style="flex-direction:column;align-items:stretch;gap:6px">
              <div style="display:flex;gap:6px;justify-content:flex-end">
                <button class="btn sm" data-a="up">▲</button><button class="btn sm" data-a="dn">▼</button><button class="btn sm danger" data-a="rm">✕</button>
              </div>
              ${opts.itemFields(it,i)}
            </div>`).join('')}
        </div>
        <button class="btn" id="_add">➕ Aggiungi</button>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{
      capture();
      opts.onCaptureExtra && opts.onCaptureExtra(ok);
      done();
    }, dlgEl=>{
      dlgEl.querySelectorAll('#_il .it').forEach(it=>{
        const i=+it.dataset.i;
        it.querySelector('[data-a=up]').onclick=()=>{if(i<=0)return;[blk.items[i-1],blk.items[i]]=[blk.items[i],blk.items[i-1]];render();};
        it.querySelector('[data-a=dn]').onclick=()=>{if(i>=blk.items.length-1)return;[blk.items[i+1],blk.items[i]]=[blk.items[i],blk.items[i+1]];render();};
        it.querySelector('[data-a=rm]').onclick=()=>{blk.items.splice(i,1);render();};
        // handle file inputs per-field
        it.querySelectorAll('input[type=file][data-f]').forEach(fi=>{
          const [key,idx] = fi.dataset.f.split(':');
          if(key.endsWith('f')){
            fi.onchange = e=>{
              const f=e.target.files[0]; if(!f) return;
              const r=new FileReader(); r.onload=()=>{
                const target = it.querySelector(`[data-f="${key.slice(0,-1)}:${idx}"]`);
                if(target){ target.value=r.result; }
              }; r.readAsDataURL(f);
            };
          }
        });
      });
      dlgEl.querySelector('#_add').onclick=()=>{ capture(); blk.items.push(opts.itemDefaults()); render(); };
      opts.onMount && opts.onMount(dlgEl, ()=>{ capture(); render(); });
    });
  }
  render();
}

// -------- Table rendering + editing --------
function renderTable(el, blk){
  const rows = RG.dataGet(blk.storageKey);
  const cols = blk.columns||[];
  let html = `<div class="thead"><div class="name">${esc(blk.title||'Tabella')}</div>`;
  if(blk.allowExport) html += `<button class="btn sm" data-t="csv">CSV</button><button class="btn sm" data-t="json">JSON</button>`;
  html += `</div>`;
  if(blk.allowAdd) html += `<div class="tbar"><button class="btn sm primary" data-t="add">➕ Aggiungi riga</button>${blk.allowDelete?`<button class="btn sm" data-t="clear">🗑 Svuota</button>`:''}</div>`;
  if(!rows.length){ html += `<div class="empty">Nessun dato.</div>`; }
  else {
    html += `<div class="tbl-wrap"><table><thead><tr>`+cols.map(c=>`<th>${esc(c.label)}</th>`).join('')+`${(blk.allowEdit||blk.allowDelete)?'<th></th>':''}</tr></thead><tbody>`;
    rows.forEach((r,i)=>{
      html += '<tr>' + cols.map(c=>`<td>${esc(formatCell(r[c.key], c))}</td>`).join('') +
        `${(blk.allowEdit||blk.allowDelete)?`<td style="text-align:right">${blk.allowEdit?`<button class="row-edit" data-i="${i}">✎</button>`:''}${blk.allowDelete?`<button class="row-del" data-i="${i}">✕</button>`:''}</td>`:''}</tr>`;
    });
    html += '</tbody></table></div>';
  }
  el.innerHTML = html;
  el.classList.add('blk-table');
  el.querySelectorAll('[data-t]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const t=b.dataset.t;
    if(t==='add') openRowForm(blk, null);
    else if(t==='csv') exportTable(blk,'csv');
    else if(t==='json') exportTable(blk,'json');
    else if(t==='clear'){ if(confirm('Svuotare?')){ RG.dataSet(blk.storageKey,[]); RG_render.rerender(); } }
  });
  el.querySelectorAll('.row-del').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=+b.dataset.i;const rs=RG.dataGet(blk.storageKey);rs.splice(i,1);RG.dataSet(blk.storageKey,rs);RG_render.rerender();});
  el.querySelectorAll('.row-edit').forEach(b=>b.onclick=e=>{e.stopPropagation();openRowForm(blk,+b.dataset.i);});
}

function formatCell(v,col){ if(v==null||v==='') return '';
  if(col.type==='datetime'){ const d=new Date(v); return isNaN(d)?v:d.toLocaleString(); }
  return String(v);
}
function fieldInput(c, v){
  v = v==null?'':v;
  if(c.type==='textarea') return `<textarea name="${c.key}" rows="3">${esc(v)}</textarea>`;
  if(c.type==='select') return `<select name="${c.key}">${(c.options||[]).map(o=>`<option ${o==v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  if(c.type==='number') return `<input type="number" name="${c.key}" value="${esc(v)}">`;
  if(c.type==='date') return `<input type="date" name="${c.key}" value="${esc(v)}">`;
  if(c.type==='datetime') return `<input type="datetime-local" name="${c.key}" value="${esc(String(v).slice(0,16))}">`;
  return `<input name="${c.key}" value="${esc(v)}">`;
}
function openRowForm(blk, idx){
  const rs = RG.dataGet(blk.storageKey);
  const row = idx==null ? {} : {...rs[idx]};
  dlg(`
    <div class="h">${idx==null?'➕ Nuova riga':'✎ Modifica riga'}<button class="x">×</button></div>
    <div class="b">${blk.columns.map(c=>`<div class="fld"><label>${esc(c.label)}</label>${fieldInput(c,row[c.key])}</div>`).join('')}</div>
    <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">${idx==null?'Aggiungi':'Salva'}</button></div>
  `, ok=>{
    blk.columns.forEach(c=>{ const i=document.querySelector(`#dlg [name="${c.key}"]`); if(i) row[c.key]=i.value; });
    if(idx==null){ blk.columns.forEach(c=>{ if(c.type==='datetime' && !row[c.key]) row[c.key]=new Date().toISOString(); }); rs.push(row); }
    else rs[idx] = row;
    RG.dataSet(blk.storageKey, rs); RG_render.rerender();
  });
}
function exportTable(blk, kind){
  const rs = RG.dataGet(blk.storageKey), cols=blk.columns;
  if(kind==='json') download(blk.storageKey+'.json', JSON.stringify(rs,null,2));
  else {
    const head = cols.map(c=>c.label).join(',');
    const body = rs.map(r=>cols.map(c=>`"${(r[c.key]==null?'':String(r[c.key])).replace(/"/g,'""')}"`).join(',')).join('\n');
    download(blk.storageKey+'.csv', head+'\n'+body, 'text/csv');
  }
}

// -------- editTable dialog --------
function editTable(blk, done){
  function render(){
    const d = dlg(`
      <div class="h">✎ Tabella<button class="x">×</button></div>
      <div class="tabs">
        <button class="active" data-tab="props">Proprietà</button>
        <button data-tab="cols">Colonne</button>
        <button data-tab="rows">Righe (${RG.dataGet(blk.storageKey).length})</button>
      </div>
      <div class="b" id="_body"></div>
      <div class="f"><button class="btn" data-x>Chiudi</button></div>
    `, null, dEl=>{
      const body = dEl.querySelector('#_body');
      const tabs = dEl.querySelectorAll('.tabs button');
      tabs.forEach(t=>t.onclick=()=>{ tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active'); tab(t.dataset.tab); });
      tab('props');
      dEl.addEventListener('close', ()=>done());

      function tab(name){
        if(name==='props'){
          body.innerHTML = `
            <div class="fld"><label>Titolo tabella</label><input id="_t" value="${esc(blk.title)}"></div>
            <div class="fld"><label>Chiave storage</label><input id="_k" value="${esc(blk.storageKey)}"></div>
            <div class="row">
              <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="_a" ${blk.allowAdd?'checked':''}>Consenti aggiunta</label>
              <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="_d" ${blk.allowDelete?'checked':''}>Consenti eliminazione</label>
            </div>
            <div class="row">
              <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="_e" ${blk.allowEdit?'checked':''}>Consenti modifica</label>
              <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="_x" ${blk.allowExport?'checked':''}>Consenti export</label>
            </div>
            <button class="btn primary" id="_save">Salva proprietà</button>`;
          body.querySelector('#_save').onclick=()=>{
            blk.title=body.querySelector('#_t').value; blk.storageKey=body.querySelector('#_k').value.trim()||blk.storageKey;
            blk.allowAdd=body.querySelector('#_a').checked; blk.allowDelete=body.querySelector('#_d').checked;
            blk.allowEdit=body.querySelector('#_e').checked; blk.allowExport=body.querySelector('#_x').checked;
            RG.save(); RG_render.rerender(); alert('Salvato');
          };
        } else if(name==='cols'){
          body.innerHTML = `
            <div class="list" id="_cl">${blk.columns.map((c,i)=>`
              <div class="it" data-i="${i}">
                <input style="width:90px" value="${esc(c.key)}" data-f="key">
                <input style="flex:1" value="${esc(c.label)}" data-f="label">
                <select data-f="type" style="width:110px">${['text','textarea','number','date','datetime','select'].map(t=>`<option ${c.type===t?'selected':''}>${t}</option>`).join('')}</select>
                <button class="btn sm" data-a="opts" title="opzioni">⚙</button>
                <button class="btn sm" data-a="up">▲</button><button class="btn sm" data-a="dn">▼</button><button class="btn sm danger" data-a="rm">✕</button>
              </div>`).join('')}</div>
            <button class="btn" id="_add">➕ Aggiungi colonna</button>
            <button class="btn primary" id="_savec">Salva colonne</button>`;
          body.querySelectorAll('#_cl .it').forEach(it=>{
            const i=+it.dataset.i;
            it.querySelector('[data-a=opts]').onclick=()=>{
              const c=blk.columns[i]; const s=prompt('Opzioni (una per riga o separate da virgola):', (c.options||[]).join('\n')); if(s==null)return;
              c.options = s.split(/[\n,]/).map(x=>x.trim()).filter(Boolean); alert('Salvate ('+c.options.length+').');
            };
            it.querySelector('[data-a=up]').onclick=()=>{if(i<=0)return;[blk.columns[i-1],blk.columns[i]]=[blk.columns[i],blk.columns[i-1]];tab('cols');};
            it.querySelector('[data-a=dn]').onclick=()=>{if(i>=blk.columns.length-1)return;[blk.columns[i+1],blk.columns[i]]=[blk.columns[i],blk.columns[i+1]];tab('cols');};
            it.querySelector('[data-a=rm]').onclick=()=>{if(!confirm('Rimuovere?'))return;blk.columns.splice(i,1);tab('cols');};
          });
          body.querySelector('#_add').onclick=()=>{blk.columns.push({key:'col'+(blk.columns.length+1),label:'Nuova colonna',type:'text'});tab('cols');};
          body.querySelector('#_savec').onclick=()=>{
            body.querySelectorAll('#_cl .it').forEach(it=>{const i=+it.dataset.i;const c=blk.columns[i];
              c.key=it.querySelector('[data-f=key]').value.trim()||c.key;
              c.label=it.querySelector('[data-f=label]').value;
              c.type=it.querySelector('[data-f=type]').value;
            });
            RG.save(); RG_render.rerender(); alert('Colonne salvate');
          };
        } else if(name==='rows'){
          const rows=RG.dataGet(blk.storageKey);
          body.innerHTML = `
            <button class="btn primary" id="_add">➕ Aggiungi riga</button>
            <div class="tbl-wrap"><table style="width:100%;font-size:12px">
              <thead><tr>${blk.columns.map(c=>`<th style="text-align:left;padding:6px;border-bottom:1px solid var(--border)">${esc(c.label)}</th>`).join('')}<th></th></tr></thead>
              <tbody>${rows.map((r,i)=>`<tr>${blk.columns.map(c=>`<td style="padding:6px;border-bottom:1px solid var(--border)">${esc(r[c.key]||'')}</td>`).join('')}
                <td style="text-align:right"><button class="btn sm" data-re="${i}">✎</button><button class="btn sm danger" data-rr="${i}">✕</button></td></tr>`).join('')}</tbody>
            </table></div>`;
          body.querySelector('#_add').onclick=()=>{ d.close(); RG_render.rerender();
            setTimeout(()=>{ const btn=document.querySelector(`[data-block-id="${blk.id}"] [data-t=add]`); if(btn) btn.click(); },100);};
          body.querySelectorAll('[data-rr]').forEach(b=>b.onclick=()=>{const i=+b.dataset.rr; if(!confirm('Eliminare?'))return; const rs=RG.dataGet(blk.storageKey); rs.splice(i,1); RG.dataSet(blk.storageKey,rs); tab('rows');});
          body.querySelectorAll('[data-re]').forEach(b=>b.onclick=()=>{ d.close(); RG_render.rerender(); setTimeout(()=>{const btn=document.querySelector(`[data-block-id="${blk.id}"] .row-edit[data-i="${b.dataset.re}"]`); if(btn) btn.click();},100);});
        }
      }
    });
  }
  render();
}

window.RG_ui = { dlg, download, actionEditor, actionParams, editButtons, editItemList, renderTable, editTable, openRowForm };
window.RG_actions = actions;
})();
