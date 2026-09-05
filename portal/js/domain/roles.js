// Ruoli del portale e loro permessi.
//
// ATTENZIONE: questa tabella governa la UI, non la sicurezza. L'autorizzazione
// vera e' nelle Security Rules di Firebase (firebase-rules-v2.json), che non
// si fidano di nulla che arrivi dal client. Qui decidiamo solo cosa mostrare:
// nascondere un bottone che il server rifiuterebbe comunque e' cortesia verso
// l'utente, non una difesa.
//
// I ruoli del portale sono DISTINTI da quelli del gestionale (SCA/RPC/RIC/
// UFF/MAG/ADM in js/taxonomies.js). Il gestionale resta invariato.

export const ROLE = {
  ADMIN: 'ADMIN',
  TELOS: 'TELOS',
  CLIENTE: 'CLIENTE',
  AGENTE: 'AGENTE',
  CORRIERE: 'CORRIERE'
};

export const ROLE_LIST = [ROLE.ADMIN, ROLE.TELOS, ROLE.CLIENTE, ROLE.AGENTE, ROLE.CORRIERE];

export const ROLE_META = {
  ADMIN:    { label: 'Amministratore', short: 'ADM', icon: '⚙️', color: '#E05555', internal: true,
              desc: 'Controllo completo: utenti, configurazioni, SLA, white-label.' },
  TELOS:    { label: 'Telos',          short: 'TLS', icon: '🏢', color: '#3B9FD4', internal: true,
              desc: 'Operatore interno: gestisce i resi e risponde a clienti, agenti e corrieri.' },
  CLIENTE:  { label: 'Cliente',        short: 'CLI', icon: '👤', color: '#2ECC71', internal: false,
              desc: 'Vede solo i propri resi, apre richieste di ritiro, carica documenti.' },
  AGENTE:   { label: 'Agente',         short: 'AGE', icon: '💼', color: '#9B6BD4', internal: false,
              desc: 'Vede i resi dei clienti della propria zona.' },
  CORRIERE: { label: 'Corriere',       short: 'COR', icon: '🚚', color: '#E6B03C', internal: false,
              desc: 'Vede i ritiri assegnati al proprio vettore e ne aggiorna lo stato.' }
};

// Dove ogni ruolo legge i resi.
//   'returns'  → nodo completo del gestionale (solo interni)
//   'view'     → proiezione portal_view/<scope>/<scopeId> (esterni)
export const ROLE_SOURCE = {
  ADMIN:    { kind: 'returns', scopeType: null },
  TELOS:    { kind: 'returns', scopeType: null },
  CLIENTE:  { kind: 'view',    scopeType: 'client' },
  AGENTE:   { kind: 'view',    scopeType: 'agent' },
  CORRIERE: { kind: 'view',    scopeType: 'courier' }
};

const PERMS = {
  ADMIN: {
    viewAllReturns: true,
    manageUsers: true,
    manageConfig: true,
    manageSla: true,
    manageBrand: true,
    viewAudit: true,
    viewKpi: true,
    viewFinancials: true,
    createRequest: false,
    approveRequest: true,
    uploadDocuments: true,
    sendMessages: true,
    exportData: true
  },
  TELOS: {
    viewAllReturns: true,
    manageUsers: false,
    manageConfig: false,
    manageSla: false,
    manageBrand: false,
    viewAudit: false,
    viewKpi: true,
    viewFinancials: true,
    createRequest: false,
    approveRequest: true,
    uploadDocuments: true,
    sendMessages: true,
    exportData: true
  },
  CLIENTE: {
    viewAllReturns: false,
    manageUsers: false,
    manageConfig: false,
    manageSla: false,
    manageBrand: false,
    viewAudit: false,
    viewKpi: true,
    viewFinancials: false,
    createRequest: true,
    approveRequest: false,
    uploadDocuments: true,
    sendMessages: true,
    exportData: false
  },
  AGENTE: {
    viewAllReturns: false,
    manageUsers: false,
    manageConfig: false,
    manageSla: false,
    manageBrand: false,
    viewAudit: false,
    viewKpi: true,
    viewFinancials: true,
    createRequest: true,
    approveRequest: false,
    uploadDocuments: true,
    sendMessages: true,
    exportData: true
  },
  CORRIERE: {
    viewAllReturns: false,
    manageUsers: false,
    manageConfig: false,
    manageSla: false,
    manageBrand: false,
    viewAudit: false,
    viewKpi: false,
    viewFinancials: false,
    createRequest: false,
    approveRequest: false,
    uploadDocuments: true,
    sendMessages: true,
    exportData: false
  }
};

