/* Original local investigation library by Brzo i Lokalno.
 * Validation and storage only: loading, saving or importing never executes a
 * plan, starts a device connection or trusts imported confirmations. */
import { InvestigationEngine, validateInvestigation } from './investigation-engine.js';

export const INVESTIGATION_VAULT_FORMAT = 'blclea.investigation.vault/1';
export const INVESTIGATION_VAULT_KEY = 'blclea.tools.investigations.v1';
const MAX_RECORDS = 20;
const MAX_BYTES = 2 * 1024 * 1024;
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const byteLength = text => new TextEncoder().encode(text).length;
const copy = value => JSON.parse(JSON.stringify(value));

function fail(message, code = 'INVESTIGATION_STORAGE') {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function requireValue(condition, message, code) { if (!condition) fail(message, code); }
function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function identifier(value) {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(value) && !BAD_KEYS.has(value),
    'Neispravan identitet istrage.');
  return value;
}
function uniqueId() {
  requireValue(typeof globalThis.crypto?.randomUUID === 'function', 'Sigurno generisanje identifikatora nije dostupno.');
  return globalThis.crypto.randomUUID();
}
function inspect(value) {
  const pending = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const { value: item, depth } = pending.pop();
    requireValue(++nodes <= 100000 && depth <= 24, 'Biblioteka istraga je previše složena.');
    if (item === null || typeof item === 'boolean' || typeof item === 'string') continue;
    if (typeof item === 'number') {
      requireValue(Number.isFinite(item), 'Biblioteka sadrži neispravan broj.');
      continue;
    }
    requireValue(Array.isArray(item) || plain(item), 'Biblioteka smije sadržavati samo obične JSON podatke.');
    const names = Object.keys(item);
    requireValue(names.length <= 10000, 'Biblioteka sadrži previše polja.');
    for (const name of names) {
      requireValue(!BAD_KEYS.has(name), 'Opasno ime polja nije dozvoljeno.');
      const descriptor = Object.getOwnPropertyDescriptor(item, name);
      requireValue(descriptor && 'value' in descriptor, 'Izvršni pristupnici nisu dozvoljeni.');
      pending.push({ value: descriptor.value, depth: depth + 1 });
    }
  }
}
function parseJson(raw) {
  requireValue(typeof raw === 'string' && byteLength(raw) <= MAX_BYTES,
    'Biblioteka ili datoteka istrage premašuje 2 MiB.');
  let value;
  try { value = JSON.parse(raw); }
  catch { fail('Datoteka istrage nije ispravan JSON.'); }
  inspect(value);
  return value;
}
function validateRecords(records) {
  requireValue(Array.isArray(records) && records.length <= MAX_RECORDS,
    'Biblioteka može sadržavati najviše 20 istraga. Izvezite i uklonite starije zapise.');
  const seen = new Set();
  return records.map(value => {
    const state = validateInvestigation(value);
    identifier(state.id);
    requireValue(!seen.has(state.id), 'Isti identitet istrage se ne može ponoviti u biblioteci.');
    seen.add(state.id);
    return state;
  });
}

/** Explicit local persistence with a recoverable memory fallback.
 * getPersistenceStatus().available must be checked before claiming a durable
 * save/removal. Read/compare/write detects stale snapshots, but is not an atomic
 * transaction across browser processes. */
