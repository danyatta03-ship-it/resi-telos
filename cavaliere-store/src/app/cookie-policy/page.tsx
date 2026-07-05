import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Informativa sui cookie utilizzati da Cavaliere.store.",
};

export default function CookiePolicyPage() {
  return (
    <PageShell title="Cookie Policy">
      <p>
        Cavaliere.store utilizza esclusivamente cookie tecnici necessari al
        funzionamento del sito (es. preferenze di visualizzazione) e, in
        fase di checkout, i cookie richiesti da Stripe per l&apos;elaborazione
        sicura dei pagamenti.
      </p>
      <p>
        <strong className="text-white">Cookie tecnici:</strong> necessari al
        corretto funzionamento del sito, non richiedono consenso.
      </p>
      <p>
        <strong className="text-white">Cookie di terze parti (Stripe):</strong>{" "}
        utilizzati esclusivamente durante il processo di pagamento per
        prevenire frodi e garantire transazioni sicure.
      </p>
      <p>
        Puoi gestire o disabilitare i cookie in qualsiasi momento dalle
        impostazioni del tuo browser.
      </p>
    </PageShell>
  );
}
