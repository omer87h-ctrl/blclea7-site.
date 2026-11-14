/* Original CLEA AUTO investigation planner. It orders bounded information
 * checks over recorded ELM replies; it does not diagnose a failed component,
 * access an adapter, execute commands, or apply guessed vehicle limits. */
import { assessAutoEvidence, parseELMResponse, decodeDTC, READ_COMMANDS } from './diagnostics.js';

export const AUTO_INVESTIGATION_FORMAT = 'blclea.auto-investigation/1';
const SYMPTOMS = new Set(['rough-running', 'power-loss', 'starting', 'general']);
const OUTCOMES = new Set(['available', 'unsupported', 'unavailable', 'failed', 'not-run', 'unknown']);
const CATEGORIES = [['stored', '03'], ['pending', '07'], ['permanent', '0A']];
const SOURCES = new Set(['obd-ble', 'obd-serial']);
const RANGE_COMMANDS = ['0100', '0120', '0140'];
const MEASUREMENT_COMMANDS = new Set(READ_COMMANDS.filter(command => /^01[0-9A-F]{2}$/.test(command) && ![...RANGE_COMMANDS, '0101'].includes(command)));
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
const fail = message => { const error = new Error(message); error.code = 'AUTO_INVESTIGATION_INPUT'; throw error; };
const ensure = (condition, message) => { if (!condition) fail(message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sorted = values => [...values].sort();
function cloneInput(input) {
  const active = new WeakSet(), stack = [{ value: input, depth: 0 }]; let count = 0;
  while (stack.length) {
    const { value, depth, leave } = stack.pop(); if (leave) { active.delete(value); continue; }
    ensure(++count <= 18000 && depth <= 20, 'AUTO podaci su previše složeni.');
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'number') { ensure(Number.isFinite(value) && Math.abs(value) <= 1e12, 'AUTO broj mora biti konačan.'); continue; }
    if (typeof value === 'string') { ensure(value.length <= 8192, 'AUTO tekst je predug.'); continue; }
    ensure(Array.isArray(value) ? Object.getPrototypeOf(value) === Array.prototype : plain(value), 'AUTO prihvata samo obične JSON podatke bez prilagođenog prototipa.');
    ensure(!active.has(value), 'Kružne reference nisu dozvoljene.'); active.add(value); stack.push({ value, leave: true });
    const names = Reflect.ownKeys(value); ensure(names.length <= 1025, 'Previše AUTO polja.');
    if (Array.isArray(value)) ensure(value.length <= 1024 && names.length === value.length + 1, 'AUTO niz mora biti potpun i bez dodatnih polja.');
    for (const key of names) {
      ensure(typeof key === 'string' && !BAD.has(key), 'Opasno ili simboličko AUTO polje.');
      const descriptor = Object.getOwnPropertyDescriptor(value, key); ensure(descriptor && Object.hasOwn(descriptor, 'value'), 'Izvršni pristupnici nisu dozvoljeni.');
      if (Array.isArray(value) && key === 'length') continue;
      ensure(descriptor.enumerable, 'Skrivena AUTO polja nisu dozvoljena.');
      if (Array.isArray(value)) ensure(/^(0|[1-9][0-9]*)$/.test(key) && Number(key) < value.length, 'Neispravno polje AUTO niza.');
      stack.push({ value: descriptor.value, depth: depth + 1 });
    }
  }
  const serialized = JSON.stringify(input); ensure(new TextEncoder().encode(serialized).length <= 262144, 'AUTO JSON premašuje 256 KiB.'); return JSON.parse(serialized);
}
function keys(value, allowed) { ensure(plain(value), 'Očekivan je AUTO objekat.'); for (const key of Object.keys(value)) ensure(allowed.includes(key), 'Nepodržano AUTO polje: ' + key + '.'); }
function text(value, max = 600) { ensure(typeof value === 'string' && value.length <= max, 'Neispravan AUTO tekst.'); }
function date(value) { ensure(typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)), 'Neispravno vrijeme AUTO dokaza.'); }
function stringList(value, max = 96) { ensure(Array.isArray(value) && value.length <= max && value.every(item => typeof item === 'string') && new Set(value).size === value.length, 'Neispravna ili ponovljena AUTO lista.'); }
function optionalTexts(value) { if (value === undefined) return; ensure(Array.isArray(value) && value.length <= 32, 'Previše opisa AUTO izvora.'); value.forEach(item => text(item, 8192)); }
function interval(value) {
  if (value.startedAt === undefined && value.completedAt === undefined) return null;
  date(value.startedAt); date(value.completedAt); ensure(Date.parse(value.completedAt) >= Date.parse(value.startedAt), 'AUTO interval je obrnut.'); return [Date.parse(value.startedAt), Date.parse(value.completedAt)];
}
function evidence(value, command, within = null) {
  keys(value, ['command', 'capturedAt', 'source', 'raw', 'notes']); ensure(value.command === command && READ_COMMANDS.includes(command), 'Naredba AUTO dokaza se ne slaže.');
  date(value.capturedAt); ensure(SOURCES.has(value.source), 'Nedostaje podržano porijeklo AUTO dokaza.'); text(value.raw, 8192); optionalTexts(value.notes);
  if (within) ensure(Date.parse(value.capturedAt) >= within[0] && Date.parse(value.capturedAt) <= within[1], 'AUTO dokaz je izvan intervala svog zapisa.');
  return { command, capturedAt: value.capturedAt, source: value.source, raw: value.raw };
}
function outcome(value, allowed) { keys(value, allowed); ensure(OUTCOMES.has(value.status), 'Nepoznat ishod AUTO očitanja.'); if (value.reason !== undefined) text(value.reason); }
function discoveryOf(value, within) {
  if (value === undefined || value === null) return { present: false, supported: new Set(), refs: [], complete: false };
  keys(value, ['status', 'ranges', 'supportedPids', 'supportedReadablePids', 'complete', 'reason']); ensure(OUTCOMES.has(value.status) && typeof value.complete === 'boolean', 'Neispravan status mape PID-ova.');
  if (value.reason !== undefined) text(value.reason); ensure(Array.isArray(value.ranges) && value.ranges.length > 0 && value.ranges.length <= 3, 'Mapa mora sadržavati 1–3 izvorna raspona.');
  stringList(value.supportedPids); stringList(value.supportedReadablePids);
  const supported = new Set(), refs = []; let expected = '0100', failed = false;
  for (const range of value.ranges) {
    ensure(expected !== null && range.command === expected && !failed, 'Rasponi PID-ova nemaju potvrđen slijed nastavka.');
    if (range.status === 'available') {
      keys(range, ['command', 'status', 'capturedAt', 'source', 'raw', 'notes', 'supportedPids']);
      const ref = evidence(Object.fromEntries(['command', 'capturedAt', 'source', 'raw', 'notes'].filter(key => range[key] !== undefined).map(key => [key, range[key]])), range.command, within);
      const parsed = parseELMResponse(range.command, range.raw); ensure(parsed.ok && Array.isArray(parsed.supportedPids), 'Mapa PID-ova nema valjan izvorni odgovor.');
      stringList(range.supportedPids, 32); ensure(equal(sorted(range.supportedPids), sorted(parsed.supportedPids)), 'Prijavljeni PID-ovi se ne slažu s izvornom bitmapom.');
      parsed.supportedPids.forEach(command => supported.add(command)); refs.push({ kind: 'support-map', ...ref, supportedPids: [...parsed.supportedPids] });
      const next = RANGE_COMMANDS[RANGE_COMMANDS.indexOf(range.command) + 1] || null; expected = next && parsed.supportedPids.includes(next) ? next : null;
    } else {
      outcome(range, ['command', 'status', 'reason', 'evidence']); ensure(range.status !== 'available', 'Neispravan ishod raspona.'); if (range.evidence) evidence(range.evidence, range.command, within); failed = true;
    }
  }
  ensure(equal(sorted(value.supportedPids), sorted(supported)), 'Skup PID-ova nije izveden iz dostavljenih bitmapa.');
  ensure(equal(sorted(value.supportedReadablePids), sorted([...supported].filter(command => MEASUREMENT_COMMANDS.has(command)))), 'Lista čitljivih PID-ova se ne slaže s ovim profilom.');
  ensure(!value.complete || (!failed && expected === null && value.status === 'available'), 'Nepotpuna mapa nije potvrđena kao potpuna.');
  return { present: true, supported, refs, complete: value.complete };
}
function dtcsOf(input, within) {
  if (input === undefined || input === null) input = {}; keys(input, CATEGORIES.map(([category]) => category)); const normalized = {}, refs = [], missing = [];
  for (const [category, command] of CATEGORIES) {
    const item = input[category]; if (item === undefined || item === null) { normalized[category] = { status: 'unknown' }; missing.push('dtcs-' + category); continue; }
    outcome(item, ['status', 'codes', 'reason', 'evidence']);
    if (item.status !== 'available') { ensure(item.codes === undefined, 'Nedostupni kodovi ne smiju biti prazna potvrđena lista.'); if (item.evidence) evidence(item.evidence, command, within); normalized[category] = item; missing.push('dtcs-' + category); continue; }
    stringList(item.codes, 128); ensure(item.codes.every(code => /^[PCBU][0-3][0-9A-F]{3}$/.test(code)), 'Neispravan kod u AUTO dokazu.');
    if (!item.evidence) { normalized[category] = { status: 'unknown' }; missing.push('raw-dtcs-' + category); continue; }
    const ref = evidence(item.evidence, command, within), parsed = decodeDTC(ref.raw, command, { singleModule: true });
    ensure(equal(sorted(parsed), sorted(item.codes)), 'Kodovi se ne slažu s izvornim odgovorom i kategorijom.'); normalized[category] = item;
    for (const code of parsed) refs.push({ kind: 'dtc', category, code, ...ref, claim: 'ECU-reported-condition' });
    if (!parsed.length) refs.push({ kind: 'dtc-response', category, codes: [], ...ref, claim: 'no-codes-in-this-response' });
  }
  return { normalized, refs, missing };
}
function monitorOf(input, within) {
  if (input === undefined || input === null) return { normalized: { status: 'unknown' }, refs: [], missing: ['monitor-status'] };
  outcome(input, ['status', 'data', 'reason', 'evidence']);
  if (input.status !== 'available') { ensure(input.data === undefined, 'Nedostupan monitor ne smije sadržavati potvrđene podatke.'); if (input.evidence) evidence(input.evidence, '0101', within); return { normalized: input, refs: [], missing: ['monitor-status'] }; }
  if (!input.evidence) return { normalized: { status: 'unknown' }, refs: [], missing: ['raw-monitor-status'] };
  const ref = evidence(input.evidence, '0101', within), parsed = parseELMResponse('0101', ref.raw); ensure(parsed.ok && equal(parsed.monitor, input.data), 'Status monitora se ne slaže s izvornim odgovorom.');
  return { normalized: input, refs: [{ kind: 'monitor', ...ref, data: parsed.monitor }], missing: [] };
}
function measurementRows(input) {
  if (input === undefined || input === null) return [];
  if (Array.isArray(input)) return input;
  keys(input, ['format', 'startedAt', 'completedAt', 'readings', 'measurements', 'limitations']); ensure(input.format === 'blclea.obd-measurements/1', 'Nepodržan format AUTO snimka.'); const within = interval(input); optionalTexts(input.limitations);
  // Nine requests can expose ten typed channels because PID 03 has two systems.
  ensure(Array.isArray(input.readings) && input.readings.length <= 9 && Array.isArray(input.measurements) && input.measurements.length <= 10, 'Snimak mora sadržavati ograničene liste očitanja.');
  const available = new Map(), commands = new Set();
  for (const reading of input.readings) {
    outcome(reading, ['command', 'status', 'values', 'reason', 'evidence']); ensure(MEASUREMENT_COMMANDS.has(reading.command) && !commands.has(reading.command), 'Ponovljena ili nepodržana mjerna naredba.'); commands.add(reading.command);
    if (reading.status === 'available') {
      const ref = evidence(reading.evidence, reading.command, within), parsed = parseELMResponse(reading.command, ref.raw); ensure(parsed.ok && equal(parsed.values, reading.values), 'Vrijednosti snimka se ne slažu s izvornim odgovorom.'); available.set(reading.command, { ref, values: parsed.values });
    } else { ensure(reading.values === undefined, 'Nedostupno očitanje ne smije sadržavati vrijednosti.'); if (reading.evidence) evidence(reading.evidence, reading.command, within); }
  }
  ensure(input.measurements.length === [...available.values()].reduce((count, reading) => count + reading.values.length, 0), 'Sažeta mjerenja ne odgovaraju izvornim očitanjima.');
  const seen = new Set();
  for (const row of input.measurements) {
    const original = available.get(row.command), channel = row.command + ':' + row.id;
    ensure(original && !seen.has(channel) && equal(original.ref, { command: row.command, capturedAt: row.capturedAt, source: row.source, raw: row.raw }) && original.values.some(value => value.id === row.id && value.unit === row.unit && value.value === row.value), 'Mjerenje nije povezano s izvornim očitanjem snimka.'); seen.add(channel);
  }
  return input.measurements;
}
function validatedReport(input) {
  const report = input === null || input === undefined ? {} : input;
  keys(report, ['format', 'startedAt', 'completedAt', 'discovery', 'supportedPids', 'dtcs', 'monitor', 'measurements', 'limitations']);
  ensure(report.format === undefined || report.format === 'blclea.obd-capabilities/1', 'Potrebni su izvorni podaci procjene; gotov izvještaj procjene nema sirove odgovore.');
  const within = interval(report); optionalTexts(report.limitations); if (report.supportedPids !== undefined) stringList(report.supportedPids);
  const discovery = discoveryOf(report.discovery, within), dtcs = dtcsOf(report.dtcs, within), monitor = monitorOf(report.monitor, within), rows = measurementRows(report.measurements);
  if (discovery.present && report.supportedPids !== undefined) ensure(equal(sorted(report.supportedPids), sorted([...discovery.supported])), 'Sažeta podrška se ne slaže s izvornom mapom.');
  ensure(rows.length <= 64, 'Previše AUTO mjerenja.');
  for (const row of rows) { keys(row, ['id', 'label', 'value', 'unit', 'command', 'capturedAt', 'source', 'raw']); if (row.label !== undefined) text(row.label, 160); if (discovery.present) ensure(discovery.supported.has(row.command), 'Očitani PID nije prijavljen u provjerenoj mapi ovog zapisa.'); }
  const assessment = assessAutoEvidence({ measurements: rows, dtcs: dtcs.normalized, monitor: monitor.normalized });
  const measurements = rows.map(row => ({ kind: 'measurement', id: row.id, command: row.command, value: row.value, unit: row.unit, capturedAt: row.capturedAt, source: row.source, raw: row.raw }));
  return { discovery, dtcs, monitor, measurements, assessment, missing: [...dtcs.missing, ...monitor.missing] };
}
const TESTS = Object.freeze([
  { id: 'engine-context', title: 'Radno stanje uz snimak', purpose: 'Sačuvati broj obrtaja i dostupno trajanje rada uz izričito zabilježeno stanje motora.', desired: ['010C', '011F'], minimum: 1 },
  { id: 'fuel-system', title: 'Stvarni režim sistema goriva', purpose: 'Očitati oba statusa standardnog PID-a 03. Samo kod 2 sistema 1 potvrđuje prijavljenu zatvorenu petlju za poređenje korekcija banke 1; drugi sistem ne zamjenjuje prvi.', desired: ['0103'], minimum: 1 },
  { id: 'bank1-trims', title: 'Par korekcija goriva banke 1', purpose: 'Očitati kratku i dugu korekciju u potvrđenoj zatvorenoj petlji i uporedivom režimu; granice zahtijevaju servisnu dokumentaciju.', desired: ['0106', '0107'], minimum: 2, context: ['running', 'closedLoopConfirmed', 'comparableConditions'] },
  { id: 'air-load', title: 'Kontekst usisa i opterećenja', purpose: 'Sačuvati dostupni pritisak, protok, opterećenje i položaj zaklopke; uzastopna očitanja ne dokazuju curenje ili kvar mjerača.', desired: ['010B', '0110', '0104', '0111'], minimum: 1, context: ['running', 'comparableConditions'] },
  { id: 'module-voltage', title: 'Napon na upravljačkom modulu', purpose: 'Zabilježiti napon modula uz stanje motora; za poređenje s polovima akumulatora treba nezavisan instrument i propisani postupak.', desired: ['0142'], minimum: 1 },
  { id: 'thermal-context', title: 'Temperaturni kontekst', purpose: 'Sačuvati dostupne prijavljene temperature uz stvarno hladno ili zagrijano stanje; nema univerzalne normalne vrijednosti.', desired: ['0105', '010F', '0146'], minimum: 1 },
  { id: 'external-fuel', title: 'Nezavisna provjera dovoda goriva', purpose: 'Ovaj profil ne mjeri stvarni pritisak ili isporuku goriva; potreban je propisani servisni postupak i odgovarajući nezavisni instrument.', desired: [], minimum: 1, external: 'independent-fuel-supply-measurement' },
  { id: 'external-uneven', title: 'Nezavisno razdvajanje uzroka neujednačenog rada', purpose: 'Generički kod i obrtaji ne razdvajaju mehaničko stanje, paljenje i dovod goriva; potreban je dokumentovani nezavisni test.', desired: [], minimum: 1, external: 'documented-independent-engine-test' }
].map(test => Object.freeze(test)));
const ORDERS = Object.freeze({ 'rough-running': ['engine-context', 'fuel-system', 'bank1-trims', 'air-load', 'module-voltage', 'external-uneven', 'external-fuel'], 'power-loss': ['air-load', 'engine-context', 'fuel-system', 'bank1-trims', 'module-voltage', 'external-fuel'], starting: ['module-voltage', 'engine-context', 'thermal-context', 'external-fuel', 'external-uneven'], general: ['engine-context', 'module-voltage', 'fuel-system', 'air-load', 'bank1-trims', 'thermal-context'] });
function resolveContext(context, facts) {
  const resolved = { engineState: context.engineState ?? 'unknown', conflicts: [] };
  if (context.comparableConditions !== undefined) resolved.comparableConditions = context.comparableConditions;
  const rpm = facts.measurements.find(row => row.id === 'rpm');
  if (rpm && ((resolved.engineState === 'running' && rpm.value === 0) || (resolved.engineState === 'off' && rpm.value > 0))) {
    resolved.engineState = 'unknown'; resolved.conflicts.push('engine-state-conflict');
  }
  const status = facts.measurements.find(row => row.id === 'fuelSystem1Status');
  if (status) {
    resolved.closedLoopConfirmed = status.value === 2;
    resolved.closedLoopSource = 'raw-pid-0103-system1';
    if (context.closedLoopConfirmed !== undefined && context.closedLoopConfirmed !== resolved.closedLoopConfirmed) resolved.conflicts.push('closed-loop-context-conflict');
  } else if (context.closedLoopConfirmed !== undefined) {
    // Older callers can supply an explicit user statement. It is never inferred
    // from trims, RPM, temperature, runtime or the second fuel-system byte.
    resolved.closedLoopConfirmed = context.closedLoopConfirmed;
    resolved.closedLoopSource = 'explicit-user-context';
  } else resolved.closedLoopSource = 'unknown';
  return resolved;
}
function testsFor(symptom, facts, context) {
  const observed = new Set(facts.measurements.map(row => row.command));
  return ORDERS[symptom].map((id, index) => {
    const definition = TESTS.find(test => test.id === id), supported = definition.desired.filter(command => facts.discovery.supported.has(command)), absent = definition.desired.filter(command => !facts.discovery.supported.has(command));
    const prerequisites = [];
    for (const requirement of definition.context || []) if (requirement === 'running' ? context.engineState !== 'running' : context[requirement] !== true) prerequisites.push(requirement === 'running' ? 'engine-state-running' : requirement);
    const available = !definition.external && supported.length >= definition.minimum && prerequisites.length === 0;
    const missing = [...(!facts.discovery.present ? ['verified-support-map'] : []), ...absent.map(command => 'unconfirmed-pid:' + command), ...supported.filter(command => !observed.has(command)).map(command => 'measurement:' + command), ...prerequisites, ...(context.conflicts.includes('engine-state-conflict') && definition.context?.includes('running') ? ['engine-state-conflict'] : []), 'manufacturer-service-limits', ...(definition.external ? [definition.external] : [])];
    const commands = available ? supported : [];
    const repeat = available && commands.every(command => observed.has(command));
    const reason = definition.external ? 'Generički ELM profil nema ovu mjeru; nema automatske naredbe.' : supported.length < definition.minimum ? 'Potrebni PID-ovi nisu potvrđeni izvornom bitmapom; naredbe nisu odabrane.' : prerequisites.length ? 'Prvo izričito potvrdite potreban radni kontekst; naredbe nisu odabrane.' : repeat ? 'Ovi kanali već imaju snimljene odgovore; ponavljanje zahtijeva novu izričitu radnju i zabilježene uslove. Ponovljeno očitanje nije dokaz popravke ili ispravnosti.' : 'Odabrani su samo fiksni PID-ovi potvrđeni izvornom bitmapom; očitanje se ne pokreće automatski.';
    return { id, title: definition.title, purpose: definition.purpose, commands, available, repeat, missing, reason, rank: index + 1 };
  });
}
function candidatesFor(symptom, facts, context) {
  const user = { kind: 'user-symptom', symptom, claim: 'user-reported-concern' }, measurements = ids => facts.measurements.filter(row => ids.includes(row.id));
  const common = ['manufacturer-service-limits', ...(context.engineState === 'unknown' ? ['engine-operating-context'] : []), ...context.conflicts];
  const make = (id, title, relevant, refs, missing) => ({ id, title, status: relevant || refs.length ? 'investigate' : 'unassessed', support: [...(relevant ? [user] : []), ...refs], contradictions: [], missing: [...new Set([...common, ...missing])] });
  return [
    make('engine-uneven', 'Razdvojiti prijavljeni neujednačen rad', symptom === 'rough-running', facts.dtcs.refs.filter(ref => ref.kind === 'dtc' && /^P03[0-9A-F]{2}$/.test(ref.code)), ['repeatable-engine-condition', 'documented-independent-engine-test']),
    make('fuel-supply', 'Razdvojiti dovod goriva od korekcija', ['rough-running', 'power-loss', 'starting'].includes(symptom), measurements(['fuelSystem1Status', 'shortFuelTrimB1Pct', 'longFuelTrimB1Pct']), ['independent-fuel-supply-measurement', ...(context.closedLoopConfirmed === true ? [] : ['closed-loop-context']), ...(measurements(['shortFuelTrimB1Pct', 'longFuelTrimB1Pct']).length === 2 ? [] : ['paired-bank1-fuel-trim'])]),
    make('air-metering', 'Razdvojiti usis i mjerenje opterećenja', ['rough-running', 'power-loss'].includes(symptom), measurements(['engineLoadPct', 'manifoldKpa', 'airflowGps', 'throttlePct']), ['documented-air-load-procedure', ...(context.comparableConditions === true ? [] : ['comparable-conditions'])]),
    make('electrical-context', 'Razdvojiti mjerno mjesto i električni kontekst', symptom === 'starting', measurements(['moduleVoltageV']), ['independent-terminal-voltage', 'measurement-location-context'])
  ];
}

