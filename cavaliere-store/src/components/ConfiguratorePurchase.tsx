"use client";

import { useState } from "react";
import { pricing, contact } from "@/content/site";

export default function ConfiguratorePurchase() {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = (pricing.basePrice * quantity).toFixed(2).replace(".", ",");

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Impossibile avviare il pagamento.");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossibile avviare il pagamento. Riprova."
      );
      setLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-alt)] p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-fg-muted)]">Quantità</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Diminuisci quantità"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-9 w-9 rounded-full border border-[var(--color-line)] text-white hover:border-[var(--color-accent)]"
            >
              −
            </button>
            <span className="w-6 text-center text-white">{quantity}</span>
            <button
              type="button"
              aria-label="Aumenta quantità"
              onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              className="h-9 w-9 rounded-full border border-[var(--color-line)] text-white hover:border-[var(--color-accent)]"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--color-line)] pt-4">
          <span className="text-sm text-[var(--color-fg-muted)]">Totale</span>
          <span className="text-xl font-semibold text-white">{total}€</span>
        </div>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading}
          className="mt-6 w-full rounded-full bg-[var(--color-accent)] px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Reindirizzamento a Stripe…" : "Procedi al pagamento"}
        </button>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
          Pagamento sicuro tramite Stripe — carte, Apple Pay e Google Pay.
        </p>
      </div>

      <p>
        Preferisci parlarne prima?{" "}
        <a
          href={contact.instagramDm}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white underline"
        >
          Scrivici su Instagram
        </a>
        .
      </p>
    </>
  );
}
