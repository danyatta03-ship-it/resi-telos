// Proxy Netlify Function per Google Gemini (compat OpenAI-style)
// Le chiavi risiedono SOLO in variabili d'ambiente (GEMINI_KEYS = lista csv).
// Il client chiama /api/gemini con { messages, model?, temperature? } e riceve
// la risposta grezza dell'endpoint upstream. Fallback automatico su altre
// chiavi/modelli in caso di 429 (quota).
'use strict';

var UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control':                'no-store'
  };
}
function readList(name, fallback) {
  var raw = process.env[name] || fallback || '';
  return raw.split(/[,\s]+/).map(function(s){ return s.trim(); }).filter(Boolean);
}

exports.handler = async function(event){
  var H = cors();
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:H, body:'' };

  var KEYS = readList('GEMINI_KEYS', process.env.GEMINI_KEY || '');
  var MODELS = readList('GEMINI_MODELS', 'gemini-2.5-flash-lite,gemini-2.0-flash');

  // GET: sonda di config (usata dal client a boot)
  if(event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: Object.assign({}, H, { 'Content-Type':'application/json' }),
      body: JSON.stringify({ ok: KEYS.length>0, keys: KEYS.length, models: MODELS })
    };
  }
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:H, body:'Method Not Allowed' };

  if(!KEYS.length) {
    return {
      statusCode: 200,
      headers: Object.assign({}, H, { 'Content-Type':'application/json' }),
      body: JSON.stringify({ error:{ code:503, message:'AI proxy non configurato: definire GEMINI_KEYS in Netlify.' } })
    };
  }

  var body;
  try { body = JSON.parse(event.body || '{}'); }
  catch(e) { return { statusCode:400, headers:H, body:'invalid json' }; }

  var messages = body.messages;
  if(!Array.isArray(messages) || !messages.length) {
    return {
      statusCode: 400,
      headers: Object.assign({}, H, { 'Content-Type':'application/json' }),
      body: JSON.stringify({ error:{ message:'messages mancanti' } })
    };
  }
  var temperature = body.temperature != null ? body.temperature : 0.3;
  var requested = body.model;
  var models = requested ? [requested].concat(MODELS.filter(function(m){ return m !== requested; })) : MODELS.slice();

  var lastErr = 'nessun tentativo', quotaHit = false;

  for(var mi=0; mi<models.length; mi++){
    var model = models[mi];
    for(var ki=0; ki<KEYS.length; ki++){
      var key = KEYS[ki];
      try {
        var r = await fetch(UPSTREAM, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+key },
          body: JSON.stringify({ model:model, temperature:temperature, messages:messages })
        });
        var j = await r.json().catch(function(){ return null; });
        if(!j) { lastErr = 'risposta non-JSON'; continue; }
        var errObj = j.error || (Array.isArray(j) && j[0] && j[0].error);
        if(errObj) {
          lastErr = errObj.message || 'errore AI';
          var code = errObj.code || r.status;
          if(code === 429 || /quota|rate.?limit/i.test(lastErr)) { quotaHit = true; continue; }
          continue;
        }
        var payload = Array.isArray(j) ? j[0] : j;
        var content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
        if(content) {
          return {
            statusCode: 200,
            headers: Object.assign({}, H, { 'Content-Type':'application/json' }),
            body: JSON.stringify(payload)
          };
        }
        lastErr = 'risposta vuota';
      } catch(e) { lastErr = (e && e.message) || 'errore rete'; }
    }
  }

  return {
    statusCode: 200,
    headers: Object.assign({}, H, { 'Content-Type':'application/json' }),
    body: JSON.stringify({ error:{ message: quotaHit ? 'Limite giornaliero AI esaurito su tutte le chiavi' : lastErr } })
  };
};
