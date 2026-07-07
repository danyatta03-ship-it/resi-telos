const { SESSION_COOKIE } = require("./_auth");

exports.handler = async () => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
  },
  body: JSON.stringify({ ok: true }),
});
