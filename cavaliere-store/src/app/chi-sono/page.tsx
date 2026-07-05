import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Chi sono",
  description:
    "La storia di Cavaliere.store: artigianalità, lavorazione a mano e qualità dei materiali.",
};

export default function ChiSonoPage() {
  return (
    <PageShell title="Chi sono" subtitle="La storia dietro Cavaliere.store">
      <section>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl text-white">
          Storia
        </h2>
        <p>
          Cavaliere.store nasce dalla passione per il ricamo e la
          personalizzazione fatta a mano. Ogni cappellino racconta una
          storia diversa: quella di chi lo ha richiesto e quella di chi lo
          realizza, punto dopo punto.
        </p>
      </section>
      <section>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl text-white">
          Brand
        </h2>
        <p>
          Uno stile streetwear e urban, ispirato all&apos;essenzialità dei
          grandi marchi ma con un&apos;anima artigianale: nessun pezzo è
          uguale all&apos;altro.
        </p>
      </section>
      <section>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl text-white">
          Lavorazione
        </h2>
        <p>
          Ricamo, stampa serigrafica e patch applicate a mano su cappellini
          selezionati. Ogni fase, dalla digitalizzazione del logo alla
          rifinitura finale, viene curata internamente.
        </p>
      </section>
      <section>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl text-white">
          Qualità
        </h2>
        <p>
          Materiali selezionati, controllo qualità su ogni pezzo prima della
          spedizione e attenzione ai dettagli in ogni fase della
          produzione.
        </p>
      </section>
    </PageShell>
  );
}
