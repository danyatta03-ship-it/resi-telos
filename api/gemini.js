// Proxy Vercel Serverless Function per Gemini (OpenAI-compat endpoint).
// Ultra-difensivo: cattura ogni errore e risponde sempre JSON, mai crash.

const UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

function readEnvList(name, fallback){
  try {
    var raw = (process.env && process.env[name]) || fallback || '';
    return String(raw).split(/[,\s]+/).map(function(s){return s.trim();}).filter(Boolean);
  } catch(e) { return fallback ? [fallback] : []; }
}

module.exports = async function handler(req, res){
  try {
    // CORS + no-cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    var method = (req.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') { res.status(204).end(''); return; }

    var KEYS = readEnvList('GEMINI_KEYS', (process.env && (process.env.GEMINI_API_KEY || process.env.GEMINI_KEY)) || '');
    var MODELS = readEnvList('GEMINI_MODELS', 'gemini-2.5-flash-lite,gemini-2.0-flash');

    if (method === 'GET') {
      res.status(200).end(JSON.stringify({ ok: KEYS.length > 0, keys: KEYS.length, models: MODELS, runtime: process.version }));
      return;
    }

    if (method !== 'POST') { res.status(405).end(JSON.stringify({ error: { message: 'Method Not Allowed' } })); return; }

    if (!KEYS.length) {
      res.status(200).end(JSON.stringify({ error: { code: 503, message: 'AI proxy non configurato: manca GEMINI_KEYS o GEMINI_API_KEY nelle env vars Vercel' } }));
      return;
    }

    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(_) { body = null; } }
    if (!body || typeof body !== 'object') body = {};

    var messages = body.messages;
    if (!Array.isArray(messages) || !messages.length) {
      res.status(200).end(JSON.stringify({ error: { message: 'messages mancanti nel body' } }));
      return;
    }

    var temperature = (body.temperature != null) ? body.temperature : 0.3;
    var requestedModel = body.model;
    var models = requestedModel ? [requestedModel].concat(MODELS.filter(function(m){return m!==requestedModel;})) : MODELS.slice();

    var lastErr = 'nessun tentativo', quotaHit = false;

    for (var i = 0; i < models.length; i++) {
      for (var k = 0; k < KEYS.length; k++) {
        try {
          var r = await fetch(UPSTREAM, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEYS[k] },
            body: JSON.stringify({ model: models[i], temperature: temperature, messages: messages })
          });
          var j = null;
          try { j = await r.json(); } catch(_) { j = null; }
          if (!j) { lastErr = 'risposta non-JSON (HTTP '+r.status+')'; continue; }
          var errObj = j.error || (Array.isArray(j) && j[0] && j[0].error);
          if (errObj) {
            lastErr = errObj.message || 'errore AI';
            var code = errObj.code || r.status;
            if (code === 429 || /quota|rate.?limit/i.test(String(lastErr))) { quotaHit = true; }
            continue;
          }
          var payload = Array.isArray(j) ? j[0] : j;
          var content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
          if (content) { res.status(200).end(JSON.stringify(payload)); return; }
          lastErr = 'risposta vuota';
        } catch(e) {
          lastErr = (e && e.message) || 'errore rete';
        }
      }
    }

    res.status(200).end(JSON.stringify({ error: { message: quotaHit ? 'Quota giornaliera esaurita su tutte le chiavi' : lastErr } }));
  } catch(fatal) {
    // Ultima linea di difesa: se anche il framework fallisce, non far crashare la funzione
    try {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).end(JSON.stringify({ error: { message: 'proxy error: ' + ((fatal && fatal.message) || String(fatal)) } }));
    } catch(_) {}
  }
};
