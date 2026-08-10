// BLOCKS — registro di tutti i tipi disponibili
// Ogni tipo: {label, icon, container?, defaults(), render(el, blk, ctx), edit(blk, done)}
(function(){
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// ---------------------- TEXT ----------------------
const text = {
  label:'Testo / titolo', icon:'📝',
  defaults:()=>({tag:'p',text:'Nuovo testo',align:'left',color:'',fontSize:15,fontWeight:'400',padding:0}),
  render(el,b){
    const t=document.createElement(b.tag||'p'); t.textContent=b.text||'';
    if(b.color) t.style.color=b.color;
    if(b.fontSize) t.style.fontSize=b.fontSize+'px';
    if(b.fontWeight) t.style.fontWeight=b.fontWeight;
    if(b.align) t.style.textAlign=b.align;
    if(b.padding!=null) t.style.padding=b.padding+'px';
    t.style.margin='0';
    el.appendChild(t);
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Testo<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>Contenuto</label><textarea id="_text" rows="3">${esc(b.text)}</textarea></div>
        <div class="row3">
          <div class="fld"><label>Tag</label><select id="_tag">${['h1','h2','h3','h4','p','div','span'].map(x=>`<option ${b.tag===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fld"><label>Font size</label><input type="number" id="_fs" value="${b.fontSize||15}"></div>
          <div class="fld"><label>Weight</label><select id="_fw">${['400','500','600','700','800','900'].map(x=>`<option ${(b.fontWeight||'400')==x?'selected':''}>${x}</option>`).join('')}</select></div>
        </div>
        <div class="row">
          <div class="fld"><label>Allineamento</label><select id="_al">${['left','center','right','justify'].map(x=>`<option ${b.align===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fld"><label>Colore</label><input type="color" id="_col" value="${b.color||'#e6edf3'}"></div>
        </div>
        <div class="fld"><label>Padding (px)</label><input type="number" id="_pd" value="${b.padding||0}"></div>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{
      b.text=ok('#_text').value; b.tag=ok('#_tag').value; b.fontSize=+ok('#_fs').value||15;
      b.fontWeight=ok('#_fw').value; b.align=ok('#_al').value; b.color=ok('#_col').value; b.padding=+ok('#_pd').value||0;
      done();
    });
  }
};

// ---------------------- BUTTONS ----------------------
const buttons = {
  label:'Pulsanti', icon:'🔘',
  defaults:()=>({layout:'row', items:[{label:'Pulsante',style:'primary',action:{type:'alert',text:'Ciao!'}}]}),
  render(el,b){
    el.style.display='flex'; el.style.gap='8px'; el.style.flexWrap='wrap';
    if(b.layout==='stack') el.style.flexDirection='column';
    if(b.align) el.style.justifyContent = b.align==='center'?'center':b.align==='right'?'flex-end':'flex-start';
    (b.items||[]).forEach(it=>{
      const btn=document.createElement('button'); btn.className='btn '+(it.style||'default');
      btn.textContent=it.label||'Pulsante';
      if(b.layout==='stack') btn.style.width='100%';
      btn.onclick=e=>{ if(document.body.classList.contains('edit-on')){e.stopPropagation();return;} RG_actions.run(it.action); };
      el.appendChild(btn);
    });
  },
  edit(b,done){ RG_ui.editButtons(b,done); }
};

// ---------------------- TABLE ----------------------
const table = {
  label:'Tabella dati', icon:'📊',
  defaults:()=>({title:'Tabella', storageKey:'t_'+Math.random().toString(36).slice(2,6),
    columns:[{key:'col1',label:'Colonna 1',type:'text'}],
    allowAdd:true,allowDelete:true,allowEdit:true,allowExport:true}),
  render(el,b){ RG_ui.renderTable(el,b); },
  edit(b,done){ RG_ui.editTable(b,done); }
};

// ---------------------- IMAGE ----------------------
const image = {
  label:'Immagine', icon:'🖼',
  defaults:()=>({src:'icon.svg', width:100, align:'center', link:'', alt:''}),
  render(el,b){
    const img=document.createElement('img'); img.src=b.src||'icon.svg'; img.alt=b.alt||'';
    img.style.maxWidth=(b.width||100)+'%'; img.style.display='block';
    img.style.marginLeft=b.align==='center'?'auto':b.align==='right'?'auto':'0';
    img.style.marginRight=b.align==='center'?'auto':b.align==='left'?'auto':'0';
    img.style.borderRadius='var(--radius)';
    if(b.link){ const a=document.createElement('a'); a.href=b.link; a.target='_blank'; a.appendChild(img); el.appendChild(a); } else el.appendChild(img);
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Immagine<button class="x">×</button></div>
      <div class="b">
        <img src="${esc(b.src)}" style="max-height:120px;align-self:flex-start;border-radius:8px;background:#fff2;padding:4px">
        <input type="file" id="_file" accept="image/*">
        <div class="fld"><label>URL / Data URL</label><input id="_url" value="${esc(b.src)}"></div>
        <div class="fld"><label>Link on click (opz.)</label><input id="_ln" value="${esc(b.link||'')}"></div>
        <div class="row3">
          <div class="fld"><label>Larghezza (%)</label><input type="number" id="_w" value="${b.width||100}"></div>
          <div class="fld"><label>Allineamento</label><select id="_al">${['left','center','right'].map(x=>`<option ${b.align===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fld"><label>Alt</label><input id="_alt" value="${esc(b.alt||'')}"></div>
        </div>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{
      b.src=ok('#_url').value; b.link=ok('#_ln').value;
      b.width=+ok('#_w').value||100; b.align=ok('#_al').value; b.alt=ok('#_alt').value;
      done();
    }, dlg=>{
      dlg.querySelector('#_file').onchange=e=>{ const f=e.target.files[0]; if(!f)return;
        const r=new FileReader(); r.onload=()=>{ dlg.querySelector('#_url').value=r.result; }; r.readAsDataURL(f); };
    });
  }
};

// ---------------------- HTML ----------------------
const html = {
  label:'HTML libero', icon:'</>',
  defaults:()=>({html:'<p>Contenuto libero</p>'}),
  render(el,b){ el.innerHTML=b.html||''; },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ HTML<button class="x">×</button></div>
      <div class="b"><textarea id="_h" rows="10">${esc(b.html)}</textarea></div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{ b.html=ok('#_h').value; done(); });
  }
};

// ---------------------- HERO ----------------------
const hero = {
  label:'Hero (banner)', icon:'⭐',
  defaults:()=>({title:'Titolo grande',subtitle:'Sottotitolo di accompagnamento',
    bg:'#141a22', bgImage:'', overlay:.3, height:320, align:'center',
    color:'#ffffff', ctas:[]}),
  render(el,b){
    el.style.position='relative'; el.style.minHeight=(b.height||320)+'px';
    el.style.background=b.bg||'#141a22'; el.style.color=b.color||'#fff';
    el.style.display='flex'; el.style.flexDirection='column'; el.style.justifyContent='center';
    el.style.textAlign=b.align||'center'; el.style.padding='40px 20px'; el.style.borderRadius='var(--radius)';
    el.style.overflow='hidden';
    if(b.bgImage){
      const bg=document.createElement('div'); bg.style.cssText=`position:absolute;inset:0;background:url("${b.bgImage}") center/cover;z-index:0`;
      const ov=document.createElement('div'); ov.style.cssText=`position:absolute;inset:0;background:rgba(0,0,0,${b.overlay||0});z-index:1`;
      el.appendChild(bg); el.appendChild(ov);
    }
    const wrap=document.createElement('div'); wrap.style.cssText='position:relative;z-index:2;display:flex;flex-direction:column;gap:12px;align-items:'+(b.align==='center'?'center':b.align==='right'?'flex-end':'flex-start');
    if(b.title){ const t=document.createElement('h1'); t.textContent=b.title; t.style.cssText='margin:0;font-size:32px;font-weight:800;line-height:1.2'; wrap.appendChild(t); }
    if(b.subtitle){ const s=document.createElement('p'); s.textContent=b.subtitle; s.style.cssText='margin:0;font-size:16px;opacity:.9;max-width:640px'; wrap.appendChild(s); }
    if(b.ctas && b.ctas.length){
      const bw=document.createElement('div'); bw.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:6px';
      b.ctas.forEach(c=>{
        const btn=document.createElement('button'); btn.className='btn '+(c.style||'primary');
        btn.textContent=c.label||'CTA';
        btn.onclick=e=>{ if(document.body.classList.contains('edit-on')){e.stopPropagation();return;} RG_actions.run(c.action); };
        bw.appendChild(btn);
      });
      wrap.appendChild(bw);
    }
    el.appendChild(wrap);
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Hero<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>Titolo</label><input id="_t" value="${esc(b.title)}"></div>
        <div class="fld"><label>Sottotitolo</label><textarea id="_s" rows="2">${esc(b.subtitle)}</textarea></div>
        <div class="fld"><label>Immagine di sfondo (upload)</label>
          <input type="file" id="_f" accept="image/*">
          <input id="_bi" value="${esc(b.bgImage||'')}" placeholder="URL o data URL">
          <button class="btn sm" id="_bic">Rimuovi immagine</button></div>
        <div class="row3">
          <div class="fld"><label>Colore sfondo</label><input type="color" id="_bg" value="${b.bg||'#141a22'}"></div>
          <div class="fld"><label>Overlay (0-1)</label><input type="number" step=".1" min="0" max="1" id="_ov" value="${b.overlay||0}"></div>
          <div class="fld"><label>Altezza (px)</label><input type="number" id="_h" value="${b.height||320}"></div>
        </div>
        <div class="row">
          <div class="fld"><label>Colore testo</label><input type="color" id="_c" value="${b.color||'#ffffff'}"></div>
          <div class="fld"><label>Allineamento</label><select id="_al">${['left','center','right'].map(x=>`<option ${b.align===x?'selected':''}>${x}</option>`).join('')}</select></div>
        </div>
        <div class="fld"><label>CTA (pulsanti)</label><div id="_ctas"></div>
          <button class="btn sm" id="_addcta">➕ CTA</button></div>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{
      b.title=ok('#_t').value; b.subtitle=ok('#_s').value; b.bgImage=ok('#_bi').value;
      b.bg=ok('#_bg').value; b.overlay=+ok('#_ov').value; b.height=+ok('#_h').value||320;
      b.color=ok('#_c').value; b.align=ok('#_al').value;
      b.ctas = [];
      document.querySelectorAll('#dlg input[data-cta^="lbl:"]').forEach(inp=>{
        const i=+inp.dataset.cta.split(':')[1];
        const st=document.querySelector(`#dlg [data-cta="st:${i}"]`).value;
        const typeSel = document.querySelector(`#dlg [data-a=type][data-i="${i}"]`);
        const type = typeSel ? typeSel.value : 'alert';
        const params={};
        document.querySelectorAll(`#dlg [data-p][data-i="${i}"]`).forEach(p=>params[p.dataset.p]=p.value);
        b.ctas.push({label:inp.value, style:st, action:Object.assign({type},params)});
      });
      done();
    }, dlg=>{
      dlg.querySelector('#_f').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>dlg.querySelector('#_bi').value=r.result;r.readAsDataURL(f);};
      dlg.querySelector('#_bic').onclick=()=>{dlg.querySelector('#_bi').value='';};
      b.ctas = b.ctas||[];
      const renderCtas=()=>{
        const w=dlg.querySelector('#_ctas'); w.innerHTML='';
        b.ctas.forEach((c,i)=>{
          const d=document.createElement('div'); d.style.cssText='display:flex;flex-direction:column;gap:4px;background:var(--panel2);padding:8px;border-radius:8px;margin-bottom:6px';
          d.innerHTML=`
            <div style="display:flex;gap:6px"><input style="flex:2" data-cta="lbl:${i}" value="${esc(c.label||'')}" placeholder="Etichetta">
              <select data-cta="st:${i}" style="width:100px">${['primary','default','danger','ghost'].map(s=>`<option ${c.style===s?'selected':''}>${s}</option>`).join('')}</select>
              <button class="btn sm danger" data-cta="rm:${i}">✕</button></div>
            <div style="display:flex;gap:6px;align-items:center">
              <label style="font-size:11px;color:var(--muted)">Azione:</label>
              ${RG_ui.actionEditor(c.action||{type:'alert',text:''}, i)}
            </div>`;
          w.appendChild(d);
        });
        w.querySelectorAll('[data-cta^="rm:"]').forEach(x=>x.onclick=()=>{ b.ctas.splice(+x.dataset.cta.split(':')[1],1); renderCtas(); });
        w.querySelectorAll('select[data-a=type]').forEach(s=>s.onchange=()=>{
          const i=+s.dataset.i;
          const span = s.parentElement.querySelector('[data-a=params]');
          if(span) span.innerHTML = RG_ui.actionParams({type:s.value}, i);
        });
      };
      dlg.querySelector('#_addcta').onclick=()=>{ b.ctas.push({label:'CTA',style:'primary',action:{type:'alert',text:''}}); renderCtas(); };
      renderCtas();
    });
  }
};

// ---------------------- SECTION (container) ----------------------
const section = {
  label:'Sezione (contenitore)', icon:'📦', container:true,
  defaults:()=>({title:'Titolo sezione',subtitle:'',bg:'',padding:24,align:'center',children:[]}),
  render(el,b,ctx){
    el.style.background=b.bg||'';
    el.style.padding=(b.padding||0)+'px';
    el.style.textAlign=b.align||'left';
    el.style.borderRadius='var(--radius)';
    if(b.title){ const h=document.createElement('h2'); h.textContent=b.title; h.style.cssText='margin:0 0 6px;font-size:22px;font-weight:800'; el.appendChild(h); }
    if(b.subtitle){ const p=document.createElement('p'); p.textContent=b.subtitle; p.style.cssText='margin:0 0 16px;color:var(--muted)'; el.appendChild(p); }
    const wrap=document.createElement('div'); wrap.style.cssText='display:flex;flex-direction:column;gap:12px;text-align:left';
    ctx.renderInto(wrap, b.children||[], b, 'children');
    el.appendChild(wrap);
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Sezione<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>Titolo</label><input id="_t" value="${esc(b.title||'')}"></div>
        <div class="fld"><label>Sottotitolo</label><input id="_s" value="${esc(b.subtitle||'')}"></div>
        <div class="row3">
          <div class="fld"><label>Sfondo</label><input type="color" id="_bg" value="${b.bg||'#141a22'}"></div>
          <div class="fld"><label>Padding (px)</label><input type="number" id="_pd" value="${b.padding||24}"></div>
          <div class="fld"><label>Allineamento</label><select id="_al">${['left','center','right'].map(x=>`<option ${b.align===x?'selected':''}>${x}</option>`).join('')}</select></div>
        </div>
        <p class="muted">I blocchi interni si aggiungono/modificano direttamente dalla pagina (in modalità editor).</p>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{
      b.title=ok('#_t').value; b.subtitle=ok('#_s').value;
      b.bg=ok('#_bg').value==='#141a22'?'':ok('#_bg').value;
      b.padding=+ok('#_pd').value||0; b.align=ok('#_al').value;
      if(!Array.isArray(b.children)) b.children=[];
      done();
    });
  }
};

