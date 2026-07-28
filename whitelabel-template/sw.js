/* Service Worker — white-label PWA
 * App shell: network-first (aggiornamenti live, offline dal cache)
 * Config JSON: cache-first + refresh in background
 */
var CACHE = 'wl-v1';
var PRECACHE = [
  './',
  './index.html',
  './app.js',
  './admin.js',
  './brand-loader.js',
  './brand-config.json',
  './app-config.json',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(PRECACHE.map(function(u){ return c.add(u).catch(function(){}); }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
                            .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin !== location.origin) return;

  var isConfig = /(?:brand-config\.json|app-config\.json)$/.test(url.pathname);

  if(isConfig){
    // cache-first + refresh in background
    e.respondWith(
      caches.match(req).then(function(hit){
        var net = fetch(req).then(function(res){
          if(res && res.ok){
            var copy = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copy); });
          }
          return res;
        }).catch(function(){ return hit; });
        return hit || net;
      })
    );
    return;
  }

  // network-first: sempre l'app aggiornata, cache fallback offline
  e.respondWith(
    fetch(req).then(function(res){
      if(res && res.ok){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        return hit || caches.match('./index.html');
      });
    })
  );
});
