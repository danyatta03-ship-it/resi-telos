/* Service Worker dedicato a Firebase Cloud Messaging.
 *
 * Firebase esige un worker separato con questo nome esatto per le notifiche
 * in background. Deve poter leggere la config senza moduli ES (i worker
 * classici non fanno import), quindi la riceve via postMessage da app.js
 * oppure la legge dai query param con cui e' stato registrato.
 *
 * Se la configurazione non arriva, il worker resta inerte: le notifiche push
 * non funzionano ma nulla si rompe.
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

var initialized = false;

function initMessaging(cfg) {
  if (initialized || !cfg || !cfg.apiKey || !cfg.projectId) return;
  try {
    firebase.initializeApp({
      apiKey: cfg.apiKey,
      projectId: cfg.projectId,
      messagingSenderId: cfg.messagingSenderId || '',
      appId: cfg.appId || '',
      databaseURL: cfg.databaseURL || ''
    });
    var messaging = firebase.messaging();

    messaging.onBackgroundMessage(function (payload) {
      var n = (payload && payload.notification) || {};
      var data = (payload && payload.data) || {};
      var title = n.title || 'Tracking Resi';
      var options = {
        body: n.body || '',
        icon: '../icon-192.png',
        badge: '../icon-192.png',
        // Il tag per reso evita che dieci aggiornamenti sulla stessa pratica
        // diventino dieci notifiche impilate.
        tag: data.returnKey || 'portal',
        data: data,
        renotify: true
      };
      return self.registration.showNotification(title, options);
    });

    initialized = true;
  } catch (e) {
    // Config incompleta o SDK non caricato: niente push, ma il worker resta vivo.
  }
}

// La config puo' arrivare come query string alla registrazione.
try {
  var params = new URL(self.location).searchParams;
  if (params.get('apiKey')) {
    initMessaging({
      apiKey: params.get('apiKey'),
      projectId: params.get('projectId'),
      messagingSenderId: params.get('messagingSenderId'),
      appId: params.get('appId'),
      databaseURL: params.get('databaseURL')
    });
  }
} catch (e) { /* URL non parsabile: aspetto il postMessage */ }

self.addEventListener('message', function (event) {
  var data = event.data;
  if (data && data.type === 'FIREBASE_CONFIG') initMessaging(data.config);
});

// Click sulla notifica: porta l'utente sulla pratica interessata,
// riusando una finestra gia' aperta se c'e'.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var returnKey = (event.notification.data && event.notification.data.returnKey) || '';
  var target = returnKey
    ? './index.html#/resi/' + encodeURIComponent(returnKey)
    : './index.html#/notifiche';
  var absolute = new URL(target, self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf(self.registration.scope) === 0 && 'navigate' in client) {
          return client.navigate(absolute).then(function (c) { return c && c.focus(); });
        }
      }
      return self.clients.openWindow(absolute);
    })
  );
});

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
