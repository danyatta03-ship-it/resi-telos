// Router hash-based. Nessuna dipendenza dal server: il portale e' servito
// come file statico e #/rotta non genera mai un 404.
//
// Rotte registrate con pattern tipo '/resi/:key'. Il match e' esatto sul
// numero di segmenti — niente wildcard, non servono.

import { emit, EVENTS } from './bus.js';

const routes = [];
let notFoundHandler = null;
let guard = null;
let current = null;
let running = false;
let pending = false;

export function route(pattern, handler, opts = {}) {
  const segments = pattern.split('/').filter(Boolean);
  routes.push({
    pattern,
    segments,
    handler,
    roles: opts.roles || null,
    title: opts.title || ''
  });
}

export function setNotFound(handler) {
  notFoundHandler = handler;
}

// La guardia decide se una rotta e' percorribile. Ritorna:
//   null/undefined → prosegui col rendering
//   stringa        → redirect a quella rotta
//   false          → FERMA: non renderizzare nulla.
//                    Serve quando la guardia ha gia' disegnato lei stessa
//                    qualcosa (schermata di login, account non abilitato):
//                    senza questo, la rotta protetta verrebbe montata sopra.
export function setGuard(fn) {
  guard = fn;
}

export function getCurrent() {
  return current ? Object.assign({}, current) : null;
}

export function navigate(path, replace = false) {
  const target = normalize(path);
  if (('#' + target) === location.hash) {
    // Stessa rotta: forzo comunque un re-render (utile dopo un'azione).
    resolve();
    return;
  }
  if (replace) location.replace('#' + target);
  else location.hash = target;
}

function normalize(path) {
  let p = String(path || '/').trim();
  if (p.startsWith('#')) p = p.slice(1);
  if (!p.startsWith('/')) p = '/' + p;
  return p;
}

function parseHash() {
  const raw = normalize(location.hash || '/');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = {};
  if (queryPart) {
    queryPart.split('&').forEach((pair) => {
      if (!pair) return;
      const idx = pair.indexOf('=');
      const k = idx < 0 ? pair : pair.slice(0, idx);
      const v = idx < 0 ? '' : pair.slice(idx + 1);
      query[decodeURIComponent(k)] = decodeURIComponent(v);
    });
  }
  return { path: pathPart, segments, query };
}

function match(segments) {
  for (const r of routes) {
    if (r.segments.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.segments.length; i++) {
      const rs = r.segments[i];
      if (rs.startsWith(':')) {
        params[rs.slice(1)] = decodeURIComponent(segments[i]);
      } else if (rs !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

async function resolve() {
  // Una navigazione durante un render in corso non deve interlacciarsi:
  // segno che ce n'e' una in attesa e la eseguo appena finisce questa.
  if (running) {
    pending = true;
    return;
  }
  running = true;
  try {
    const { path, segments, query } = parseHash();
    const found = match(segments);

    if (guard) {
      const verdict = await guard({
        path,
        params: found ? found.params : {},
        query,
        route: found ? found.route : null
      });
      if (verdict === false) {
        current = { path, params: {}, query, route: null };
        return;
      }
      if (verdict) {
        running = false;
        navigate(verdict, true);
        return;
      }
    }

    if (!found) {
      current = { path, params: {}, query, route: null };
      emit(EVENTS.ROUTE_CHANGED, getCurrent());
      if (notFoundHandler) await notFoundHandler({ path, query });
      return;
    }

    current = { path, params: found.params, query, route: found.route };
    emit(EVENTS.ROUTE_CHANGED, getCurrent());
    await found.route.handler({ params: found.params, query, path });
  } catch (err) {
    console.error('[router] errore nel rendering della rotta', err);
    if (notFoundHandler) {
      try {
        await notFoundHandler({ path: location.hash, error: err });
      } catch (e) { /* handler rotto: meglio non peggiorare */ }
    }
  } finally {
    running = false;
    if (pending) {
      pending = false;
      resolve();
    }
  }
}

export function startRouter(defaultPath = '/') {
  window.addEventListener('hashchange', resolve);
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    location.replace('#' + normalize(defaultPath));
  }
  resolve();
}

export function refresh() {
  resolve();
}
