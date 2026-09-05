// Gestione utenti del portale: creazione, aggiornamento, revoca.
//
// E' l'unico punto in cui vengono assegnati i custom claim. Solo un ADMIN
// autenticato puo' chiamarla, e il controllo avviene qui: il client non ha
// modo di aggirarlo perche' il claim viene letto da un token firmato Google.
//
// BOOTSTRAP: il primo amministratore non puo' essere creato da un
// amministratore (non ne esiste ancora nessuno). Per quel caso soltanto si usa
// PORTAL_BOOTSTRAP_SECRET: un segreto in env, valido solo finche' non esiste
// alcun utente ADMIN. Dopo il primo admin, la via di bootstrap si chiude da sola.

const { getAdmin, corsHeaders, json, requireRole, safeKey } = require('./_portal-admin');

const VALID_ROLES = ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE', 'CORRIERE'];

exports.handler = async (event) => {
  const reqOrigin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const H = corsHeaders(reqOrigin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo non consentito' }, H);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Corpo della richiesta non valido.' }, H);
  }

  let fb;
  try {
    fb = getAdmin();
  } catch (e) {
    return json(503, { error: e.message }, H);
  }

  const action = String(body.action || '').toLowerCase();

  try {
    if (action === 'bootstrap') return await bootstrap(fb, body, H);

    const caller = await requireRole(event, ['ADMIN']);

    if (action === 'create') return await createUser(fb, body, caller, H);
    if (action === 'update') return await updateUser(fb, body, caller, H);
    if (action === 'revoke') return await revokeUser(fb, body, caller, H);

    return json(400, { error: 'Azione sconosciuta: ' + action }, H);
  } catch (err) {
    const code = err.statusCode || 500;
    return json(code, { error: err.message || 'Errore imprevisto.' }, H);
  }
};

function validate(body, { requireEmail }) {
  const errors = [];
  const email = String(body.email || '').trim().toLowerCase();
  if (requireEmail) {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Email non valida.');
  }
  const role = String(body.role || '').toUpperCase();
  if (VALID_ROLES.indexOf(role) < 0) errors.push('Ruolo non valido.');
  const displayName = String(body.displayName || '').trim();
  if (!displayName) errors.push('Nome obbligatorio.');

  // Un utente esterno senza perimetro vedrebbe zero pratiche: e' quasi
  // sempre una dimenticanza, quindi la blocchiamo.
  const scope = {};
  if (role !== 'ADMIN' && role !== 'TELOS') {
    const raw = body.scope && typeof body.scope === 'object' ? Object.keys(body.scope) : [];
    const keys = raw.filter((k) => body.scope[k] === true).map(safeKey).filter(Boolean);
    if (!keys.length) errors.push('Per questo ruolo serve almeno un valore nel perimetro di visibilita\'.');
    if (keys.length > 500) errors.push('Troppi valori nel perimetro (massimo 500).');
    for (const k of keys) scope[k] = true;
  }

  return {
    ok: errors.length === 0,
    errors,
    email,
    role,
    displayName,
    scope,
    company: String(body.company || '').trim().slice(0, 200),
    phone: String(body.phone || '').trim().slice(0, 40),
    active: body.active !== false
  };
}

async function writeProfile(fb, uid, data) {
  const profile = {
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    company: data.company,
    phone: data.phone,
    active: data.active,
    scope: data.scope
  };
  const ref = fb.database().ref('portal_users/' + uid);
  const existing = await ref.child('createdAt').once('value');
  if (!existing.exists()) profile.createdAt = Date.now();
  await ref.update(profile);
}

async function audit(fb, actorUid, actorRole, action, target, detail) {
  try {
    await fb.database().ref('portal_audit').push({
      ts: Date.now(),
      uid: actorUid,
      role: actorRole,
      action,
      target: String(target || '').slice(0, 300),
      detail: String(detail || '').slice(0, 2000)
    });
  } catch (e) {
    // L'audit non deve far fallire l'operazione che sta tracciando.
  }
}

async function createUser(fb, body, caller, H) {
  const v = validate(body, { requireEmail: true });
  if (!v.ok) return json(400, { error: v.errors.join(' ') }, H);

  let user;
  try {
    user = await fb.auth().getUserByEmail(v.email);
  } catch (e) {
    user = null;
  }

  if (!user) {
    // Password casuale mai comunicata: l'utente la imposta dal link di reset.
    // Cosi' nessuna password transita da questa function.
    const temp = 'Tp' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!9';
    user = await fb.auth().createUser({
      email: v.email,
      password: temp,
      displayName: v.displayName,
      emailVerified: false,
      disabled: !v.active
    });
  } else {
    await fb.auth().updateUser(user.uid, { displayName: v.displayName, disabled: !v.active });
  }

  await fb.auth().setCustomUserClaims(user.uid, { prole: v.role });
  await writeProfile(fb, user.uid, v);
  await audit(fb, caller.uid, caller.role, 'user_create', user.uid, v.email + ' → ' + v.role);

  let resetLink = null;
  try {
    resetLink = await fb.auth().generatePasswordResetLink(v.email);
  } catch (e) {
    // Senza dominio autorizzato in console Firebase la generazione fallisce:
    // l'utente e' comunque creato e puo' usare "Password dimenticata".
  }

  return json(200, {
    ok: true,
    uid: user.uid,
    resetLink,
    message: resetLink
      ? 'Utente creato. Invia il link di attivazione all\'indirizzo indicato.'
      : 'Utente creato. Chiedi all\'utente di usare "Password dimenticata" al primo accesso.'
  }, H);
}

