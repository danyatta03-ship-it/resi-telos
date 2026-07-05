import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import { contact } from "@/content/site";

export const metadata: Metadata = {
  title: "Richiesta inviata",
  robots: { index: false, follow: false },
};

export default function ConfiguratoreGraziePage() {
  return (
    <PageShell title="Richiesta inviata, grazie!">
      <p>
        Abbiamo ricevuto la tua richiesta con tutti i dettagli e i file
        allegati. Ti ricontatteremo il prima possibile per confermare il
        prezzo finale, i tempi di realizzazione e i dettagli della
        personalizzazione.
      </p>
      <p>
        Per accelerare i tempi, puoi anche scriverci direttamente su
        Instagram citando la richiesta appena inviata.
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
