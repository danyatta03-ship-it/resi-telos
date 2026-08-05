// js/core/config.js — configurazione statica del dominio Resi Telos.
//
// Estratto da index.html (blocco "CONFIGURAZIONE PERMESSI PER RUOLO",
// linee ~1502-1670). Fonte unica di verità per: permessi ruoli, stati
// per fase, causali, sotto-categorie, ordinamento fasi, header colonne.
//
// ATTENZIONE — file in refactor foundation:
//   - non ancora incluso da index.html (produzione usa ancora le var inline)
//   - qualunque modifica qui NON tocca la produzione
//   - le costanti sono esposte anche su window.* per retro-compat futuro
'use strict';

// ── Permessi per ruolo ──────────────────────────────────────────────
// canEditFasi  = fasi di cui il ruolo può modificare i campi
// canAdvanceTo = fasi a cui il ruolo può portare un reso (avanzamento)
// canSendBack  = può rimandare un reso alla fase precedente
// canViewPhases: fasi visibili in lista ('*' = tutte)
// canViewOwnOnly: vede solo i record che ha inserito
// canSeeTabs: tab principali visibili ('*' = tutti)
var ROLE_PERMS = {
  RIC: { canAdd:true, canDelete:false, canArchive:false, canEditFasi:['RICEVIMENTO'],                                              canViewAll:false, canViewPhases:['*'],           canViewOwnOnly:true,  canBulk:false, canAdvanceTo:['UFFICIO RESI'],                                            canSendBack:false, canSeeTabs:['pgIns','pgList'] },
  UFF: { canAdd:true, canDelete:false, canArchive:true,  canEditFasi:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'],          canViewAll:false, canViewPhases:['UFFICIO RESI'], canViewOwnOnly:false, canBulk:true,  canAdvanceTo:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'],         canSendBack:true,  canSeeTabs:['*'] },
  MAG: { canAdd:true, canDelete:false, canArchive:true,  canEditFasi:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO'],                    canViewAll:false, canViewPhases:['MAGAZZINO'],    canViewOwnOnly:false, canBulk:true,  canAdvanceTo:['UFFICIO RESI','MAGAZZINO','FINALE'],                        canSendBack:true,  canSeeTabs:['*'] },
  ADM: { canAdd:true, canDelete:true,  canArchive:true,  canEditFasi:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'],          canViewAll:true,  canViewPhases:['*'],           canViewOwnOnly:false, canBulk:true,  canAdvanceTo:['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'],         canSendBack:true,  canSeeTabs:['*'] }
};

// ── Stati per fase ──────────────────────────────────────────────────
var STATI = {
  'RICEVIMENTO': ['DA GESTIRE ⏳','OK PER UFFICIO','ANOMALIA RICEVIMENTO','STALLO RICEVIMENTO'],
  'UFFICIO RESI': [
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
  'MAGAZZINO': ['CHIUDERE','PRESA LOGISTICA','ANOMALIA MAGAZZINO','STALLO MAGAZZINO'],
  'FINALE': ['NOTA CREDITO','NON RENDIBILE','TRASFERITO FILIALE','ROTTAMATO','COMMERCIALE','VENDUTO','REVISIONATO','RIFIUTATO CLIENTE','ADDEBITATO VETTORE','STOCK MAGAZZINO']
};

// ── Ordine fasi ─────────────────────────────────────────────────────
var FASI_ORDER = ['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'];
var NEXT_FASE  = { 'RICEVIMENTO':'UFFICIO RESI', 'UFFICIO RESI':'MAGAZZINO', 'MAGAZZINO':'FINALE' };
var PREV_FASE  = { 'UFFICIO RESI':'RICEVIMENTO', 'MAGAZZINO':'UFFICIO RESI', 'FINALE':'MAGAZZINO' };

// ── Causali ─────────────────────────────────────────────────────────
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

// Sotto-categorie mutuamente esclusive per causale garanzia.
// Se causale = 'GARANZIA' → SOLO sotto-cat GARANZIA, ecc.
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

// Anomalie generiche (per tutte le causali non-garanzia)
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

function subsForCausale(cau){
  var c = String(cau||'').trim().toUpperCase();
  if(c === 'GARANZIA') return CAU_SUBS['GARANZIA'];
  if(c === 'GARANZIA MANODOPERA') return CAU_SUBS['GARANZIA MANODOPERA'];
  if(c === 'GARANZIA DANNI E MANODOPERA') return CAU_SUBS['GARANZIA DANNI E MANODOPERA'];
  return ANOMALIE_GEN;
}

// ── Header colonne (ordine canonico dei campi in export/tabelle) ────
var HDR = [
  'Data Listato','Vettore Ricevimento','Data Elaborazione','Soggetto','Pre','Codice','Quantita',
  'Fornitore','Prezzo','Vettore Uscita','Tipo flusso','Causale','Anomalia','Tipo documento',
  'FASE','STATO','Data stato','RMA','Contatto','Data contatto','Agente','Doc Ricevuti',
  'Data Ric.Doc','Note','Foto','Inserito da','Motivo NR','Chiuso da','Data chiusura'
];

// ── SLA (giorni di stallo prima di allarme) ─────────────────────────
var SLA_WARN = 7;   // giallo
var SLA_CRIT = 14;  // rosso

// ── Esporto tutto sia come CommonJS (tests) sia su window (browser) ──
if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    ROLE_PERMS, STATI, FASI_ORDER, NEXT_FASE, PREV_FASE,
    CAULIST, CAU_SUBS, ANOMALIE_GEN, subsForCausale,
    HDR, SLA_WARN, SLA_CRIT
  };
}
if(typeof window !== 'undefined'){
  window.ROLE_PERMS = ROLE_PERMS;
  window.STATI = STATI;
  window.FASI_ORDER = FASI_ORDER;
  window.NEXT_FASE = NEXT_FASE;
  window.PREV_FASE = PREV_FASE;
  window.CAULIST = CAULIST;
  window.CAU_SUBS = CAU_SUBS;
  window.ANOMALIE_GEN = ANOMALIE_GEN;
  window.subsForCausale = subsForCausale;
  window.HDR = HDR;
  window.SLA_WARN = SLA_WARN;
  window.SLA_CRIT = SLA_CRIT;
}
