// ═══════════════════════════════════════════════════════════
// SERVICE WORKER — Resi Telos PWA
// Offline-first: serve dall'installazione anche senza rete
// ═══════════════════════════════════════════════════════════
var CACHE = 'resi-telos-v3';
var ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  // Non intercettare Supabase (deve passare dalla rete)
  if(url.indexOf('supabase.co')>=0 || url.indexOf('supabase.io')>=0) return;
  // Non intercettare CDN esterni
  if(url.indexOf('cdn.jsdelivr.net')>=0) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if(cached) return cached;
      return fetch(e.request).then(function(res) {
        // Cache solo le risorse locali
        if(res.ok && url.indexOf(self.location.origin)>=0) {
          var c = res.clone();
          caches.open(CACHE).then(function(cache){cache.put(e.request, c);});
        }
        return res;
      }).catch(function() {
        // Offline fallback: serve index.html per qualsiasi navigazione
        if(e.request.mode==='navigate') return caches.match('./index.html');
      });
    })
  );
});

// Notifica il client che c'è un aggiornamento disponibile
self.addEventListener('message', function(e) {
  if(e.data==='skipWaiting') self.skipWaiting();
});
