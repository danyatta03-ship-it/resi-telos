// ============ VISUAL EDITOR (doppio-tap) ============
(function(){
  const OV = window.RG_overrides;
  const bar = document.getElementById('editorBar');
  const dlg = document.getElementById('editDlg');
  const adm = document.getElementById('adminDlg');
  let enabled = false;
  let dirty = false;

  function enable(){
    enabled = true;
    document.body.classList.add('editor-on');
    bar.classList.remove('hidden');
  }
  function disable(){
    enabled = false;
    document.body.classList.remove('editor-on');
    bar.classList.add('hidden');
  }
  window.RG_editor = { enable, disable };

  // ---- doppio tap ----
  let lastTap=0, lastTarget=null;
  document.addEventListener('click', e=>{
    if(!enabled) return;
    // ignora click sulla barra/dialoghi
    if(e.target.closest('#editorBar')||e.target.closest('dialog')) return;
    const el = e.target.closest('[data-edit-id]');
    if(!el) return;
    const now = Date.now();
    if(now-lastTap<400 && lastTarget===el){
      e.preventDefault(); e.stopPropagation();
      openEditor(el);
      lastTap=0;
    } else {
      lastTap = now; lastTarget = el;
      e.preventDefault(); e.stopPropagation();
    }
  }, true);

  // ---- editor per singolo elemento ----
  function openEditor(el){
    const id = el.dataset.editId;
    const data = OV.get();
    const cur = data[id] || {};
    const cs = getComputedStyle(el);
    const isImg = el.tagName==='IMG';
    const isText = !isImg && el.children.length===0;

    const rect = el.getBoundingClientRect();
    dlg.innerHTML = `
      <div class="dlg-head">✏️ Modifica: <code>${id}</code></div>
      <div class="dlg-body">
        ${ isText ? `
          <div class="field"><label>Testo</label>
            <textarea id="_ed_text" rows="2">${(cur.text!=null?cur.text:el.textContent).replace(/</g,'&lt;')}</textarea></div>
        `:''}
        ${ isImg ? `
          <div class="field"><label>Immagine (URL o carica file)</label>
            <input id="_ed_src" value="${(cur.src||el.getAttribute('src')||'').replace(/"/g,'&quot;')}">
            <input type="file" id="_ed_file" accept="image/*">
          </div>
        `:''}
        <div class="row2">
          <div class="field"><label>Colore testo</label>
            <input type="color" id="_ed_color" value="${toHex(cur.styles?.color||cs.color)}"></div>
          <div class="field"><label>Sfondo</label>
            <input type="color" id="_ed_bg" value="${toHex(cur.styles?.backgroundColor||cs.backgroundColor)}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>Font size (px)</label>
            <input type="number" id="_ed_fs" value="${parseInt(cur.styles?.fontSize||cs.fontSize)||14}"></div>
          <div class="field"><label>Font weight</label>
            <select id="_ed_fw">
              ${['normal','500','600','700','800','900'].map(w=>`<option ${((cur.styles?.fontWeight||cs.fontWeight)+''===w)?'selected':''}>${w}</option>`).join('')}
            </select></div>
        </div>
        <div class="row2">
          <div class="field"><label>Padding (px)</label>
            <input type="number" id="_ed_pad" value="${parseInt(cur.styles?.padding||cs.padding)||0}"></div>
          <div class="field"><label>Border radius (px)</label>
            <input type="number" id="_ed_br" value="${parseInt(cur.styles?.borderRadius||cs.borderRadius)||0}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>Allineamento testo</label>
            <select id="_ed_ta">
              ${['left','center','right','justify'].map(a=>`<option ${(cur.styles?.textAlign||cs.textAlign)===a?'selected':''}>${a}</option>`).join('')}
            </select></div>
          <div class="field"><label>Larghezza (px, 0=auto)</label>
            <input type="number" id="_ed_w" value="${cur.styles?.width?parseInt(cur.styles.width):0}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>Sposta X (px)</label>
            <input type="number" id="_ed_x" value="${cur.moved?.x||0}"></div>
          <div class="field"><label>Sposta Y (px)</label>
            <input type="number" id="_ed_y" value="${cur.moved?.y||0}"></div>
        </div>
        <div class="field">
          <label><input type="checkbox" id="_ed_hide" ${cur.hidden?'checked':''}> Nascondi elemento</label>
        </div>
      </div>
      <div class="dlg-foot">
        <button class="btn danger" id="_ed_del">Reset elemento</button>
        <button class="btn" id="_ed_cancel">Annulla</button>
        <button class="btn primary" id="_ed_ok">Applica</button>
      </div>
    `;
    dlg.showModal();

    // file upload → data URL
    if(isImg){
      const f = dlg.querySelector('#_ed_file');
      f.onchange = ()=>{
        const file = f.files[0]; if(!file) return;
        const r = new FileReader(); r.onload = ()=>{ dlg.querySelector('#_ed_src').value = r.result; }; r.readAsDataURL(file);
      };
    }

    dlg.querySelector('#_ed_cancel').onclick = ()=>dlg.close();
    dlg.querySelector('#_ed_del').onclick = ()=>{
      const d=OV.get(); delete d[id]; OV.set(d); dirty=true; dlg.close(); location.reload();
    };
    dlg.querySelector('#_ed_ok').onclick = ()=>{
      const newObj = { styles:{...(cur.styles||{})} };
      if(isText){ newObj.text = dlg.querySelector('#_ed_text').value; }
      if(isImg){ newObj.src = dlg.querySelector('#_ed_src').value; }
      newObj.styles.color = dlg.querySelector('#_ed_color').value;
      newObj.styles.backgroundColor = dlg.querySelector('#_ed_bg').value;
      newObj.styles.fontSize = dlg.querySelector('#_ed_fs').value+'px';
      newObj.styles.fontWeight = dlg.querySelector('#_ed_fw').value;
      newObj.styles.padding = dlg.querySelector('#_ed_pad').value+'px';
      newObj.styles.borderRadius = dlg.querySelector('#_ed_br').value+'px';
      newObj.styles.textAlign = dlg.querySelector('#_ed_ta').value;
      const w = +dlg.querySelector('#_ed_w').value; if(w>0) newObj.styles.width = w+'px';
      const x = +dlg.querySelector('#_ed_x').value, y = +dlg.querySelector('#_ed_y').value;
      if(x||y) newObj.moved = {x,y};
      if(dlg.querySelector('#_ed_hide').checked) newObj.hidden = true;
      const d = OV.get(); d[id] = newObj; OV.set(d);
      dirty = true;
      dlg.close();
    };
  }

  function toHex(c){
    if(!c) return '#000000';
    if(c.startsWith('#')) return c.length===7?c:'#000000';
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if(!m) return '#000000';
    return '#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('');
  }

  // ---- ADMIN dialog: tema globale + import/export/reset ----
  function openAdmin(){
    const d = OV.get();
    const root = d.__root || {};
    const cs = getComputedStyle(document.documentElement);
    const vars = ['--bg','--panel','--panel2','--border','--text','--muted','--primary','--primary2','--danger','--ok'];
    adm.innerHTML = `
      <div class="dlg-head">⚙️ Admin — tema globale</div>
      <div class="admin-tabs">
        <button class="active" data-tab="theme">Tema</button>
        <button data-tab="io">Import / Export</button>
        <button data-tab="help">Guida</button>
      </div>
      <div class="dlg-body" id="_adm_body"></div>
      <div class="dlg-foot">
        <button class="btn" id="_adm_close">Chiudi</button>
        <button class="btn primary" id="_adm_apply">Applica</button>
      </div>
    `;
    const body = adm.querySelector('#_adm_body');
    function renderTab(t){
      if(t==='theme'){
        body.innerHTML = vars.map(v=>`
          <div class="color-row">
            <label>${v}</label>
            <input type="color" data-var="${v}" value="${toHex(root[v]||cs.getPropertyValue(v).trim())}">
          </div>`).join('');
      } else if(t==='io'){
        body.innerHTML = `
          <button class="btn" id="_adm_export">⬇ Esporta override (JSON)</button>
          <button class="btn" id="_adm_import">⬆ Importa override</button>
          <input type="file" id="_adm_imp_file" accept=".json" style="display:none">
          <button class="btn danger" id="_adm_reset">↺ Reset TOTALE (rimuovi tutte le personalizzazioni)</button>
        `;
        body.querySelector('#_adm_export').onclick = ()=>{
          const b=new Blob([JSON.stringify(OV.get(),null,2)],{type:'application/json'});
          const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='rg-overrides.json';a.click();
        };
        body.querySelector('#_adm_import').onclick = ()=>body.querySelector('#_adm_imp_file').click();
        body.querySelector('#_adm_imp_file').onchange = e=>{
          const f=e.target.files[0]; if(!f) return;
          const r=new FileReader(); r.onload=()=>{try{OV.set(JSON.parse(r.result));location.reload();}catch(x){alert('File non valido')}}; r.readAsText(f);
        };
        body.querySelector('#_adm_reset').onclick = ()=>{
          if(confirm('Rimuovere TUTTE le personalizzazioni?')) OV.clear();
        };
      } else {
        body.innerHTML = `
          <p><b>Come funziona</b></p>
          <ul>
            <li>Attiva l'<b>editor</b> (barra arancione in basso).</li>
            <li><b>Doppio tap</b> su QUALUNQUE elemento per modificarlo: testo, colore, sfondo, dimensione font, spaziature, posizione, visibilità.</li>
            <li>Nel pannello <b>Admin</b> cambi i colori globali del tema.</li>
            <li>Le modifiche restano fino a quando premi <b>Salva</b>: da quel momento sono permanenti su questo dispositivo.</li>
            <li>Puoi <b>esportare</b> la configurazione e caricarla su un altro dispositivo.</li>
          </ul>
          <p class="muted">Login con la parola <code>admin260403</code> per riattivare l'editor.</p>
        `;
      }
    }
    renderTab('theme');
    adm.querySelectorAll('.admin-tabs button').forEach(b=>b.onclick=()=>{
      adm.querySelectorAll('.admin-tabs button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); renderTab(b.dataset.tab);
    });
    adm.querySelector('#_adm_close').onclick = ()=>adm.close();
    adm.querySelector('#_adm_apply').onclick = ()=>{
      const d = OV.get(); d.__root = d.__root || {};
      body.querySelectorAll('input[type=color][data-var]').forEach(i=>{
        d.__root[i.dataset.var] = i.value;
      });
      OV.set(d); dirty = true; adm.close();
    };
    adm.showModal();
  }

  // ---- barra editor ----
  document.getElementById('btnEditorAdmin').onclick = openAdmin;
  document.getElementById('btnEditorSave').onclick = ()=>{
    // le modifiche sono già persistite ad ogni "Applica"; qui solo conferma
    dirty=false; alert('Modifiche salvate su questo dispositivo.');
  };
  document.getElementById('btnEditorReset').onclick = ()=>{
    if(confirm('Reset di TUTTE le personalizzazioni?')) OV.clear();
  };
  document.getElementById('btnEditorOff').onclick = ()=>{
    if(dirty && !confirm('Uscire dall\'editor? Le modifiche applicate restano salvate.')) return;
    disable();
  };

  // hotkey desktop: 3 tap sul logo login → attiva editor senza pin
  let taps=0, tt=0;
  document.addEventListener('click',e=>{
    if(!e.target.closest('#brandLogo')) return;
    const now=Date.now(); if(now-tt>800) taps=0; tt=now; taps++;
    if(taps>=5){ taps=0; enable(); }
  });
})();
