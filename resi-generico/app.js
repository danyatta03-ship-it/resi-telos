// ============ MINI APP ============
const LS = {
  user:'rg-user', practs:'rg-practs', scans:'rg-scans',
};
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

const ADMIN_PIN = 'admin260403'; // <-- cambia se vuoi

function show(view){
  $$('.view').forEach(v=>v.classList.add('hidden'));
  const el = $('#view-'+view); if(el) el.classList.remove('hidden');
  window.scrollTo(0,0);
}

// ---- LOGIN ----
$('#btnLogin').addEventListener('click',()=>{
  const name = $('#loginName').value.trim();
  if(!name) return;
  if(name.toLowerCase() === ADMIN_PIN.toLowerCase()){
    // apri direttamente editor + admin
    sessionStorage.setItem(LS.user,'admin');
    $('#whoami').textContent='admin';
    show('home');
    window.RG_editor && window.RG_editor.enable();
    return;
  }
  sessionStorage.setItem(LS.user,name);
  $('#whoami').textContent=name;
  show('home');
});
$('#loginName').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#btnLogin').click(); });

// ---- LOGOUT ----
$('#btnLogout').addEventListener('click',()=>{
  sessionStorage.removeItem(LS.user);
  $('#loginName').value='';
  show('login');
});

// ---- NAV ----
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.back)));

// ---- RCV ----
function loadPracts(){ try{return JSON.parse(localStorage.getItem(LS.practs)||'[]')}catch(e){return[]} }
function savePracts(x){ localStorage.setItem(LS.practs,JSON.stringify(x)); }
$('#btnRcvSave').addEventListener('click',()=>{
  const p = {
    id: $('#rcvCodice').value.trim() || 'RES-'+Date.now(),
    forn: $('#rcvForn').value.trim(),
    note: $('#rcvNote').value.trim(),
    ts: Date.now(),
  };
  if(!p.forn){ alert('Manca il fornitore'); return; }
  const all = loadPracts(); all.push(p); savePracts(all);
  $('#rcvCodice').value=''; $('#rcvForn').value=''; $('#rcvNote').value='';
  alert('Pratica salvata: '+p.id);
});

// ---- SCAN ----
function loadScans(){ try{return JSON.parse(localStorage.getItem(LS.scans)||'[]')}catch(e){return[]} }
function saveScans(x){ localStorage.setItem(LS.scans,JSON.stringify(x)); renderScans(); }
function renderScans(){
  const ul = $('#scanList'); ul.innerHTML='';
  loadScans().slice().reverse().forEach((s,i,arr)=>{
    const realIdx = arr.length-1-i;
    const li=document.createElement('li');
    li.innerHTML = `<span>${s.code}</span><button class="del">×</button>`;
    li.querySelector('.del').onclick=()=>{ const a=loadScans(); a.splice(realIdx,1); saveScans(a); };
    ul.appendChild(li);
  });
}
$('#btnScanAdd').addEventListener('click',()=>{
  const code = $('#scanInput').value.trim().toUpperCase();
  if(!code) return;
  const a = loadScans(); a.push({code,ts:Date.now()}); saveScans(a);
  $('#scanInput').value='';
});
$('#scanInput').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#btnScanAdd').click(); });

// ---- LIST ----
function renderList(){
  const q = ($('#listFilter').value||'').toLowerCase();
  const ul = $('#listRows'); ul.innerHTML='';
  loadPracts().filter(p=>!q||p.id.toLowerCase().includes(q)||(p.forn||'').toLowerCase().includes(q))
    .slice().reverse().forEach((p,i,arr)=>{
    const realIdx = arr.length-1-i;
    const li=document.createElement('li');
    li.innerHTML=`<span><b>${p.id}</b><br><small class="muted">${p.forn||''}</small></span><button class="del">×</button>`;
    li.querySelector('.del').onclick=()=>{
      if(!confirm('Eliminare '+p.id+'?')) return;
      const a=loadPracts(); a.splice(realIdx,1); savePracts(a); renderList();
    };
    ul.appendChild(li);
  });
}
$('#listFilter').addEventListener('input',renderList);

// ---- EXPORT ----
function download(name,content,type='application/json'){
  const b=new Blob([content],{type});const u=URL.createObjectURL(b);
  const a=document.createElement('a');a.href=u;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
}
$('#btnExportJson').addEventListener('click',()=>{
  download('pratiche.json',JSON.stringify({pratiche:loadPracts(),scans:loadScans()},null,2));
});
$('#btnExportCsv').addEventListener('click',()=>{
  const rows=[['id','fornitore','note','data']].concat(
    loadPracts().map(p=>[p.id,p.forn||'',p.note||'',new Date(p.ts).toISOString()])
  );
  download('pratiche.csv',rows.map(r=>r.map(c=>`"${(c+'').replace(/"/g,'""')}"`).join(',')).join('\n'),'text/csv');
});
$('#btnWipe').addEventListener('click',()=>{
  if(!confirm('Cancellare TUTTI i dati (pratiche+scans)?')) return;
  localStorage.removeItem(LS.practs); localStorage.removeItem(LS.scans);
  alert('Fatto.');
});

// ---- VIEW HOOKS ----
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-go]'); if(!b) return;
  if(b.dataset.go==='list') renderList();
  if(b.dataset.go==='scan') renderScans();
});

// ---- BOOT ----
(function boot(){
  const u = sessionStorage.getItem(LS.user);
  if(u){ $('#whoami').textContent=u; show('home'); }
  else show('login');
})();
