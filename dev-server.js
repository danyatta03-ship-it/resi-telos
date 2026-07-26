// ═══════════════════════════════════════════════════════
// REPARTO RESI — SERVER LOCALE
// Telos SPA — Uso interno aziendale
// ═══════════════════════════════════════════════════════
// Avvio: node server.js
// Tutti i dispositivi accedono a http://[IP-PC]:3000
// ═══════════════════════════════════════════════════════

var express    = require('express');
var http       = require('http');
var WebSocket  = require('ws');
var fs         = require('fs');
var path       = require('path');
var os         = require('os');

var app    = express();
var server = http.createServer(app);
var wss    = new WebSocket.Server({ server: server });

// ── CARTELLA DATI ──────────────────────────────────────
var DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// ── FILE OGGI ──────────────────────────────────────────
function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function getTodayFile() {
  return path.join(DATA_DIR, getTodayKey() + '.json');
}

function loadRowsFrom(file) {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { console.error('Errore lettura dati:', e.message); return {}; }
}

function loadRows() { return loadRowsFrom(getTodayFile()); }

function saveRowsTo(file, rows) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
  }
  catch(e) { console.error('Errore salvataggio dati:', e.message); }
}

function saveRows(rows) { saveRowsTo(getTodayFile(), rows); }

// Trova il file giornaliero che contiene la riga: se il giorno è cambiato
// a sessione aperta, le modifiche vanno sul file del giorno giusto invece
// di essere scartate in silenzio.
function findRowsForKey(key) {
  var today = getTodayFile();
  var rows = loadRowsFrom(today);
  if (rows[key]) return { file: today, rows: rows };
  try {
    var files = fs.readdirSync(DATA_DIR)
      .filter(function(f) { return f.endsWith('.json'); })
      .sort().reverse().slice(0, 7);
    for (var i = 0; i < files.length; i++) {
      var fp = path.join(DATA_DIR, files[i]);
      if (fp === today) continue;
      var r = loadRowsFrom(fp);
      if (r[key]) return { file: fp, rows: r };
    }
  } catch(e) {}
  return { file: today, rows: rows };
}

// ── PRESENZA UTENTI ────────────────────────────────────
var presence = {}; // { deviceId: { name, role, ts } }

// ── STATIC FILES ───────────────────────────────────────
app.use(express.static(__dirname));
app.use(express.json());

// ── REST API (backup HTTP) ─────────────────────────────
app.get('/api/rows', function(req, res) {
  res.json(loadRows());
});

app.get('/api/date', function(req, res) {
  res.json({ date: getTodayKey() });
});

// Lista file storici disponibili
app.get('/api/history', function(req, res) {
  try {
    var files = fs.readdirSync(DATA_DIR)
      .filter(function(f) { return f.endsWith('.json'); })
      .sort().reverse().slice(0, 30);
    res.json(files.map(function(f) { return f.replace('.json',''); }));
  } catch(e) { res.json([]); }
});

