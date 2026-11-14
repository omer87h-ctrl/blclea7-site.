/* Original CLEA Auto bounded, read-only time-series acquisition.
 * All measurements are decoded from retained ELM bytes; no connection, retry,
 * health score, invented sample or background polling is supplied here. */
import { OBDBridge, READ_COMMANDS, parseELMResponse, claimOBDAcquisition } from './diagnostics.js';
import { validateAutoReport } from './auto-vault.js';

export const AUTO_SERIES_FORMAT = 'blclea.auto-series/1';
export const AUTO_SERIES_VAULT_FORMAT = 'blclea.auto-series-vault/1';
export const AUTO_SERIES_VAULT_KEY = 'blclea.tools.auto-series.v1';
export const AUTO_SERIES_COMMANDS = Object.freeze(READ_COMMANDS.filter(command => /^01[0-9A-F]{2}$/.test(command) && !['0100', '0120', '0140', '0101'].includes(command)));
const ALLOWED = new Set(AUTO_SERIES_COMMANDS), ACTIVE = new WeakSet();
const RECORD_BYTES = 1024 * 1024, VAULT_BYTES = RECORD_BYTES * 2, MAX_RECORDS = 10;
const BAD = new Set(['__proto__', 'prototype', 'constructor']);
const copy = value => JSON.parse(JSON.stringify(value));
const bytes = value => new TextEncoder().encode(value).length;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function ensure(ok, message, code = 'AUTO_SERIES') { if (!ok) throw Object.assign(new Error(message), { code }); }
function inspect(root, limit = RECORD_BYTES) {
  const active = new WeakSet(), stack = [{ value: root, depth: 0 }]; let nodes = 0;
  while (stack.length) {
    const { value, depth, leave } = stack.pop();
    if (leave) { active.delete(value); continue; }
    ensure(++nodes <= 160000 && depth <= 26, 'Zapis snimanja je previše složen.');
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'string') { ensure(value.length <= 32768, 'Tekst snimanja je predug.'); continue; }
    if (typeof value === 'number') { ensure(Number.isFinite(value), 'Snimanje sadrži neispravan broj.'); continue; }
    ensure(Array.isArray(value) ? Object.getPrototypeOf(value) === Array.prototype : plain(value), 'Snimanje prihvata samo obične JSON podatke.');
    ensure(!active.has(value), 'Kružne reference nisu dozvoljene.'); active.add(value); stack.push({ value, leave: true });
    const names = Reflect.ownKeys(value); ensure(names.length <= 4096, 'Snimanje sadrži previše polja.');
    if (Array.isArray(value)) ensure(names.length === value.length + 1 && value.length <= 4095, 'Niz snimanja mora biti potpun.');
    for (const name of names) {
      ensure(typeof name === 'string' && !BAD.has(name), 'Nedozvoljeno ime polja snimanja.');
      const p = Object.getOwnPropertyDescriptor(value, name); ensure(p && Object.hasOwn(p, 'value'), 'Izvršni pristupnici nisu dozvoljeni.');
      if (Array.isArray(value) && name === 'length') continue;
      ensure(p.enumerable, 'Skrivena polja nisu dozvoljena.');
      if (Array.isArray(value)) ensure(/^(0|[1-9][0-9]*)$/.test(name) && Number(name) < value.length, 'Niz sadrži dodatna polja.');
      stack.push({ value: p.value, depth: depth + 1 });
    }
  }
  ensure(bytes(JSON.stringify(root)) <= limit, limit === RECORD_BYTES ? 'Snimanje premašuje 1 MiB.' : 'Biblioteka snimanja premašuje 2 MiB.');
}
function keys(value, required, optional = []) { ensure(plain(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key)), 'Snimanje ima nedostajuća ili nepodržana polja.'); }
function identifier(value) { ensure(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(value) && !BAD.has(value), 'Neispravna oznaka snimanja.'); return value; }
function iso(value) { ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'Neispravno vrijeme snimanja.'); return Date.parse(value); }
function equal(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const names = Object.keys(a); return names.length === Object.keys(b).length && names.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]));
}
function settings(value) {
  keys(value, ['commands', 'intervalMs', 'maxCycles', 'maxDurationMs']);
  ensure(Array.isArray(value.commands) && value.commands.length >= 1 && value.commands.length <= 3 && new Set(value.commands).size === value.commands.length && value.commands.every(command => ALLOWED.has(command)), 'Snimanje bira 1–3 različita podržana mjerna PID-a.');
  ensure(Number.isInteger(value.intervalMs) && value.intervalMs >= 1000 && value.intervalMs <= 30000, 'Razmak ciklusa mora biti između 1000 i 30000 ms.');
  ensure(Number.isInteger(value.maxCycles) && value.maxCycles >= 1 && value.maxCycles <= 30, 'Snimanje dopušta najviše 30 ciklusa.');
  ensure(Number.isInteger(value.maxDurationMs) && value.maxDurationMs >= 1000 && value.maxDurationMs <= 120000, 'Vremenska granica snimanja mora biti između 1 i 120 sekundi.');
}
function metadata(capabilities, device, command) {
  // Reuse the complete canonical capability/device validator. This internal
  // envelope explicitly contains NO measurement; it is never returned or saved.
  validateAutoReport({ format: 'blclea.auto-report/1', id: 'series-metadata-validation', createdAt: capabilities.completedAt, device,
    capabilities, readings: { format: 'blclea.obd-measurements/1', startedAt: capabilities.completedAt, completedAt: capabilities.completedAt,
      readings: [{ command, status: 'not-run', reason: 'Mjerenje nije dio provjere metapodataka.' }], measurements: [], limitations: [] },
    symptom: 'general', context: { engineState: 'unknown' }, origin: 'live', testOnly: false });
  return new Set(capabilities.discovery.supportedPids);
}
const freshId = () => { ensure(typeof globalThis.crypto?.randomUUID === 'function', 'Sigurno generisanje oznake nije dostupno.'); return globalThis.crypto.randomUUID(); };
const time = now => { const at = now(); ensure(Number.isFinite(at) && at >= 0 && Number.isFinite(new Date(at).getTime()), 'Sistemski sat nije valjan.'); return at; };
const abortFailure = () => Object.assign(new Error('Snimanje je zaustavljeno.'), { name: 'AbortError' });
function delay(ms, signal) {
  if (signal.aborted) return Promise.reject(abortFailure());
  return new Promise((resolve, reject) => {
    const done = () => { signal.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(done, ms);
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(abortFailure()); };
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Re-decode every retained sample, including unavailable/failed raw replies.
 * Imported evidence remains a claim from its source, not hardware attestation. */
export function validateAutoSeriesRecord(input, { now = Date.now } = {}) {
  inspect(input); ensure(typeof now === 'function', 'Neispravan sat provjere snimanja.');
  keys(input, ['format', 'id', 'createdAt', 'device', 'capabilities', 'settings', 'startedAt', 'completedAt', 'samples', 'completion', 'origin', 'testOnly']);
  ensure(input.format === AUTO_SERIES_FORMAT, 'Nepodržan format snimanja.'); identifier(input.id); settings(input.settings);
  const started = iso(input.startedAt), completed = iso(input.completedAt), created = iso(input.createdAt), current = time(now);
  ensure(started <= completed && completed <= created && created <= current + 1000, 'Vremena snimanja su obrnuta ili su u budućnosti.');
  const supported = metadata(input.capabilities, input.device, input.settings.commands[0]);
  ensure(iso(input.capabilities.completedAt) <= started, 'Mapa mogućnosti mora prethoditi snimanju.');
  ensure(input.settings.commands.every(command => supported.has(command)), 'Odabrani PID nema potvrđenu podršku u izvornoj mapi.');
  ensure(['live', 'imported'].includes(input.origin) && typeof input.testOnly === 'boolean', 'Neispravno porijeklo snimanja.');
  ensure(Array.isArray(input.samples) && input.samples.length <= input.settings.maxCycles * input.settings.commands.length, 'Snimanje sadrži previše uzoraka.');
  let previous = started;
  input.samples.forEach((sample, index) => {
    keys(sample, ['cycle', 'command', 'capturedAt', 'status'], ['values', 'evidence', 'reason']);
    ensure(sample.cycle === Math.floor(index / input.settings.commands.length) && sample.command === input.settings.commands[index % input.settings.commands.length], 'Uzorci nemaju potvrđen redoslijed ciklusa i komandi.');
    const at = iso(sample.capturedAt);
    ensure(at >= previous && at <= completed && at - started <= input.settings.maxDurationMs, 'Uzorak je izvan intervala snimanja.'); previous = at;
    ensure(['available', 'unavailable', 'failed'].includes(sample.status), 'Nepodržan status uzorka.');
    let parsed;
    if (sample.evidence !== undefined) {
      const e = sample.evidence; keys(e, ['command', 'capturedAt', 'source', 'raw', 'notes']);
      ensure(e.command === sample.command && e.capturedAt === sample.capturedAt && ['obd-ble', 'obd-serial'].includes(e.source) && typeof e.raw === 'string' && e.raw.length <= 8192, 'Uzorak nema odgovarajuće porijeklo i vrijeme.');
      parsed = parseELMResponse(sample.command, e.raw);
      ensure(parsed.raw === e.raw && equal(parsed.notes, e.notes), 'Izvorni odgovor ili njegove napomene nisu valjani.');
    }
    if (sample.status === 'available') ensure(parsed?.ok && equal(sample.values, parsed.values) && !Object.hasOwn(sample, 'reason'), 'Vrijednost ili jedinica ne odgovara izvornim bajtovima.');
    else {
      ensure(!Object.hasOwn(sample, 'values') && typeof sample.reason === 'string' && sample.reason.trim().length > 0 && sample.reason.length <= 600, 'Neuspješan uzorak mora sačuvati razlog bez zamjenske vrijednosti.');
      if (sample.status === 'unavailable') ensure(parsed && !parsed.ok && /(?:^|[\r\n>])\s*NO DATA\s*(?:[\r\n>]|$)/i.test(sample.evidence.raw), 'Nedostupan uzorak nema stvarni NO DATA odgovor.');
      if (parsed) {
        ensure(!parsed.ok, 'Valjan odgovor ne smije biti prikazan kao greška.');
        ensure(sample.reason === (parsed.errors.join(' ') || 'Odgovor nije valjan.').slice(0, 600), 'Razlog greške nije usklađen s izvornim odgovorom.');
      }
    }
  });
  keys(input.completion, ['reason', 'cyclesCompleted']);
  ensure(['completed', 'cancelled', 'timeout', 'disconnected'].includes(input.completion.reason) && input.completion.cyclesCompleted === Math.floor(input.samples.length / input.settings.commands.length), 'Završetak snimanja nije dosljedan.');
  if (input.completion.reason === 'completed') ensure(input.samples.length === input.settings.maxCycles * input.settings.commands.length && completed - started <= input.settings.maxDurationMs, 'Nepotpuno snimanje nije završeno uspješno.');
  if (input.completion.reason === 'timeout') ensure(completed - started >= input.settings.maxDurationMs, 'Istek vremena nije potvrđen vremenom snimanja.');
  return copy(input);
}

/** One explicit finite run on the caller's already-connected, inventoried bridge. */
export async function recordAutoSeries(bridge, { capabilities, device, commands, signal, intervalMs = 1000, maxCycles = 10, maxDurationMs = 60000, onSample, now = Date.now, wait = delay, id = freshId, testOnly = false } = {}) {
  ensure(bridge instanceof OBDBridge && bridge.connected && bridge.state === 'ready', 'Prvo povežite i provjerite CLEA ELM adapter.');
  ensure(!bridge._pending && !bridge._queued && !ACTIVE.has(bridge), 'Drugo očitanje je u toku.');
  ensure(signal == null || signal instanceof AbortSignal, 'Neispravan signal zaustavljanja.');
  ensure(typeof now === 'function' && typeof wait === 'function' && typeof id === 'function' && (onSample == null || typeof onSample === 'function') && typeof testOnly === 'boolean', 'Neispravne postavke snimanja.');
  const configured = { commands, intervalMs, maxCycles, maxDurationMs }; inspect(configured); settings(configured);
  inspect({ capabilities, device });
  keys(device, ['name', 'profile', 'profileId'], ['source', 'reportedVersion', 'versionReply']);
  if (device.source !== undefined) ensure(['obd-ble', 'obd-serial'].includes(device.source), 'Nepoznato porijeklo veze.');
  const selected = copy(configured), cap = copy(capabilities), dev = Object.fromEntries(Object.entries(copy(device)).filter(([key]) => key !== 'source')), supported = metadata(cap, dev, selected.commands[0]);
  ensure(selected.commands.every(command => supported.has(command)), 'Odabrani PID nije prijavljen u izvornoj mapi mogućnosti.');
  const started = time(now); ensure(iso(cap.completedAt) <= started, 'Mapa mogućnosti mora prethoditi snimanju.');
  const record = { format: AUTO_SERIES_FORMAT, id: identifier(id()), createdAt: new Date(started).toISOString(), device: dev, capabilities: cap, settings: selected,
    startedAt: new Date(started).toISOString(), completedAt: new Date(started).toISOString(), samples: [], completion: { reason: 'completed', cyclesCompleted: 0 }, origin: 'live', testOnly };
  const controller = new AbortController(); let reason = signal?.aborted ? 'cancelled' : null, last = started;
  const stop = kind => { if (!reason) reason = kind; controller.abort(); bridge.disconnect(); };
  const abort = () => stop('cancelled');
  const check = () => {
    const at = time(now); ensure(at >= last, 'Sistemski sat se pomjerio unazad; snimanje nije izmijenjeno.'); last = at;
    if (!reason && at - started >= maxDurationMs) stop('timeout');
    if (!reason && (!bridge.connected || bridge.state !== 'ready')) stop('disconnected');
    return !reason;
  };
  const release = claimOBDAcquisition(bridge);
  ACTIVE.add(bridge); signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => stop('timeout'), maxDurationMs);
  try {
    if (signal?.aborted) stop('cancelled');
    outer: for (let cycle = 0; cycle < maxCycles; cycle++) {
      if (!check()) break;
      for (const command of selected.commands) {
        if (!check()) break outer;
        let sample;
        try {
          const actual = await bridge.read(command);
          if (!check()) break outer;
          const parsed = parseELMResponse(command, actual.raw), captured = iso(actual.capturedAt);
          ensure(captured >= started && captured >= (record.samples.at(-1) ? iso(record.samples.at(-1).capturedAt) : started) && captured <= time(now) && captured - started <= maxDurationMs && ['obd-ble', 'obd-serial'].includes(actual.source) && parsed.raw === actual.raw, 'Odgovor nema valjano vrijeme ili porijeklo.');
          const evidence = { command, capturedAt: actual.capturedAt, source: actual.source, raw: parsed.raw, notes: [...parsed.notes] };
          sample = { cycle, command, capturedAt: actual.capturedAt, status: parsed.ok ? 'available' : /(?:^|[\r\n>])\s*NO DATA\s*(?:[\r\n>]|$)/i.test(parsed.raw) ? 'unavailable' : 'failed',
            ...(parsed.ok ? { values: copy(parsed.values) } : { reason: (parsed.errors.join(' ') || 'Odgovor nije valjan.').slice(0, 600) }), evidence };
        } catch (error) {
          if (reason) break outer;
          const at = time(now); if (at - started >= maxDurationMs) { stop('timeout'); break outer; }
          sample = { cycle, command, capturedAt: new Date(at).toISOString(), status: 'failed', reason: String(error?.message || 'Očitanje nije uspjelo.').slice(0, 600) };
        }
        record.samples.push(sample); record.completion.cyclesCompleted = Math.floor(record.samples.length / selected.commands.length);
        try { onSample?.(copy(sample)); } catch { /* Observers cannot change acquisition or retained evidence. */ }
        if (!check()) break outer;
      }
      if (cycle + 1 < maxCycles && !reason) {
        const remaining = maxDurationMs - (time(now) - started);
        try { await wait(Math.min(intervalMs, Math.max(0, remaining)), controller.signal); } catch (error) { if (!reason) throw error; }
      }
    }
    const completed = time(now); ensure(completed >= last, 'Sistemski sat se pomjerio unazad.');
    record.completedAt = new Date(completed).toISOString(); record.createdAt = record.completedAt;
    record.completion.reason = reason || 'completed';
    return validateAutoSeriesRecord(record, { now });
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); ACTIVE.delete(bridge); release(); }
}

function parse(raw, limit) {
  ensure(typeof raw === 'string' && bytes(raw) <= limit, 'Datoteka snimanja je prevelika.');
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Datoteka snimanja nije ispravan JSON.'), { code: 'AUTO_SERIES' }); }
}

/** Explicit local persistence. Conflicts/corruption preserve old disk content;
 * newly saved valid records remain exportable in RAM if storage fails. */
export class AutoSeriesVault {
  constructor({ storage, key = AUTO_SERIES_VAULT_KEY, id = freshId, now = Date.now } = {}) {
    identifier(key); ensure(typeof id === 'function' && typeof now === 'function', 'Neispravna biblioteka snimanja.');
    this.key = key; this.id = id; this.now = now; this.records = []; this.raw = null; this.blockWrites = false; this.available = true; this.reason = 'ready'; this.message = 'Snimanja se čuvaju lokalno samo nakon vaše radnje.';
    if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } } this.storage = storage;
    try {
      if (!storage || typeof storage.getItem !== 'function') throw Error('storage');
      this.raw = storage.getItem(key); ensure(this.raw === null || typeof this.raw === 'string', 'Neispravno spremište.');
      if (this.raw !== null) { const value = parse(this.raw, VAULT_BYTES); inspect(value, VAULT_BYTES); keys(value, ['format', 'records']); ensure(value.format === AUTO_SERIES_VAULT_FORMAT, 'Nepodržana biblioteka.'); this.records = this.validateRecords(value.records); }
    } catch { this.unavailable('Biblioteka nije dostupna ili nije valjana. Postojeći sadržaj nije prepisan; novi zapisi ostaju u memoriji i mogu se izvesti.', 'load-failed'); return; }
    try { if (typeof storage.setItem !== 'function') this.unavailable('Spremište je samo za čitanje. Novi zapisi ostaju u memoriji.', 'read-only'); } catch { this.unavailable('Spremište je samo za čitanje. Novi zapisi ostaju u memoriji.', 'read-only'); }
  }
  unavailable(message, reason) { this.available = false; this.blockWrites = true; this.reason = reason; this.message = message; }
  getPersistenceStatus() { return { available: this.available, reason: this.reason, message: this.message }; }
  list() { return copy(this.records); }
  validateRecords(records) {
    ensure(Array.isArray(records) && records.length <= MAX_RECORDS, 'Biblioteka dopušta najviše 10 snimanja.'); const ids = new Set();
    return records.map(record => { const valid = validateAutoSeriesRecord(record, { now: this.now }); ensure(!ids.has(valid.id), 'Oznaka snimanja se ponavlja.'); ids.add(valid.id); return valid; });
  }
  persist(records) {
    const next = this.validateRecords(records), raw = JSON.stringify({ format: AUTO_SERIES_VAULT_FORMAT, records: next }); ensure(bytes(raw) <= VAULT_BYTES, 'Biblioteka snimanja premašuje 2 MiB. Izvezite i uklonite starije zapise.');
    if (!this.blockWrites) { try { ensure(this.storage.getItem(this.key) === this.raw, 'Biblioteka je izmijenjena u drugoj kartici. Izmjene ostaju u memoriji.', 'AUTO_SERIES_STALE'); this.storage.setItem(this.key, raw); this.raw = raw; this.message = 'Snimanje je sačuvano lokalno.'; } catch (error) { this.unavailable(error?.code === 'AUTO_SERIES_STALE' ? error.message : 'Spremanje nije uspjelo. Snimanje ostaje u memoriji; izvezite ga prije zatvaranja.', error?.code === 'AUTO_SERIES_STALE' ? 'stale-storage' : 'write-failed'); } }
    this.records = next;
  }
  save(input) { const record = validateAutoSeriesRecord(input, { now: this.now }); this.persist([record, ...this.records.filter(item => item.id !== record.id)]); return copy(record); }
  remove(id) { identifier(id); if (!this.records.some(item => item.id === id)) return false; this.persist(this.records.filter(item => item.id !== id)); return true; }
  export(id) { identifier(id); const record = this.records.find(item => item.id === id); ensure(record, 'Snimanje nije pronađeno.'); return JSON.stringify(validateAutoSeriesRecord(record, { now: this.now })); }
  import(raw) { const record = validateAutoSeriesRecord(parse(raw, RECORD_BYTES), { now: this.now }), id = identifier(this.id()); ensure(id !== record.id && !this.records.some(item => item.id === id), 'Uvoz mora dobiti novu nezavisnu oznaku.'); return this.save({ ...record, id, origin: 'imported' }); }
}
