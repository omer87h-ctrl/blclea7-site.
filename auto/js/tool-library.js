/* Original browser-local library for user-authored CLEA tool recipes.
 * Persistence and import are data operations: they never execute a recipe,
 * resolve a private source reference, connect a device or contact a service. */
import { ComposerEngine } from './tool-composer.js';

export const TOOL_LIBRARY_FORMAT = 'blclea.tool.library/1';
export const TOOL_LIBRARY_KEY = 'blclea.tools.library.v1';
const MAX_RECORDS = 50;
const MAX_BYTES = 1024 * 1024;
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const bytes = value => new TextEncoder().encode(value).length;
const copy = value => JSON.parse(JSON.stringify(value));

function requireValue(condition, message, code = 'TOOL_LIBRARY') {
  if (condition) return;
  const error = new Error(message);
  error.code = code;
  throw error;
}
function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function identifier(value) {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= 160 && !BAD_KEYS.has(value),
    'Neispravna oznaka alata.');
  return value;
}
function parse(raw) {
  requireValue(typeof raw === 'string' && bytes(raw) <= MAX_BYTES,
    'Biblioteka ili datoteka alata premašuje 1 MiB.');
  let value;
  try { value = JSON.parse(raw); }
  catch { requireValue(false, 'Datoteka alata nije ispravan JSON.'); }
  return value;
}

/** Explicit local saves, with an exportable memory fallback when persistence
 * is unavailable. A read/compare/write detects an already stale snapshot; it
 * cannot provide an atomic transaction between browser processes. */
export class ToolLibrary {
  constructor({ storage, key = TOOL_LIBRARY_KEY, now = Date.now, id } = {}) {
    requireValue(typeof key === 'string' && key.length > 0 && key.length <= 160 && !BAD_KEYS.has(key),
      'Neispravan ključ lokalne biblioteke alata.');
    this.key = key;
    this.raw = null;
    this.records = [];
    this.blockWrites = false;
    this.available = true;
    this.reason = 'ready';
    this.message = 'Alati se čuvaju samo u ovom pregledniku, nakon vaše radnje.';
    this.composer = new ComposerEngine({ now, id });
    if (storage === undefined) {
      try { storage = globalThis.localStorage; }
      catch { storage = null; }
    }
    this.storage = storage;
    try {
      if (!storage || typeof storage.getItem !== 'function') {
        this.blockWrites = true;
        this.unavailable('Lokalno spremište nije dostupno. Alati ostaju u memoriji; izvezite ih prije zatvaranja.', 'no-storage');
        return;
      }
      this.raw = storage.getItem(this.key);
      requireValue(this.raw === null || typeof this.raw === 'string', 'Lokalna biblioteka nije ispravan tekst.');
      if (this.raw !== null) {
        const stored = parse(this.raw);
        requireValue(plain(stored) && Object.keys(stored).length === 2 &&
          Object.hasOwn(stored, 'format') && Object.hasOwn(stored, 'records') &&
          stored.format === TOOL_LIBRARY_FORMAT, 'Nepodržana ili oštećena biblioteka alata.');
        this.records = this.validateRecords(stored.records);
      }
    } catch {
      this.records = [];
      this.blockWrites = true;
      this.unavailable('Lokalna biblioteka nije dostupna ili nije valjana. Postojeći sadržaj nije prepisan. Novi alati ostaju u memoriji i mogu se izvesti.', 'load-failed');
      return;
    }
    // Write capability can be denied independently of a successful read. Keep
    // validated loaded recipes available for export even if this getter throws.
    let writable = false;
    try { writable = typeof storage.setItem === 'function'; }
    catch { /* Treat a denied write accessor as read-only storage. */ }
    if (!writable) {
      this.blockWrites = true;
      this.unavailable('Biblioteka je samo za čitanje. Izmjene ostaju u memoriji i mogu se izvesti.', 'read-only');
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
  validateRecords(records) {
    requireValue(Array.isArray(records) && records.length <= MAX_RECORDS,
      'Biblioteka može sadržavati najviše 50 alata. Izvezite i uklonite starije zapise.');
    const seen = new Set();
    return records.map(value => {
      // The composer owns the recipe language, including JSON safety and the
      // allowlist of declarative operations. The library adds no recipe schema.
      const recipe = this.composer.validateRecipe(value);
      identifier(recipe.id);
      requireValue(!seen.has(recipe.id), 'Ista oznaka alata se ne može ponoviti u biblioteci.');
      seen.add(recipe.id);
      return recipe;
    });
  }
  list() { return copy(this.records); }
  persist(records) {
    const next = this.validateRecords(records);
    const serialized = JSON.stringify({ format: TOOL_LIBRARY_FORMAT, records: next });
    requireValue(bytes(serialized) <= MAX_BYTES,
      'Biblioteka premašuje 1 MiB. Izvezite i uklonite starije alate.');
    if (!this.blockWrites && this.storage) {
      try {
        requireValue(this.storage.getItem(this.key) === this.raw,
          'Biblioteka je promijenjena u drugoj kartici. Trenutni alat ostaje u memoriji; izvezite ga prije ponovnog učitavanja.',
          'TOOL_STALE_STORAGE');
        this.storage.setItem(this.key, serialized);
        this.raw = serialized;
        this.available = true;
        this.reason = 'ready';
        this.message = 'Biblioteka alata je sačuvana u ovom pregledniku.';
      } catch (error) {
        this.blockWrites = true;
        this.unavailable(error?.code === 'TOOL_STALE_STORAGE' ? error.message :
          'Spremanje nije uspjelo. Izmjene su samo u memoriji; izvezite ih prije zatvaranja.',
        error?.code === 'TOOL_STALE_STORAGE' ? 'stale-storage' : 'write-failed');
      }
    } else {
      this.unavailable('Izmjene su samo u memoriji. Postojeći lokalni sadržaj nije prepisan; izvezite alat prije zatvaranja.',
        this.reason === 'ready' ? 'no-storage' : this.reason);
    }
    this.records = next;
  }
  save(input) {
    const recipe = this.composer.validateRecipe(input);
    identifier(recipe.id);
    const rest = this.records.filter(record => record.id !== recipe.id);
    requireValue(rest.length < MAX_RECORDS,
      'Biblioteka može sadržavati najviše 50 alata. Izvezite i uklonite starije zapise.');
    this.persist([recipe, ...rest]);
    return copy(recipe);
  }
  remove(id) {
    identifier(id);
    if (!this.records.some(record => record.id === id)) return false;
    this.persist(this.records.filter(record => record.id !== id));
    return true;
  }
  export(id) {
    identifier(id);
    const recipe = this.records.find(record => record.id === id);
    requireValue(recipe, 'Alat nije pronađen.');
    // Private source/stream references stay local; an explicit export includes
    // the selected recipe. Compact JSON keeps export/import size limits equal.
    return JSON.stringify(this.composer.validateRecipe(recipe));
  }
  import(raw) {
    const original = this.composer.validateRecipe(parse(raw));
    const imported = this.composer.validateRecipe(this.composer.import(raw));
    requireValue(imported.id !== original.id && !this.records.some(record => record.id === imported.id),
      'Uvoz mora dobiti novu nezavisnu oznaku alata.');
    return this.save(imported);
  }
}