async function updateUser(fb, body, caller, H) {
  const uid = String(body.uid || '').trim();
  if (!uid) return json(400, { error: 'UID mancante.' }, H);

  const v = validate(body, { requireEmail: false });
  if (!v.ok) return json(400, { error: v.errors.join(' ') }, H);

  // Un admin che si toglie il ruolo da solo si chiude fuori: se e' l'ultimo
  // rimasto, il portale non ha piu' nessuno che possa gestire gli utenti.
  if (uid === caller.uid && v.role !== 'ADMIN') {
    const admins = await countAdmins(fb);
    if (admins <= 1) {
      return json(400, { error: 'Sei l\'unico amministratore: assegna prima il ruolo ADMIN a un altro utente.' }, H);
    }
  }

  await fb.auth().updateUser(uid, { displayName: v.displayName, disabled: !v.active });
  await fb.auth().setCustomUserClaims(uid, { prole: v.role });

  const current = await fb.database().ref('portal_users/' + uid + '/email').once('value');
  v.email = v.email || current.val() || '';
  await writeProfile(fb, uid, v);

  // Il claim vive nel token: senza revoca l'utente terrebbe il vecchio ruolo
  // fino alla scadenza naturale (~1h).
  await fb.auth().revokeRefreshTokens(uid);
  await audit(fb, caller.uid, caller.role, 'user_update', uid, v.role + ' · ' + Object.keys(v.scope).length + ' scope');

  return json(200, { ok: true, uid, message: 'Utente aggiornato.' }, H);
}

async function revokeUser(fb, body, caller, H) {
  const uid = String(body.uid || '').trim();
  if (!uid) return json(400, { error: 'UID mancante.' }, H);
  if (uid === caller.uid) return json(400, { error: 'Non puoi revocare il tuo stesso accesso.' }, H);

  await fb.auth().updateUser(uid, { disabled: true });
  await fb.auth().setCustomUserClaims(uid, { prole: null });
  await fb.auth().revokeRefreshTokens(uid);
  await fb.database().ref('portal_users/' + uid).update({ active: false, role: '' });
  // Il perimetro va rimosso: se domani l'account viene riabilitato deve
  // ripartire senza visibilita' ereditata.
  await fb.database().ref('portal_access/' + uid).remove();
  await audit(fb, caller.uid, caller.role, 'user_revoke', uid, '');

  return json(200, { ok: true, message: 'Accesso revocato.' }, H);
}

async function countAdmins(fb) {
  const snap = await fb.database().ref('portal_users').orderByChild('role').equalTo('ADMIN').once('value');
  const val = snap.val() || {};
  return Object.keys(val).filter((uid) => val[uid] && val[uid].active !== false).length;
}

// Crea il PRIMO amministratore. Funziona solo se non ne esiste gia' uno.
async function bootstrap(fb, body, H) {
  const secret = process.env.PORTAL_BOOTSTRAP_SECRET || '';
  if (!secret) return json(403, { error: 'Bootstrap non abilitato.' }, H);
  if (String(body.secret || '') !== secret) return json(403, { error: 'Segreto non valido.' }, H);

  const admins = await countAdmins(fb);
  if (admins > 0) {
    return json(409, { error: 'Esiste gia\' un amministratore: usa il portale per creare gli altri utenti.' }, H);
  }

  const v = validate(Object.assign({}, body, { role: 'ADMIN' }), { requireEmail: true });
  if (!v.ok) return json(400, { error: v.errors.join(' ') }, H);

  let user;
  try {
    user = await fb.auth().getUserByEmail(v.email);
  } catch (e) {
    user = null;
  }
  if (!user) {
    const password = String(body.password || '');
    if (password.length < 10) {
      return json(400, { error: 'La password del primo amministratore deve avere almeno 10 caratteri.' }, H);
    }
    user = await fb.auth().createUser({
      email: v.email,
      password,
      displayName: v.displayName,
      emailVerified: true
    });
  }

  await fb.auth().setCustomUserClaims(user.uid, { prole: 'ADMIN' });
  await writeProfile(fb, user.uid, v);
  await audit(fb, user.uid, 'ADMIN', 'bootstrap_admin', user.uid, v.email);

  return json(200, {
    ok: true,
    uid: user.uid,
    message: 'Primo amministratore creato. Rimuovi PORTAL_BOOTSTRAP_SECRET dalle variabili d\'ambiente.'
  }, H);
}
