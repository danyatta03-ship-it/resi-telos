// ═══════════════════════════════════════════════════════════════════════
//  TAXONOMIES — Resi Telos
//  Tutte le regole di business che descrivono il DOMINIO applicativo:
//    • RUOLI + PERMESSI     (ROLE_PERMS)
//    • FASI del ciclo       (FASI_ORDER, NEXT_FASE, PREV_FASE)
//    • STATI per fase       (STATI)
//    • CAUSALI di reso      (CAULIST)
//    • SOTTO-ANOMALIE       (CAU_SUBS, ANOMALIE_GEN + helper subsForCausale)
//
//  Questo file e' caricato SINCRONO in <head>, prima della SPA principale,
//  cosi' i simboli globali sono disponibili al primo <script> di index.html.
//  Modificare qui = modificare in tutta l'app. Nessuna duplicazione.
//
//  Riferimenti: docs/DATA-MODEL.md (sez. 2, 3) e docs/ARCHITECTURE.md (sez. 4).
// ═══════════════════════════════════════════════════════════════════════

// ── RUOLI + PERMESSI ────────────────────────────────────────────────────
// canEditFasi   = fasi su cui il ruolo puo' modificare CAMPI del record
// canAdvanceTo  = fasi a cui il ruolo puo' PORTARE un reso (avanzamento)
// canSendBack   = puo' rimandare un reso alla fase precedente
// canViewPhases = fasi VISIBILI in lista (fuori: record nascosti)
// canViewOwnOnly= se true, l'utente vede solo i record da lui inseriti
// canSeeTabs    = tab principali visibili ('*' = tutti)
//
// v34o: SCA (Scanner mobile) + RPC (Ricevimento PC che riceve gli scans)
// v36f: RIC vede TUTTI i record in reception (canViewOwnOnly:false) — cosi'
//   RIC/RPC/UFF collaborano sulla stessa coda invece di vedere ognuno "il suo".
//   UFF vede anche RICEVIMENTO (per prendere in carico record che RIC gli manda).
var ROLE_PERMS = {
  SCA: { canAdd:false, canDelete:false, canArchive:false, canEditFasi:[],               canViewAll:false, canViewPhases:['*'], canViewOwnOnly:true,  canBulk:false, canAdvanceTo:[],                    canSendBack:false, canSeeTabs:['pgIns'] },
  RPC: { canAdd:true,  canDelete:false, canArchive:false, canEditFasi:['RICEVIMENTO'],  canViewAll:false, canViewPhases:['*'], canViewOwnOnly:false, canBulk:false, canAdvanceTo:['UFFICIO RESI'],       canSendBack:false, canSeeTabs:['pgIns','pgList'] },
  RIC: { canAdd:true,  canDelete:false, canArchive:false, canEditFasi:['RICEVIMENTO'],  canViewAll:false, canViewPhases:['*'], canViewOwnOnly:false, canBulk:false, canAdvanceTo:['UFFICIO RESI'],       canSendBack:false, canSeeTabs:['pgIns','pgList'] },
  UFF: { canAdd:true,  canDelete:false, canArchive:true,  canEditFasi:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'], canViewAll:false, canViewPhases:['RICEVIMENTO','UFFICIO RESI'], canViewOwnOnly:false, canBulk:true,  canAdvanceTo:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'], canSendBack:true,  canSeeTabs:['*'] },
  MAG: { canAdd:true,  canDelete:false, canArchive:true,  canEditFasi:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO'],          canViewAll:false, canViewPhases:['MAGAZZINO'],    canViewOwnOnly:false, canBulk:true,  canAdvanceTo:['UFFICIO RESI','MAGAZZINO','FINALE'],               canSendBack:true,  canSeeTabs:['*'] },
  ADM: { canAdd:true,  canDelete:true,  canArchive:true,  canEditFasi:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'], canViewAll:true,  canViewPhases:['*'],            canViewOwnOnly:false, canBulk:true,  canAdvanceTo:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'], canSendBack:true,  canSeeTabs:['*'] }
};

// ── FASI del ciclo di vita ──────────────────────────────────────────────
var FASI_ORDER = ['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'];
var NEXT_FASE  = {'RICEVIMENTO':'UFFICIO RESI','UFFICIO RESI':'MAGAZZINO','MAGAZZINO':'FINALE'};
var PREV_FASE  = {'UFFICIO RESI':'RICEVIMENTO','MAGAZZINO':'UFFICIO RESI','FINALE':'MAGAZZINO'};

