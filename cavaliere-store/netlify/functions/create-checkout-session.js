const Stripe = require("stripe");

const BASE_PRICE_CENTS = 5500; // 55,00 €
const MAX_QUANTITY = 10;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Stripe non configurato sul server." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Corpo richiesta non valido." }) };
  }

  const quantity = Math.min(
    Math.max(parseInt(payload.quantity, 10) || 1, 1),
    MAX_QUANTITY
  );

  const siteUrl = process.env.URL || "https://cavaliere.store";
  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: BASE_PRICE_CENTS,
            product_data: {
              name: "Cappellino Custom — Cavaliere.store",
              description: "Cappellino realizzato a mano su misura.",
            },
          },
          quantity,
          adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_QUANTITY },
        },
      ],
      custom_fields: [
        {
          key: "testo_ricamo",
          label: { type: "custom", custom: "Testo da ricamare/stampare (opzionale)" },
          type: "text",
          optional: true,
        },
        {
          key: "note",
          label: { type: "custom", custom: "Note per la personalizzazione (opzionale)" },
          type: "text",
          optional: true,
        },
      ],
      success_url: `${siteUrl}/configuratore/successo?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/configuratore?canceled=1`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Errore nella creazione del pagamento." }),
    };
  }
};
