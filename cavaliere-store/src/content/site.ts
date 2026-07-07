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
  // opzionale: se presente, la card mostra un visualizzatore 360° trascinabile
  // invece della singola immagine (foto scattate girando intorno al cappellino)
  images360?: string[];
};

export const works: WorkItem[] = [
  {
    id: "la-dodgers",
    title: "LA Dodgers Custom",
    description: "Logo LA in strass su base grigio tortora effetto vissuto. Trascina per vederlo a 360°.",
    image: "/lavori/la-front.jpg",
    accent: "#9aa0a6",
    images360: [
      "/lavori/la-front.jpg",
      "/lavori/la-right.jpg",
      "/lavori/la-back.jpg",
      "/lavori/la-left.jpg",
    ],
  },
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
