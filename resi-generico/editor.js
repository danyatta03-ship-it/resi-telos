// EDITOR — barra strumenti e pannelli principali
(function(){
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const bar = document.getElementById('editorBar');
const dlg = RG_ui.dlg;

function enable(){ document.body.classList.add('edit-on'); bar.classList.remove('hidden'); RG_render.rerender(); }
function disable(){ document.body.classList.remove('edit-on'); bar.classList.add('hidden'); RG_render.rerender(); }

bar.querySelectorAll('button').forEach(b=>b.onclick=()=>{
  const a=b.dataset.act;
  ({ header:openHeader, theme:openTheme, pages:openPages, site:openSite,
     addblock:openAddBlockRoot, io:openIO,
     reset:()=>{ if(confirm('Reset TOTALE ai default? I dati delle tabelle e invii form restano.')){ RG.reset(); RG_render.rerender(); } },
     off:disable })[a]?.();
});

function done(){ RG.save(); RG_render.rerender(); }

// ============ ADD BLOCK (root o dentro un contenitore) ============
function pickAndAdd(arr, container){
  const types = Object.entries(RG_BLOCKS).filter(([k,v])=>k!=='card');
  dlg(`
    <div class="h">➕ Nuovo blocco<button class="x">×</button></div>
    <div class="b">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${types.map(([k,v])=>`<button class="btn" data-t="${k}" style="flex-direction:column;padding:14px 6px;display:flex;gap:4px;align-items:center;text-align:center;font-size:12px">
          <span style="font-size:22px">${v.icon}</span><span>${esc(v.label)}</span></button>`).join('')}
      </div>
    </div>
    <div class="f"><button class="btn" data-x>Chiudi</button></div>
  `, null, d=>{
    d.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{
      const t = b.dataset.t;
      const blk = Object.assign({id:RG.uid('b_'), type:t}, RG_BLOCKS[t].defaults());
      arr.push(blk);
      RG.save(); d.close(); RG_render.rerender();
      // dopo un attimo apri l'editor del nuovo blocco
      setTimeout(()=>editBlock(blk), 100);
    });
  });
}
function openAddBlockRoot(){
  const pages = RG.get().pages;
  const cur = pages.find(p=>p.id===RG_render.currentPageId) || pages[0];
  dlg(`
    <div class="h">➕ Nuovo blocco<button class="x">×</button></div>
    <div class="b">
      <div class="fld"><label>In pagina</label>
        <select id="_pg">${pages.map(p=>`<option value="${p.id}" ${p.id===cur.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
      <p class="muted">Il blocco verrà aggiunto in fondo alla pagina scelta. Per aggiungerlo dentro una sezione o una colonna usa il pulsante <b>➕ blocco qui</b> che appare nella pagina in modalità editor.</p>
    </div>
    <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Avanti</button></div>
  `, ok=>{
    const p = pages.find(x=>x.id===ok('#_pg').value);
    RG_render.goto(p.id);
    setTimeout(()=>pickAndAdd(p.blocks, null), 50);
  });
}

function editBlock(blk){
  const type = RG_BLOCKS[blk.type];
  if(!type){ alert('Blocco sconosciuto'); return; }
  type.edit(blk, done);
}

// ============ HEADER ============
function openHeader(){
  const s=RG.get(), h=s.header, b=s.brand;
  dlg(`
    <div class="h">🎨 Header e Logo<button class="x">×</button></div>
    <div class="b">
      <div class="fld"><label>Titolo</label><input id="_t" value="${esc(h.title)}"></div>
      <div class="fld"><label>Sottotitolo</label><input id="_s" value="${esc(h.subtitle||'')}"></div>
      <div class="fld"><label>Nome brand</label><input id="_b" value="${esc(b.name)}"></div>
      <div class="fld"><label>Logo (galleria/URL)</label>
        ${b.logo?`<img src="${b.logo}" style="max-height:80px;border-radius:8px;background:#fff2;padding:4px;align-self:flex-start">`:''}
        <input type="file" id="_f" accept="image/*">
        <input id="_l" value="${esc(b.logo)}">
        <button class="btn sm" id="_lc">Rimuovi logo</button></div>
      <div class="row3">
        <div class="fld"><label>Posizione logo</label><select id="_lp">${['left','center','right','none'].map(x=>`<option ${h.logoPos===x?'selected':''}>${x}</option>`).join('')}</select></div>
        <div class="fld"><label>Dim. logo (px)</label><input type="number" id="_ls" value="${h.logoSize||36}"></div>
        <div class="fld"><label>Allineamento</label><select id="_al">${['left','center','right'].map(x=>`<option ${h.align===x?'selected':''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="row3">
        <div class="fld"><label>Visibile</label><select id="_sh"><option value="1" ${h.show!==false?'selected':''}>Sì</option><option value="0" ${h.show===false?'selected':''}>No</option></select></div>
        <div class="fld"><label>Sticky</label><select id="_st"><option value="1" ${h.sticky!==false?'selected':''}>Sì</option><option value="0" ${h.sticky===false?'selected':''}>No</option></select></div>
        <div class="fld"><label>Mostra menu</label><select id="_nv"><option value="1" ${h.showNav!==false?'selected':''}>Sì</option><option value="0" ${h.showNav===false?'selected':''}>No</option></select></div>
      </div>
      <div class="row">
        <div class="fld"><label>Sfondo</label><input type="color" id="_bg" value="${h.bg||'#141a22'}"></div>
        <div class="fld"><label>Testo</label><input type="color" id="_tx" value="${h.text||'#e6edf3'}"></div>
      </div>
    </div>
    <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Applica</button></div>
  `, ok=>{
    h.title=ok('#_t').value; h.subtitle=ok('#_s').value; b.name=ok('#_b').value; b.logo=ok('#_l').value;
    h.logoPos=ok('#_lp').value; h.logoSize=+ok('#_ls').value||36; h.align=ok('#_al').value;
    h.show=ok('#_sh').value==='1'; h.sticky=ok('#_st').value==='1'; h.showNav=ok('#_nv').value==='1';
    h.bg=ok('#_bg').value; h.text=ok('#_tx').value;
    done();
  }, d=>{
    d.querySelector('#_f').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{d.querySelector('#_l').value=r.result;alert('Logo caricato. Applica.');};r.readAsDataURL(f);};
    d.querySelector('#_lc').onclick=()=>{d.querySelector('#_l').value='';};
  });
}

// ============ THEME ============
function openTheme(){
  const t=RG.get().theme; const keys=Object.keys(t);
  dlg(`
    <div class="h">🌈 Tema colori<button class="x">×</button></div>
    <div class="b">${keys.map(k=>`<div style="display:flex;align-items:center;gap:8px"><label style="flex:1;font-size:13px">--${k}</label><input type="color" data-k="${k}" value="${t[k]||'#000000'}"></div>`).join('')}</div>
    <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Applica</button></div>
  `, ok=>{ document.querySelectorAll('#dlg input[type=color][data-k]').forEach(i=>t[i.dataset.k]=i.value); done(); });
}

// ============ PAGES ============
function openPages(){
  const pages=RG.get().pages;
  const capture = ()=>{
    document.querySelectorAll('#dlg #_pl .it').forEach(it=>{
      const i=+it.dataset.i;
      pages[i].icon = it.querySelector('[data-f=icon]').value;
      pages[i].name = it.querySelector('[data-f=name]').value;
      pages[i].id = it.querySelector('[data-f=id]').value.trim()||pages[i].id;
      pages[i].hideFromNav = it.querySelector('[data-f=hn]').checked;
    });
  };
  const d = dlg(`
    <div class="h">📄 Pagine<button class="x">×</button></div>
    <div class="b">
      <div class="list" id="_pl">
        ${pages.map((p,i)=>`<div class="it" data-i="${i}">
          <input style="width:36px;text-align:center" value="${esc(p.icon||'')}" data-f="icon">
          <input style="flex:1" value="${esc(p.name)}" data-f="name">
          <input style="width:100px" value="${esc(p.id)}" data-f="id">
          <label style="display:flex;align-items:center;gap:4px;font-size:11px"><input type="checkbox" data-f="hn" ${p.hideFromNav?'checked':''}>Nasc. menu</label>
          <button class="btn sm" data-a="set">⚙</button>
          <button class="btn sm" data-a="up">▲</button><button class="btn sm" data-a="dn">▼</button>
          <button class="btn sm danger" data-a="rm">✕</button>
        </div>`).join('')}
      </div>
      <button class="btn" id="_add">➕ Aggiungi pagina</button>
    </div>
    <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
  `, ok=>{ capture(); done(); }, d=>{
    d.querySelectorAll('#_pl .it').forEach(it=>{
      const i=+it.dataset.i;
      it.querySelector('[data-a=set]').onclick=()=>{ capture(); RG.save(); openPageSettings(pages[i], ()=>openPages()); };
      // v35 fix: capture() prima di ogni azione che rirende openPages()
      it.querySelector('[data-a=up]').onclick=()=>{if(i<=0)return;capture();[pages[i-1],pages[i]]=[pages[i],pages[i-1]];RG.save();openPages();};
      it.querySelector('[data-a=dn]').onclick=()=>{if(i>=pages.length-1)return;capture();[pages[i+1],pages[i]]=[pages[i],pages[i+1]];RG.save();openPages();};
      it.querySelector('[data-a=rm]').onclick=()=>{if(pages.length<=1){alert('Almeno una pagina.');return;}if(!confirm('Rimuovere "'+pages[i].name+'"?'))return;capture();pages.splice(i,1);RG.save();openPages();};
    });
    d.querySelector('#_add').onclick=()=>{ capture(); pages.push({id:'p_'+Math.random().toString(36).slice(2,6),name:'Nuova pagina',icon:'📄',blocks:[],settings:{}}); RG.save(); openPages(); };
  });
}

function openPageSettings(p, back){
  p.settings = p.settings || {};
  const st = p.settings;
  dlg(`
    <div class="h">⚙ Impostazioni pagina — ${esc(p.name)}<button class="x">×</button></div>
    <div class="b">
      <div class="row">
        <div class="fld"><label>Sfondo pagina</label><input type="color" id="_bg" value="${st.bg||'#0b0f14'}"></div>
        <div class="fld"><label>Padding top (px)</label><input type="number" id="_pd" value="${st.padding||0}"></div>
      </div>
      <div class="row">
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="_hh" ${st.hideHeader?'checked':''}>Nascondi header</label>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="_hf" ${st.hideFooter?'checked':''}>Nascondi footer</label>
      </div>
      <div class="fld"><label>SEO title</label><input id="_st" value="${esc(st.seoTitle||'')}"></div>
      <div class="fld"><label>SEO description</label><textarea id="_sd" rows="2">${esc(st.seoDesc||'')}</textarea></div>
    </div>
    <div class="f"><button class="btn" data-x>Annulla</button><button class="btn primary" id="_ok">Salva</button></div>
  `, ok=>{
    st.bg=ok('#_bg').value==='#0b0f14'?'':ok('#_bg').value;
    st.padding=+ok('#_pd').value||0; st.hideHeader=ok('#_hh').checked; st.hideFooter=ok('#_hf').checked;
    st.seoTitle=ok('#_st').value; st.seoDesc=ok('#_sd').value;
    done(); if(back) back();
  });
}

// ============ SITE (footer, favicon, custom css, PWA) ============
function openSite(){
  const s=RG.get().site, f=RG.get().footer;
  const d = dlg(`
    <div class="h">⚙ Sito<button class="x">×</button></div>
    <div class="tabs">
      <button class="active" data-tab="pwa">PWA / branding</button>
      <button data-tab="footer">Footer</button>
      <button data-tab="css">Custom CSS</button>
    </div>
    <div class="b" id="_body"></div>
    <div class="f"><button class="btn" data-x>Chiudi</button></div>
  `, null, d=>{
    const body=d.querySelector('#_body'); const tabs=d.querySelectorAll('.tabs button');
    tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));t.classList.add('active');tab(t.dataset.tab);});
    tab('pwa');
    function tab(name){
      if(name==='pwa'){
        body.innerHTML=`
          <div class="fld"><label>Nome sito (title tab)</label><input id="_n" value="${esc(s.name||'')}"></div>
          <div class="fld"><label>Nome breve (PWA)</label><input id="_sn" value="${esc(s.shortName||'')}"></div>
          <div class="row"><div class="fld"><label>Colore tema (mobile)</label><input type="color" id="_tc" value="${s.themeColor||'#0b0f14'}"></div>
            <div class="fld"><label>Favicon (URL o upload)</label><input type="file" id="_ff" accept="image/*"><input id="_fu" value="${esc(s.favicon||'')}"></div></div>
          <button class="btn primary" id="_save">Salva</button>`;
        body.querySelector('#_ff').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>body.querySelector('#_fu').value=r.result;r.readAsDataURL(f);};
        body.querySelector('#_save').onclick=()=>{s.name=body.querySelector('#_n').value;s.shortName=body.querySelector('#_sn').value;s.themeColor=body.querySelector('#_tc').value;s.favicon=body.querySelector('#_fu').value;done();alert('Salvato');};
      } else if(name==='footer'){
        const draw=()=>{ body.innerHTML=`
          <div class="row"><div class="fld"><label>Visibile</label><select id="_sh"><option value="1" ${f.show!==false?'selected':''}>Sì</option><option value="0" ${f.show===false?'selected':''}>No</option></select></div>
          <div class="fld"><label>Sfondo</label><input type="color" id="_bg" value="${f.bg||'#141a22'}"></div></div>
          <div class="fld"><label>Copyright / testo finale</label><input id="_cp" value="${esc(f.copy||'')}"></div>
          <div class="list" id="_fc">${(f.cols||[]).map((c,i)=>`
            <div class="it" data-i="${i}" style="flex-direction:column;align-items:stretch">
              <div style="display:flex;gap:6px"><input style="flex:1" data-f="title" value="${esc(c.title||'')}" placeholder="titolo colonna">
                <button class="btn sm" data-a="up">▲</button><button class="btn sm" data-a="dn">▼</button><button class="btn sm danger" data-a="rm">✕</button></div>
              <textarea data-f="items" rows="4" placeholder="una voce per riga">${esc((c.items||[]).join('\n'))}</textarea>
            </div>`).join('')}</div>
          <button class="btn" id="_add">➕ Aggiungi colonna footer</button>
          <button class="btn primary" id="_savef">Salva footer</button>`;
          f.cols=f.cols||[];
          // v35 fix: capture() prima di riordinare/rimuovere/aggiungere,
          // altrimenti il testo digitato in title/items viene perso quando
          // draw() rigenera il body leggendo f.cols ancora vecchia.
          const _capFooter = ()=>{
            body.querySelectorAll('#_fc .it').forEach(it=>{const i=+it.dataset.i;const c=f.cols[i]; if(!c) return;
              const _t=it.querySelector('[data-f=title]'); if(_t) c.title=_t.value;
              const _i=it.querySelector('[data-f=items]'); if(_i) c.items=_i.value.split('\n').map(s=>s.trim()).filter(Boolean);
            });
          };
          body.querySelectorAll('#_fc .it').forEach(it=>{const i=+it.dataset.i;
            it.querySelector('[data-a=up]').onclick=()=>{if(i<=0)return;_capFooter();[f.cols[i-1],f.cols[i]]=[f.cols[i],f.cols[i-1]];RG.save();draw();};
            it.querySelector('[data-a=dn]').onclick=()=>{if(i>=f.cols.length-1)return;_capFooter();[f.cols[i+1],f.cols[i]]=[f.cols[i],f.cols[i+1]];RG.save();draw();};
            it.querySelector('[data-a=rm]').onclick=()=>{_capFooter();f.cols.splice(i,1);RG.save();draw();};
          });
          body.querySelector('#_add').onclick=()=>{_capFooter();f.cols.push({title:'Colonna',items:[]});RG.save();draw();};
          body.querySelector('#_savef').onclick=()=>{
            body.querySelectorAll('#_fc .it').forEach(it=>{const i=+it.dataset.i;const c=f.cols[i];
              c.title=it.querySelector('[data-f=title]').value;
              c.items=it.querySelector('[data-f=items]').value.split('\n').map(s=>s.trim()).filter(Boolean);
            });
            f.show=body.querySelector('#_sh').value==='1'; f.bg=body.querySelector('#_bg').value; f.copy=body.querySelector('#_cp').value;
            done(); alert('Footer salvato');
          };
        };
        draw();
      } else if(name==='css'){
        body.innerHTML=`
          <p class="muted">CSS iniettato globalmente. Puoi sovrascrivere qualunque selettore/classe dell'app.</p>
          <textarea id="_cs" rows="14" style="font-family:monospace;font-size:12px">${esc(s.customCss||'')}</textarea>
          <button class="btn primary" id="_save">Salva CSS</button>`;
        body.querySelector('#_save').onclick=()=>{ s.customCss=body.querySelector('#_cs').value; done(); alert('CSS salvato'); };
      }
    }
  });
}

