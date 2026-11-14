/* Original, browser-local Auto evidence records. Validation decodes recorded
 * replies only; loading and importing never connect to or command a vehicle. */
import { assessAutoEvidence, parseELMResponse, decodeDTC, READ_COMMANDS } from './diagnostics.js';

export const AUTO_REPORT_FORMAT = 'blclea.auto-report/1';
export const AUTO_VAULT_FORMAT = 'blclea.auto-vault/1';
export const AUTO_VAULT_KEY = 'blclea.tools.auto.v1';
export const AUTO_SYMPTOMS = Object.freeze(['general', 'rough-running', 'starting', 'power-loss']);
const REPORT_BYTES = 1024 * 1024, VAULT_BYTES = 2 * REPORT_BYTES, MAX_RECORDS = 20;
const BAD = new Set(['__proto__', 'prototype', 'constructor']);
const MEASUREMENT_COMMANDS = new Set(READ_COMMANDS.filter(c => /^01/.test(c) && !['0100', '0120', '0140', '0101'].includes(c)));
const copy = value => JSON.parse(JSON.stringify(value));
const bytes = value => new TextEncoder().encode(value).length;
function ensure(condition, message, code = 'AUTO_REPORT') {
  if (condition) return;
  const error = new Error(message); error.code = code; throw error;
}
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function inspect(root, limit = REPORT_BYTES) {
  const active = new WeakSet(), stack = [{ value: root, depth: 0 }]; let nodes = 0;
  while (stack.length) {
    const { value, depth, leave } = stack.pop();
    if (leave) { active.delete(value); continue; }
    ensure(++nodes <= 160000 && depth <= 24, 'Auto zapis je previše složen.');
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'string') { ensure(value.length <= 32768, 'Tekst Auto zapisa je predug.'); continue; }
    if (typeof value === 'number') { ensure(Number.isFinite(value), 'Auto zapis sadrži neispravan broj.'); continue; }
    ensure(Array.isArray(value) ? Object.getPrototypeOf(value) === Array.prototype : plain(value), 'Dozvoljeni su samo obični JSON podaci.');
    ensure(!active.has(value), 'Kružne reference nisu dozvoljene.'); active.add(value); stack.push({ value, leave: true });
    const names = Reflect.ownKeys(value);
    ensure(names.length <= 4096, 'Auto zapis sadrži previše polja.');
    if (Array.isArray(value)) ensure(names.length === value.length + 1 && value.length <= 4095, 'Niz mora biti potpun i bez dodatnih polja.');
    for (const name of names) {
      ensure(typeof name === 'string' && !BAD.has(name), 'Opasno ime polja nije dozvoljeno.');
      const property = Object.getOwnPropertyDescriptor(value, name);
      ensure(property && Object.hasOwn(property, 'value'), 'Izvršni pristupnici nisu dozvoljeni.');
      if (Array.isArray(value) && name === 'length') continue;
      ensure(property.enumerable, 'Skrivena polja nisu dozvoljena.');
      if (Array.isArray(value)) ensure(/^(0|[1-9][0-9]*)$/.test(name) && Number(name) < value.length, 'Niz sadrži dodatna polja.');
      stack.push({ value: property.value, depth: depth + 1 });
    }
  }
  ensure(bytes(JSON.stringify(root)) <= limit, limit === REPORT_BYTES ? 'Auto nalaz premašuje 1 MiB.' : 'Auto biblioteka premašuje 2 MiB.');
}
function keys(value, required, optional = []) {
  ensure(plain(value) && required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => required.includes(k) || optional.includes(k)), 'Auto zapis ima nepodržana ili nedostajuća polja.');
}
function text(value, max = 600) { ensure(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'Neispravan tekst Auto zapisa.'); }
function identifier(value) { ensure(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(value) && !BAD.has(value), 'Neispravna oznaka Auto zapisa.'); return value; }
function iso(value) { ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'Neispravno ISO vrijeme Auto zapisa.'); }
function equal(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const names = Object.keys(a); return names.length === Object.keys(b).length && names.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
function labels(value) { ensure(Array.isArray(value) && value.length <= 16 && value.every(v => typeof v === 'string' && v.length <= 600), 'Neispravne napomene Auto zapisa.'); }
function scanHeader(value, format, fields) {
  keys(value, ['format', 'startedAt', 'completedAt', ...fields, 'limitations']);
  ensure(value.format === format, 'Nepodržan format OBD pregleda.'); iso(value.startedAt); iso(value.completedAt);
  ensure(value.startedAt <= value.completedAt, 'Završetak OBD pregleda prethodi početku.'); labels(value.limitations);
  return [value.startedAt, value.completedAt];
}
function evidence(value, command, within = null) {
  keys(value, ['command', 'capturedAt', 'source', 'raw', 'notes']);
  ensure(value.command === command && ['obd-ble', 'obd-serial'].includes(value.source), 'Odgovor nema odgovarajuću naredbu ili porijeklo.');
  iso(value.capturedAt); ensure(typeof value.raw === 'string' && value.raw.length <= 8192, 'Izvorni OBD odgovor je predug.'); labels(value.notes);
  if (within) ensure(value.capturedAt >= within[0] && value.capturedAt <= within[1], 'Auto dokaz je izvan intervala svog pregleda.');
  const parsed = parseELMResponse(command, value.raw);
  ensure(parsed.raw === value.raw, 'Izvorni odgovor sadrži nedozvoljene znakove.');
  ensure(equal(value.notes, parsed.notes), 'Napomene nisu usklađene s izvornim odgovorom.');
  return parsed;
}
function failure(value, command, statuses, prefix = [], within = null) {
  keys(value, [...prefix, 'status', 'reason'], ['evidence']);
  ensure(statuses.includes(value.status), 'Nepodržan status OBD očitanja.'); text(value.reason);
  if (value.evidence !== undefined) {
    ensure(['unavailable', 'failed'].includes(value.status), 'Neizvršena provjera ne smije sadržavati odgovor.');
    const parsed = evidence(value.evidence, command, within);
    if (value.status === 'unavailable') ensure(!parsed.ok && /(?:^|[\r\n>])\s*NO DATA\s*(?:[\r\n>]|$)/i.test(value.evidence.raw), 'Nedostupno očitanje nema odgovor NO DATA.');
    if (value.status === 'failed' && parsed.ok) {
      let ambiguous = false;
      if (['03', '07', '0A'].includes(command)) { try { decodeDTC(value.evidence.raw, command, { singleModule: true }); } catch { ambiguous = true; } }
      ensure(ambiguous, 'Neuspješno očitanje sadrži valjan odgovor.');
    }
  }
}
function validateCapabilities(value) {
  const within = scanHeader(value, 'blclea.obd-capabilities/1', ['discovery', 'monitor', 'dtcs']);
  const d = value.discovery; keys(d, ['status', 'ranges', 'supportedPids', 'supportedReadablePids', 'complete'], ['reason']);
  ensure(Array.isArray(d.ranges) && d.ranges.length >= 1 && d.ranges.length <= 3, 'Neispravan broj mapa mogućnosti.');
  const rangeCommands = ['0100', '0120', '0140'], supported = new Set(); let failed = null;
  d.ranges.forEach((range, index) => {
    const command = rangeCommands[index];
    ensure(!failed && range.command === command && (index === 0 || supported.has(command)), 'Mape PID-ova nemaju potvrđen slijed.');
    if (range.status === 'available') {
      keys(range, ['status', 'command', 'capturedAt', 'source', 'raw', 'notes', 'supportedPids']);
      const parsed = evidence(Object.fromEntries(['command', 'capturedAt', 'source', 'raw', 'notes'].map(k => [k, range[k]])), command, within);
      ensure(parsed.ok && Array.isArray(parsed.supportedPids) && equal(range.supportedPids, parsed.supportedPids), 'Mapa nije usklađena s izvornim OBD odgovorom.');
      parsed.supportedPids.forEach(pid => supported.add(pid));
      if (index < 2 && parsed.supportedPids.includes(rangeCommands[index + 1])) ensure(index + 1 < d.ranges.length, 'Najavljena mapa PID-ova nije očitana.');
      else ensure(index === d.ranges.length - 1, 'Dodatna mapa PID-ova nije bila najavljena.');
    } else { failure(range, command, ['unavailable', 'failed', 'not-run'], ['command'], within); failed = range; }
  });
  const pids = [...supported].sort();
  ensure(equal(d.supportedPids, pids) && equal(d.supportedReadablePids, pids.filter(pid => MEASUREMENT_COMMANDS.has(pid))) &&
    d.complete === !failed && d.status === (failed?.status || 'available') && (failed ? d.reason === failed.reason : !Object.hasOwn(d, 'reason')), 'Sažetak mape PID-ova nije dosljedan.');
  const m = value.monitor;
  if (m.status === 'available') {
    keys(m, ['status', 'data', 'evidence']); const parsed = evidence(m.evidence, '0101', within);
    ensure(!failed && supported.has('0101') && parsed.ok && equal(m.data, parsed.monitor), 'Status monitora nije usklađen s izvornim odgovorom.');
  } else {
    failure(m, '0101', ['unsupported', 'not-run', 'unavailable', 'failed'], [], within);
    ensure(failed ? m.status === 'not-run' : supported.has('0101') ? m.status !== 'unsupported' : m.status === 'unsupported', 'Status monitora ne odgovara potvrđenoj mapi.');
  }
  keys(value.dtcs, ['stored', 'pending', 'permanent']);
  for (const [category, command] of [['stored', '03'], ['pending', '07'], ['permanent', '0A']]) {
    const item = value.dtcs[category];
    if (item.status === 'available') {
      keys(item, ['status', 'codes', 'evidence']); const parsed = evidence(item.evidence, command, within);
      ensure(parsed.ok && equal(item.codes, decodeDTC(item.evidence.raw, command, { singleModule: true })), 'Kodovi nisu usklađeni s izvornim odgovorom.');
    } else failure(item, command, ['unavailable', 'failed', 'not-run'], [], within);
  }
  return supported;
}
function validateReadings(value, supported) {
  const within = scanHeader(value, 'blclea.obd-measurements/1', ['readings', 'measurements']);
  ensure(Array.isArray(value.readings) && value.readings.length >= 1 && value.readings.length <= 9 && Array.isArray(value.measurements), 'Neispravan broj mjernih očitanja.');
  const commands = new Set(), measurements = [];
  for (const item of value.readings) {
    ensure(MEASUREMENT_COMMANDS.has(item.command) && !commands.has(item.command), 'Mjerni kanal nije dozvoljen ili se ponavlja.'); commands.add(item.command);
    ensure(supported.has(item.command) ? item.status !== 'unsupported' : item.status === 'unsupported', 'Status mjerenja ne odgovara potvrđenoj mapi.');
    if (item.status === 'available') {
      keys(item, ['command', 'status', 'values', 'evidence']); const parsed = evidence(item.evidence, item.command, within);
      ensure(parsed.ok && parsed.values.length >= 1 && parsed.values.length <= 2 && equal(item.values, parsed.values), 'Mjerenje nije usklađeno s izvornim odgovorom ili jedinicom.');
      for (const row of parsed.values) measurements.push({ ...row, command: item.command, capturedAt: item.evidence.capturedAt, source: item.evidence.source, raw: item.evidence.raw });
    } else failure(item, item.command, ['unsupported', 'not-run', 'unavailable', 'failed'], ['command'], within);
  }
  ensure(equal(value.measurements, measurements), 'Lista mjerenja nije jednaka potvrđenim odgovorima.');
}
export function validateAutoReport(input) {
  inspect(input); keys(input, ['format', 'id', 'createdAt', 'device', 'capabilities', 'readings', 'symptom', 'context', 'origin', 'testOnly']);
  ensure(input.format === AUTO_REPORT_FORMAT, 'Nepodržan format Auto nalaza.'); identifier(input.id); iso(input.createdAt);
  keys(input.device, ['name', 'profile', 'profileId'], ['reportedVersion','versionReply']); text(input.device.name, 240); text(input.device.profile, 240); identifier(input.device.profileId);
  if(input.device.reportedVersion!==undefined||input.device.versionReply!==undefined){text(input.device.reportedVersion,240);ensure(typeof input.device.versionReply==='string'&&input.device.versionReply.length<=8192,'Neispravan izvor verzije adaptera.');const parsed=parseELMResponse('ATZ',input.device.versionReply);ensure(parsed.ok&&parsed.raw===input.device.versionReply&&parsed.notes.join(' · ').slice(0,240)===input.device.reportedVersion,'Verzija adaptera nije usklađena s izvornim odgovorom.');}
  ensure(AUTO_SYMPTOMS.includes(input.symptom) && ['live', 'imported'].includes(input.origin) && typeof input.testOnly === 'boolean', 'Neispravan kontekst ili porijeklo Auto nalaza.');
  keys(input.context, ['engineState'], ['comparableConditions']); ensure(['unknown', 'off', 'running'].includes(input.context.engineState), 'Nepoznato radno stanje motora.');
  if(input.context.comparableConditions!==undefined)ensure(typeof input.context.comparableConditions==='boolean','Uslovi moraju biti izričita logička potvrda.');
  validateReadings(input.readings, validateCapabilities(input.capabilities));
  // This validates raw measurement values/units and the assessment inventory;
  // it does not attest the physical vehicle, adapter or imported provenance.
  assessAutoEvidence({ measurements: input.readings.measurements, dtcs: input.capabilities.dtcs, monitor: input.capabilities.monitor });
  return copy(input);
}
const freshId = () => { ensure(typeof globalThis.crypto?.randomUUID === 'function', 'Sigurno generisanje oznake nije dostupno.'); return globalThis.crypto.randomUUID(); };
export function createAutoReport(input, { id = freshId, now = Date.now } = {}) {
  inspect(input); keys(input, ['device', 'capabilities', 'readings', 'symptom', 'context'], ['origin', 'testOnly']);
  ensure(typeof id === 'function' && typeof now === 'function', 'Neispravna tvornica Auto nalaza.');
  return validateAutoReport({ format: AUTO_REPORT_FORMAT, id: id(), createdAt: new Date(now()).toISOString(), ...copy(input), origin: input.origin ?? 'live', testOnly: input.testOnly ?? false });
}
function parse(raw, limit) {
  ensure(typeof raw === 'string' && bytes(raw) <= limit, limit === REPORT_BYTES ? 'Auto nalaz premašuje 1 MiB.' : 'Auto biblioteka premašuje 2 MiB.');
  let value; try { value = JSON.parse(raw); } catch { ensure(false, 'Auto datoteka nije ispravan JSON.'); }
  return value;
}

/** Local explicit persistence with recoverable RAM fallback. The stale check
 * is read/compare/write, not an atomic browser-wide transaction. */
export class AutoVault {
  constructor({ storage, key = AUTO_VAULT_KEY, id = freshId } = {}) {
    identifier(key); ensure(typeof id === 'function', 'Neispravna tvornica oznaka.'); this.id = id; this.key = key;
    this.records = []; this.raw = null; this.blockWrites = false; this.available = true; this.reason = 'ready';
    this.message = 'Auto nalazi se čuvaju lokalno samo nakon vaše radnje.';
    if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
    this.storage = storage;
    try {
      if (!storage || typeof storage.getItem !== 'function') { this.unavailable('Lokalno spremište nije dostupno. Nalazi ostaju u memoriji; izvezite ih prije zatvaranja.', 'no-storage'); return; }
      this.raw = storage.getItem(key); ensure(this.raw === null || typeof this.raw === 'string', 'Neispravno lokalno spremište.');
      if (this.raw !== null) {
        const stored = parse(this.raw, VAULT_BYTES); inspect(stored, VAULT_BYTES); keys(stored, ['format', 'records']);
        ensure(stored.format === AUTO_VAULT_FORMAT, 'Nepodržana Auto biblioteka.'); this.records = this.validateRecords(stored.records);
      }
    } catch { this.records = []; this.unavailable('Lokalna biblioteka nije dostupna ili nije valjana. Postojeći sadržaj nije prepisan; novi nalazi ostaju u memoriji i mogu se izvesti.', 'load-failed'); return; }
    let writable = false; try { writable = typeof storage.setItem === 'function'; } catch { /* Read-only storage. */ }
    if (!writable) this.unavailable('Biblioteka je samo za čitanje. Izmjene ostaju u memoriji i mogu se izvesti.', 'read-only');
  }
  unavailable(message, reason) { this.available = false; this.blockWrites = true; this.message = message; this.reason = reason; }
  getPersistenceStatus() { return { available: this.available, message: this.message, reason: this.reason }; }
  list() { return copy(this.records); }
  validateRecords(records) {
    ensure(Array.isArray(records) && records.length <= MAX_RECORDS, 'Biblioteka može sadržavati najviše 20 Auto nalaza.');
    const ids = new Set(); return records.map(record => { const valid = validateAutoReport(record); ensure(!ids.has(valid.id), 'Oznaka Auto nalaza se ponavlja.'); ids.add(valid.id); return valid; });
  }
  persist(records) {
    const next = this.validateRecords(records), serialized = JSON.stringify({ format: AUTO_VAULT_FORMAT, records: next });
    ensure(bytes(serialized) <= VAULT_BYTES, 'Auto biblioteka premašuje 2 MiB. Izvezite i uklonite starije nalaze.');
    if (!this.blockWrites) {
      try {
        ensure(this.storage.getItem(this.key) === this.raw, 'Biblioteka je promijenjena u drugoj kartici. Izmjene ostaju u memoriji; izvezite ih prije ponovnog učitavanja.', 'AUTO_STALE_STORAGE');
        this.storage.setItem(this.key, serialized); this.raw = serialized; this.message = 'Auto biblioteka je sačuvana u ovom pregledniku.';
      } catch (error) { this.unavailable(error?.code === 'AUTO_STALE_STORAGE' ? error.message : 'Spremanje nije uspjelo. Izmjene su samo u memoriji; izvezite ih prije zatvaranja.', error?.code === 'AUTO_STALE_STORAGE' ? 'stale-storage' : 'write-failed'); }
    } else this.message = 'Izmjene su samo u memoriji. Postojeći lokalni sadržaj nije prepisan; izvezite nalaz prije zatvaranja.';
    this.records = next;
  }
  save(input) { const report = validateAutoReport(input); this.persist([report, ...this.records.filter(r => r.id !== report.id)]); return copy(report); }
  remove(id) { identifier(id); if (!this.records.some(r => r.id === id)) return false; this.persist(this.records.filter(r => r.id !== id)); return true; }
  export(id) { identifier(id); const report = this.records.find(r => r.id === id); ensure(report, 'Auto nalaz nije pronađen.'); return JSON.stringify(validateAutoReport(report)); }
  import(raw) {
    const original = validateAutoReport(parse(raw, REPORT_BYTES)), id = identifier(this.id());
    ensure(id !== original.id && !this.records.some(r => r.id === id), 'Uvoz mora dobiti novu nezavisnu oznaku nalaza.');
    return this.save({ ...original, id, origin: 'imported' });
  }
}
