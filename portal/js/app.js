// Bootstrap del portale: inizializza Firebase, monta il router, decide fra
// schermata di login e shell applicativa.

import { initFirebase, FirebaseUnavailable, paths } from './core/firebase.js';
import { loadBrandDefaults, applyBrand, getFirebaseConfig, saveFirebaseConfig } from './core/config.js';
import { initAuth, whenReady, whenProfileReady, isSignedIn, getRole, getUid, signOut } from './core/auth.js';
import { initOffline } from './core/offline.js';
import { route, setNotFound, setGuard, startRouter, navigate } from './core/router.js';
import { on, EVENTS } from './core/bus.js';
import { clear as clearStore } from './core/store.js';
import { loadSlaConfig, setSlaConfig } from './domain/sla.js';
import { isDemo, installDemoBackend, stopDemo, demoRole } from './core/demo.js';
import { navFor, isTrackingOnly, homePathFor, reachablePaths } from './domain/roles.js';
import { h, mount, clear } from './ui/dom.js';
import { buildShell, teardownShell, getMain, restoreTheme, setNotifCount } from './ui/shell.js';
import { emptyState, banner } from './ui/components.js';
import { toast } from './ui/toast.js';

import { renderLogin, leaveLogin } from './views/login.js';
import { renderDashboard, leaveDashboard } from './views/dashboard.js';
import { renderReturns, leaveReturns } from './views/returns.js';
import { renderReturnDetail, leaveReturnDetail } from './views/return-detail.js';
import { renderRequests, renderNewRequest, leaveRequests } from './views/requests.js';
import { renderNotifications, leaveNotifications } from './views/notifications.js';
import { renderProfile } from './views/profile.js';
import { renderAdminUsers, leaveAdminUsers } from './views/admin-users.js';
import { renderAdminSla } from './views/admin-sla.js';
import { renderAdminBrand } from './views/admin-brand.js';

const app = document.getElementById('app');
let shellMounted = false;
let noRoleShown = false;
let brandRef = null;
let slaRef = null;

// Ogni vista che monta listener Firebase deve poterli smontare: senza questo
// passando da una schermata all'altra si accumulano sottoscrizioni.
function leaveAll() {
  leaveDashboard();
  leaveReturns();
  leaveReturnDetail();
  leaveRequests();
  leaveNotifications();
  leaveAdminUsers();
}

function view(fn) {
  return async (ctx) => {
    leaveAll();
    const main = ensureShell();
    if (!main) return;
    window.scrollTo(0, 0);
    await fn(main, ctx);
  };
}

function ensureShell() {
  if (!shellMounted) {
    leaveLogin();
    buildShell(app);
    shellMounted = true;
  }
  return getMain();
}

function showLogin() {
  leaveAll();
  clearStore();
  if (shellMounted) {
    teardownShell();
    shellMounted = false;
  }
  renderLogin(app);
}

// ── Rotte ───────────────────────────────────────────────────────────────
route('/',                 view((main) => renderDashboard(main)));
route('/resi',             view((main, ctx) => renderReturns(main, ctx)));
route('/resi/:key',        view((main, ctx) => renderReturnDetail(main, ctx)));
route('/richieste',        view((main) => renderRequests(main)));
route('/richieste/nuova',  view((main) => renderNewRequest(main)));
route('/notifiche',        view((main) => renderNotifications(main)));
route('/profilo',          view((main) => renderProfile(main)));
route('/admin/utenti',     view((main) => renderAdminUsers(main)), { roles: ['ADMIN'] });
route('/admin/sla',        view((main) => renderAdminSla(main)), { roles: ['ADMIN'] });
route('/admin/brand',      view((main) => renderAdminBrand(main)), { roles: ['ADMIN'] });