// ---------------------- COLUMNS (container) ----------------------
const columns = {
  label:'Colonne', icon:'▦', container:true,
  defaults:()=>({cols:2,gap:16,cols_content:[[],[]]}),
  render(el,b,ctx){
    const n=b.cols||2;
    while(!b.cols_content) b.cols_content=[];
    while(b.cols_content.length<n) b.cols_content.push([]);
    while(b.cols_content.length>n) b.cols_content.pop();
    el.style.display='grid'; el.style.gap=(b.gap||16)+'px';
    el.style.gridTemplateColumns=`repeat(${n},minmax(0,1fr))`;
    for(let i=0;i<n;i++){
      const c=document.createElement('div'); c.style.cssText='display:flex;flex-direction:column;gap:12px;min-width:0';
      c.dataset.col=i;
      ctx.renderInto(c, b.cols_content[i], b, 'col:'+i);
      el.appendChild(c);
    }
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Colonne<button class="x">×</button></div>
      <div class="b">
        <div class="row"><div class="fld"><label>Numero colonne</label><input type="number" min="1" max="6" id="_n" value="${b.cols||2}"></div>
        <div class="fld"><label>Gap (px)</label><input type="number" id="_g" value="${b.gap||16}"></div></div>
        <p class="muted">Aumentando/diminuendo le colonne il contenuto in eccesso viene rimosso.</p>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{
      const n=+ok('#_n').value||2; b.cols=Math.max(1,Math.min(6,n)); b.gap=+ok('#_g').value||16; done();
    });
  }
};

