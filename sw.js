// ═══════════════════════════════════════════════════════
// SERVICE WORKER — Resi Telos
// App shell: network-first (aggiornamenti subito, offline dal cache)
// Dati anagrafica/storico: cache-first con refresh in background
// ═══════════════════════════════════════════════════════
var CACHE = 'resi-telos-v34r';
var PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './ocr-config.js',
  './html5-qrcode.min.js',
  './zxing.min.js',
  './qrcode-lib.min.js',
  './clients.json',
  './db_import.json',
  './client_agents.json',
  './cli_data.json',
  './db_tri.json',
  './admin-config.json',
  './jsqr.js',
  './qrcode.min.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // addAll fallisce tutto se un file manca: precache tollerante
      return Promise.all(PRECACHE.map(function(u) {
        return c.add(u).catch(function() {});
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; })
        .map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  var isData = /(?:clients\.json|db_import\.json|cli_data\.json|db_tri\.json|client_agents\.json)$/.test(url.pathname);

  if (isData) {
    // cache-first + aggiornamento in background (i dati cambiano di rado)
    e.respondWith(
      caches.match(req).then(function(hit) {
        var net = fetch(req).then(function(res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function(c) { c.put(req, copy); });
          }
          return res;
        }).catch(function() { return hit; });
        return hit || net;
      })
    );
    return;
  }

  // network-first: sempre l'app più aggiornata, cache come fallback offline
  e.respondWith(
    fetch(req).then(function(res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function(c) { c.put(req, copy); });
      }
      return res;
    }).catch(function() {
      return caches.match(req).then(function(hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
