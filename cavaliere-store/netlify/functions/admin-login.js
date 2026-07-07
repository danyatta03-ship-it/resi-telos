const { sign, SESSION_COOKIE } = require("./_auth");

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = process.env.ADMIN_SESSION_SECRET;
  const password = process.env.ADMIN_PASSWORD;
  if (!secret || !password) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Pannello admin non configurato sul server." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Richiesta non valida." }) };
  }

  if (body.password !== password) {
    return { statusCode: 401, body: JSON.stringify({ error: "Password errata." }) };
  }

  const token = sign({ exp: Date.now() + SEVEN_DAYS_MS }, secret);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SEVEN_DAYS_MS / 1000}`,
    },
    body: JSON.stringify({ ok: true }),
  };
};
