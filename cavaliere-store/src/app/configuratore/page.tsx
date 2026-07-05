import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import ConfiguratorePurchase from "@/components/ConfiguratorePurchase";
import { pricing } from "@/content/site";

export const metadata: Metadata = {
  title: "Crea il tuo cappellino",
  description:
    "Configura e acquista il tuo cappellino su misura: ricamo o stampa personalizzata, pagamento sicuro con Stripe.",
};

export default function ConfiguratorePage() {
  return (
    <PageShell
      title="Crea il tuo cappellino"
      subtitle={`${pricing.basePrice}€ a pezzo — realizzato completamente a mano`}
    >
      <p>
        Il configuratore visuale completo (colore, modello, taglia, upload di
        loghi e bozze) è in fase di sviluppo. Nel frattempo puoi già
        prenotare e pagare il tuo cappellino qui sotto: nel checkout Stripe
        potrai indicare il testo da ricamare/stampare e delle note, e dopo il
        pagamento ti chiederemo via Instagram le immagini di riferimento e i
        dettagli finali.
      </p>
      <ConfiguratorePurchase />
    </PageShell>
  );
}