setNotFound(view((main, ctx) => {
  clear(main);
  main.appendChild(emptyState({
    icon: '🧭',
    title: 'Pagina non trovata',
    message: 'L\'indirizzo richiesto non esiste.',
    action: h('a.btn.btn-primary', { href: '#/' }, 'Torna alla dashboard')
  }));
}));

// La guardia gira PRIMA di ogni rotta: e' il punto in cui si decide se
// l'utente puo' vedere quella schermata.
setGuard(async (ctx) => {
  await whenReady();

  if (!isSignedIn()) {
    // Sessione valida ma senza ruolo: la schermata "account non abilitato"
    // e' gia' a video, non va sostituita col login.
    if (!noRoleShown) showLogin();
    // false = "ho gia' disegnato io": il router non deve montare la rotta
    // protetta sopra la schermata di accesso.
    return false;
  }

  // Il perimetro dell'utente arriva col profilo: senza, un cliente
  // interrogherebbe Firebase con scope vuoto e vedrebbe zero resi.
  await whenProfileReady();

  const role = getRole();
  const home = homePathFor(role);

  if (ctx.route && ctx.route.roles && ctx.route.roles.indexOf(role) < 0) {
    toast('Sezione non disponibile per il tuo ruolo.', 'err');
    return home;
  }

  // Un ruolo esterno che arriva su '/' non ha una dashboard: lo porto sul
  // tracking, che per lui e' la home.
  if (ctx.path === '/' && isTrackingOnly(role)) return home;

  // Rotta valida ma fuori dal perimetro del ruolo: riporto alla sua home
  // invece di mostrare una pagina vuota.
  if (ctx.route && ctx.path !== '/' && !ctx.path.startsWith('/resi/')) {
    const allowed = reachablePaths(role);
    if (allowed.indexOf(ctx.path) < 0) return home;
  }

  ensureShell();
  return null;
});

// ── Avvio ───────────────────────────────────────────────────────────────
async function boot() {
  restoreTheme();
  await loadBrandDefaults();

  // La demo installa un finto SDK con dati in memoria: da qui in poi il resto
  // dell'applicazione gira identico, senza sapere di essere in prova.
  if (isDemo()) {
    installDemoBackend();
    document.documentElement.classList.add('is-demo');
  }

  try {
    await initFirebase();
  } catch (err) {
    renderSetup(err);
    return;
  }

  initAuth();
  initOffline();

  on(EVENTS.AUTH_CHANGED, (auth) => {
    if (!auth) {
      showLogin();
      detachConfig();
      return;
    }
    if (!auth.role) {
      renderNoRole();
      noRoleShown = true;
      return;
    }
    noRoleShown = false;
    attachConfig();
    ensureShell();
    // Dopo il login rientro sulla rotta corrente, o sulla home del ruolo.
    const home = homePathFor(auth.role);
    const current = location.hash && location.hash !== '#' ? location.hash.slice(1) : '';
    navigate(current && current !== '/' ? current : home, true);
  });

  startRouter('/');
}

// I listener su brand e SLA vivono per tutta la sessione autenticata: sono
// configurazioni globali che devono propagarsi senza ricaricare la pagina.
function attachConfig() {
  if (!brandRef) {
    try {
      brandRef = paths.configBrand();
      brandRef.on('value', (snap) => {
        const val = snap.val();
        if (val) applyBrand(val);
      }, () => { /* nodo assente: restano i default del bundle */ });
    } catch (e) { /* non bloccante */ }
  }
  if (!slaRef) {
    try {
      slaRef = paths.configSla();
      slaRef.on('value', (snap) => {
        const val = snap.val();
        if (val) setSlaConfig(val);
      }, () => { /* restano i default */ });
    } catch (e) { /* non bloccante */ }
  }
  loadSlaConfig();
}

function detachConfig() {
  if (brandRef) { try { brandRef.off(); } catch (e) { /* ignora */ } brandRef = null; }
  if (slaRef)   { try { slaRef.off(); } catch (e) { /* ignora */ } slaRef = null; }
}