// Dati di un giorno specifico
app.get('/api/history/:date', function(req, res) {
  var file = path.join(DATA_DIR, req.params.date + '.json');
  if (!fs.existsSync(file)) { res.json({}); return; }
  try { res.json(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch(e) { res.json({}); }
});


// Anagrafica clienti (per autocomplete)
app.get('/api/clients', function(req, res) {
  var file = path.join(__dirname, 'clients.json');
  if (!fs.existsSync(file)) { res.json({}); return; }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(file);
});

// Import dati DB esistente (trimestre)
app.get('/api/db-import', function(req, res) {
  var file = path.join(__dirname, 'db_import.json');
  if (!fs.existsSync(file)) file = path.join(__dirname, 'db import.json');
  if (!fs.existsSync(file)) { res.json([]); return; }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.sendFile(file);
});

// ── WEBSOCKET ──────────────────────────────────────────
var clients = {};
var clientCount = 0;

wss.on('connection', function(ws, req) {
  var clientId = 'c_' + (++clientCount);
  clients[clientId] = ws;
  console.log('[' + new Date().toLocaleTimeString('it-IT') + '] Connesso: ' + clientId + ' (' + Object.keys(clients).length + ' online)');

  // Manda lo stato attuale al nuovo client
  ws.send(JSON.stringify({ type: 'init', data: loadRows(), presence: presence }));

  ws.on('message', function(msg) {
    try {
      var m = JSON.parse(msg);
      var rows;

      if (m.type === 'add') {
        rows = loadRows();
        // Riusa la chiave generata dal client: tutti i dispositivi (incluso
        // chi ha inserito) devono condividere la stessa chiave della riga.
        var key = m.row._key || ('r' + Date.now() + Math.random().toString(36).slice(2, 5));
        m.row._key = key;
        if (!m.row._ts) m.row._ts = Date.now();
        rows[key] = m.row;
        saveRows(rows);
        broadcast({ type: 'add', key: key, row: m.row }, clientId);
        console.log('[+] Aggiunto: ' + m.row.cod + ' da ' + (m.row._who || '?'));

      } else if (m.type === 'update') {
        var loc = findRowsForKey(m.key);
        if (loc.rows[m.key]) {
          var k;
          for (k in m.changes) loc.rows[m.key][k] = m.changes[k];
          saveRowsTo(loc.file, loc.rows);
          broadcast({ type: 'update', key: m.key, changes: m.changes }, clientId);
          console.log('[~] Aggiornato: ' + m.key);
        }

      } else if (m.type === 'remove') {
        var locR = findRowsForKey(m.key);
        if (locR.rows[m.key]) {
          var cod = locR.rows[m.key].cod;
          delete locR.rows[m.key];
          saveRowsTo(locR.file, locR.rows);
          broadcast({ type: 'remove', key: m.key }, clientId);
          console.log('[-] Eliminato: ' + cod);
        }

      } else if (m.type === 'clear') {
        saveRows({});
        broadcast({ type: 'clear' }, clientId);
        console.log('[!] Database svuotato da ' + clientId);

      } else if (m.type === 'presence') {
        presence[m.id] = { name: m.name, role: m.role, ts: Date.now() };
        broadcast({ type: 'presence_all', presence: presence }, null);

      } else if (m.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }

    } catch(e) {
      console.error('Errore messaggio:', e.message);
    }
  });

  ws.on('close', function() {
    delete clients[clientId];
    console.log('[' + new Date().toLocaleTimeString('it-IT') + '] Disconnesso: ' + clientId + ' (' + Object.keys(clients).length + ' rimasti)');
  });

  ws.on('error', function(e) {
    console.error('WS error:', e.message);
  });
});

function broadcast(msg, excludeClientId) {
  var data = JSON.stringify(msg);
  var k;
  for (k in clients) {
    if (k !== excludeClientId && clients[k].readyState === WebSocket.OPEN) {
      try { clients[k].send(data); } catch(e) {}
    }
  }
}

// ── PULIZIA PRESENZA (ogni 60 sec) ────────────────────
setInterval(function() {
  var now = Date.now();
  var changed = false;
  var id;
  for (id in presence) {
    if (now - presence[id].ts > 120000) { // 2 minuti senza ping → offline
      delete presence[id];
      changed = true;
    }
  }
  if (changed) broadcast({ type: 'presence_all', presence: presence }, null);
}, 60000);

// ── AVVIO SERVER ───────────────────────────────────────
var PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', function() {
  console.log('\n════════════════════════════════════════');
  console.log('  REPARTO RESI — SERVER AVVIATO');
  console.log('════════════════════════════════════════');
  console.log('  Porta: ' + PORT);
  console.log('  Dati:  ' + DATA_DIR);
  console.log('\n  INDIRIZZI DI ACCESSO:');
  console.log('  → Questo PC:    http://localhost:' + PORT);

  // Mostra tutti gli IP della rete locale
  var interfaces = os.networkInterfaces();
  var iface, details, i;
  for (iface in interfaces) {
    for (i = 0; i < interfaces[iface].length; i++) {
      details = interfaces[iface][i];
      if (details.family === 'IPv4' && !details.internal) {
        console.log('  → Rete locale:  http://' + details.address + ':' + PORT);
      }
    }
  }

  console.log('\n  Condividi l\'indirizzo "Rete locale" con');
  console.log('  tutti i dispositivi collegati alla stessa rete.');
  console.log('\n  Premi CTRL+C per fermare il server.');
  console.log('════════════════════════════════════════\n');
});