// ---------------------- CARD (used in grid or alone) ----------------------
const card = {
  label:'Card', icon:'🗂',
  defaults:()=>({title:'Titolo card',text:'Descrizione della card.',image:'',link:'',linkLabel:''}),
  render(el,b){
    el.style.cssText='background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;display:flex;flex-direction:column;gap:8px';
    if(b.image){ const im=document.createElement('img'); im.src=b.image; im.style.cssText='width:100%;height:150px;object-fit:cover;border-radius:8px'; el.appendChild(im); }
    if(b.title){ const t=document.createElement('h3'); t.textContent=b.title; t.style.cssText='margin:0;font-size:18px;font-weight:700'; el.appendChild(t); }
    if(b.text){ const p=document.createElement('p'); p.textContent=b.text; p.style.cssText='margin:0;color:var(--muted);font-size:14px'; el.appendChild(p); }
    if(b.link){ const a=document.createElement('a'); a.href=b.link; a.target='_blank'; a.textContent=b.linkLabel||'Scopri'; a.style.cssText='color:var(--primary);text-decoration:none;font-weight:600;margin-top:auto'; el.appendChild(a); }
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Card<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>Titolo</label><input id="_t" value="${esc(b.title||'')}"></div>
        <div class="fld"><label>Testo</label><textarea id="_x" rows="3">${esc(b.text||'')}</textarea></div>
        <div class="fld"><label>Immagine (upload o URL)</label>
          <input type="file" id="_f" accept="image/*">
          <input id="_im" value="${esc(b.image||'')}"></div>
        <div class="row"><div class="fld"><label>Link (URL)</label><input id="_ln" value="${esc(b.link||'')}"></div>
        <div class="fld"><label>Etichetta link</label><input id="_ll" value="${esc(b.linkLabel||'')}"></div></div>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{
      b.title=ok('#_t').value; b.text=ok('#_x').value; b.image=ok('#_im').value;
      b.link=ok('#_ln').value; b.linkLabel=ok('#_ll').value; done();
    }, dlg=>{
      dlg.querySelector('#_f').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>dlg.querySelector('#_im').value=r.result;r.readAsDataURL(f);};
    });
  }
};

