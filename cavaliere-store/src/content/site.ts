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
    id: "kassimi",
    title: "CAVALIERE.STORE X KASSIMI",
    description: "Ricamo custom in strass oro e rosa su base nera effetto vissuto.",
    image: "/lavori/kassimi.jpg",
    accent: "#caa24a",
  },
  {
    id: "yuneslagrintaa",
    title: "CAVALIERE.STORE X YUNESLAGRINTAA",
    description: "Logo NY in strass bianco e azzurro su cappellino nero distressed.",
    image: "/lavori/yuneslagrintaa.jpg",
    accent: "#40c4ff",
  },
  {
    id: "ny-cross",
    title: "NY Cross Custom",
    description: "Logo NY in strass con croci decorative dipinte a mano.",
    image: "/lavori/ny-cross.jpg",
    accent: "#e04b3f",
  },
  {
    id: "as-verde",
    title: "A's Velluto Verde",
    description: "Monogramma in velluto ricamato con strass, base crema.",
    image: "/lavori/as-verde.jpg",
    accent: "#37b06c",
  },
];

export const pricing = {
  basePrice: 55,
  currency: "EUR",
};

export const configuratorOptions = {
  colors: ["Nero", "Bianco", "Beige", "Verde militare", "Blu navy"],
  models: ["Snapback", "Dad Hat", "Trucker", "Flat Brim"],
  sizes: ["Regolabile (consigliata)", "S/M", "L/XL"],
  workTypes: ["Ricamo", "Stampa", "Patch", "Altro"],
};

export const contact = {
  email: "info@cavaliere.store",
  instagram: "https://instagram.com/cavalieree.11",
  // Apre direttamente una chat nei DM Instagram
  instagramDm: "https://ig.me/m/cavalieree.11",
  tiktok: "https://tiktok.com/@cavalieree11",
  // Sostituisci con l'indirizzo reale per mostrare la mappa corretta in Contatti
  mapQuery: "",
};
