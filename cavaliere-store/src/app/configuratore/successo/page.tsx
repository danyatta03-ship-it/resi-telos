import { Suspense } from "react";
import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import OrderConfirmation from "@/components/OrderConfirmation";

export const metadata: Metadata = {
  title: "Ordine confermato",
  robots: { index: false, follow: false },
};

export default function ConfiguratoreSuccessoPage() {
  return (
    <PageShell title="Grazie per il tuo ordine!">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--color-fg-muted)]">Verifica del pagamento…</p>
        }
      >
        <OrderConfirmation />
      </Suspense>
    </PageShell>
  );
}