export function can(role, permission) {
  const table = PERMS[role];
  return !!(table && table[permission]);
}

export function permsFor(role) {
  return Object.assign({}, PERMS[role] || {});
}

export function isInternal(role) {
  return !!(ROLE_META[role] && ROLE_META[role].internal);
}

export function roleLabel(role) {
  return (ROLE_META[role] && ROLE_META[role].label) || role || '—';
}

export function roleColor(role) {
  return (ROLE_META[role] && ROLE_META[role].color) || '#888';
}

export function roleIcon(role) {
  return (ROLE_META[role] && ROLE_META[role].icon) || '';
}

// Voci di navigazione per ruolo. L'ordine e' quello di visualizzazione.
export function navFor(role) {
  const items = [
    { path: '/',        label: 'Dashboard', icon: '📊', roles: ROLE_LIST },
    { path: '/resi',    label: 'Resi',      icon: '📦', roles: ROLE_LIST },
    { path: '/richieste', label: 'Richieste', icon: '📝', roles: [ROLE.ADMIN, ROLE.TELOS, ROLE.CLIENTE, ROLE.AGENTE] },
    { path: '/notifiche', label: 'Notifiche', icon: '🔔', roles: ROLE_LIST },
    { path: '/admin/utenti', label: 'Utenti', icon: '👥', roles: [ROLE.ADMIN] },
    { path: '/admin/sla',    label: 'SLA',    icon: '⏱️', roles: [ROLE.ADMIN] },
    { path: '/admin/brand',  label: 'Brand',  icon: '🎨', roles: [ROLE.ADMIN] },
    { path: '/profilo', label: 'Profilo',   icon: '👤', roles: ROLE_LIST }
  ];
  return items.filter((it) => it.roles.indexOf(role) >= 0);
}

// Campi del record reso visibili a ciascun ruolo. Serve sia alla UI sia alla
// funzione di sync, che costruisce le proiezioni con esattamente questi campi:
// un cliente non deve poter leggere il prezzo di carico o le note interne
// nemmeno scaricando il JSON grezzo.
export const VISIBLE_FIELDS = {
  ADMIN: null,   // null = tutti
  TELOS: null,
  CLIENTE: [
    '_key', '_ts', 'cod', 'pre', 'qty', 'forn', 'sogg', 'causale',
    'fase', 'stato', 'datArr', 'datSta', 'vetRic', 'vetUsc', 'rma',
    'colli', 'tipoImb', 'trackingState', 'trackingTs'
  ],
  AGENTE: [
    '_key', '_ts', 'cod', 'pre', 'qty', 'prc', 'forn', 'sogg', 'agente',
    'causale', 'anomalia', 'fase', 'stato', 'datArr', 'datSta', 'vetRic',
    'vetUsc', 'rma', 'colli', 'tipoImb', 'trackingState', 'trackingTs'
  ],
  CORRIERE: [
    '_key', '_ts', 'cod', 'qty', 'sogg', 'fase', 'stato', 'vetRic', 'vetUsc',
    'colli', 'tipoImb', 'datArr', 'trackingState', 'trackingTs'
  ]
};

export function visibleFieldsFor(role) {
  const list = VISIBLE_FIELDS[role];
  return list ? list.slice() : null;
}

// Riduce un record ai soli campi visibili al ruolo.
export function projectForRole(row, role) {
  const fields = VISIBLE_FIELDS[role];
  if (!fields) return Object.assign({}, row);
  const out = {};
  for (const f of fields) {
    if (row[f] !== undefined && row[f] !== null && row[f] !== '') out[f] = row[f];
  }
  return out;
}
