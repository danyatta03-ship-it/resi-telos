/* Service Worker del Portale Tracking Resi.
 *
 * Cache separata da quella del gestionale (resi-telos-vXX): i due sono app
 * distinte con cicli di rilascio propri e non devono invalidarsi a vicenda.
 *
 * Strategie:
 *   • shell (HTML)      → network-first: chi ha rete vede sempre l'ultima versione
 *   • asset statici     → stale-while-revalidate: istantanei, si aggiornano dietro
 *   • Firebase / API    → mai in cache: sono dati vivi
 */

var CACHE = 'portal-resi-v1';

var PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './config/brand.json',
  './js/app.js',
  './js/core/bus.js',
  './js/core/config.js',
  './js/core/firebase.js',
  './js/core/auth.js',
  './js/core/router.js',
  './js/core/store.js',
  './js/core/idb.js',
  './js/core/offline.js',
  './js/domain/roles.js',
  './js/domain/workflow.js',
  './js/domain/timeline.js',
  './js/domain/sla.js',
  './js/domain/returns.js',
  './js/domain/messages.js',
  './js/domain/documents.js',
  './js/domain/kpi.js',
  './js/domain/requests.js',
  './js/domain/notifications.js',
  './js/ui/dom.js',
  './js/ui/toast.js',
  './js/ui/modal.js',
  './js/ui/components.js',
  './js/ui/shell.js',
  './js/views/login.js',
  './js/views/dashboard.js',
  './js/views/returns.js',
  './js/views/return-detail.js',
  './js/views/requests.js',
  './js/views/notifications.js',
  './js/views/profile.js',
  './js/views/admin-users.js',
  './js/views/admin-sla.js',
  './js/views/admin-brand.js',
  '../icon-192.png',
  '../icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // addAll fallisce in blocco se un solo file manca: precarico uno a uno
      // cosi' un asset assente non impedisce l'installazione.
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        // Tocco solo le cache del portale: quelle del gestionale non sono mie.
        if (key.indexOf('portal-resi-') === 0 && key !== CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isFirebaseOrApi(url) {
  return /firebasedatabase\.app|firebaseio\.com|googleapis\.com|firebaseapp\.com|gstatic\.com|\/api\//.test(url);
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = req.url;
  if (url.indexOf('http') !== 0) return;
  if (isFirebaseOrApi(url)) return;      // dati vivi: sempre dalla rete
  if (url.indexOf(self.registration.scope) !== 0) return;  // fuori scope: non mio

  // Navigazione: network-first con fallback alla shell in cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        });
      })
    );
    return;
  }

  // Asset: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});
