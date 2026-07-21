// Proxy Netlify Function per Gemini/OpenAI-compat.
// Le chiavi risiedono SOLO in variabili d'ambiente Netlify (GEMINI_KEYS, GEMINI_MODELS)
// e non sono mai visibili al browser. Il client chiama /api/gemini con lo stesso body
// che userebbe con https://generativelanguage.googleapis.com/v1beta/openai/chat/completions;
// il proxy prova tutte le chiavi × modelli con fallback su 429 (quota) e restituisce la
// risposta grezza dell'endpoint OpenAI-compat.

const UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
}

function readEnvList(name, fallback){
  const raw = process.env[name] || fallback || '';
  return raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
}

exports.handler = async (event) => {
  const H = corsHeaders();

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };

  const KEYS = readEnvList('GEMINI_KEYS', process.env.GEMINI_KEY || '');
  const MODELS = readEnvList('GEMINI_MODELS', 'gemini-2.5-flash-lite,gemini-2.0-flash');

  // Sonda: il client la usa a boot per capire se il proxy è configurato.
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: KEYS.length > 0, keys: KEYS.length, models: MODELS })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: H, body: 'Method Not Allowed' };
  }

  if (!KEYS.length) {
    return {
      statusCode: 200,
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { code: 503, message: 'AI proxy non configurato: definire GEMINI_KEYS in Netlify' } })
    };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: H, body: 'invalid json' }; }

  const messages = body.messages;
  if (!Array.isArray(messages) || !messages.length) {
    return { statusCode: 400, headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: { message: 'messages mancanti' } }) };
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
        // Google restituisce l'errore come oggetto {error:{...}} OPPURE come array [{error:{...}}]
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
          return {
            statusCode: 200,
            headers: { ...H, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          };
        }
        lastErr = 'risposta vuota';
      } catch (e) {
        lastErr = (e && e.message) || 'errore rete';
      }
    }
  }

  return {
    statusCode: 200,
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: { message: quotaHit ? 'Limite giornaliero AI gratuito esaurito su tutte le chiavi' : lastErr } })
  };
};
