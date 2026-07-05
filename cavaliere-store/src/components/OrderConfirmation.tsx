"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { contact } from "@/content/site";

type SessionData = {
  payment_status: string;
  amount_total: number;
  currency: string;
  customer_email: string | null;
};

export default function OrderConfirmation() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Nessun ordine trovato.");
      return;
    }
    fetch(
      `/.netlify/functions/get-checkout-session?session_id=${encodeURIComponent(sessionId)}`
    )
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e.message || "Errore nel recupero dell'ordine."));
  }, [sessionId]);

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-[var(--color-fg-muted)]">Verifica del pagamento…</p>;
  }

  const amount = (data.amount_total / 100).toFixed(2).replace(".", ",");

  return (
    <div className="space-y-4">
      <p className="text-sm text-white">
        Pagamento {data.payment_status === "paid" ? "confermato" : data.payment_status}{" "}
        — {amount}€
      </p>
      {data.customer_email && (
        <p className="text-sm text-[var(--color-fg-muted)]">
          Riceverai la conferma d&apos;ordine da Stripe a {data.customer_email}.
        </p>
      )}
      <p className="text-sm text-[var(--color-fg-muted)]">
        Ultimo passo: mandaci su Instagram le immagini di riferimento, il logo
        e ogni dettaglio per la personalizzazione, citando questo ordine.
      </p>
      <a
        href={contact.instagramDm}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105"
      >
        Invia i dettagli su Instagram
      </a>
    </div>
  );
}