// Account autenticato ma senza ruolo: e' successo se l'admin ha creato
// l'utente in Firebase Auth ma non ha ancora assegnato il claim.
function renderNoRole() {
  if (shellMounted) { teardownShell(); shellMounted = false; }
  clear(app);
  app.appendChild(h('div.fullscreen', h('div.fullscreen-box', h('div.card', [
    emptyState({
      icon: '🔒',
      title: 'Account non abilitato',
      message: 'Il tuo account esiste ma non ha ancora un ruolo assegnato. Contatta l\'amministratore del portale.'
    }),
    h('button.btn.btn-block', { type: 'button', onclick: () => signOut() }, 'Esci')
  ]))));
}

// Prima configurazione: nessuna credenziale Firebase su questo dispositivo.
function renderSetup(err) {
  clear(app);
  const apiInput = h('input.input', { type: 'text', placeholder: 'AIza…', spellcheck: false });
  const urlInput = h('input.input', { type: 'url', placeholder: 'https://<progetto>-default-rtdb.europe-west1.firebasedatabase.app', spellcheck: false });
  const vapidInput = h('input.input', { type: 'text', placeholder: 'Facoltativa: chiave VAPID per le notifiche push', spellcheck: false });
  const errBox = h('div.banner.banner-err.hidden');

  const saveBtn = h('button.btn.btn-primary.btn-block', {
    type: 'button',
    onclick: () => {
      const apiKey = apiInput.value.trim();
      const databaseURL = urlInput.value.trim();
      if (!apiKey || !databaseURL) {
        mount(errBox, [h('div', '⛔'), h('div', 'Compila API key e URL del database.')]);
        errBox.classList.remove('hidden');
        return;
      }
      const cfg = { apiKey, databaseURL };
      if (vapidInput.value.trim()) cfg.vapidKey = vapidInput.value.trim();
      saveFirebaseConfig(cfg);
      location.reload();
    }
  }, 'Salva e connetti');

  const isSdkProblem = err instanceof FirebaseUnavailable && /SDK/.test(err.message || '');

  app.appendChild(h('div.fullscreen', h('div.fullscreen-box', [
    h('div.txt-c', { style: { marginBottom: '18px' } }, [
      h('h1', 'Configurazione'),
      h('div.muted', { style: { fontSize: '13.5px' } }, 'Collega il portale al database Firebase del gestionale.')
    ]),
    h('div.card', [
      isSdkProblem
        ? banner('err', 'Le librerie Firebase non si sono caricate. Controlla la connessione e ricarica la pagina.')
        : banner('info', 'Usa le STESSE credenziali del gestionale: i due sistemi condividono il database.'),
      h('div.field', [h('label.label', ['API key', h('span.req', '*')]), apiInput]),
      h('div.field', [h('label.label', ['URL Realtime Database', h('span.req', '*')]), urlInput]),
      h('div.field', [h('label.label', 'VAPID key (push)'), vapidInput, h('div.hint', 'Firebase Console → Impostazioni progetto → Cloud Messaging → Certificati push web.')]),
      errBox,
      saveBtn
    ])
  ])));

  // Se il gestionale gira sullo stesso dominio, la sua config e' gia' in
  // localStorage: precompilo per evitare di far ridigitare tutto.
  const existing = getFirebaseConfig();
  if (existing) {
    apiInput.value = existing.apiKey || '';
    urlInput.value = existing.databaseURL || '';
  }
}

boot().catch((err) => {
  console.error('[app] avvio fallito', err);
  clear(app);
  app.appendChild(h('div.fullscreen', h('div.fullscreen-box', h('div.card',
    emptyState({
      icon: '⚠️',
      title: 'Avvio non riuscito',
      message: (err && err.message) || 'Errore imprevisto.',
      action: h('button.btn.btn-primary', { type: 'button', onclick: () => location.reload() }, 'Ricarica')
    })
  ))));
});
