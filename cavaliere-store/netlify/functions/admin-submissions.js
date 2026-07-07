const { verify, getCookie, SESSION_COOKIE } = require("./_auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = getCookie(event, SESSION_COOKIE);
  const session = verify(token, secret);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ error: "Non autenticato." }) };
  }

  const apiToken = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!apiToken || !siteId) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Integrazione Netlify non configurata (NETLIFY_API_TOKEN / NETLIFY_SITE_ID mancanti).",
      }),
    };
  }

  try {
    const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!formsRes.ok) {
      throw new Error(`Impossibile leggere i moduli (${formsRes.status}).`);
    }
    const forms = await formsRes.json();
    const form = forms.find((f) => f.name === "configuratore");
    if (!form) {
      return { statusCode: 200, body: JSON.stringify({ submissions: [] }) };
    }

    const subsRes = await fetch(
      `https://api.netlify.com/api/v1/forms/${form.id}/submissions`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    if (!subsRes.ok) {
      throw new Error(`Impossibile leggere le richieste (${subsRes.status}).`);
    }
    const submissions = await subsRes.json();

    const simplified = submissions.map((s) => ({
      id: s.id,
      created_at: s.created_at,
      data: s.data,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissions: simplified }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
