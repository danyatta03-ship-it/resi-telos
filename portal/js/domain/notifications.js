// Notifiche: in-app (nodo RTDB per utente) + push via Firebase Cloud Messaging.
//
// L'in-app funziona sempre. Il push e' opzionale: richiede una VAPID key
// configurata e il permesso del browser. Se manca l'uno o l'altro il portale
// resta pienamente utilizzabile — degrada, non si rompe.
//
// L'invio del push e' server-side (netlify/functions/portal-notify.js): un
// client non puo' e non deve poter spedire notifiche ad altri utenti.

import { paths, db } from '../core/firebase.js';
import { getUid, getRole } from '../core/auth.js';
import { getFirebaseConfig } from '../core/config.js';
import { snapToArray } from '../core/store.js';
import { emit, EVENTS } from '../core/bus.js';

let messaging = null;
let pushReady = false;

export function bindNotifications({ next, fail }) {
  const uid = getUid();
  if (!uid) {
    next([]);
    return () => {};
  }
  const ref = paths.notifications(uid).limitToLast(100);
  const handler = ref.on('value', (snap) => {
    const rows = snapToArray(snap).map((n) => Object.assign({}, n, { id: n._key }));
    rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    next(rows);
    emit(EVENTS.NOTIF_CHANGED, rows.filter((n) => !n.read).length);
  }, (err) => fail(err));
  return () => ref.off('value', handler);
}

export function unreadCount(list) {
  return (list || []).filter((n) => !n.read).length;
}

export async function markRead(id) {
  const uid = getUid();
  if (!uid || !id) return;
  try {
    await paths.notifications(uid).child(id).child('read').set(true);
  } catch (e) { /* offline: verra' riletto come non letto, innocuo */ }
}

export async function markAllRead(list) {
  const uid = getUid();
  if (!uid) return;
  const updates = {};
  for (const n of list || []) {
    if (!n.read && n.id) updates[n.id + '/read'] = true;
  }
  if (!Object.keys(updates).length) return;
  try {
    await paths.notifications(uid).update(updates);
  } catch (e) { /* offline */ }
}

export async function clearAll() {
  const uid = getUid();
  if (!uid) return;
  await paths.notifications(uid).remove();
}

// ── Push (FCM) ──────────────────────────────────────────────────────────

export function pushSupported() {
  return typeof firebase !== 'undefined'
    && typeof firebase.messaging === 'function'
    && typeof Notification !== 'undefined'
    && 'serviceWorker' in navigator;
}

export function pushPermission() {
  try {
    return Notification.permission;
  } catch (e) {
    return 'default';
  }
}

export function isPushReady() {
  return pushReady;
}

// Attiva il push: chiede il permesso, ottiene il token e lo registra sul
// profilo utente. La function server legge quei token per spedire.
export async function enablePush() {
  if (!pushSupported()) throw new Error('Notifiche push non supportate da questo browser.');
  const cfg = getFirebaseConfig();
  if (!cfg || !cfg.vapidKey) {
    throw new Error('Push non configurato: manca la VAPID key nella configurazione Firebase.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permesso negato. Attiva le notifiche dalle impostazioni del browser.');

  const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' });
  if (!messaging) messaging = firebase.messaging(firebase.app('portal'));

  const token = await messaging.getToken({
    vapidKey: cfg.vapidKey,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error('Impossibile ottenere il token di notifica.');

  const uid = getUid();
  if (uid) await paths.userTokens(uid).child(token).set(Date.now());

  // Messaggio ricevuto con l'app in primo piano: FCM non mostra nulla da solo.
  messaging.onMessage((payload) => {
    const n = (payload && payload.notification) || {};
    emit(EVENTS.NOTIF_CHANGED, -1);
    try {
      new Notification(n.title || 'Tracking Resi', {
        body: n.body || '',
        icon: './icon-192.png',
        tag: (payload.data && payload.data.returnKey) || 'portal'
      });
    } catch (e) { /* alcuni browser vietano Notification fuori dal SW */ }
  });

  pushReady = true;
  return token;
}

export async function disablePush() {
  const uid = getUid();
  if (!messaging || !uid) {
    pushReady = false;
    return;
  }
  try {
    const token = await messaging.getToken();
    if (token) {
      await paths.userTokens(uid).child(token).remove();
      await messaging.deleteToken();
    }
  } catch (e) { /* token gia' invalidato lato FCM */ }
  pushReady = false;
}

// Richiede al server di notificare gli utenti interessati a un reso.
// Fallisce in silenzio: una notifica non consegnata non deve mai far fallire
// l'azione che l'ha generata.
export async function requestNotify(payload) {
  try {
    const res = await fetch('/api/portal-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Notifica in-app diretta verso un utente. Consentita solo allo staff dalle
// regole: e' il canale con cui Telos avvisa un cliente.
export async function notifyUser(uid, title, body, returnKey) {
  const role = getRole();
  if (role !== 'ADMIN' && role !== 'TELOS') return false;
  try {
    const id = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const rec = { ts: Date.now(), title: String(title).slice(0, 200), read: false };
    if (body) rec.body = String(body).slice(0, 1000);
    if (returnKey) rec.returnKey = String(returnKey);
    await db().ref('portal_notifications/' + uid + '/' + id).set(rec);
    return true;
  } catch (e) {
    return false;
  }
}
