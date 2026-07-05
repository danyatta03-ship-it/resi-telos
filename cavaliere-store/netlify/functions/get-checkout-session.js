const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Stripe non configurato sul server." }),
    };
  }

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return { statusCode: 400, body: JSON.stringify({ error: "session_id mancante o non valido." }) };
  }

  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      statusCode: 200,
      body: JSON.stringify({
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: session.customer_details ? session.customer_details.email : null,
        custom_fields: session.custom_fields,
      }),
    };
  } catch (err) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Sessione non trovata." }),
    };
  }
};