// ============ IMPORT / EXPORT ============
function openIO(){
  dlg(`
    <div class="h">📥 Import / Export<button class="x">×</button></div>
    <div class="b">
      <button class="btn" id="_e">⬇ Esporta configurazione (schema.json)</button>
      <button class="btn" id="_ea">⬇ Esporta tutto (config + dati + invii form)</button>
      <button class="btn" id="_i">⬆ Importa</button>
      <input type="file" id="_f" accept=".json" style="display:none">
    </div>
    <div class="f"><button class="btn" data-x>Chiudi</button></div>
  `, null, d=>{
    d.querySelector('#_e').onclick=()=>RG_ui.download('schema.json', JSON.stringify(RG.get(),null,2));
    d.querySelector('#_ea').onclick=()=>{
      const bundle={schema:RG.get(),data:{},subm:{}};
      // raccogli tutte le tabelle e i form
      const walk = arr => (arr||[]).forEach(b=>{
        if(b.type==='table') bundle.data[b.storageKey]=RG.dataGet(b.storageKey);
        if(b.type==='form')  bundle.subm[b.storageKey]=RG.submGet(b.storageKey);
        if(b.type==='section') walk(b.children);
        if(b.type==='columns') (b.cols_content||[]).forEach(c=>walk(c));
      });
      RG.get().pages.forEach(p=>walk(p.blocks));
      RG_ui.download('schema-full.json', JSON.stringify(bundle,null,2));
    };
    d.querySelector('#_i').onclick=()=>d.querySelector('#_f').click();
    d.querySelector('#_f').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{
      const o=JSON.parse(r.result);
      if(o.schema){ RG.replace(o.schema); if(o.data) for(const k in o.data) RG.dataSet(k,o.data[k]); if(o.subm) for(const k in o.subm) RG.submSet(k,o.subm[k]); }
      else RG.replace(o);
      alert('Importato.'); location.reload();
    }catch(e){alert('File non valido');}};r.readAsText(f);};
  });
}

window.RG_editor = { enable, disable, editBlock, pickAndAdd };
})();
