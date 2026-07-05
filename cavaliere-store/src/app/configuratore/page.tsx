import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import { pricing, contact } from "@/content/site";

export const metadata: Metadata = {
  title: "Crea il tuo cappellino",
  description:
    "Configura il tuo cappellino su misura: colore, modello, taglia, ricamo o stampa personalizzata.",
};

export default function ConfiguratorePage() {
  return (
    <PageShell
      title="Crea il tuo cappellino"
      subtitle={`A partire da ${pricing.basePrice}€ — realizzato completamente a mano`}
    >
      <p>
        Il configuratore completo (scelta colore, modello, taglia, quantità,
        upload di loghi e bozze, ricamo/stampa/patch e checkout Stripe) è in
        fase di sviluppo e sarà collegato a questa pagina nella prossima fase
        del progetto.
      </p>
      <p>
        Nel frattempo, per richiedere un cappellino personalizzato scrivici
        direttamente: raccontaci colore, modello, testo da ricamare o
        stampare e allega le immagini di riferimento.
      </p>
      <a
        href={contact.instagramDm}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105"
      >
        Scrivici su Instagram
      </a>
    </PageShell>
  );
}
