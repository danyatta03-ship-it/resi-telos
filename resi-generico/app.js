// APP — login + boot
const ADMIN_WORDS = ['admin','admin260403'];
const $ = s=>document.querySelector(s);

function boot(){
  RG_render.applyTheme();
  const u = sessionStorage.getItem('rg-user');
  if(u) enterApp(u);
  else {
    const b = RG.get().brand;
    if(b.logo) $('#loginLogo').src = b.logo;
    $('#loginTitle').textContent = b.name || 'Accesso';
  }
}
function enterApp(user){
  sessionStorage.setItem('rg-user', user);
  $('#view-login').classList.add('hidden');
  $('#view-app').classList.remove('hidden');
  RG_render.rerender();
  if(ADMIN_WORDS.includes(user.toLowerCase())) RG_editor.enable();
}
$('#btnLogin').onclick = ()=>{ const n=$('#loginName').value.trim(); if(!n) return; enterApp(n); };
$('#loginName').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#btnLogin').click(); });
boot();
