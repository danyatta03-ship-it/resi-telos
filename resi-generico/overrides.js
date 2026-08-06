// Applica gli override salvati PRIMA che l'utente veda la pagina.
// Formato in localStorage 'rg-overrides':
// { "<edit-id>": { text?, html?, styles:{...}, hidden?, moved?:{x,y} }, "__root":{ "--primary":"#..." } }
(function(){
  const KEY='rg-overrides';
  let data={};
  try{ data = JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){}
  window.RG_overrides = {
    key:KEY,
    get(){ return data; },
    set(d){ data=d; localStorage.setItem(KEY,JSON.stringify(d)); this.apply(); },
    clear(){ data={}; localStorage.removeItem(KEY); location.reload(); },
    apply(){
      // vars root
      if(data.__root){
        for(const k in data.__root) document.documentElement.style.setProperty(k, data.__root[k]);
      }
      // elementi
      for(const id in data){
        if(id==='__root') continue;
        const el = document.querySelector('[data-edit-id="'+id+'"]');
        if(!el) continue;
        const o = data[id];
        if(o.hidden){ el.style.display='none'; continue; }
        if('text' in o) el.textContent = o.text;
        if('html' in o) el.innerHTML = o.html;
        if(o.src && el.tagName==='IMG') el.src = o.src;
        if(o.styles){ for(const k in o.styles) el.style[k]=o.styles[k]; }
        if(o.moved){
          el.style.position='relative';
          el.style.left=o.moved.x+'px';
          el.style.top=o.moved.y+'px';
        }
      }
    }
  };
  // primo apply dopo che DOM è pronto
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>window.RG_overrides.apply());
  else window.RG_overrides.apply();
})();
