/* BL CLEA Tools shared local runtime. Original implementation by Brzo i Lokalno.
 * Structured data only: no execution of application text, scripts or imports. */

import { EvidenceEngine } from './evidence-engine.js';
const evidenceValidator = new EvidenceEngine();
export const CASE_FORMAT = 'blclea.tools.case/1';
const WORKSPACE_FORMAT = 'blclea.tools.workspace/1';
const STORAGE_KEY = 'blclea.tools.workspace.v1';
const TOOLS = new Set(['auto', 'electric', 'build', 'climate', 'workshop']);
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const CASE_KEYS = new Set(['format', 'id', 'toolId', 'title', 'revision', 'createdAt', 'updatedAt', 'fields', 'measurements', 'steps', 'notes', 'materials', 'services', 'calculations', 'events', 'diagnostics']);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_CASES = 100;
const MAX_EVENTS = 200;
const MAX_NUMBER = 1e12;

export const PILLARS = Object.freeze([
  Object.freeze({ id: 'core', name: 'Core AI Manager', responsibility: 'Coordinates bounded local operations. No AI model or AI decisions are claimed.', output: 'Operation counts, duration and status.' }),
  Object.freeze({ id: 'bridge', name: 'Link Bridge Elite', responsibility: 'Checks the tool identity, typed case contract and capability availability.', output: 'Validated tool and format; rejected invalid inputs.' }),
  Object.freeze({ id: 'expansion', name: 'Expansion Q', responsibility: 'Uses an explicit versioned registry of five supported tool identifiers.', output: 'Supported tool IDs and contract version.' }),
  Object.freeze({ id: 'recovery', name: 'Adaptive Recovery', responsibility: 'Validates before mutation, preserves live state on failure and reports storage problems.', output: 'Rejected mutations and in-memory recovery status.' }),
  Object.freeze({ id: 'interaction', name: 'Holo Interaction', responsibility: 'Publishes detached state updates to subscribed interfaces.', output: 'Actual change notifications; no holography claim.' }),
  Object.freeze({ id: 'fallback', name: 'Fallback Executor', responsibility: 'Keeps an explicitly unsaved in-memory session when durable storage is unavailable.', output: 'Persistence status and exportable local data.' }),
  Object.freeze({ id: 'vision', name: 'Vision Q', responsibility: 'Records real local actions and isolated what-if comparisons without copying customer values into traces.', output: 'Bounded execution trail and measured operation duration.' })
]);

function problem(message, code = 'VALIDATION') {
  const error = new Error(message);
  error.code = code;
  return error;
}
function requireValue(condition, message, code) {
  if (!condition) throw problem(message, code);
}
function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function string(value, name, max = 10000, empty = true) {
  requireValue(typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0), `${name}: neispravan ili predug tekst.`);
  return value;
}
function number(value, name, min = -MAX_NUMBER, max = MAX_NUMBER) {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `${name}: potreban je konačan broj u dozvoljenom rasponu.`);
  return value;
}
function id(value, name = 'ID') {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) && !FORBIDDEN.has(value), `${name}: neispravan identifikator.`);
  return value;
}
function timestamp(value, name) {
  requireValue(typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)), `${name}: neispravan datum.`);
  return value;
}
function allowedKeys(value, keys, name) {
  requireValue(plain(value), `${name}: potreban je objekat.`);
  for (const key of Object.keys(value)) {
    requireValue(!FORBIDDEN.has(key) && keys.has(key), `${name}: nepodržano polje ${key}.`);
  }
}

// Validate before cloning or traversal. Iterative traversal bounds stack and work.
function inspectData(value) {
  const pending = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const entry = pending.pop();
    requireValue(++count <= 100000 && entry.depth <= 24, 'Podaci premašuju dozvoljenu složenost.');
    const node = entry.value;
    if (node === null || typeof node === 'boolean') continue;
    if (typeof node === 'number') {
      requireValue(Number.isFinite(node) && Math.abs(node) <= MAX_NUMBER, 'Podaci sadrže neispravan broj.');
      continue;
    }
    if (typeof node === 'string') {
      requireValue(node.length <= 40000, 'Podaci sadrže predug tekst.');
      continue;
    }
    requireValue(Array.isArray(node) || plain(node), 'Dozvoljeni su samo obični JSON podaci.');
    const keys = Object.keys(node);
    requireValue(keys.length <= 2000, 'Podaci sadrže previše polja.');
    for (const key of keys) {
      requireValue(!FORBIDDEN.has(key), 'Opasno ime polja nije dozvoljeno.');
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      requireValue(descriptor && 'value' in descriptor, 'Pristupnici i izvršni objekti nisu dozvoljeni.');
      pending.push({ value: descriptor.value, depth: entry.depth + 1 });
    }
  }
}
function clone(value) {
  inspectData(value);
  const text = JSON.stringify(value);
  requireValue(text.length <= MAX_BYTES, 'Podaci premašuju ograničenje od 2 MiB znakova.');
  return JSON.parse(text);
}

