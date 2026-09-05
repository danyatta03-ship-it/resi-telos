// Invio notifiche: in-app (RTDB) + push (FCM).
//
// L'invio e' server-side per due ragioni: serve la chiave del progetto per
// parlare con FCM, e un client non deve poter decidere a chi recapitare una
// notifica. Qui il destinatario NON viene dal chiamante: si ricava da
// portal_access, cioe' da chi ha effettivamente diritto di vedere quel reso.

const { getAdmin, corsHeaders, json, requireRole } = require('./_portal-admin');

exports.handler = async (event) => {
  const reqOrigin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const H = corsHeaders(reqOrigin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo non consentito' }, H);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Corpo non valido.' }, H);
  }

  let fb;
  try {
    fb = getAdmin();
  } catch (e) {
    return json(503, { error: e.message }, H);
  }

  let caller;
  try {
    // Qualunque ruolo autenticato puo' chiedere di notificare, ma solo sui
    // resi che gia' vede: il controllo e' subito sotto.
    caller = await requireRole(event, ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE', 'CORRIERE']);
  } catch (err) {
    return json(err.statusCode || 401, { error: err.message }, H);
  }

  const returnKey = String(body.returnKey || '').trim();
  const title = String(body.title || '').trim().slice(0, 200);
  const text = String(body.body || '').trim().slice(0, 1000);

  if (!returnKey || !title) return json(400, { error: 'returnKey e title sono obbligatori.' }, H);

  const db = fb.database();

  // Il chiamante deve avere accesso al reso. Senza questo controllo, un
  // cliente potrebbe spammare notifiche su pratiche altrui indovinando le chiavi.
  if (caller.role !== 'ADMIN' && caller.role !== 'TELOS') {
    const allowed = await db.ref('portal_access/' + caller.uid + '/' + returnKey).once('value');
    if (allowed.val() !== true) {
      return json(403, { error: 'Non hai accesso a questa pratica.' }, H);
    }
  }

  // Destinatari: chi ha accesso al reso, piu' lo staff interno.
  const recipients = await resolveRecipients(db, returnKey, body.excludeUid || caller.uid);

  if (!recipients.length) return json(200, { ok: true, delivered: 0, message: 'Nessun destinatario.' }, H);

  const ts = Date.now();
  const inAppUpdates = {};
  for (const uid of recipients) {
    const id = 'n' + ts.toString(36) + Math.random().toString(36).slice(2, 8);
    inAppUpdates[uid + '/' + id] = {
      ts,
      title,
      body: text,
      returnKey,
      read: false
    };
  }
  await db.ref('portal_notifications').update(inAppUpdates);

  const pushed = await sendPush(fb, db, recipients, { title, body: text, returnKey });

  return json(200, { ok: true, delivered: recipients.length, pushed }, H);
};

async function resolveRecipients(db, returnKey, excludeUid) {
  const [usersSnap, accessSnap] = await Promise.all([
    db.ref('portal_users').once('value'),
    db.ref('portal_access').once('value')
  ]);
  const users = usersSnap.val() || {};
  const access = accessSnap.val() || {};

  const out = [];
  for (const uid in users) {
    if (uid === excludeUid) continue;
    const u = users[uid];
    if (!u || u.active === false || !u.role) continue;

    // Lo staff riceve tutto; gli esterni solo se il reso e' nel loro perimetro.
    const isStaff = u.role === 'ADMIN' || u.role === 'TELOS';
    const hasAccess = access[uid] && access[uid][returnKey] === true;
    if (isStaff || hasAccess) out.push(uid);
  }
  return out;
}

async function sendPush(fb, db, uids, payload) {
  let messaging;
  try {
    messaging = fb.messaging();
  } catch (e) {
    return 0; // FCM non disponibile sul progetto: le notifiche in-app bastano
  }

  const tokensByUid = {};
  const allTokens = [];
  await Promise.all(uids.map(async (uid) => {
    try {
      const snap = await db.ref('portal_users/' + uid + '/fcmTokens').once('value');
      const val = snap.val() || {};
      const list = Object.keys(val);
      if (list.length) {
        tokensByUid[uid] = list;
        allTokens.push(...list);
      }
    } catch (e) { /* utente senza token: riceve solo in-app */ }
  }));

  if (!allTokens.length) return 0;

  let sent = 0;
  // FCM accetta al massimo 500 token per chiamata.
  for (let i = 0; i < allTokens.length; i += 450) {
    const batch = allTokens.slice(i, i + 450);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: payload.title, body: payload.body },
        data: { returnKey: payload.returnKey || '' },
        webpush: {
          fcmOptions: { link: '/portal/index.html#/resi/' + encodeURIComponent(payload.returnKey || '') }
        }
      });
      sent += res.successCount;
      // Token morti (app disinstallata, cache pulita): vanno rimossi o la
      // lista cresce all'infinito e ogni invio spreca chiamate.
      if (res.responses) {
        const dead = [];
        res.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = r.error && r.error.code;
            if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
              dead.push(batch[idx]);
            }
          }
        });
        if (dead.length) await pruneTokens(db, tokensByUid, dead);
      }
    } catch (e) {
      // Un batch fallito non deve compromettere gli altri.
    }
  }
  return sent;
}

async function pruneTokens(db, tokensByUid, deadTokens) {
  const dead = new Set(deadTokens);
  const updates = {};
  for (const uid in tokensByUid) {
    for (const token of tokensByUid[uid]) {
      if (dead.has(token)) updates['portal_users/' + uid + '/fcmTokens/' + token] = null;
    }
  }
  if (Object.keys(updates).length) {
    try { await db.ref().update(updates); } catch (e) { /* non critico */ }
  }
}