// ---------------------- CARD GRID ----------------------
const cardGrid = {
  label:'Griglia di card', icon:'🃏',
  defaults:()=>({cols:3,gap:12,items:[
    {image:'',title:'Titolo 1',text:'Descrizione',link:'',linkLabel:''},
    {image:'',title:'Titolo 2',text:'Descrizione',link:'',linkLabel:''},
    {image:'',title:'Titolo 3',text:'Descrizione',link:'',linkLabel:''},
  ]}),
  render(el,b){
    el.style.cssText=`display:grid;gap:${b.gap||12}px;grid-template-columns:repeat(${b.cols||3},minmax(0,1fr))`;
    (b.items||[]).forEach(it=>{
      const c=document.createElement('div'); card.render(c,it); el.appendChild(c);
    });
  },
  edit(b,done){ RG_ui.editItemList(b, {
    title:'Griglia di card',
    extraTop:`<div class="row"><div class="fld"><label>Colonne</label><input type="number" min="1" max="6" id="_c" value="${b.cols||3}"></div>
      <div class="fld"><label>Gap</label><input type="number" id="_g" value="${b.gap||12}"></div></div>`,
    itemDefaults:()=>({image:'',title:'Nuova card',text:'Testo',link:'',linkLabel:''}),
    itemFields:(it,i)=>`
      <div class="fld"><label>Titolo</label><input data-f="title:${i}" value="${esc(it.title||'')}"></div>
      <div class="fld"><label>Testo</label><textarea data-f="text:${i}" rows="2">${esc(it.text||'')}</textarea></div>
      <div class="fld"><label>Immagine</label>
        <input type="file" data-f="imgf:${i}" accept="image/*">
        <input data-f="image:${i}" value="${esc(it.image||'')}"></div>
      <div class="row"><div class="fld"><label>Link</label><input data-f="link:${i}" value="${esc(it.link||'')}"></div>
        <div class="fld"><label>Etichetta link</label><input data-f="linkLabel:${i}" value="${esc(it.linkLabel||'')}"></div></div>`,
    onCaptureExtra:(ok)=>{ b.cols=+ok('#_c').value||3; b.gap=+ok('#_g').value||12; },
    fields:['title','text','image','link','linkLabel'],
  }, done); }
};

// ---------------------- STAT GRID ----------------------
const statGrid = {
  label:'Statistiche / numeri', icon:'📈',
  defaults:()=>({cols:3, items:[{number:'100+',label:'Clienti'},{number:'98%',label:'Soddisfatti'},{number:'10',label:'Anni'}]}),
  render(el,b){
    el.style.cssText=`display:grid;gap:12px;grid-template-columns:repeat(${b.cols||3},minmax(0,1fr))`;
    (b.items||[]).forEach(it=>{
      const c=document.createElement('div'); c.style.cssText='background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;text-align:center';
      c.innerHTML=`<div style="font-size:32px;font-weight:800;color:var(--primary)">${esc(it.number||'')}</div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(it.label||'')}</div>`;
      el.appendChild(c);
    });
  },
  edit(b,done){ RG_ui.editItemList(b, {
    title:'Statistiche',
    extraTop:`<div class="fld"><label>Colonne</label><input type="number" min="1" max="6" id="_c" value="${b.cols||3}"></div>`,
    itemDefaults:()=>({number:'0',label:'Etichetta'}),
    itemFields:(it,i)=>`
      <div class="row"><div class="fld"><label>Numero</label><input data-f="number:${i}" value="${esc(it.number||'')}"></div>
        <div class="fld"><label>Etichetta</label><input data-f="label:${i}" value="${esc(it.label||'')}"></div></div>`,
    onCaptureExtra:(ok)=>{ b.cols=+ok('#_c').value||3; },
    fields:['number','label'],
  }, done); }
};

// ---------------------- ACCORDION ----------------------
const accordion = {
  label:'Accordion / FAQ', icon:'▼',
  defaults:()=>({items:[{title:'Domanda?',content:'Risposta.'}]}),
  render(el,b){
    (b.items||[]).forEach(it=>{
      const d=document.createElement('details'); d.style.cssText='background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:6px';
      d.innerHTML=`<summary style="cursor:pointer;font-weight:700;list-style:none">${esc(it.title||'')}</summary>
        <div style="padding-top:8px;color:var(--muted)">${esc(it.content||'')}</div>`;
      el.appendChild(d);
    });
  },
  edit(b,done){ RG_ui.editItemList(b, {
    title:'Accordion / FAQ',
    itemDefaults:()=>({title:'Nuova domanda',content:'Risposta.'}),
    itemFields:(it,i)=>`
      <div class="fld"><label>Titolo</label><input data-f="title:${i}" value="${esc(it.title||'')}"></div>
      <div class="fld"><label>Contenuto</label><textarea data-f="content:${i}" rows="3">${esc(it.content||'')}</textarea></div>`,
    fields:['title','content'],
  }, done); }
};

