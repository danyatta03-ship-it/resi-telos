// Autenticazione del portale: email/password reale (NON anonima).
//
// Il ruolo vive in due posti che devono restare allineati:
//   • custom claim `prole`  → applicato dal server, e' cio' che le Security
//     Rules leggono. E' l'unica fonte di verita' lato sicurezza.
//   • portal_users/<uid>/role → copia leggibile per la UI e per l'admin.
// La UI si fida del claim; il nodo serve a mostrare nome, azienda, scope.
//
// Se i due divergono (claim aggiornato ma token vecchio in cache) forziamo
// un refresh del token: getIdTokenResult(true).

import { auth, paths } from './firebase.js';
import { emit, EVENTS } from './bus.js';

let currentUser = null;
let currentProfile = null;
let currentRole = null;
let currentScope = [];
let profileRef = null;
let ready = false;
let readyResolvers = [];
let profileReady = false;
let profileResolvers = [];

export const ROLES = ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE', 'CORRIERE'];

export function getUser() {
  return currentUser;
}

export function getProfile() {
  return currentProfile ? Object.assign({}, currentProfile) : null;
}

export function getRole() {
  return currentRole;
}

export function getScope() {
  return currentScope.slice();
}

export function getUid() {
  return currentUser ? currentUser.uid : null;
}

export function getDisplayName() {
  if (currentProfile && currentProfile.displayName) return currentProfile.displayName;
  if (currentUser && currentUser.displayName) return currentUser.displayName;
  if (currentUser && currentUser.email) return currentUser.email.split('@')[0];
  return 'Utente';
}

export function isSignedIn() {
  return !!currentUser && !!currentRole;
}

export function isStaff() {
  return currentRole === 'ADMIN' || currentRole === 'TELOS';
}

export function isAdmin() {
  return currentRole === 'ADMIN';
}

// Risolve quando il primo onAuthStateChanged e' arrivato, cosi' il router
// non decide dove instradare prima di sapere se c'e' una sessione.
export function whenReady() {
  if (ready) return Promise.resolve();
  return new Promise((resolve) => readyResolvers.push(resolve));
}

function markReady() {
  if (ready) return;
  ready = true;
  readyResolvers.forEach((fn) => fn());
  readyResolvers = [];
}

// Il PERIMETRO di un utente esterno (quali codici cliente, quali vettori) vive
// nel profilo, non nel token. Montare una vista prima che sia arrivato
// significa interrogare Firebase con uno scope vuoto: l'utente vedrebbe
// "nessun reso" pur avendone. Il router aspetta qui.
export function whenProfileReady(timeoutMs = 6000) {
  if (profileReady || !currentUser) return Promise.resolve(getProfile());
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(getProfile());
    };
    profileResolvers.push(done);
    // Se il profilo non arriva (nodo assente, permesso negato) non blocchiamo
    // l'app per sempre: si prosegue con quello che c'e'.
    setTimeout(done, timeoutMs);
  });
}

function markProfileReady() {
  profileReady = true;
  profileResolvers.forEach((fn) => fn());
  profileResolvers = [];
}

export function initAuth() {
  auth().onAuthStateChanged(async (user) => {
    detachProfile();
    profileReady = false;
    if (!user) {
      currentUser = null;
      currentProfile = null;
      currentRole = null;
      currentScope = [];
      markProfileReady();
      markReady();
      emit(EVENTS.AUTH_CHANGED, null);
      return;
    }
    currentUser = user;
    try {
      currentRole = await readRoleClaim(user);
    } catch (err) {
      console.error('[auth] lettura claim fallita', err);
      currentRole = null;
    }
    attachProfile(user.uid);
    touchLastLogin(user.uid);
    markReady();
    emit(EVENTS.AUTH_CHANGED, { uid: user.uid, email: user.email, role: currentRole });
  });
}