export function safeParse(text) {
  requireValue(typeof text === 'string' && text.length <= MAX_BYTES, 'Datoteka je prevelika ili nije tekst.');
  let value;
  try { value = JSON.parse(text); }
  catch { throw problem('Datoteka nije ispravan JSON.'); }
  inspectData(value);
  return value;
}

function primitiveMap(value, label, maxText) {
  requireValue(plain(value) && Object.keys(value).length <= 100, `${label}: previše ili neispravna polja.`);
  for (const [key, item] of Object.entries(value)) {
    requireValue(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(key) && !FORBIDDEN.has(key), `${label}: neispravno ime polja.`);
    requireValue(item === null || ['string', 'number', 'boolean'].includes(typeof item), `${label}: očekivana je jednostavna vrijednost.`);
    if (typeof item === 'string') string(item, label, maxText);
    if (typeof item === 'number') number(item, label);
  }
}

export function validateCase(input) {
  inspectData(input);
  allowedKeys(input, CASE_KEYS, 'Radni predmet');
  requireValue(input.format === CASE_FORMAT, 'Nepodržana verzija radnog predmeta.');
  id(input.id);
  requireValue(TOOLS.has(input.toolId), 'Alat nije registrovan u ovom Runtimeu.');
  string(input.title, 'Naslov', 160, false);
  requireValue(Number.isSafeInteger(input.revision) && input.revision >= 1 && input.revision <= MAX_NUMBER, 'Neispravna revizija.');
  timestamp(input.createdAt, 'Datum kreiranja');
  timestamp(input.updatedAt, 'Datum izmjene');
  primitiveMap(input.fields, 'Podaci', 10000);
  primitiveMap(input.measurements, 'Mjerenja', 4000);
  requireValue(plain(input.steps) && Object.keys(input.steps).length <= 100, 'Previše koraka postupka.');
  for (const [key, step] of Object.entries(input.steps)) {
    id(key, 'Korak');
    allowedKeys(step, new Set(['done', 'note']), 'Korak');
    requireValue(typeof step.done === 'boolean', 'Korak mora imati status.');
    string(step.note, 'Zapažanje koraka', 10000);
  }
  string(input.notes, 'Bilješke', 40000);
  for (const kind of ['materials', 'services']) {
    requireValue(Array.isArray(input[kind]) && input[kind].length <= 200, 'Previše stavki obračuna.');
    const ids = new Set();
    for (const row of input[kind]) {
      allowedKeys(row, new Set(kind === 'materials' ? ['id', 'name', 'quantity', 'unit', 'unitPrice'] : ['id', 'description', 'quantity', 'unitPrice']), 'Stavka');
      id(row.id, 'Stavka');
      requireValue(!ids.has(row.id), 'Duplikat stavke obračuna.');
      ids.add(row.id);
      // Draft rows may be incomplete; completeness is a report/workflow concern.
      string(kind === 'materials' ? row.name : row.description, 'Opis stavke', 300);
      if (kind === 'materials') string(row.unit, 'Jedinica', 30);
      number(row.quantity, 'Količina', 0);
      number(row.unitPrice, 'Jedinična cijena', 0);
    }
  }
  requireValue(Array.isArray(input.calculations) && input.calculations.length <= 100, 'Previše proračuna.');
  const calculationIds = new Set();
  for (const calculation of input.calculations) {
    allowedKeys(calculation, new Set(['id', 'name', 'inputs', 'result', 'createdAt']), 'Proračun');
    id(calculation.id, 'Proračun');
    requireValue(!calculationIds.has(calculation.id), 'Duplikat proračuna.');
    calculationIds.add(calculation.id);
    string(calculation.name, 'Naziv proračuna', 300, false);
    timestamp(calculation.createdAt, 'Datum proračuna');
    primitiveMap(calculation.inputs, 'Ulazi proračuna', 1000);
    allowedKeys(calculation.result, new Set(['items', 'notes']), 'Rezultat proračuna');
    requireValue(Array.isArray(calculation.result.items) && calculation.result.items.length <= 100, 'Neispravne stavke proračuna.');
    for (const item of calculation.result.items) {
      allowedKeys(item, new Set(['label', 'value', 'unit']), 'Stavka proračuna');
      string(item.label, 'Naziv rezultata', 300, false);
      if (typeof item.value === 'number') number(item.value, 'Rezultat');
      else string(item.value, 'Rezultat', 4000);
      if (item.unit !== undefined) string(item.unit, 'Jedinica', 50);
    }
    requireValue(Array.isArray(calculation.result.notes) && calculation.result.notes.length <= 50, 'Neispravne napomene proračuna.');
    calculation.result.notes.forEach(note => string(note, 'Napomena proračuna', 4000));
  }
  if (input.diagnostics !== undefined && input.diagnostics !== null) {
    evidenceValidator.exportSession(input.diagnostics);
    requireValue(input.diagnostics.toolId === input.toolId, 'Mjerna sesija pripada drugom alatu.');
  }
  requireValue(Array.isArray(input.events) && input.events.length <= MAX_EVENTS, 'Previše događaja.');
  for (const event of input.events) {
    allowedKeys(event, new Set(['id', 'at', 'pillar', 'operation', 'status', 'summary', 'details', 'durationMs']), 'Događaj');
    id(event.id, 'Događaj');
    timestamp(event.at, 'Datum događaja');
    requireValue(PILLARS.some(p => p.id === event.pillar), 'Nepoznat stub u događaju.');
    string(event.operation, 'Operacija', 80, false);
    requireValue(['ok', 'rejected', 'memory', 'info'].includes(event.status), 'Nepoznat status događaja.');
    string(event.summary, 'Sažetak', 300);
    if (event.details !== undefined) primitiveMap(event.details, 'Metapodaci', 300);
    if (event.durationMs !== undefined) number(event.durationMs, 'Trajanje', 0);
  }
  return clone(input);
}