// ---------------------- TESTIMONIAL GRID ----------------------
const testimonialGrid = {
  label:'Testimonianze', icon:'💬',
  defaults:()=>({cols:3,items:[{text:'Fantastici!',author:'Mario Rossi',role:'CEO Acme',avatar:''}]}),
  render(el,b){
    el.style.cssText=`display:grid;gap:12px;grid-template-columns:repeat(${b.cols||3},minmax(0,1fr))`;
    (b.items||[]).forEach(it=>{
      const c=document.createElement('div'); c.style.cssText='background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:18px;display:flex;flex-direction:column;gap:10px';
      c.innerHTML=`<p style="margin:0;font-style:italic;color:var(--text)">"${esc(it.text||'')}"</p>
        <div style="display:flex;align-items:center;gap:8px;margin-top:auto">
          ${it.avatar?`<img src="${esc(it.avatar)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`:''}
          <div><div style="font-weight:700">${esc(it.author||'')}</div><div style="font-size:12px;color:var(--muted)">${esc(it.role||'')}</div></div></div>`;
      el.appendChild(c);
    });
  },
  edit(b,done){ RG_ui.editItemList(b, {
    title:'Testimonianze',
    extraTop:`<div class="fld"><label>Colonne</label><input type="number" min="1" max="4" id="_c" value="${b.cols||3}"></div>`,
    itemDefaults:()=>({text:'Testimonianza',author:'Nome',role:'Ruolo',avatar:''}),
    itemFields:(it,i)=>`
      <div class="fld"><label>Testo</label><textarea data-f="text:${i}" rows="3">${esc(it.text||'')}</textarea></div>
      <div class="row"><div class="fld"><label>Autore</label><input data-f="author:${i}" value="${esc(it.author||'')}"></div>
        <div class="fld"><label>Ruolo</label><input data-f="role:${i}" value="${esc(it.role||'')}"></div></div>
      <div class="fld"><label>Avatar (URL)</label><input data-f="avatar:${i}" value="${esc(it.avatar||'')}"></div>`,
    onCaptureExtra:(ok)=>{ b.cols=+ok('#_c').value||3; },
    fields:['text','author','role','avatar'],
  }, done); }
};

// ---------------------- GALLERY ----------------------
const gallery = {
  label:'Galleria immagini', icon:'🖼️',
  defaults:()=>({cols:3,gap:8,items:[]}),
  render(el,b){
    el.style.cssText=`display:grid;gap:${b.gap||8}px;grid-template-columns:repeat(${b.cols||3},minmax(0,1fr))`;
    (b.items||[]).forEach(it=>{
      const im=document.createElement('img'); im.src=it.src||''; im.style.cssText='width:100%;height:140px;object-fit:cover;border-radius:8px';
      el.appendChild(im);
    });
  },
  edit(b,done){ RG_ui.editItemList(b, {
    title:'Galleria',
    extraTop:`<div class="row"><div class="fld"><label>Colonne</label><input type="number" min="1" max="6" id="_c" value="${b.cols||3}"></div>
      <div class="fld"><label>Gap</label><input type="number" id="_g" value="${b.gap||8}"></div></div>
      <div class="fld"><label>Aggiungi da galleria dispositivo (multiple)</label><input type="file" id="_multif" accept="image/*" multiple></div>`,
    itemDefaults:()=>({src:''}),
    itemFields:(it,i)=>`
      <div class="row"><div class="fld"><label>Sorgente</label><input data-f="src:${i}" value="${esc(it.src||'')}"></div>
        <div class="fld"><label>Upload singolo</label><input type="file" data-f="srcf:${i}" accept="image/*"></div></div>
      ${it.src?`<img src="${esc(it.src)}" style="max-height:80px;border-radius:6px;align-self:flex-start">`:''}`,
    onCaptureExtra:(ok)=>{ b.cols=+ok('#_c').value||3; b.gap=+ok('#_g').value||8; },
    onMount:(dlg,reRender)=>{
      dlg.querySelector('#_multif')?.addEventListener('change',e=>{
        const files=[...e.target.files]; if(!files.length)return;
        let done=0;
        files.forEach(f=>{ const r=new FileReader(); r.onload=()=>{ b.items.push({src:r.result}); done++; if(done===files.length) reRender(); }; r.readAsDataURL(f); });
      });
    },
    fields:['src'],
  }, done); }
};

// ---------------------- VIDEO ----------------------
const video = {
  label:'Video', icon:'▶️',
  defaults:()=>({url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ratio:'16/9'}),
  render(el,b){
    const wrap=document.createElement('div'); wrap.style.cssText=`position:relative;width:100%;aspect-ratio:${b.ratio||'16/9'};border-radius:var(--radius);overflow:hidden;background:#000`;
    const u=(b.url||'').trim();
    let src='';
    let m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^?&/]+)/);
    if(m){ src=`https://www.youtube.com/embed/${m[1]}`; }
    else if(u.match(/vimeo\.com\/(\d+)/)){ src=`https://player.vimeo.com/video/${u.match(/vimeo\.com\/(\d+)/)[1]}`; }
    if(src){
      const f=document.createElement('iframe'); f.src=src; f.allowFullscreen=true; f.frameBorder='0';
      f.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0'; wrap.appendChild(f);
    } else if(u){
      const v=document.createElement('video'); v.src=u; v.controls=true;
      v.style.cssText='position:absolute;inset:0;width:100%;height:100%'; wrap.appendChild(v);
    } else wrap.textContent='(video)';
    el.appendChild(wrap);
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Video<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>URL (YouTube / Vimeo / MP4)</label><input id="_u" value="${esc(b.url||'')}"></div>
        <div class="fld"><label>Rapporto (aspect-ratio)</label>
          <select id="_r">${['16/9','4/3','1/1','21/9','9/16'].map(x=>`<option ${b.ratio===x?'selected':''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{ b.url=ok('#_u').value; b.ratio=ok('#_r').value; done(); });
  }
};

// ---------------------- IFRAME ----------------------
const iframe = {
  label:'Iframe / Embed', icon:'🌐',
  defaults:()=>({url:'https://example.com',height:400}),
  render(el,b){
    const f=document.createElement('iframe'); f.src=b.url||''; f.style.cssText=`width:100%;height:${b.height||400}px;border:0;border-radius:var(--radius);background:#fff`;
    el.appendChild(f);
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Iframe<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>URL</label><input id="_u" value="${esc(b.url||'')}"></div>
        <div class="fld"><label>Altezza (px)</label><input type="number" id="_h" value="${b.height||400}"></div>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{ b.url=ok('#_u').value; b.height=+ok('#_h').value||400; done(); });
  }
};

