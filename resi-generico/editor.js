// EDITOR — pannelli per header, tema, pagine, blocchi, tabelle, pulsanti
(function(){
  const dlg = document.getElementById('dlg');
  const bar = document.getElementById('editorBar');

  function enable(){ document.body.classList.add('edit-on'); bar.classList.remove('hidden'); RG_render.rerender(); }
  function disable(){ document.body.classList.remove('edit-on'); bar.classList.add('hidden'); RG_render.rerender(); }

  bar.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const a = b.dataset.act;
    if(a==='header') openHeader();
    else if(a==='theme') openTheme();
    else if(a==='pages') openPages();
    else if(a==='addblock') openAddBlock();
    else if(a==='io') openIO();
    else if(a==='reset'){ if(confirm('Reset TOTALE ai default? Perdi le personalizzazioni (i dati delle tabelle restano).')){ RG.reset(); RG_render.rerender(); } }
    else if(a==='off') disable();
  });

  function E(html){ dlg.innerHTML=html; dlg.showModal(); dlg.querySelectorAll('.x').forEach(x=>x.onclick=()=>dlg.close()); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // ============ HEADER ============
  function openHeader(){
    const s = RG.get(); const h=s.header, b=s.brand;
    E(`
      <div class="h">🎨 Header e Logo<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>Titolo</label><input id="h_title" value="${esc(h.title)}"></div>
        <div class="fld"><label>Sottotitolo</label><input id="h_sub" value="${esc(h.subtitle||'')}"></div>
        <div class="fld"><label>Nome azienda (usato se titolo vuoto)</label><input id="h_brand" value="${esc(b.name)}"></div>

        <div class="fld"><label>Logo (carica dalla galleria)</label>
          ${b.logo?`<img src="${b.logo}" style="max-height:80px;border-radius:8px;background:#fff2;padding:4px;align-self:flex-start">`:''}
          <input type="file" id="h_logofile" accept="image/*">
          <input id="h_logourl" placeholder="oppure URL immagine" value="${esc(b.logo)}">
          <button class="btn sm" id="h_logoclear">Rimuovi logo</button>
        </div>

        <div class="row">
          <div class="fld"><label>Posizione logo</label>
            <select id="h_lpos">${['left','center','right','none'].map(x=>`<option ${h.logoPos===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fld"><label>Dim. logo (px)</label>
            <input type="number" id="h_lsize" value="${h.logoSize||36}"></div>
        </div>
        <div class="row">
          <div class="fld"><label>Allineamento</label>
            <select id="h_align">${['left','center','right'].map(x=>`<option ${h.align===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fld"><label>Header visibile</label>
            <select id="h_show"><option value="1" ${h.show!==false?'selected':''}>Sì</option><option value="0" ${h.show===false?'selected':''}>No</option></select></div>
        </div>
        <div class="row">
          <div class="fld"><label>Sfondo</label><input type="color" id="h_bg" value="${h.bg||'#141a22'}"></div>
          <div class="fld"><label>Testo</label><input type="color" id="h_tx" value="${h.text||'#e6edf3'}"></div>
        </div>
      </div>
      <div class="f"><button class="btn" id="h_cancel">Annulla</button><button class="btn primary" id="h_ok">Applica</button></div>
    `);
    dlg.querySelector('#h_logofile').onchange = e=>{
      const f=e.target.files[0]; if(!f) return;
      const r=new FileReader(); r.onload=()=>{ dlg.querySelector('#h_logourl').value = r.result; alert('Logo caricato. Premi Applica.'); }; r.readAsDataURL(f);
    };
    dlg.querySelector('#h_logoclear').onclick = ()=>{ dlg.querySelector('#h_logourl').value=''; };
    dlg.querySelector('#h_cancel').onclick = ()=>dlg.close();
    dlg.querySelector('#h_ok').onclick = ()=>{
      h.title = dlg.querySelector('#h_title').value;
      h.subtitle = dlg.querySelector('#h_sub').value;
      b.name = dlg.querySelector('#h_brand').value;
      b.logo = dlg.querySelector('#h_logourl').value;
      h.logoPos = dlg.querySelector('#h_lpos').value;
      h.logoSize = +dlg.querySelector('#h_lsize').value || 36;
      h.align = dlg.querySelector('#h_align').value;
      h.show = dlg.querySelector('#h_show').value==='1';
      h.bg = dlg.querySelector('#h_bg').value;
      h.text = dlg.querySelector('#h_tx').value;
      RG.save(); RG_render.rerender(); dlg.close();
    };
  }

  // ============ TEMA ============
  function openTheme(){
    const t = RG.get().theme;
    const keys = Object.keys(t);
    E(`
      <div class="h">🌈 Tema — colori globali<button class="x">×</button></div>
      <div class="b">
        ${keys.map(k=>`<div style="display:flex;align-items:center;gap:8px">
          <label style="flex:1;font-size:13px">--${k}</label>
          <input type="color" data-k="${k}" value="${t[k]||'#000000'}">
        </div>`).join('')}
      </div>
      <div class="f"><button class="btn" id="t_cancel">Annulla</button><button class="btn primary" id="t_ok">Applica</button></div>
    `);
    dlg.querySelector('#t_cancel').onclick = ()=>dlg.close();
    dlg.querySelector('#t_ok').onclick = ()=>{
      dlg.querySelectorAll('input[type=color][data-k]').forEach(i=>{ t[i.dataset.k]=i.value; });
      RG.save(); RG_render.rerender(); dlg.close();
    };
  }

  // ============ PAGINE ============
  function openPages(){
    const pages = RG.get().pages;
    E(`
      <div class="h">📄 Pagine<button class="x">×</button></div>
      <div class="b">
        <div class="list" id="pgl">
          ${pages.map((p,i)=>`
            <div class="it" data-i="${i}">
              <input style="width:36px;text-align:center" value="${esc(p.icon||'')}" data-f="icon">
              <input style="flex:1" value="${esc(p.name)}" data-f="name">
              <input style="width:100px" value="${esc(p.id)}" data-f="id">
              <button class="btn sm" data-a="up">▲</button>
              <button class="btn sm" data-a="dn">▼</button>
              <button class="btn sm danger" data-a="rm">✕</button>
            </div>
          `).join('')}
        </div>
        <button class="btn" id="pg_add">➕ Aggiungi pagina</button>
      </div>
      <div class="f"><button class="btn" id="pg_cancel">Annulla</button><button class="btn primary" id="pg_ok">Salva</button></div>
    `);
    const list = dlg.querySelector('#pgl');
    list.querySelectorAll('.it').forEach(it=>{
      it.querySelector('[data-a=up]').onclick = ()=>{
        const i=+it.dataset.i; if(i<=0) return; [pages[i-1],pages[i]]=[pages[i],pages[i-1]]; RG.save(); openPages();
      };
      it.querySelector('[data-a=dn]').onclick = ()=>{
        const i=+it.dataset.i; if(i>=pages.length-1) return; [pages[i+1],pages[i]]=[pages[i],pages[i+1]]; RG.save(); openPages();
      };
      it.querySelector('[data-a=rm]').onclick = ()=>{
        const i=+it.dataset.i;
        if(pages.length<=1){ alert('Almeno una pagina.'); return; }
        if(!confirm('Rimuovere pagina "'+pages[i].name+'"?')) return;
        pages.splice(i,1); RG.save(); openPages();
      };
    });
    dlg.querySelector('#pg_add').onclick = ()=>{
      const id = 'p_'+Math.random().toString(36).slice(2,6);
      pages.push({id, name:'Nuova pagina', icon:'📄', blocks:[]});
      RG.save(); openPages();
    };
    dlg.querySelector('#pg_cancel').onclick = ()=>dlg.close();
    dlg.querySelector('#pg_ok').onclick = ()=>{
      list.querySelectorAll('.it').forEach(it=>{
        const i=+it.dataset.i;
        pages[i].icon = it.querySelector('[data-f=icon]').value;
        pages[i].name = it.querySelector('[data-f=name]').value;
        const newId = it.querySelector('[data-f=id]').value.trim() || pages[i].id;
        pages[i].id = newId;
      });
      RG.save(); RG_render.rerender(); dlg.close();
    };
  }

  // ============ AGGIUNGI BLOCCO ============
  function openAddBlock(){
    const pages = RG.get().pages;
    const curId = RG_render.currentPageId;
    E(`
      <div class="h">➕ Nuovo blocco<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>In pagina</label>
          <select id="ab_page">${pages.map(p=>`<option value="${p.id}" ${p.id===curId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="fld"><label>Tipo</label>
          <select id="ab_type">
            <option value="text">Testo / titolo</option>
            <option value="buttons">Pulsanti</option>
            <option value="table">Tabella</option>
            <option value="image">Immagine</option>
            <option value="html">HTML libero</option>
          </select></div>
      </div>
      <div class="f"><button class="btn" id="ab_cancel">Annulla</button><button class="btn primary" id="ab_ok">Crea</button></div>
    `);
    dlg.querySelector('#ab_cancel').onclick = ()=>dlg.close();
    dlg.querySelector('#ab_ok').onclick = ()=>{
      const pid = dlg.querySelector('#ab_page').value;
      const t = dlg.querySelector('#ab_type').value;
      const page = pages.find(p=>p.id===pid);
      const blk = defaultBlock(t);
      page.blocks.push(blk); RG.save(); RG_render.goto(pid); dlg.close();
      setTimeout(()=>editBlock(page, page.blocks.length-1),120);
    };
  }

  function defaultBlock(t){
    const id = RG.uid('b_');
    if(t==='text') return {id, type:'text', tag:'p', text:'Nuovo testo', align:'left', color:'', fontSize:15, fontWeight:'400', padding:0};
    if(t==='buttons') return {id, type:'buttons', layout:'row', items:[{label:'Nuovo pulsante', style:'primary', action:{type:'alert', text:'Ciao!'}}]};
    if(t==='table') return {id, type:'table', title:'Nuova tabella', storageKey:'t_'+id.slice(2),
      columns:[{key:'col1',label:'Colonna 1',type:'text'}], allowAdd:true, allowDelete:true, allowEdit:true, allowExport:true};
    if(t==='image') return {id, type:'image', src:'icon.svg', width:100, align:'center'};
    if(t==='html') return {id, type:'html', html:'<p>Contenuto libero</p>'};
  }

  // ============ EDIT BLOCCO ============
  function editBlock(page, idx){
    const blk = page.blocks[idx];
    if(blk.type==='text') editText(page, blk);
    else if(blk.type==='buttons') editButtons(page, blk);
    else if(blk.type==='table') editTable(page, blk);
    else if(blk.type==='image') editImage(page, blk);
    else if(blk.type==='html') editHtml(page, blk);
  }

  function editText(page, blk){
    E(`
      <div class="h">✎ Testo<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>Contenuto</label><textarea id="t_text" rows="3">${esc(blk.text)}</textarea></div>
        <div class="row3">
          <div class="fld"><label>Tag</label>
            <select id="t_tag">${['h1','h2','h3','p','div'].map(x=>`<option ${blk.tag===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fld"><label>Font size</label><input type="number" id="t_fs" value="${blk.fontSize||15}"></div>
          <div class="fld"><label>Weight</label>
            <select id="t_fw">${['400','500','600','700','800','900'].map(x=>`<option ${(blk.fontWeight||'400')==x?'selected':''}>${x}</option>`).join('')}</select></div>
        </div>
        <div class="row">
          <div class="fld"><label>Allineamento</label>
            <select id="t_al">${['left','center','right','justify'].map(x=>`<option ${blk.align===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fld"><label>Colore</label><input type="color" id="t_col" value="${blk.color||'#e6edf3'}"></div>
        </div>
        <div class="fld"><label>Padding (px)</label><input type="number" id="t_pd" value="${blk.padding||0}"></div>
      </div>
      <div class="f"><button class="btn" id="tc">Annulla</button><button class="btn primary" id="to">Salva</button></div>
    `);
    dlg.querySelector('#tc').onclick = ()=>dlg.close();
    dlg.querySelector('#to').onclick = ()=>{
      blk.text = dlg.querySelector('#t_text').value;
      blk.tag  = dlg.querySelector('#t_tag').value;
      blk.fontSize = +dlg.querySelector('#t_fs').value||15;
      blk.fontWeight = dlg.querySelector('#t_fw').value;
      blk.align = dlg.querySelector('#t_al').value;
      blk.color = dlg.querySelector('#t_col').value;
      blk.padding = +dlg.querySelector('#t_pd').value||0;
      RG.save(); RG_render.rerender(); dlg.close();
    };
  }

  function editButtons(page, blk){
    const pages = RG.get().pages;
    function actionEditor(a, prefix){
      a = a || {type:'alert', text:''};
      const types = ['goto','alert','openUrl','addRow','exportCsv','exportJson','clearTable','logout','js'];
      return `
        <select data-a="type" ${prefix?`data-p="${prefix}"`:''}>
          ${types.map(t=>`<option ${a.type===t?'selected':''} value="${t}">${t}</option>`).join('')}
        </select>
        <div data-a="params">${actionParams(a, pages)}</div>
      `;
    }
    function render(){
      E(`
        <div class="h">✎ Pulsanti<button class="x">×</button></div>
        <div class="b">
          <div class="fld"><label>Layout</label>
            <select id="b_layout"><option value="row" ${blk.layout!=='stack'?'selected':''}>orizzontale</option><option value="stack" ${blk.layout==='stack'?'selected':''}>verticale (larghezza piena)</option></select></div>
          <div class="list" id="b_list">
            ${blk.items.map((it,i)=>`
              <div class="it" data-i="${i}" style="flex-direction:column;align-items:stretch">
                <div style="display:flex;gap:6px;align-items:center">
                  <input style="flex:2" data-f="label" value="${esc(it.label)}" placeholder="Etichetta">
                  <select data-f="style" style="width:110px">
                    ${['default','primary','danger','ghost'].map(s=>`<option ${it.style===s?'selected':''}>${s}</option>`).join('')}
                  </select>
                  <button class="btn sm" data-a="up">▲</button>
                  <button class="btn sm" data-a="dn">▼</button>
                  <button class="btn sm danger" data-a="rm">✕</button>
                </div>
                <div style="display:flex;gap:6px;align-items:center;margin-top:6px" data-act-wrap>
                  <label style="font-size:11px;color:var(--muted)">Azione:</label>
                  ${actionEditor(it.action)}
                </div>
              </div>
            `).join('')}
          </div>
          <button class="btn" id="b_add">➕ Aggiungi pulsante</button>
        </div>
        <div class="f"><button class="btn" id="bc">Annulla</button><button class="btn primary" id="bo">Salva</button></div>
      `);
      dlg.querySelectorAll('#b_list .it').forEach(it=>{
        const i=+it.dataset.i;
        const wrap = it.querySelector('[data-act-wrap]');
        const sel = wrap.querySelector('[data-a=type]');
        sel.onchange = ()=>{
          const a = {type:sel.value};
          wrap.querySelector('[data-a=params]').innerHTML = actionParams(a, pages);
        };
        it.querySelector('[data-a=up]').onclick = ()=>{ if(i<=0)return; [blk.items[i-1],blk.items[i]]=[blk.items[i],blk.items[i-1]]; capture(); render(); };
        it.querySelector('[data-a=dn]').onclick = ()=>{ if(i>=blk.items.length-1)return; [blk.items[i+1],blk.items[i]]=[blk.items[i],blk.items[i+1]]; capture(); render(); };
        it.querySelector('[data-a=rm]').onclick = ()=>{ blk.items.splice(i,1); render(); };
      });
      dlg.querySelector('#b_add').onclick = ()=>{ capture(); blk.items.push({label:'Pulsante', style:'default', action:{type:'alert',text:''}}); render(); };
      dlg.querySelector('#bc').onclick = ()=>dlg.close();
      dlg.querySelector('#bo').onclick = ()=>{ capture(); blk.layout = dlg.querySelector('#b_layout').value; RG.save(); RG_render.rerender(); dlg.close(); };
      function capture(){
        dlg.querySelectorAll('#b_list .it').forEach(it=>{
          const i=+it.dataset.i;
          const item = blk.items[i]; if(!item) return;
          item.label = it.querySelector('[data-f=label]').value;
          item.style = it.querySelector('[data-f=style]').value;
          const wrap = it.querySelector('[data-act-wrap]');
          const type = wrap.querySelector('[data-a=type]').value;
          const params = {};
          wrap.querySelectorAll('[data-p]').forEach(inp=>{ params[inp.dataset.p] = inp.value; });
          item.action = Object.assign({type}, params);
        });
      }
    }
    render();
  }

  function actionParams(a, pages){
    if(a.type==='goto'){
      return `<select data-p="page" style="flex:1">${pages.map(p=>`<option value="${p.id}" ${a.page===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`;
    }
    if(a.type==='alert') return `<input data-p="text" style="flex:1" placeholder="Messaggio" value="${esc(a.text||'')}">`;
    if(a.type==='openUrl') return `<input data-p="url" style="flex:1" placeholder="https://..." value="${esc(a.url||'')}">`;
    if(a.type==='addRow'||a.type==='exportCsv'||a.type==='exportJson'||a.type==='clearTable'){
      const tables = tablesAll();
      return `<select data-p="storageKey" style="flex:1">${tables.map(t=>`<option value="${t.storageKey}" ${a.storageKey===t.storageKey?'selected':''}>${esc(t.title)} (${t.storageKey})</option>`).join('')}</select>`;
    }
    if(a.type==='js') return `<textarea data-p="code" rows="2" style="flex:1" placeholder="alert('hi')">${esc(a.code||'')}</textarea>`;
    if(a.type==='logout') return `<span class="muted" style="flex:1">nessun parametro</span>`;
    return '';
  }
  function tablesAll(){ const arr=[]; RG.get().pages.forEach(p=>(p.blocks||[]).forEach(b=>{ if(b.type==='table') arr.push(b); })); return arr; }

  function editTable(page, blk){
    function render(){
      E(`
        <div class="h">✎ Tabella<button class="x">×</button></div>
        <div class="tabs">
          <button class="active" data-tab="props">Proprietà</button>
          <button data-tab="cols">Colonne</button>
          <button data-tab="rows">Righe (${RG.dataGet(blk.storageKey).length})</button>
        </div>
        <div class="b" id="tb_body"></div>
        <div class="f"><button class="btn" id="tbc">Chiudi</button></div>
      `);
      dlg.querySelector('#tbc').onclick = ()=>{ RG.save(); RG_render.rerender(); dlg.close(); };
      const body = dlg.querySelector('#tb_body');
      const tabs = dlg.querySelectorAll('.tabs button');
      tabs.forEach(t=>t.onclick = ()=>{ tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active'); tab(t.dataset.tab); });
      tab('props');

      function tab(name){
        if(name==='props'){
          body.innerHTML = `
            <div class="fld"><label>Titolo tabella</label><input id="tt_title" value="${esc(blk.title)}"></div>
            <div class="fld"><label>Chiave storage (dati)</label><input id="tt_key" value="${esc(blk.storageKey)}"><small class="muted">Cambiare svuota i dati collegati alla vecchia chiave.</small></div>
            <div class="row">
              <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="tt_add" ${blk.allowAdd?'checked':''}> Consenti aggiunta</label>
              <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="tt_del" ${blk.allowDelete?'checked':''}> Consenti eliminazione</label>
            </div>
            <div class="row">
              <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="tt_ed" ${blk.allowEdit?'checked':''}> Consenti modifica</label>
              <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="tt_ex" ${blk.allowExport?'checked':''}> Consenti export</label>
            </div>
            <button class="btn primary" id="tt_save">Salva proprietà</button>
          `;
          body.querySelector('#tt_save').onclick = ()=>{
            blk.title = body.querySelector('#tt_title').value;
            blk.storageKey = body.querySelector('#tt_key').value.trim() || blk.storageKey;
            blk.allowAdd = body.querySelector('#tt_add').checked;
            blk.allowDelete = body.querySelector('#tt_del').checked;
            blk.allowEdit = body.querySelector('#tt_ed').checked;
            blk.allowExport = body.querySelector('#tt_ex').checked;
            RG.save(); RG_render.rerender(); alert('Proprietà salvate.');
          };
        }
        else if(name==='cols'){
          body.innerHTML = `
            <div class="list" id="cl">${blk.columns.map((c,i)=>`
              <div class="it" data-i="${i}">
                <input style="width:90px" value="${esc(c.key)}" data-f="key" placeholder="chiave">
                <input style="flex:1" value="${esc(c.label)}" data-f="label" placeholder="etichetta">
                <select data-f="type" style="width:110px">${['text','textarea','number','date','datetime','select'].map(t=>`<option ${c.type===t?'selected':''}>${t}</option>`).join('')}</select>
                <button class="btn sm" data-a="opts" title="opzioni (select)">⚙</button>
                <button class="btn sm" data-a="up">▲</button>
                <button class="btn sm" data-a="dn">▼</button>
                <button class="btn sm danger" data-a="rm">✕</button>
              </div>
            `).join('')}</div>
            <button class="btn" id="c_add">➕ Aggiungi colonna</button>
            <button class="btn primary" id="c_save">Salva colonne</button>
          `;
          body.querySelectorAll('#cl .it').forEach(it=>{
            const i=+it.dataset.i;
            it.querySelector('[data-a=opts]').onclick = ()=>{
              const c = blk.columns[i];
              const s = prompt('Opzioni per il select (una per riga o separate da virgola):', (c.options||[]).join('\n'));
              if(s==null) return;
              c.options = s.split(/[\n,]/).map(x=>x.trim()).filter(Boolean);
              alert('Opzioni salvate ('+c.options.length+').');
            };
            it.querySelector('[data-a=up]').onclick = ()=>{ if(i<=0)return; [blk.columns[i-1],blk.columns[i]]=[blk.columns[i],blk.columns[i-1]]; tab('cols'); };
            it.querySelector('[data-a=dn]').onclick = ()=>{ if(i>=blk.columns.length-1)return; [blk.columns[i+1],blk.columns[i]]=[blk.columns[i],blk.columns[i+1]]; tab('cols'); };
            it.querySelector('[data-a=rm]').onclick = ()=>{ if(!confirm('Rimuovere colonna?'))return; blk.columns.splice(i,1); tab('cols'); };
          });
          body.querySelector('#c_add').onclick = ()=>{
            blk.columns.push({key:'col'+(blk.columns.length+1),label:'Nuova colonna',type:'text'});
            tab('cols');
          };
          body.querySelector('#c_save').onclick = ()=>{
            body.querySelectorAll('#cl .it').forEach(it=>{
              const i=+it.dataset.i; const c=blk.columns[i];
              c.key   = it.querySelector('[data-f=key]').value.trim() || c.key;
              c.label = it.querySelector('[data-f=label]').value;
              c.type  = it.querySelector('[data-f=type]').value;
            });
            RG.save(); RG_render.rerender(); alert('Colonne salvate.');
          };
        }
        else if(name==='rows'){
          const rows = RG.dataGet(blk.storageKey);
          body.innerHTML = `
            <button class="btn primary" id="r_add">➕ Aggiungi riga</button>
            <div class="tbl-wrap"><table style="width:100%;font-size:12px">
              <thead><tr>${blk.columns.map(c=>`<th style="text-align:left;padding:6px;border-bottom:1px solid var(--border)">${esc(c.label)}</th>`).join('')}<th></th></tr></thead>
              <tbody>${rows.map((r,i)=>`
                <tr>${blk.columns.map(c=>`<td style="padding:6px;border-bottom:1px solid var(--border)">${esc(r[c.key]||'')}</td>`).join('')}
                <td style="text-align:right">
                  <button class="btn sm" data-re="${i}">✎</button>
                  <button class="btn sm danger" data-rr="${i}">✕</button>
                </td></tr>`).join('')}</tbody>
            </table></div>
          `;
          body.querySelector('#r_add').onclick = ()=>{ dlg.close(); RG_render.rerender();
            // apre form riga: raggiungiamo la funzione via render.js re-render
            setTimeout(()=>{ const btn=document.querySelector(`[data-block-id="${blk.id}"] [data-t=add]`); if(btn) btn.click(); },100);
          };
          body.querySelectorAll('[data-rr]').forEach(b=>b.onclick=()=>{
            const i=+b.dataset.rr; if(!confirm('Eliminare riga?'))return;
            const rs=RG.dataGet(blk.storageKey); rs.splice(i,1); RG.dataSet(blk.storageKey,rs); tab('rows');
          });
          body.querySelectorAll('[data-re]').forEach(b=>b.onclick=()=>{
            dlg.close(); RG_render.rerender();
            setTimeout(()=>{ const btn=document.querySelector(`[data-block-id="${blk.id}"] .row-edit[data-i="${b.dataset.re}"]`); if(btn) btn.click(); },100);
          });
        }
      }
    }
    render();
  }

  function editImage(page, blk){
    E(`
      <div class="h">✎ Immagine<button class="x">×</button></div>
      <div class="b">
        <img src="${blk.src}" style="max-height:120px;align-self:flex-start;border-radius:8px;background:#fff2;padding:4px">
        <input type="file" id="i_file" accept="image/*">
        <div class="fld"><label>URL immagine</label><input id="i_url" value="${esc(blk.src)}"></div>
        <div class="row">
          <div class="fld"><label>Larghezza (%)</label><input type="number" id="i_w" value="${blk.width||100}"></div>
          <div class="fld"><label>Allineamento</label>
            <select id="i_al">${['left','center','right'].map(x=>`<option ${blk.align===x?'selected':''}>${x}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="f"><button class="btn" id="ic">Annulla</button><button class="btn primary" id="io">Salva</button></div>
    `);
    dlg.querySelector('#i_file').onchange = e=>{
      const f=e.target.files[0]; if(!f) return;
      const r=new FileReader(); r.onload=()=>{ dlg.querySelector('#i_url').value=r.result; }; r.readAsDataURL(f);
    };
    dlg.querySelector('#ic').onclick=()=>dlg.close();
    dlg.querySelector('#io').onclick=()=>{
      blk.src = dlg.querySelector('#i_url').value;
      blk.width = +dlg.querySelector('#i_w').value||100;
      blk.align = dlg.querySelector('#i_al').value;
      RG.save(); RG_render.rerender(); dlg.close();
    };
  }

  function editHtml(page, blk){
    E(`
      <div class="h">✎ HTML libero<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>HTML</label><textarea id="hh" rows="8">${esc(blk.html)}</textarea></div>
      </div>
      <div class="f"><button class="btn" id="hc">Annulla</button><button class="btn primary" id="ho">Salva</button></div>
    `);
    dlg.querySelector('#hc').onclick=()=>dlg.close();
    dlg.querySelector('#ho').onclick=()=>{ blk.html = dlg.querySelector('#hh').value; RG.save(); RG_render.rerender(); dlg.close(); };
  }

  // ============ IMPORT / EXPORT ============
  function openIO(){
    E(`
      <div class="h">📥 Import / Export<button class="x">×</button></div>
      <div class="b">
        <button class="btn" id="io_e">⬇ Esporta configurazione (schema.json)</button>
        <button class="btn" id="io_ea">⬇ Esporta configurazione + dati</button>
        <button class="btn" id="io_i">⬆ Importa configurazione</button>
        <input type="file" id="io_f" accept=".json" style="display:none">
        <p class="muted">La configurazione include: header, tema, pagine, blocchi (pulsanti/tabelle/testi). I dati delle tabelle sono opzionali nell'export.</p>
      </div>
      <div class="f"><button class="btn" id="ioc">Chiudi</button></div>
    `);
    dlg.querySelector('#ioc').onclick=()=>dlg.close();
    dlg.querySelector('#io_e').onclick=()=>{ dl('schema.json', JSON.stringify(RG.get(),null,2)); };
    dlg.querySelector('#io_ea').onclick=()=>{
      const bundle = {schema: RG.get(), data:{}};
      RG.get().pages.forEach(p=>(p.blocks||[]).forEach(b=>{ if(b.type==='table') bundle.data[b.storageKey]=RG.dataGet(b.storageKey); }));
      dl('schema-full.json', JSON.stringify(bundle,null,2));
    };
    dlg.querySelector('#io_i').onclick=()=>dlg.querySelector('#io_f').click();
    dlg.querySelector('#io_f').onchange=e=>{
      const f=e.target.files[0]; if(!f) return;
      const r=new FileReader(); r.onload=()=>{ try{
        const o = JSON.parse(r.result);
        if(o.schema){ RG.replace(o.schema); if(o.data) for(const k in o.data) RG.dataSet(k, o.data[k]); }
        else RG.replace(o);
        alert('Importato.'); location.reload();
      }catch(e){ alert('File non valido'); } }; r.readAsText(f);
    };
    function dl(name, content){
      const b=new Blob([content],{type:'application/json'}); const u=URL.createObjectURL(b);
      const a=document.createElement('a'); a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
    }
  }

  window.RG_editor = { enable, disable, editBlock };
})();