function clock() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
function defaultId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  throw problem('Nije dostupan siguran generator identifikatora.');
}
function initialStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
function blankWorkspace() { return { format: WORKSPACE_FORMAT, revision: 0, records: [] }; }
function decodeWorkspace(text) {
  if (text === null) return blankWorkspace();
  const data = safeParse(text);
  allowedKeys(data, new Set(['format', 'revision', 'records']), 'Lokalno spremište');
  requireValue(data.format === WORKSPACE_FORMAT && Number.isSafeInteger(data.revision) && data.revision >= 0, 'Nepodržano lokalno spremište.');
  requireValue(Array.isArray(data.records) && data.records.length <= MAX_CASES, 'Previše lokalnih radnih predmeta.');
  const seen = new Set();
  data.records = data.records.map(record => {
    const result = validateCase(record);
    requireValue(!seen.has(result.id), 'Duplikat lokalnog radnog predmeta.');
    seen.add(result.id);
    return result;
  });
  return data;
}

export class ToolsRuntime {
  constructor({ storage = initialStorage(), now = () => new Date().toISOString(), id: makeId = defaultId } = {}) {
    this._storage = storage;
    this._now = now;
    this._id = makeId;
    this._workspace = blankWorkspace();
    this._persistedText = null;
    this._blocked = false;
    this._dirty = false;
    this._listeners = new Set();
    this._diagnostics = [];
    this._counts = Object.create(null);
    this._persistence = { available: Boolean(storage), message: storage ? 'Lokalni podaci ostaju u ovom pregledniku.' : 'Lokalno spremanje nije dostupno. Izvezi rad prije zatvaranja.' };
    if (storage) {
      try {
        this._persistedText = storage.getItem(STORAGE_KEY);
        this._workspace = decodeWorkspace(this._persistedText);
      } catch (error) {
        // Never overwrite unreadable/corrupt storage as if it were an empty workspace.
        this._blocked = true;
        this._persistence = { available: false, message: 'Postojeće spremište nije moguće sigurno pročitati. Rad je privremen; izvezi ga prije zatvaranja.' };
        this._diagnostic(null, 'recovery', 'storage.load', 'rejected', 'Lokalno spremište nije učitano.', { code: error.code || 'STORAGE_READ' });
      }
    }
  }

