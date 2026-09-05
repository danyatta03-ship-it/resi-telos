// Event bus minimale. Disaccoppia i moduli: chi produce un evento non deve
// conoscere chi lo consuma. Usato per auth-changed, data-changed, connessione,
// notifiche in arrivo.

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  const set = listeners.get(event);
  if (set) set.delete(fn);
}

export function once(event, fn) {
  const unsub = on(event, (payload) => {
    unsub();
    fn(payload);
  });
  return unsub;
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  // Copia il set: un handler puo' disiscriversi durante l'emit.
  for (const fn of Array.from(set)) {
    try {
      fn(payload);
    } catch (err) {
      console.error('[bus] handler fallito per "' + event + '"', err);
    }
  }
}

export function clear(event) {
  if (event) listeners.delete(event);
  else listeners.clear();
}

export const EVENTS = {
  AUTH_CHANGED: 'auth:changed',
  AUTH_PROFILE: 'auth:profile',
  CONN_CHANGED: 'conn:changed',
  RETURNS_CHANGED: 'returns:changed',
  TIMELINE_CHANGED: 'timeline:changed',
  MESSAGES_CHANGED: 'messages:changed',
  NOTIF_CHANGED: 'notif:changed',
  QUEUE_CHANGED: 'queue:changed',
  BRAND_CHANGED: 'brand:changed',
  ROUTE_CHANGED: 'route:changed'
};
