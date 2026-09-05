// Configurazione runtime del portale.
//
// FIREBASE: il portale riusa lo STESSO progetto Firebase del gestionale.
// La config viene cercata in quest'ordine:
//   1. window.PORTAL_FIREBASE  (iniettata da portal/config/firebase.js, non versionata)
//   2. localStorage.fbcfg      (condivisa col gestionale sullo stesso origin)
//   3. localStorage.portal_fbcfg
// Se nessuna e' presente il portale mostra la schermata di configurazione.
//
// BRAND: default dal bundle (config/brand.json), sovrascritto da
// portal_config/brand su Firebase se ha un ts piu' recente.

import { emit, EVENTS } from './bus.js';

const BRAND_LS_KEY = 'portal_brand';
const FB_LS_KEY = 'portal_fbcfg';

let brand = {
  appName: 'Tracking Resi',
  companyName: 'TELOS SPA',
  companyAddress: '',
  companyEmail: '',
  companyPhone: '',
  supportEmail: '',
  logoUrl: '',
  colorPrimary: '#3B9FD4',
  colorAccent: '#2ECC71',
  colorWarn: '#E6B03C',
  colorDanger: '#E05555',
  loginTagline: '',
  footerNote: '',
  privacyUrl: '',
  termsUrl: '',
  ts: 0
};

export function getBrand() {
  return Object.assign({}, brand);
}

export function applyBrand(next) {
  if (!next || typeof next !== 'object') return;
  // Non accetto ts piu' vecchio: evita che una cache stantia sovrascriva
  // una config appena pubblicata dall'admin.
  if (typeof next.ts === 'number' && typeof brand.ts === 'number' && next.ts < brand.ts) return;
  brand = Object.assign({}, brand, next);
  paintBrand();
  try {
    localStorage.setItem(BRAND_LS_KEY, JSON.stringify(brand));
  } catch (e) { /* quota o private mode: il brand resta solo in memoria */ }
  emit(EVENTS.BRAND_CHANGED, getBrand());
}

// Riversa i colori del brand nelle CSS custom properties.
export function paintBrand() {
  const root = document.documentElement;
  if (!root || !root.style) return;
  const map = {
    '--brand-primary': brand.colorPrimary,
    '--brand-accent': brand.colorAccent,
    '--brand-warn': brand.colorWarn,
    '--brand-danger': brand.colorDanger
  };
  for (const key in map) {
    if (map[key]) root.style.setProperty(key, map[key]);
  }
  if (brand.appName) {
    document.title = brand.appName;
    const t = document.querySelector('meta[name="application-name"]');
    if (t) t.setAttribute('content', brand.appName);
  }
}

export async function loadBrandDefaults() {
  // Cache locale prima (istantanea, evita il flash di colori sbagliati)
  try {
    const cached = JSON.parse(localStorage.getItem(BRAND_LS_KEY) || 'null');
    if (cached) brand = Object.assign({}, brand, cached);
  } catch (e) { /* cache illeggibile: uso i default */ }
  paintBrand();
  // Poi il bundle
  try {
    const res = await fetch('./config/brand.json', { cache: 'no-cache' });
    if (res.ok) {
      const json = await res.json();
      delete json._comment;
      applyBrand(json);
    }
  } catch (e) { /* offline: restano cache o default */ }
}

export function getFirebaseConfig() {
  if (typeof window !== 'undefined' && window.PORTAL_FIREBASE) {
    const c = window.PORTAL_FIREBASE;
    if (c.apiKey && c.databaseURL) return normalizeFbCfg(c);
  }
  for (const key of [FB_LS_KEY, 'fbcfg']) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      if (raw && raw.apiKey && (raw.databaseURL || raw.dbUrl)) return normalizeFbCfg(raw);
    } catch (e) { /* chiave corrotta: provo la successiva */ }
  }
  return null;
}

export function saveFirebaseConfig(cfg) {
  const norm = normalizeFbCfg(cfg);
  localStorage.setItem(FB_LS_KEY, JSON.stringify(norm));
  return norm;
}

function normalizeFbCfg(raw) {
  const databaseURL = raw.databaseURL || raw.dbUrl || '';
  const cfg = { apiKey: raw.apiKey, databaseURL };
  // projectId e storageBucket sono deducibili dal databaseURL quando non forniti:
  // https://<project>-default-rtdb.<region>.firebasedatabase.app
  const m = /^https:\/\/([^.]+?)(-default-rtdb)?\./.exec(databaseURL);
  cfg.projectId = raw.projectId || (m ? m[1] : '');
  cfg.storageBucket = raw.storageBucket || (cfg.projectId ? cfg.projectId + '.appspot.com' : '');
  cfg.authDomain = raw.authDomain || (cfg.projectId ? cfg.projectId + '.firebaseapp.com' : '');
  if (raw.messagingSenderId) cfg.messagingSenderId = raw.messagingSenderId;
  if (raw.appId) cfg.appId = raw.appId;
  if (raw.vapidKey) cfg.vapidKey = raw.vapidKey;
  return cfg;
}