  get persistence() { return { ...this._persistence }; }
  get registry() { return Object.freeze({ format: CASE_FORMAT, tools: Object.freeze([...TOOLS]), maxCases: MAX_CASES, maxEvents: MAX_EVENTS }); }
  get metrics() { return { operations: { ...this._counts }, cases: this._workspace.records.length, pendingPersistence: this._dirty, diagnostics: this._diagnostics.length }; }

  _time() { return timestamp(this._now(), 'Runtime sat'); }
  _newId() { return id(this._id()); }
  _event(pillar, operation, status, summary, details = {}, durationMs = 0) {
    return { id: this._newId(), at: this._time(), pillar, operation, status, summary, details, durationMs: Math.max(0, Math.round(durationMs * 100) / 100) };
  }
  _diagnostic(caseId, pillar, operation, status, summary, details = {}, durationMs = 0) {
    const event = this._event(pillar, operation, status, summary, details, durationMs);
    this._diagnostics.push({ caseId, ...event });
    if (this._diagnostics.length > 300) this._diagnostics.shift();
    this._counts[operation] = (this._counts[operation] || 0) + 1;
    return event;
  }
  _notify(change) {
    for (const listener of this._listeners) {
      try { listener({ ...change, persistence: this.persistence }); }
      catch { /* A presentation subscriber cannot roll back a completed storage operation. */ }
    }
  }
  subscribe(listener) {
    requireValue(typeof listener === 'function', 'Pretplatnik mora biti funkcija.');
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _refresh() {
    if (!this._storage || this._blocked) return;
    let text;
    try { text = this._storage.getItem(STORAGE_KEY); }
    catch {
      this._persistence = { available: false, message: 'Spremište je trenutno nedostupno. Rad ostaje u memoriji; izvezi ga.' };
      return;
    }
    if (text === this._persistedText) return;
    if (this._dirty) {
      // Reading/export must remain possible even when a durable conflict blocks writes.
      this._persistence = { available: false, message: 'Drugi prozor je promijenio spremište dok postoje nespremljene izmjene. Izvezi svoj rad i ponovo otvori aplikaciju.' };
      return;
    }
    try {
      const fresh = decodeWorkspace(text);
      this._workspace = fresh;
      this._persistedText = text;
      this._persistence = { available: true, message: 'Lokalni podaci ostaju u ovom pregledniku.' };
    } catch {
      this._blocked = true;
      this._persistence = { available: false, message: 'Spremište je promijenjeno u nečitljiv format. Sačuvana sesija ostaje u memoriji; izvezi svoj rad.' };
    }
  }

  _commit(workspace, change) {
    const encoded = JSON.stringify(workspace);
    requireValue(encoded.length <= MAX_BYTES, 'Lokalna zbirka je puna. Izvezi pa ukloni stare radne predmete.');
    let persisted = false;
    if (this._storage && !this._blocked) {
      try {
        const before = this._storage.getItem(STORAGE_KEY);
        if (before !== this._persistedText) throw problem('Drugi prozor je promijenio podatke. Ponovo učitaj predmet prije spremanja.', 'CONFLICT');
        this._storage.setItem(STORAGE_KEY, encoded);
        const after = this._storage.getItem(STORAGE_KEY);
        if (after !== encoded) throw problem('Spremište je istovremeno promijenjeno u drugom prozoru. Izvezi svoj rad i ponovo ga otvori.', 'CONFLICT');
        this._persistedText = encoded;
        persisted = true;
      } catch (error) {
        if (error.code === 'CONFLICT') throw error;
      }
    }
    this._workspace = workspace;
    this._dirty = !persisted;
    this._persistence = persisted
      ? { available: true, message: 'Spremljeno lokalno u ovom pregledniku.' }
      : { available: false, message: 'Izmjene su samo u memoriji. Spremanje nije uspjelo; izvezi rad prije zatvaranja.' };
    this._notify({ ...change, persisted });
  }

  listCases() {
    this._refresh();
    return this._workspace.records.map(record => clone(record)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }
  getCase(caseId) {
    id(caseId);
    this._refresh();
    const record = this._workspace.records.find(item => item.id === caseId);
    return record ? clone(record) : null;
  }
  createCase(toolId, title = 'Novi radni predmet') {
    const started = clock();
    this._refresh();
    requireValue(TOOLS.has(toolId), 'Alat nije registrovan.', 'CAPABILITY');
    requireValue(this._workspace.records.length < MAX_CASES, 'Dostignuto je ograničenje od 100 predmeta. Izvezi pa ukloni stare predmete.');
    const caseId = this._newId();
    requireValue(!this._workspace.records.some(r => r.id === caseId), 'Identifikator već postoji. Pokušaj ponovo.');
    const time = this._time();
    const event = this._event('core', 'case.create', 'ok', 'Kreiran lokalni radni predmet.', { toolId }, clock() - started);
    const record = validateCase({ format: CASE_FORMAT, id: caseId, toolId, title, revision: 1, createdAt: time, updatedAt: time, fields: {}, measurements: {}, steps: {}, notes: '', materials: [], services: [], calculations: [], events: [event] });
    const workspace = { ...this._workspace, revision: this._workspace.revision + 1, records: [...this._workspace.records, record] };
    this._commit(workspace, { type: 'create', id: caseId });
    this._diagnostic(caseId, 'core', 'case.create', this.persistence.available ? 'ok' : 'memory', 'Radni predmet je dostupan.', { toolId }, clock() - started);
    return clone(record);
  }
  saveCase(input) {
    const started = clock();
    let record;
    try {
      record = validateCase(input);
      this._refresh();
      const current = this._workspace.records.find(item => item.id === record.id);
      requireValue(current, 'Radni predmet ne postoji. Koristi uvoz za novi predmet.', 'NOT_FOUND');
      requireValue(current.revision === record.revision, 'Ovaj predmet ima noviju reviziju. Ponovo ga otvori prije spremanja.', 'CONFLICT');
      requireValue(current.toolId === record.toolId && current.createdAt === record.createdAt, 'Identitet i alat postojećeg predmeta ne mogu se promijeniti.');
      const changed = ['title', 'fields', 'measurements', 'steps', 'notes', 'materials', 'services', 'calculations', 'diagnostics'].filter(key => JSON.stringify(record[key]) !== JSON.stringify(current[key]));
      const event = this._event('recovery', 'case.save', 'ok', 'Provjeren ugovor i spremljena nova revizija.', { changed: changed.join(', ') || 'none', revision: current.revision + 1 }, clock() - started);
      // Imported or edited event arrays cannot fabricate runtime execution facts.
      record.events = [...current.events, event].slice(-MAX_EVENTS);
      record.revision = current.revision + 1;
      record.updatedAt = this._time();
      validateCase(record);
      this._commit({ ...this._workspace, revision: this._workspace.revision + 1, records: this._workspace.records.map(item => item.id === record.id ? record : item) }, { type: 'save', id: record.id });
      this._diagnostic(record.id, 'bridge', 'case.save', this.persistence.available ? 'ok' : 'memory', 'Prihvaćena izmjena radnog predmeta.', { changed: changed.join(', ') || 'none', revision: record.revision }, clock() - started);
      return clone(record);
    } catch (error) {
      this._diagnostic(record?.id || null, 'recovery', 'case.save', 'rejected', 'Izmjena je odbijena; prethodno stanje je sačuvano.', { code: error.code || 'ERROR' }, clock() - started);
      throw error;
    }
  }
  deleteCase(caseId) {
    id(caseId);
    this._refresh();
    requireValue(this._workspace.records.some(record => record.id === caseId), 'Radni predmet ne postoji.', 'NOT_FOUND');
    this._commit({ ...this._workspace, revision: this._workspace.revision + 1, records: this._workspace.records.filter(record => record.id !== caseId) }, { type: 'delete', id: caseId });
    // Private case content and its traces leave this session too.
    this._diagnostics = this._diagnostics.filter(event => event.caseId !== caseId);
    return true;
  }
  exportCase(caseId) {
    const record = this.getCase(caseId);
    requireValue(record, 'Radni predmet ne postoji.', 'NOT_FOUND');
    this._diagnostic(caseId, 'bridge', 'case.export', 'ok', 'Pripremljena je lokalna JSON datoteka.', { revision: record.revision });
    return JSON.stringify(record, null, 2);
  }
  importCase(text) {
    const started = clock();
    const source = validateCase(safeParse(text));
    this._refresh();
    requireValue(this._workspace.records.length < MAX_CASES, 'Dostignuto je ograničenje od 100 predmeta.');
    const caseId = this._newId();
    requireValue(!this._workspace.records.some(r => r.id === caseId), 'Identifikator već postoji. Pokušaj ponovo.');
    const time = this._time();
    const record = { ...source, id: caseId, revision: 1, createdAt: time, updatedAt: time, events: [this._event('bridge', 'case.import', 'ok', 'Uvezeni podaci su provjereni i dobili novi identitet. Trag izvornog izvršavanja nije preuzet.', { toolId: source.toolId, sourceRevision: source.revision }, clock() - started)] };
    if (record.diagnostics) record.diagnostics = evidenceValidator.importSession(JSON.stringify(record.diagnostics));
    validateCase(record);
    this._commit({ ...this._workspace, revision: this._workspace.revision + 1, records: [...this._workspace.records, record] }, { type: 'import', id: caseId });
    this._diagnostic(caseId, 'bridge', 'case.import', this.persistence.available ? 'ok' : 'memory', 'Uvezen nezavisan radni predmet.', { toolId: source.toolId }, clock() - started);
    return clone(record);
  }

  // A host-owned callback may edit an isolated structured copy. Never pass code from imports.
  runShadow(input, mutator) {
    const started = clock();
    const original = validateCase(input);
    requireValue(typeof mutator === 'function', 'Alternativa mora biti lokalna kontrolisana funkcija.');
    const alternative = clone(original);
    const result = mutator(alternative);
    requireValue(!result || typeof result.then !== 'function', 'Asinhrone i vanjske radnje nisu dozvoljene u ovoj alternativi.');
    const after = validateCase(result === undefined ? alternative : result);
    requireValue(after.id === original.id && after.toolId === original.toolId && after.revision === original.revision && after.createdAt === original.createdAt && after.updatedAt === original.updatedAt, 'Alternativa ne može promijeniti identitet, reviziju ili datume.');
    const changed = ['title', 'fields', 'measurements', 'steps', 'notes', 'materials', 'services', 'calculations'].filter(key => JSON.stringify(original[key]) !== JSON.stringify(after[key]));
    const event = this._diagnostic(original.id, 'vision', 'case.shadow', 'ok', 'Izračunata izolovana alternativa. Živi predmet nije promijenjen.', { changed: changed.join(', ') || 'none', writesToLive: 0 }, clock() - started);
    return { mode: 'SHADOW', before: original, after, changed, committed: false, event: clone(event) };
  }

  trace(caseId, operation, { pillar = 'vision', status = 'info', summary = 'Zabilježena lokalna operacija.', details = {} } = {}) {
    requireValue(this.getCase(caseId), 'Radni predmet ne postoji.', 'NOT_FOUND');
    requireValue(PILLARS.some(item => item.id === pillar), 'Nepoznat stub.');
    string(operation, 'Operacija', 80, false);
    string(summary, 'Sažetak', 300);
    requireValue(['ok', 'rejected', 'memory', 'info'].includes(status), 'Nepoznat status.');
    primitiveMap(details, 'Metapodaci', 300);
    // Caller is trusted application code; never dispatch or evaluate a trace as an instruction.
    return clone(this._diagnostic(caseId, pillar, operation, status, summary, details));
  }
  explain(caseId) {
    const record = this.getCase(caseId);
    requireValue(record, 'Radni predmet ne postoji.', 'NOT_FOUND');
    const events = [...record.events, ...this._diagnostics.filter(item => item.caseId === caseId).map(({ caseId: ignored, ...event }) => event)];
    const seen = new Set();
    return events.filter(event => !seen.has(event.id) && seen.add(event.id)).sort((a, b) => a.at.localeCompare(b.at)).slice(-MAX_EVENTS).map(clone);
  }
}