/** Pure planning only: report.measurements is scanOBDMeasurements output or
 * explicit raw-backed assessment rows. A returned assessment is not source data. */
export function planAutoInvestigation(input) {
  const data = cloneInput(input); keys(data, ['symptom', 'report', 'context']); ensure(SYMPTOMS.has(data.symptom), 'Odaberite podržan AUTO simptom.');
  const suppliedContext = data.context === undefined ? {} : data.context;
  keys(suppliedContext, ['engineState', 'closedLoopConfirmed', 'comparableConditions']); ensure(suppliedContext.engineState === undefined || ['unknown', 'off', 'running'].includes(suppliedContext.engineState), 'Neispravno prijavljeno stanje motora.');
  for (const key of ['closedLoopConfirmed', 'comparableConditions']) if (suppliedContext[key] !== undefined) ensure(typeof suppliedContext[key] === 'boolean', 'Kontekst mora biti izričita logička potvrda.');
  const facts = validatedReport(data.report), context = resolveContext(suppliedContext, facts), candidates = candidatesFor(data.symptom, facts, context), tests = testsFor(data.symptom, facts, context);
  const nextTest = tests.find(test => test.available && !test.repeat) || tests.find(test => test.available) || null;
  const evidenceCount = facts.measurements.length + facts.dtcs.refs.length + facts.monitor.refs.length, missingCount = new Set([...facts.missing, ...tests.flatMap(test => test.missing)]).size;
  const trace = [
    { pillar: 'Core AI Manager', operation: 'auto.plan.validate', inputCount: 1, outputCount: candidates.length, detail: 'Odabran je deterministički plan za prijavljeni simptom; AI model nije pozivan.' },
    { pillar: 'Link Bridge Elite', operation: 'auto.raw.validate', inputCount: evidenceCount, outputCount: evidenceCount, detail: 'Mjerenja, kodovi i monitori provjereni su prema izvornim odgovorima; adapter nije pristupan.' },
    { pillar: 'Expansion Q', operation: 'auto.pid.select', inputCount: facts.discovery.supported.size, outputCount: tests.reduce((sum, test) => sum + test.commands.length, 0), detail: 'Predložene naredbe pripadaju fiksnom profilu i potvrđenim bitmapama.' },
    { pillar: 'Adaptive Recovery', operation: 'auto.missing.identify', inputCount: tests.length, outputCount: missingCount, detail: 'Nedostupni odgovori i nepotvrđeni uslovi ostali su nepoznati.' },
    { pillar: 'Holo Interaction', operation: 'auto.tests.prepare', inputCount: tests.length, outputCount: tests.filter(test => test.available).length, detail: 'Pripremljeni su svrha, ograničenja i dostupnost svakog pregleda, bez izvršavanja.' },
    { pillar: 'Fallback Executor', operation: 'auto.unknown.preserve', inputCount: candidates.length, outputCount: candidates.filter(candidate => candidate.status === 'unassessed').length, detail: 'Izostanak koda ili mjerenja nije pretvoren u potvrdu ispravnosti ili kvara.' },
    { pillar: 'Vision Q', operation: 'auto.hypotheses.explain', inputCount: evidenceCount, outputCount: candidates.reduce((sum, candidate) => sum + candidate.support.length, 0), detail: 'Prijavljeni simptom i izvorne činjenice navedeni su kao kontekst istraživanja, bez dijagnoze dijela.' }
  ];
  return { format: AUTO_INVESTIGATION_FORMAT, symptom: data.symptom, context, candidates, tests, nextTest, trace, limitations: [
    'Status investigate označava temu za razdvajanje, a ne potvrđen kvar, vjerovatnoću ili preporuku dijela za zamjenu.',
    'Kod P03xx je ECU-prijavljeno stanje te grupe; sam kod ne određuje korijenski uzrok. Prazan uspješan odgovor nije potvrda ukupne ispravnosti.',
    'Banku 1 i uzastopna očitanja ne treba smatrati istovremenim zapisom. Zatvorena petlja izvodi se samo iz koda 2 sistema 1 stvarnog PID-a 03; izričita korisnička potvrda starijih poziva važi samo kada taj status nedostaje.',
    'Radno stanje i uporedivost potvrđuje korisnik. Vrijeme i oznaka transporta ne potvrđuju isti fizički automobil, ECU ni tačnost adaptera.',
    'Granice proizvođača, kalibracija, nezavisna mjerenja i propisani servisni postupak nisu sadržani u generičkom ELM profilu.',
    'Redoslijed rangira prikupljanje relevantnih informacija po simptomu; ne rangira vjerovatnoću uzroka.',
    ...(!facts.discovery.present ? ['Nema izvorne mape PID-ova; dostavljena lista podrške sama ne odobrava nijednu naredbu.'] : !facts.discovery.complete ? ['Mapa PID-ova je djelimična; koriste se samo izvorno potvrđeni bitovi podrške.'] : []),
    ...facts.missing.map(key => 'Nedostaje potvrđeni izvor: ' + key + '.'),
    'Plan ne pokreće pristup vozilu, vožnju, brisanje kodova, aktuatore, proizvođačke protokole, slanje podataka niti automatsko ponavljanje.'
  ] };
}
