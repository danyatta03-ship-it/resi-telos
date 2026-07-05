// ─────────────────────────────────────────────────────────────
// CONTENUTI DEL SITO — CAVALIERE.STORE
// Modifica i testi, i prezzi e le immagini qui sotto.
// Non serve toccare nessun altro file per aggiornare la home.
// (Nella build finale questi contenuti saranno gestibili anche
// dal pannello amministratore, senza modificare codice.)
// ─────────────────────────────────────────────────────────────

export const brand = {
  name: "Cavaliere.store",
  tagline: "Cappelli fatti a mano, uno per uno.",
};

export const hero = {
  headline: "Crea il tuo cappellino unico.",
  subtitle: "Realizzato completamente a mano.",
  ctaLabel: "CREA IL TUO CAPPELLINO",
  ctaHref: "/configuratore",
};

export type WorkItem = {
  id: string;
  title: string;
  description: string;
  image: string; // percorso in /public — sostituibile con una foto reale
  accent: string; // colore d'accento per il placeholder grafico
};

export const works: WorkItem[] = [
  {
    id: "ricamo-oro",
    title: "Ricamo Oro Vintage",
    description: "Ricamo a filo pieno su tela premium, ispirazione old-school.",
    image: "/lavori/ricamo-oro.svg",
    accent: "#caa24a",
  },
  {
    id: "patch-urban",
    title: "Patch Urban Edition",
    description: "Patch in gomma 3D cucita a mano su visiera piatta.",
    image: "/lavori/patch-urban.svg",
    accent: "#e04b3f",
  },
  {
    id: "stampa-street",
    title: "Stampa Street Custom",
    description: "Serigrafia artigianale multistrato, colori acceso.",
    image: "/lavori/stampa-street.svg",
    accent: "#3f8ee0",
  },
  {
    id: "logo-brand",
    title: "Logo Brand su Misura",
    description: "Digitalizzazione e ricamo del tuo logo aziendale.",
    image: "/lavori/logo-brand.svg",
    accent: "#37b06c",
  },
  {
    id: "edizione-limitata",
    title: "Edizione Limitata",
    description: "Pezzo unico numerato, materiali selezionati a mano.",
    image: "/lavori/edizione-limitata.svg",
    accent: "#9b5de5",
  },
  {
    id: "cliente-nike-style",
    title: "Custom Cliente",
    description: "Progetto realizzato su richiesta per un cliente privato.",
    image: "/lavori/cliente-custom.svg",
    accent: "#f2a90c",
  },
];

export const pricing = {
  basePrice: 55,
  currency: "EUR",
};

export const contact = {
  email: "info@cavaliere.store",
  instagram: "https://instagram.com/cavaliere.store",
  tiktok: "https://tiktok.com/@cavaliere.store",
  // Sostituisci con il numero WhatsApp reale in formato internazionale senza "+" o spazi
  whatsapp: "https://wa.me/390000000000",
  // Sostituisci con l'indirizzo reale per mostrare la mappa corretta in Contatti
  mapQuery: "",
};
