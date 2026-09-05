/* Service Worker dell'app pubblica di invio reso.
 *
 * Cache separata da quella del gestionale (resi-telos-vXX): sono due app
 * distinte, con cicli di rilascio propri.
 *
 * Le chiamate a /api/ non vengono MAI messe in cache: sono l'invio del reso
 * e la lettura dello stato, cioe' esattamente le cose che devono essere
 * fresche. Servire un invio dalla cache significherebbe far credere a
 * qualcuno di aver mandato un reso che non e' partito.
 */

var CACHE = 'reso-telos-v1';

var PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/api.js',
  './js/dom.js',
  './js/form.js',
  './js/stato.js',
  './js/photos.js',
  './js/costanti.js',
  '../icon-192.png',
  '../icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Uno a uno: un file mancante non deve impedire l'installazione.
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('reso-telos-') === 0 && k !== CACHE) return caches.delete(k);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = req.url;
  if (url.indexOf('http') !== 0) return;
  if (url.indexOf('/api/') >= 0) return;                       // mai in cache
  if (url.indexOf(self.registration.scope) !== 0) return;      // fuori scope

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

  event.respondWith(
    caches.match(req).then(function (hit) {
      var rete = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || rete;
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});
