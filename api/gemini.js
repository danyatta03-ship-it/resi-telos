// Proxy Vercel Serverless Function per Gemini/OpenAI-compat.
// Le chiavi risiedono SOLO in variabili d'ambiente Vercel (GEMINI_KEYS, GEMINI_MODELS)
// e non sono mai visibili al browser. Il client chiama /api/gemini con lo stesso body
// che userebbe con https://generativelanguage.googleapis.com/v1beta/openai/chat/completions;
// il proxy prova tutte le chiavi × modelli con fallback su 429 (quota) e restituisce la
// risposta grezza dell'endpoint OpenAI-compat.

const UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

function setCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}
function readEnvList(name, fallback){
  const raw = process.env[name] || fallback || '';
  return raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const KEYS = readEnvList('GEMINI_KEYS', process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '');
  const MODELS = readEnvList('GEMINI_MODELS', 'gemini-2.5-flash-lite,gemini-2.0-flash');

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify({ ok: KEYS.length > 0, keys: KEYS.length, models: MODELS }));
    return;
  }

  if (req.method !== 'POST') { res.status(405).end('Method Not Allowed'); return; }

  if (!KEYS.length) {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify({ error: { code: 503, message: 'AI proxy non configurato: definire GEMINI_KEYS (o GEMINI_API_KEY) in Vercel' } }));
    return;
  }

  // Vercel automaticamente fa il parsing del body JSON, ma per sicurezza gestisco entrambi i casi
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { res.status(400).end('invalid json'); return; } }
  if (!body || typeof body !== 'object') body = {};

  const messages = body.messages;
  if (!Array.isArray(messages) || !messages.length) {
    res.setHeader('Content-Type', 'application/json');
    res.status(400).end(JSON.stringify({ error: { message: 'messages mancanti' } }));
    return;
  }
  const temperature = body.temperature != null ? body.temperature : 0.3;
  const requestedModel = body.model;
  const models = requestedModel
    ? [requestedModel, ...MODELS.filter(m => m !== requestedModel)]
    : MODELS.slice();

  let lastErr = 'nessun tentativo', quotaHit = false;

  for (const model of models) {
    for (const key of KEYS) {
      try {
        const r = await fetch(UPSTREAM, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model, temperature, messages })
        });
        const j = await r.json().catch(() => null);
        if (!j) { lastErr = 'risposta non-JSON'; continue; }
        const errObj = j.error || (Array.isArray(j) && j[0] && j[0].error);
        if (errObj) {
          lastErr = errObj.message || 'errore AI';
          const code = errObj.code || r.status;
          if (code === 429 || /quota|rate.?limit/i.test(lastErr)) { quotaHit = true; continue; }
          continue;
        }
        const payload = Array.isArray(j) ? j[0] : j;
        const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
        if (content) {
          res.setHeader('Content-Type', 'application/json');
          res.status(200).end(JSON.stringify(payload));
          return;
        }
        lastErr = 'risposta vuota';
      } catch (e) {
        lastErr = (e && e.message) || 'errore rete';
      }
    }
  }

  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify({ error: { message: quotaHit ? 'Limite giornaliero AI gratuito esaurito su tutte le chiavi' : lastErr } }));
};