async function readRoleClaim(user, forceRefresh = false) {
  const res = await user.getIdTokenResult(forceRefresh);
  const claim = res && res.claims ? res.claims.prole : null;
  return ROLES.indexOf(claim) >= 0 ? claim : null;
}

// Da chiamare dopo che l'admin ha cambiato il ruolo: il claim vive nel token,
// che non si aggiorna da solo finche' non scade (~1h).
export async function refreshClaims() {
  if (!currentUser) return null;
  currentRole = await readRoleClaim(currentUser, true);
  emit(EVENTS.AUTH_CHANGED, { uid: currentUser.uid, email: currentUser.email, role: currentRole });
  return currentRole;
}

function attachProfile(uid) {
  try {
    profileRef = paths.user(uid);
    profileRef.on('value', (snap) => {
      const val = snap.val() || null;
      currentProfile = val;
      currentScope = val && val.scope ? Object.keys(val.scope).filter((k) => val.scope[k] === true) : [];
      // Il claim resta l'autorita' per la sicurezza, ma se il profilo dice un
      // ruolo diverso il token e' stantio: lo rinfresco una volta sola.
      if (val && val.role && currentRole && val.role !== currentRole) {
        refreshClaims().catch(() => {});
      }
      markProfileReady();
      emit(EVENTS.AUTH_PROFILE, getProfile());
    }, (err) => {
      // Permission denied qui significa quasi sempre "claim non ancora assegnato".
      console.warn('[auth] profilo non leggibile:', err && err.message);
      currentProfile = null;
      markProfileReady();
      emit(EVENTS.AUTH_PROFILE, null);
    });
  } catch (err) {
    console.error('[auth] attach profilo fallito', err);
  }
}

function detachProfile() {
  if (profileRef) {
    try { profileRef.off(); } catch (e) { /* gia' staccato */ }
    profileRef = null;
  }
}

function touchLastLogin(uid) {
  try {
    paths.user(uid).child('lastLogin').set(Date.now()).catch(() => {});
  } catch (e) { /* offline: irrilevante */ }
}

export async function signIn(email, password) {
  const cred = await auth().signInWithEmailAndPassword(String(email || '').trim(), password);
  const role = await readRoleClaim(cred.user, true);
  if (!role) {
    await auth().signOut();
    const err = new Error('Account non abilitato al portale. Contatta l\'amministratore.');
    err.code = 'portal/no-role';
    throw err;
  }
  return cred.user;
}

export async function signOut() {
  detachProfile();
  await auth().signOut();
}

export async function sendPasswordReset(email) {
  await auth().sendPasswordResetEmail(String(email || '').trim());
}

export async function changePassword(currentPassword, newPassword) {
  const user = auth().currentUser;
  if (!user || !user.email) throw new Error('Nessuna sessione attiva');
  // Riautenticazione obbligatoria: Firebase rifiuta updatePassword su sessioni
  // vecchie, ed e' comunque la cosa giusta da fare.
  const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
  await user.reauthenticateWithCredential(cred);
  await user.updatePassword(newPassword);
}

// Messaggi Firebase in italiano leggibile.
export function authErrorText(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-email': 'Indirizzo email non valido.',
    'auth/user-disabled': 'Account disabilitato. Contatta l\'amministratore.',
    'auth/user-not-found': 'Email o password non corretti.',
    'auth/wrong-password': 'Email o password non corretti.',
    'auth/invalid-credential': 'Email o password non corretti.',
    'auth/invalid-login-credentials': 'Email o password non corretti.',
    'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
    'auth/network-request-failed': 'Nessuna connessione. Controlla la rete.',
    'auth/weak-password': 'Password troppo debole: minimo 6 caratteri.',
    'auth/requires-recent-login': 'Per sicurezza rifai il login e riprova.',
    'portal/no-role': 'Account non abilitato al portale. Contatta l\'amministratore.'
  };
  if (map[code]) return map[code];
  return (err && err.message) || 'Errore imprevisto.';
}
