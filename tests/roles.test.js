// Test dei ruoli e della proiezione dei campi.
// La proiezione e' una misura di sicurezza vera: e' cio' che impedisce a un
// cliente di ricevere il prezzo di carico o le note interne.

import { describe, it, assert, eq } from './run.js';
import {
  ROLE, ROLE_LIST, ROLE_META, ROLE_SOURCE,
  can, permsFor, isInternal, navFor,
  VISIBLE_FIELDS, visibleFieldsFor, projectForRole
} from '../portal/js/domain/roles.js';

export async function runRolesTests() {
  describe('Ruoli — definizione');

  it('ogni ruolo ha metadati e sorgente dati', () => {
    for (const r of ROLE_LIST) {
      assert(ROLE_META[r], 'metadati mancanti per ' + r);
      assert(ROLE_META[r].label, 'label mancante per ' + r);
      assert(ROLE_SOURCE[r], 'sorgente mancante per ' + r);
    }
  });

  it('solo ADMIN e TELOS sono interni', () => {
    assert(isInternal(ROLE.ADMIN));
    assert(isInternal(ROLE.TELOS));
    assert(!isInternal(ROLE.CLIENTE));
    assert(!isInternal(ROLE.AGENTE));
    assert(!isInternal(ROLE.CORRIERE));
  });

  it('solo i ruoli interni leggono returns/ direttamente', () => {
    eq(ROLE_SOURCE.ADMIN.kind, 'returns');
    eq(ROLE_SOURCE.TELOS.kind, 'returns');
    eq(ROLE_SOURCE.CLIENTE.kind, 'view');
    eq(ROLE_SOURCE.AGENTE.kind, 'view');
    eq(ROLE_SOURCE.CORRIERE.kind, 'view');
  });

  it('ogni ruolo esterno ha uno scopeType distinto', () => {
    eq(ROLE_SOURCE.CLIENTE.scopeType, 'client');
    eq(ROLE_SOURCE.AGENTE.scopeType, 'agent');
    eq(ROLE_SOURCE.CORRIERE.scopeType, 'courier');
  });

  describe('Ruoli — permessi');

  it('solo ADMIN amministra utenti e configurazioni', () => {
    assert(can(ROLE.ADMIN, 'manageUsers'));
    for (const r of [ROLE.TELOS, ROLE.CLIENTE, ROLE.AGENTE, ROLE.CORRIERE]) {
      assert(!can(r, 'manageUsers'), r + ' non deve gestire utenti');
      assert(!can(r, 'manageSla'), r + ' non deve configurare SLA');
      assert(!can(r, 'manageBrand'), r + ' non deve configurare il brand');
    }
  });

  it('solo lo staff vede tutti i resi', () => {
    assert(can(ROLE.ADMIN, 'viewAllReturns'));
    assert(can(ROLE.TELOS, 'viewAllReturns'));
    assert(!can(ROLE.CLIENTE, 'viewAllReturns'));
    assert(!can(ROLE.AGENTE, 'viewAllReturns'));
    assert(!can(ROLE.CORRIERE, 'viewAllReturns'));
  });

  it('cliente e corriere non vedono i dati economici', () => {
    assert(!can(ROLE.CLIENTE, 'viewFinancials'));
    assert(!can(ROLE.CORRIERE, 'viewFinancials'));
    assert(can(ROLE.AGENTE, 'viewFinancials'));
  });

  it('solo lo staff approva le richieste', () => {
    assert(can(ROLE.ADMIN, 'approveRequest'));
    assert(can(ROLE.TELOS, 'approveRequest'));
    assert(!can(ROLE.CLIENTE, 'approveRequest'));
    assert(!can(ROLE.AGENTE, 'approveRequest'));
  });

  it('il corriere non apre richieste di reso', () => {
    assert(!can(ROLE.CORRIERE, 'createRequest'));
  });

  it('un permesso inesistente e\' sempre negato', () => {
    assert(!can(ROLE.ADMIN, 'permessoInventato'));
    assert(!can('RUOLO_FALSO', 'manageUsers'));
    assert(!can(null, 'manageUsers'));
  });

  it('permsFor restituisce una copia isolata', () => {
    const p = permsFor(ROLE.CLIENTE);
    p.manageUsers = true;
    assert(!can(ROLE.CLIENTE, 'manageUsers'), 'la tabella non deve essere alterabile dall\'esterno');
  });

  describe('Ruoli — navigazione');

  it('le voci admin compaiono solo per ADMIN', () => {
    const adminPaths = navFor(ROLE.ADMIN).map((n) => n.path);
    assert(adminPaths.includes('/admin/utenti'));
    for (const r of [ROLE.TELOS, ROLE.CLIENTE, ROLE.AGENTE, ROLE.CORRIERE]) {
      const paths = navFor(r).map((n) => n.path);
      assert(!paths.some((p) => p.startsWith('/admin')), r + ' vede voci admin');
    }
  });

  it('il corriere non vede la sezione richieste', () => {
    const paths = navFor(ROLE.CORRIERE).map((n) => n.path);
    assert(!paths.includes('/richieste'));
  });

  it('ogni ruolo ha almeno dashboard, resi e profilo', () => {
    for (const r of ROLE_LIST) {
      const paths = navFor(r).map((n) => n.path);
      assert(paths.includes('/'), r + ' senza dashboard');
      assert(paths.includes('/resi'), r + ' senza elenco resi');
      assert(paths.includes('/profilo'), r + ' senza profilo');
    }
  });

  describe('Ruoli — proiezione dei campi');

  const fullRow = {
    _key: 'r123', _ts: 1700000000000, cod: 'ABC123', pre: 'BOS', qty: 2,
    prc: '120.50', forn: 'BOSCH', sogg: '007183 - AUTOFFICINA ROSSI',
    agente: 'Direzionali Torino', causale: 'GARANZIA', anomalia: 'MANCA MODULO',
    fase: 'UFFICIO RESI', stato: 'DA GESTIRE', datArr: '2026-01-05',
    vetRic: 'PIEMME', vetUsc: 'CIPI', rma: 'RMA-9', colli: 1, tipoImb: 'SCATOLA',
    note: 'Nota interna riservata',
    _who: 'MARIO', _role: 'UFF', _log: [{ ts: 1, user: 'X' }],
    _photoPez: 'data:image/jpeg;base64,AAAA',
    motivoNR: 'PREZZO INFERIORE'
  };

  it('lo staff riceve il record completo', () => {
    eq(visibleFieldsFor(ROLE.ADMIN), null);
    eq(visibleFieldsFor(ROLE.TELOS), null);
    const projected = projectForRole(fullRow, ROLE.ADMIN);
    eq(projected.note, 'Nota interna riservata');
    eq(projected._who, 'MARIO');
  });

  it('il cliente NON riceve prezzo, note interne e metadati operatore', () => {
    const p = projectForRole(fullRow, ROLE.CLIENTE);
    eq(p.prc, undefined, 'il prezzo non deve arrivare al cliente');
    eq(p.note, undefined, 'le note interne non devono arrivare al cliente');
    eq(p._who, undefined);
    eq(p._role, undefined);
    eq(p._log, undefined);
    eq(p.motivoNR, undefined);
    eq(p.anomalia, undefined);
    eq(p.agente, undefined, 'il cliente non deve vedere l\'agente assegnato');
  });

  it('il cliente riceve comunque cio\' che gli serve', () => {
    const p = projectForRole(fullRow, ROLE.CLIENTE);
    eq(p.cod, 'ABC123');
    eq(p.qty, 2);
    eq(p.forn, 'BOSCH');
    eq(p.rma, 'RMA-9');
    eq(p.stato, 'DA GESTIRE');
  });

  it('il corriere riceve solo i dati logistici', () => {
    const p = projectForRole(fullRow, ROLE.CORRIERE);
    eq(p.prc, undefined);
    eq(p.forn, undefined, 'il fornitore non serve al corriere');
    eq(p.causale, undefined, 'la causale non serve al corriere');
    eq(p.note, undefined);
    eq(p.colli, 1);
    eq(p.vetRic, 'PIEMME');
  });

  it('l\'agente vede i dati economici ma non le note interne', () => {
    const p = projectForRole(fullRow, ROLE.AGENTE);
    eq(p.prc, '120.50');
    eq(p.agente, 'Direzionali Torino');
    eq(p.note, undefined, 'le note interne restano interne');
    eq(p._log, undefined);
  });

  it('nessuna proiezione esterna include campi con prefisso privato', () => {
    for (const r of [ROLE.CLIENTE, ROLE.AGENTE, ROLE.CORRIERE]) {
      const fields = VISIBLE_FIELDS[r];
      for (const f of fields) {
        // _key e _ts sono le sole eccezioni ammesse: identificano la riga.
        if (f === '_key' || f === '_ts') continue;
        assert(!f.startsWith('_'), 'campo privato esposto a ' + r + ': ' + f);
      }
    }
  });

  it('la proiezione omette i valori vuoti invece di trasmetterli', () => {
    const p = projectForRole({ _key: 'r1', cod: 'X', forn: '', rma: null, qty: 0 }, ROLE.CLIENTE);
    eq(p.forn, undefined);
    eq(p.rma, undefined);
    eq(p.cod, 'X');
  });

  it('visibleFieldsFor restituisce una copia', () => {
    const list = visibleFieldsFor(ROLE.CLIENTE);
    list.push('prc');
    assert(!VISIBLE_FIELDS.CLIENTE.includes('prc'), 'la lista non deve essere modificabile dall\'esterno');
  });
}