// ---------------------- MAP ----------------------
const map = {
  label:'Mappa (Google)', icon:'📍',
  defaults:()=>({address:'Roma',height:280,zoom:15}),
  render(el,b){
    const q=encodeURIComponent(b.address||'Roma');
    const f=document.createElement('iframe');
    f.src=`https://www.google.com/maps?q=${q}&z=${b.zoom||15}&output=embed`;
    f.style.cssText=`width:100%;height:${b.height||280}px;border:0;border-radius:var(--radius)`;
    f.loading='lazy'; el.appendChild(f);
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Mappa<button class="x">×</button></div>
      <div class="b">
        <div class="fld"><label>Indirizzo / query</label><input id="_a" value="${esc(b.address||'')}"></div>
        <div class="row"><div class="fld"><label>Zoom</label><input type="number" id="_z" value="${b.zoom||15}"></div>
        <div class="fld"><label>Altezza (px)</label><input type="number" id="_h" value="${b.height||280}"></div></div>
      </div>
      <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
    `, ok=>{ b.address=ok('#_a').value; b.zoom=+ok('#_z').value||15; b.height=+ok('#_h').value||280; done(); });
  }
};

// ---------------------- CONTACT INFO ----------------------
const contactInfo = {
  label:'Info di contatto', icon:'☎️',
  defaults:()=>({items:[{icon:'📍',label:'Indirizzo',value:'Via Roma 1'},{icon:'✉️',label:'Email',value:'info@azienda.it'}]}),
  render(el,b){
    (b.items||[]).forEach(it=>{
      const r=document.createElement('div'); r.style.cssText='display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)';
      r.innerHTML=`<div style="font-size:24px">${esc(it.icon||'')}</div>
        <div><div style="font-size:12px;color:var(--muted);text-transform:uppercase">${esc(it.label||'')}</div>
        <div style="font-weight:600">${esc(it.value||'')}</div></div>`;
      el.appendChild(r);
    });
  },
  edit(b,done){ RG_ui.editItemList(b, {
    title:'Info contatto',
    itemDefaults:()=>({icon:'✉️',label:'Etichetta',value:'Valore'}),
    itemFields:(it,i)=>`
      <div class="row3"><div class="fld"><label>Icona</label><input data-f="icon:${i}" style="text-align:center" value="${esc(it.icon||'')}"></div>
        <div class="fld"><label>Etichetta</label><input data-f="label:${i}" value="${esc(it.label||'')}"></div>
        <div class="fld"><label>Valore</label><input data-f="value:${i}" value="${esc(it.value||'')}"></div></div>`,
    fields:['icon','label','value'],
  }, done); }
};

// ---------------------- SOCIAL ----------------------
const SOCIALS = {
  linkedin:'🔗', instagram:'📷', facebook:'📘', twitter:'🐦', youtube:'📺',
  tiktok:'🎵', github:'💻', whatsapp:'💬', telegram:'✈️', email:'✉️', web:'🌐'
};
const social = {
  label:'Social', icon:'🌐',
  defaults:()=>({size:34,align:'left',items:[{net:'linkedin',url:'https://linkedin.com'}]}),
  render(el,b){
    el.style.cssText='display:flex;gap:10px;flex-wrap:wrap;justify-content:'+(b.align==='center'?'center':b.align==='right'?'flex-end':'flex-start');
    (b.items||[]).forEach(it=>{
      const a=document.createElement('a'); a.href=it.url||'#'; a.target='_blank';
      a.style.cssText=`display:inline-flex;align-items:center;justify-content:center;width:${b.size||34}px;height:${b.size||34}px;background:var(--panel);border:1px solid var(--border);border-radius:50%;text-decoration:none;font-size:${Math.round((b.size||34)*.55)}px`;
      a.textContent = SOCIALS[it.net] || '🔗'; a.title=it.net||'';
      el.appendChild(a);
    });
  },
  edit(b,done){ RG_ui.editItemList(b, {
    title:'Social',
    extraTop:`<div class="row"><div class="fld"><label>Dimensione (px)</label><input type="number" id="_sz" value="${b.size||34}"></div>
      <div class="fld"><label>Allineamento</label><select id="_al">${['left','center','right'].map(x=>`<option ${b.align===x?'selected':''}>${x}</option>`).join('')}</select></div></div>`,
    itemDefaults:()=>({net:'linkedin',url:''}),
    itemFields:(it,i)=>`
      <div class="row"><div class="fld"><label>Rete</label>
        <select data-f="net:${i}">${Object.keys(SOCIALS).map(k=>`<option ${it.net===k?'selected':''}>${k}</option>`).join('')}</select></div>
        <div class="fld"><label>URL</label><input data-f="url:${i}" value="${esc(it.url||'')}"></div></div>`,
    onCaptureExtra:(ok)=>{ b.size=+ok('#_sz').value||34; b.align=ok('#_al').value; },
    fields:['net','url'],
  }, done); }
};

// ---------------------- FORM ----------------------
const form = {
  label:'Form (invii)', icon:'📮',
  defaults:()=>({title:'Modulo',storageKey:'form_'+Math.random().toString(36).slice(2,6),
    submitLabel:'Invia', thankYou:'Grazie!',
    fields:[{key:'nome',label:'Nome',type:'text',required:true},{key:'email',label:'Email',type:'email',required:true},{key:'msg',label:'Messaggio',type:'textarea',required:true}]}),
  render(el,b){
    el.style.cssText='background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;display:flex;flex-direction:column;gap:8px';
    if(b.title){ const h=document.createElement('h3'); h.textContent=b.title; h.style.cssText='margin:0 0 4px'; el.appendChild(h); }
    const f=document.createElement('form'); f.style.cssText='display:flex;flex-direction:column;gap:8px';
    (b.fields||[]).forEach(fd=>{
      const wrap=document.createElement('div'); wrap.className='fld';
      const lbl=document.createElement('label'); lbl.textContent=fd.label + (fd.required?' *':''); lbl.style.cssText='font-size:12px;color:var(--muted);text-transform:uppercase';
      wrap.appendChild(lbl);
      let inp;
      if(fd.type==='textarea'){ inp=document.createElement('textarea'); inp.rows=3; }
      else if(fd.type==='select'){ inp=document.createElement('select'); (fd.options||[]).forEach(o=>{const op=document.createElement('option');op.textContent=o;inp.appendChild(op);}); }
      else { inp=document.createElement('input'); inp.type=fd.type||'text'; }
      inp.name=fd.key; if(fd.required) inp.required=true;
      wrap.appendChild(inp); f.appendChild(wrap);
    });
    const sub=document.createElement('button'); sub.type='submit'; sub.className='btn primary'; sub.textContent=b.submitLabel||'Invia';
    f.appendChild(sub);
    f.onsubmit = e=>{
      e.preventDefault();
      if(document.body.classList.contains('edit-on')) return;
      const data={}; (b.fields||[]).forEach(fd=>{ const el2=f.elements.namedItem(fd.key); data[fd.key]=el2?el2.value:''; });
      RG.submAdd(b.storageKey, data);
      f.reset();
      const msg=document.createElement('div'); msg.style.cssText='padding:10px;background:var(--ok);color:#fff;border-radius:8px;font-weight:700;text-align:center';
      msg.textContent=b.thankYou||'Grazie!'; el.appendChild(msg); setTimeout(()=>msg.remove(), 4000);
    };
    el.appendChild(f);
  },
  edit(b,done){
    RG_ui.dlg(`
      <div class="h">✎ Form<button class="x">×</button></div>
      <div class="tabs">
        <button class="active" data-tab="props">Proprietà</button>
        <button data-tab="fields">Campi</button>
        <button data-tab="subs">Invii ricevuti (${RG.submGet(b.storageKey).length})</button>
      </div>
      <div class="b" id="_body"></div>
      <div class="f"><button class="btn" data-x>Chiudi</button></div>
    `, null, dlg=>{
      const body=dlg.querySelector('#_body');
      const tabs=dlg.querySelectorAll('.tabs button');
      tabs.forEach(t=>t.onclick=()=>{ tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active'); tab(t.dataset.tab); });
      tab('props');
      dlg.addEventListener('close', done);

      function tab(name){
        if(name==='props'){
          body.innerHTML=`
            <div class="fld"><label>Titolo</label><input id="_t" value="${esc(b.title||'')}"></div>
            <div class="fld"><label>Chiave storage invii</label><input id="_k" value="${esc(b.storageKey||'')}"></div>
            <div class="row"><div class="fld"><label>Etichetta invia</label><input id="_sl" value="${esc(b.submitLabel||'Invia')}"></div>
            <div class="fld"><label>Messaggio grazie</label><input id="_ty" value="${esc(b.thankYou||'Grazie!')}"></div></div>
            <button class="btn primary" id="_save">Salva proprietà</button>`;
          body.querySelector('#_save').onclick=()=>{ b.title=body.querySelector('#_t').value; b.storageKey=body.querySelector('#_k').value.trim()||b.storageKey; b.submitLabel=body.querySelector('#_sl').value; b.thankYou=body.querySelector('#_ty').value; RG.save(); alert('Salvato'); };
        } else if(name==='fields'){
          const draw=()=>{ body.innerHTML=`
            <div class="list" id="_fl">${b.fields.map((f,i)=>`
              <div class="it" data-i="${i}" style="flex-direction:column;align-items:stretch">
                <div style="display:flex;gap:6px"><input style="width:90px" data-f="key" value="${esc(f.key)}" placeholder="chiave">
                  <input style="flex:1" data-f="label" value="${esc(f.label)}" placeholder="etichetta">
                  <select data-f="type" style="width:110px">${['text','email','tel','number','date','textarea','select'].map(t=>`<option ${f.type===t?'selected':''}>${t}</option>`).join('')}</select>
                  <label style="display:flex;align-items:center;gap:4px;font-size:11px"><input type="checkbox" data-f="required" ${f.required?'checked':''}>Obbl.</label>
                  <button class="btn sm" data-a="up">▲</button><button class="btn sm" data-a="dn">▼</button><button class="btn sm danger" data-a="rm">✕</button>
                </div>
                ${f.type==='select'?`<input data-f="options" placeholder="opzioni separate da virgola" value="${esc((f.options||[]).join(','))}" style="margin-top:6px">`:''}
              </div>`).join('')}</div>
            <button class="btn" id="_add">➕ Aggiungi campo</button>
            <button class="btn primary" id="_savef">Salva campi</button>`;
            // v35 fix: capture() prima di riordino/rimuovi/aggiungi, altrimenti
            // key/label/required in edit vengono sovrascritti dal draw().
            const _capFields=()=>{
              body.querySelectorAll('#_fl .it').forEach(it=>{ const i=+it.dataset.i; const f=b.fields[i]; if(!f) return;
                const _k=it.querySelector('[data-f=key]');      if(_k) f.key=_k.value.trim()||f.key;
                const _l=it.querySelector('[data-f=label]');    if(_l) f.label=_l.value;
                const _t=it.querySelector('[data-f=type]');     if(_t) f.type=_t.value;
                const _r=it.querySelector('[data-f=required]'); if(_r) f.required=_r.checked;
                const _o=it.querySelector('[data-f=options]');  if(_o) f.options=_o.value.split(',').map(s=>s.trim()).filter(Boolean);
              });
            };
            body.querySelectorAll('#_fl .it').forEach(it=>{
              const i=+it.dataset.i;
              it.querySelector('[data-a=up]').onclick=()=>{if(i<=0)return;_capFields();[b.fields[i-1],b.fields[i]]=[b.fields[i],b.fields[i-1]];draw();};
              it.querySelector('[data-a=dn]').onclick=()=>{if(i>=b.fields.length-1)return;_capFields();[b.fields[i+1],b.fields[i]]=[b.fields[i],b.fields[i+1]];draw();};
              it.querySelector('[data-a=rm]').onclick=()=>{if(!confirm('Rimuovere?'))return;_capFields();b.fields.splice(i,1);draw();};
            });
            body.querySelector('#_add').onclick=()=>{ _capFields(); b.fields.push({key:'campo'+(b.fields.length+1),label:'Nuovo campo',type:'text',required:false}); draw(); };
            body.querySelector('#_savef').onclick=()=>{
              body.querySelectorAll('#_fl .it').forEach(it=>{ const i=+it.dataset.i; const f=b.fields[i];
                f.key=it.querySelector('[data-f=key]').value.trim()||f.key;
                f.label=it.querySelector('[data-f=label]').value;
                f.type=it.querySelector('[data-f=type]').value;
                f.required=it.querySelector('[data-f=required]').checked;
                const op=it.querySelector('[data-f=options]'); if(op) f.options=op.value.split(',').map(s=>s.trim()).filter(Boolean);
              });
              RG.save(); alert('Campi salvati');
            };
          };
          draw();
        } else if(name==='subs'){
          const subs=RG.submGet(b.storageKey);
          body.innerHTML=`<div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="btn sm" id="_esc">CSV</button><button class="btn sm" id="_ejs">JSON</button>
            <button class="btn sm danger" id="_ec">Cancella</button></div>
            ${subs.length===0?`<p class="muted" style="text-align:center;padding:20px">Nessun invio ricevuto.</p>`:
            `<div class="tbl-wrap"><table style="width:100%;font-size:12px">
              <thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border)">Data</th>${b.fields.map(f=>`<th style="text-align:left;padding:6px;border-bottom:1px solid var(--border)">${esc(f.label)}</th>`).join('')}</tr></thead>
              <tbody>${subs.slice().reverse().map(s=>`<tr>
                <td style="padding:6px;border-bottom:1px solid var(--border)">${new Date(s._ts).toLocaleString()}</td>
                ${b.fields.map(f=>`<td style="padding:6px;border-bottom:1px solid var(--border)">${esc(s[f.key]||'')}</td>`).join('')}
              </tr>`).join('')}</tbody></table></div>`}`;
          body.querySelector('#_ec')?.addEventListener('click',()=>{ if(confirm('Cancellare tutti gli invii?')){ RG.submSet(b.storageKey,[]); tab('subs'); } });
          body.querySelector('#_esc')?.addEventListener('click',()=>RG_ui.download(b.storageKey+'.csv', csv(subs,b.fields), 'text/csv'));
          body.querySelector('#_ejs')?.addEventListener('click',()=>RG_ui.download(b.storageKey+'.json', JSON.stringify(subs,null,2), 'application/json'));
          function csv(rows,fields){ const head=['data',...fields.map(f=>f.label)].join(','); const body=rows.map(r=>[r._ts,...fields.map(f=>`"${(r[f.key]||'').toString().replace(/"/g,'""')}"`)].join(',')).join('\n'); return head+'\n'+body; }
        }
      }
    });
  }
};

