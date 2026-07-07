import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import ConfiguratoreForm from "@/components/ConfiguratoreForm";
import { pricing } from "@/content/site";

export const metadata: Metadata = {
  title: "Crea il tuo cappellino",
  description:
    "Configura il tuo cappellino su misura: colore, modello, taglia, ricamo o stampa personalizzata.",
};

export default function ConfiguratorePage() {
  return (
    <PageShell
      title="Crea il tuo cappellino"
      subtitle={`${pricing.basePrice}€ a pezzo — realizzato completamente a mano`}
    >
      <p>
        Compila il modulo con le tue scelte e i file di riferimento: appena
        invii la richiesta si apre Instagram con il riepilogo già copiato,
        pronto da incollare nel messaggio.
      </p>
      <ConfiguratoreForm />
    </PageShell>
  );
}