// ── STATI per fase (contenuto dei dropdown "stato") ─────────────────────
var STATI = {
  'RICEVIMENTO':['DA GESTIRE ⏳','OK PER UFFICIO','ANOMALIA RICEVIMENTO','STALLO RICEVIMENTO'],
  'UFFICIO RESI':[
    'DA GESTIRE ⏳',
    'OK PER UFFICIO',
    'RICHIESTA ATTESA APPROVAZIONE ⏳',
    'RICHIESTA ✅ - ACCUMULARE',
    'RICHIESTA ✅ - FARE RNC (FILIALE)',
    'RNC 🔓 - ACCUMULARE (SOLO DDT SENZA RIF AQ)',
    'RNC ✅ - FARE RICHIESTA (FILIALE)',
    'STALLO UFFICIO',
    'ANOMALIA UFFICIO'
  ],
  'MAGAZZINO':['CHIUDERE','PRESA LOGISTICA','ANOMALIA MAGAZZINO','STALLO MAGAZZINO'],
  'FINALE':[
    'NOTA CREDITO FORNITORE',
    'NON RENDIBILE - COSTI DI TRASPORTO',
    'NON RENDIBILE - FUORI TEMPISTICA',
    'NON RENDIBILE - IMPORTO INFERIORE',
    'NON RENDIBILE - IMPORTO INFERIORE E FUORI TEMPISTICA',
    'NON RENDIBILE - FUORI TEMPISTICA E COSTI DI TRASPORTO',
    'NON RENDIBILE - COSTI DI TRASPORTO E IMPORTO INFERIORE',
    'NON RENDIBILE - TUTTE LE CASISTICHE',
    'VENDUTO CLIENTE',
    'STOCK MAGAZZINO',
    'TRASFERITO FILIALE',
    'ROTTAMATO - FILIALE',
    'ROTTAMATO - CLIENTE',
    'REVISIONATO',
    'ADDEBITATO VETTORE PIEMME',
    'ADDEBITATO VETTORE CIPI',
    'SOSTITUZIONE GARANZIA - STOCK',
    'RIFIUTO FORNITORE - STOCK',
    'RIFIUTO FORNITORE - ROTTAMAZIONE & COMMERCIALE',
    'COMMERCIALE - ROTTAMATO',
    'COMMERCIALE - REN',
    'COMMERCIALE - SCONTO MERCE',
    'COMMERCIALE - BST'
  ]
};

// ── CAUSALI di reso (dropdown "causale") ────────────────────────────────
var CAULIST = [
  '"NON CONFORME" - ERRATO ORDINE',
  '"RESO/RESO MERCE" - ERRATO ORDINE',
  '"NO CAUSALE" - ERRATO ORDINE',
  'ERRATA SPEDIZIONE',
  'ORDINE DISDETTO CLIENTE',
  'ORDINE MULTIPLO',
  'ERRATA COMPARAZIONE CATALOGO',
  'DIVERSO DA OE/INCOMPATIBILE',
  'ERRATO CONFEZIONAMENTO',
  "INCOMPLETO - MANCA UN PZ ALL'INTERNO",
  'CARCASSA',
  'GARANZIA',
  'GARANZIA MANODOPERA',
  'GARANZIA DANNI E MANODOPERA',
  'DANNEGGIATO - SEGNALATO AL BANCO',
  'PERVENUTO MONTATO/SPORCO AL CLIENTE DA RESO',
  'PERVENUTO MONTATO/SPORCO AL CLIENTE DA FORNITORE'
];

// ── SOTTO-CATEGORIE per CAUSALE ─────────────────────────────────────────
// Mutuamente esclusive per famiglia. Selezionando una causale, il dropdown
// "anomalia" mostra solo il set corrispondente (garanzia / generico).
var CAU_SUBS = {
  'GARANZIA': [
    'BOLLA MANCANTE',
    'MANCA MODULO',
    'DIFETTO NON VALIDO',
    'MANCA LIBRETTO',
    'MANCA MODULO E LIBRETTO',
    'MANCA DIAGNOSI',
    'FUORI GARANZIA',
    'MANCA RICEVUTA O RELAZIONE',
    'MANCA MODULO, LIBRETTO, RICEVUTA E/O RELAZIONE',
    'NO GARANZIA OE',
    'MANCA DIAGNOSI E LIBRETTO',
    'MANCA MODULO, LIBRETTO E DIAGNOSI',
    'MANCA MODULO E DIAGNOSI',
    'MANCA DIAGNOSI E RELAZIONE/RICEVUTA'
  ],
  'GARANZIA MANODOPERA': [
    'MANCA RICEVUTA',
    'MANCA RELAZIONE',
    'MANCA FATTURA A COSTO 0',
    'MANCA LIBRETTO',
    'MANCA RICEVUTA, LIBRETTO, FATTURA A COSTO 0 E FOTO',
    'FOTO HD PER MANODOPERA E DANNI',
    'MANCA RICEVUTA, FATTURA A COSTO 0 E DICHIARAZIONE'
  ],
  'GARANZIA DANNI E MANODOPERA': [
    'MANCA RICEVUTA',
    'MANCA RELAZIONE',
    'MANCA FATTURA A COSTO 0',
    'MANCA LIBRETTO',
    'MANCA RICEVUTA, LIBRETTO, FATTURA A COSTO 0 E FOTO',
    'FOTO HD PER MANODOPERA E DANNI',
    'MANCA RICEVUTA, FATTURA A COSTO 0 E DICHIARAZIONE'
  ]
};

// Anomalie generiche disponibili per TUTTE le altre causali (non garanzia)
var ANOMALIE_GEN = [
  'MATERIALE ORIGINALE',
  'BOLLA MANCANTE',
  'CAUSALE MANCANTE',
  'DOCUMENTO INCOMPLETO',
  'BATTERIA ESAUSTA',
  "QUANTITA' DISCORDANTE",
  'PEZZO DANNEGGIATO',
  'MONTATO E SPORCO',
  'SCATOLA OG MANCANTE',
  'NON ADDEBITATO/A',
  'PERVENUTO APERTO (LIQUIDI)',
  'DANNEGGIATO NON SEGNALATO ENTRO 24h',
  'INCOMPLETO'
];

// Ritorna le sotto-anomalie ammesse per una data causale (mutex per famiglia)
function subsForCausale(cau){
  var c = String(cau||'').trim().toUpperCase();
  if(c === 'GARANZIA') return CAU_SUBS['GARANZIA'];
  if(c === 'GARANZIA MANODOPERA') return CAU_SUBS['GARANZIA MANODOPERA'];
  if(c === 'GARANZIA DANNI E MANODOPERA') return CAU_SUBS['GARANZIA DANNI E MANODOPERA'];
  return ANOMALIE_GEN;
}