export class InvestigationVault {
  constructor({ storage, key = INVESTIGATION_VAULT_KEY, now = Date.now, id = uniqueId } = {}) {
    requireValue(typeof key === 'string' && key.length > 0 && key.length <= 160 && !BAD_KEYS.has(key),
      'Neispravan ključ lokalne biblioteke.');
    this.key = key;
    this.raw = null;
    this.records = [];
    this.available = true;
    this.blockWrites = false;
    this.reason = 'ready';
    this.message = 'Istrage se čuvaju lokalno samo nakon vaše radnje.';
    this.importer = new InvestigationEngine({ now, id });
    if (storage === undefined) {
      try { storage = globalThis.localStorage; }
      catch { storage = null; }
    }
    this.storage = storage;
    try {
      if (!storage || typeof storage.getItem !== 'function') {
        this.unavailable('Lokalno spremište nije dostupno. Istrage ostaju u memoriji; izvezite ih prije zatvaranja.', 'no-storage');
        this.blockWrites = true;
        return;
      }
      this.raw = storage.getItem(this.key);
      requireValue(this.raw === null || typeof this.raw === 'string', 'Lokalna biblioteka nije ispravan tekst.');
      if (this.raw !== null) {
        const stored = parseJson(this.raw);
        requireValue(plain(stored) && Object.keys(stored).every(k => ['format', 'records'].includes(k)) &&
          stored.format === INVESTIGATION_VAULT_FORMAT, 'Nepodržana ili oštećena biblioteka istraga.');
        this.records = validateRecords(stored.records);
      }
      if (typeof storage.setItem !== 'function') {
        this.blockWrites = true;
        this.unavailable('Biblioteka je samo za čitanje. Izmjene ostaju u memoriji i mogu se izvesti.', 'read-only');
      }
    } catch {
      this.records = [];
      this.blockWrites = true;
      this.unavailable('Lokalna biblioteka nije dostupna ili nije valjana. Postojeći sadržaj nije prepisan. Nove istrage ostaju u memoriji i mogu se izvesti.', 'load-failed');
    }
  }
  unavailable(message, reason) {
    this.available = false;
    this.message = message;
    this.reason = reason;
  }
  getPersistenceStatus() {
    return { available: this.available, message: this.message, reason: this.reason };
  }
  list() { return copy(this.records); }
  persist(records) {
    const next = validateRecords(records);
    const envelope = { format: INVESTIGATION_VAULT_FORMAT, records: next };
    // Keep write and restart acceptance identical; never save an envelope that
    // the bounded reader itself would reject after the page is reopened.
    inspect(envelope);
    const serialized = JSON.stringify(envelope);
    requireValue(byteLength(serialized) <= MAX_BYTES,
      'Biblioteka premašuje 2 MiB. Izvezite i uklonite starije istrage.');
    if (!this.blockWrites && this.storage) {
      try {
        requireValue(this.storage.getItem(this.key) === this.raw,
          'Biblioteka je promijenjena u drugoj kartici. Trenutna istraga ostaje u memoriji; izvezite je prije ponovnog učitavanja.',
          'INVESTIGATION_STALE_STORAGE');
        this.storage.setItem(this.key, serialized);
        this.raw = serialized;
        this.available = true;
        this.reason = 'ready';
        this.message = 'Istraga je sačuvana u ovom pregledniku.';
      } catch (error) {
        this.blockWrites = true;
        this.unavailable(error?.code === 'INVESTIGATION_STALE_STORAGE' ? error.message :
          'Spremanje nije uspjelo. Izmjene su samo u memoriji; izvezite ih prije zatvaranja.',
        error?.code === 'INVESTIGATION_STALE_STORAGE' ? 'stale-storage' : 'write-failed');
      }
    } else {
      this.unavailable('Izmjene su samo u memoriji. Postojeći lokalni sadržaj nije prepisan; izvezite istragu prije zatvaranja.',
        this.reason === 'ready' ? 'no-storage' : this.reason);
    }
    this.records = next;
  }
  save(input) {
    const state = validateInvestigation(input);
    identifier(state.id);
    const rest = this.records.filter(record => record.id !== state.id);
    requireValue(rest.length < MAX_RECORDS,
      'Biblioteka može sadržavati najviše 20 istraga. Izvezite i uklonite starije zapise.');
    this.persist([state, ...rest]);
    return copy(state);
  }
  remove(id) {
    identifier(id);
    if (!this.records.some(record => record.id === id)) return false;
    this.persist(this.records.filter(record => record.id !== id));
    return true;
  }
  export(id) {
    identifier(id);
    const state = this.records.find(record => record.id === id);
    requireValue(state, 'Istraga nije pronađena.');
    // The language contract bounds canonical JSON to 1 MiB. Pretty-printing
    // could produce a file too large for the same engine to import again.
    return JSON.stringify(validateInvestigation(state));
  }
  import(raw) {
    const original = validateInvestigation(parseJson(raw));
    const imported = validateInvestigation(this.importer.import(JSON.stringify(original)));
    requireValue(imported.id !== original.id && !this.records.some(record => record.id === imported.id),
      'Uvoz mora dobiti novi nezavisan identitet istrage.');
    requireValue(imported.origin === 'imported' && typeof imported.importedAt === 'string',
      'Uvezeni zapis mora zadržati označeno porijeklo.');
    return this.save(imported);
  }
}
