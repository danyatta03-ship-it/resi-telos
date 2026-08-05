// js/data/firebase.js — inizializzazione Firebase con ready-promise.
//
// STATO: STUB progettuale. index.html oggi inizializza Firebase con un
// pattern async spargendo `FB_REF` come var globale e ripetendo
// setTimeout(mfuInit, 1500) finché non è pronto. Questo modulo mostra
// il pattern da adottare al posto di quel retry loop.
//
// NON INCLUDERE in index.html finché non si è deciso di sostituire
// l'inizializzazione esistente. Estrazione vera → Fase 3.

'use strict';

// Config Firebase (identica a quella in index.html)
var FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD-Vs4v-VvVvVvVvVvVvVvVvVvVvVvVvVv',  // SOSTITUIRE con la key reale
  authDomain: 'resi-telos-fb7ff.firebaseapp.com',
  databaseURL: 'https://resi-telos-fb7ff-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'resi-telos-fb7ff'
};

var _ready = null;   // Promise risolta con FB_REF quando pronto
var _refs = null;    // { root, rows, arch, notif, mfu, presence }

// Inizializza (idempotente). Ritorna sempre la stessa Promise.
// SDK Firebase deve essere già caricato (via <script>).
function init(){
  if(_ready) return _ready;
  _ready = new Promise(function(resolve, reject){
    if(typeof firebase === 'undefined'){
      reject(new Error('Firebase SDK non caricato'));
      return;
    }
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      firebase.auth().signInAnonymously()
        .then(function(){
          var root = firebase.database().ref();
          _refs = {
            root:     root,
            rows:     root.child('rows'),
            arch:     root.child('arch'),
            notif:    root.child('notif'),
            mfu:      root.child('mailFollowups'),
            presence: root.child('presence')
          };
          resolve(_refs);
        })
        .catch(reject);
    }catch(e){ reject(e); }
  });
  return _ready;
}

// Comodità: attendi che sia pronto e usa la ref
function whenReady(cb){
  return init().then(cb, function(err){
    if(typeof console !== 'undefined') console.error('[firebase] init fallito:', err);
  });
}

// Introspection
function refs(){ return _refs; }
function isReady(){ return !!_refs; }

var api = { init, whenReady, refs, isReady, FIREBASE_CONFIG };
if(typeof module !== 'undefined' && module.exports) module.exports = api;
if(typeof window !== 'undefined') window._firebase = api;
