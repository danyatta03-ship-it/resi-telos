import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import { contact } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Informativa sulla privacy di Cavaliere.store.",
};

export default function PrivacyPolicyPage() {
  return (
    <PageShell title="Privacy Policy">
      <p>
        Questa informativa descrive come Cavaliere.store raccoglie e
        utilizza i dati personali forniti dagli utenti tramite il sito, il
        modulo di contatto e il processo di personalizzazione/ordine.
      </p>
      <p>
        <strong className="text-white">Dati raccolti:</strong> nome, email,
        telefono, testo/immagini/loghi caricati per la personalizzazione,
        indirizzo di spedizione e dati di pagamento (gestiti direttamente da
        Stripe, che non condivide i dati completi della carta con
        Cavaliere.store).
      </p>
      <p>
        <strong className="text-white">Finalità:</strong> evasione degli
        ordini, comunicazioni relative alla personalizzazione richiesta,
        assistenza clienti.
      </p>
      <p>
        <strong className="text-white">Conservazione:</strong> i dati sono
        conservati per il tempo necessario a evadere l&apos;ordine e per gli
        obblighi fiscali previsti dalla legge italiana.
      </p>
      <p>
        Per esercitare i diritti di accesso, rettifica o cancellazione dei
        dati, scrivi a{" "}
        <a href={`mailto:${contact.email}`} className="text-white underline">
          {contact.email}
        </a>
        .
      </p>
      <p className="text-xs text-[var(--color-fg-muted)]">
        Questo testo è un modello informativo: prima della pubblicazione
        online si consiglia una revisione da parte di un consulente legale
        per garantirne la piena conformità al GDPR.
      </p>
    </PageShell>
  );
}
