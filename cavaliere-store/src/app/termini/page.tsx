import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import { pricing, contact } from "@/content/site";

export const metadata: Metadata = {
  title: "Termini e Condizioni",
  description: "Termini e condizioni di vendita di Cavaliere.store.",
};

export default function TerminiPage() {
  return (
    <PageShell title="Termini e Condizioni">
      <p>
        Prezzo base del prodotto configurabile: {pricing.basePrice}{" "}
        {pricing.currency === "EUR" ? "€" : pricing.currency} (IVA inclusa
        dove applicabile). Eventuali supplementi per lavorazioni aggiuntive
        verranno mostrati chiaramente prima della conferma dell&apos;ordine.
      </p>
      <p>
        <strong className="text-white">Personalizzazione:</strong> essendo
        ogni prodotto realizzato su misura in base alle indicazioni fornite
        dal cliente (testo, immagini, loghi), il diritto di recesso non si
        applica una volta avviata la lavorazione, salvo diversamente
        indicato dalla legge applicabile.
      </p>
      <p>
        <strong className="text-white">Pagamenti:</strong> tutti i pagamenti
        sono elaborati in modo sicuro tramite Stripe. Cavaliere.store non
        memorizza i dati completi della carta di pagamento.
      </p>
      <p>
        <strong className="text-white">Spedizione:</strong> i tempi di
        realizzazione e spedizione variano in base alla complessità della
        lavorazione richiesta e verranno comunicati al cliente dopo la
        conferma dell&apos;ordine.
      </p>
      <p>
        Per qualsiasi domanda relativa a un ordine, contattaci a{" "}
        <a href={`mailto:${contact.email}`} className="text-white underline">
          {contact.email}
        </a>
        .
      </p>
    </PageShell>
  );
}