// ---------------------- SPACER ----------------------
const spacer = {
  label:'Spaziatore', icon:'↕',
  defaults:()=>({height:40}),
  render(el,b){ el.style.height=(b.height||40)+'px'; },
  edit(b,done){ RG_ui.dlg(`<div class="h">✎ Spaziatore<button class="x">×</button></div>
    <div class="b"><div class="fld"><label>Altezza (px)</label><input type="number" id="_h" value="${b.height||40}"></div></div>
    <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>`,
    ok=>{ b.height=+ok('#_h').value||40; done(); }); }
};

// ---------------------- DIVIDER ----------------------
const divider = {
  label:'Divisore', icon:'—',
  defaults:()=>({color:'#2a3441',thickness:1,margin:12}),
  render(el,b){ el.style.cssText=`border-top:${b.thickness||1}px solid ${b.color||'#2a3441'};margin:${b.margin||12}px 0`; },
  edit(b,done){ RG_ui.dlg(`<div class="h">✎ Divisore<button class="x">×</button></div>
    <div class="b"><div class="row3"><div class="fld"><label>Colore</label><input type="color" id="_c" value="${b.color||'#2a3441'}"></div>
    <div class="fld"><label>Spessore</label><input type="number" id="_t" value="${b.thickness||1}"></div>
    <div class="fld"><label>Margine</label><input type="number" id="_m" value="${b.margin||12}"></div></div></div>
    <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>`,
    ok=>{ b.color=ok('#_c').value; b.thickness=+ok('#_t').value||1; b.margin=+ok('#_m').value||0; done(); }); }
};

// ---------------------- REGISTRO ----------------------
window.RG_BLOCKS = {
  hero, section, columns, text, buttons, card, 'card-grid':cardGrid, 'stat-grid':statGrid,
  accordion, 'testimonial-grid':testimonialGrid, gallery, video, iframe, map,
  'contact-info':contactInfo, social, form, image, html, spacer, divider, table,
};
})();
