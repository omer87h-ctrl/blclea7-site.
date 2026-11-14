/* Original CLEA Auto comparison of immutable, raw-backed observations.
 * This module has no device, storage, network or mutation capability. */
import { validateAutoReport } from './auto-vault.js';

export const AUTO_COMPARISON_FORMAT = 'blclea.auto-comparison/1';
const copy = value => JSON.parse(JSON.stringify(value));
const ensure = (condition, message) => { if (!condition) throw Object.assign(new Error(message), { code: 'AUTO_COMPARISON_INPUT' }); };
const own = (value, key) => Object.hasOwn(value, key);
const CATEGORIES = ['stored', 'pending', 'permanent'];
const CATEGORICAL = new Set(['fuelSystem1Status', 'fuelSystem2Status']);
const channelKey = row => `${row.command}:${row.id}:${row.unit}`;

function confirmations(options) {
  ensure(options !== null && typeof options === 'object' && !Array.isArray(options) && [Object.prototype, null].includes(Object.getPrototypeOf(options)), 'Potvrdite vozilo i uslove poređenja.');
  const allowed = ['sameVehicleConfirmed', 'comparableConditionsConfirmed'];
  ensure(Reflect.ownKeys(options).length === 2 && allowed.every(key => own(options, key)), 'Poređenje zahtijeva dvije izričite potvrde.');
  for (const key of Reflect.ownKeys(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    ensure(typeof key === 'string' && allowed.includes(key) && descriptor && own(descriptor, 'value') && descriptor.enumerable && descriptor.value === true,
      key === 'sameVehicleConfirmed' ? 'Potvrdite da se oba nalaza odnose na isto vozilo.' : 'Potvrdite da uslovi odgovaraju ovom poređenju.');
  }
  return { sameVehicleConfirmed: true, comparableConditionsConfirmed: true, source: 'explicit-user-statement' };
}
function capture(report) {
  return {
    startedAt: [report.capabilities.startedAt, report.readings.startedAt].sort()[0],
    completedAt: [report.capabilities.completedAt, report.readings.completedAt].sort().at(-1)
  };
}
function summary(report) {
  return { id: report.id, createdAt: report.createdAt, capture: capture(report), device: copy(report.device), origin: report.origin,
    symptom: report.symptom, context: copy(report.context), testOnly: report.testOnly };
}
function observation(report, reading, row) {
  if (!reading) return { status: 'not-requested', reportId: report.id };
  if (!row) return { status: reading.status, reportId: report.id, ...(reading.reason ? { reason: reading.reason } : {}),
    ...(reading.evidence ? { evidence: copy(reading.evidence) } : {}) };
  return { status: 'available', reportId: report.id, value: row.value,
    evidence: { command: row.command, capturedAt: row.capturedAt, source: row.source, raw: row.raw } };
}
function measurementChanges(before, after) {
  const beforeValues = new Map(before.readings.measurements.map(row => [channelKey(row), row]));
  const afterValues = new Map(after.readings.measurements.map(row => [channelKey(row), row]));
  const beforeReadings = new Map(before.readings.readings.map(row => [row.command, row]));
  const afterReadings = new Map(after.readings.readings.map(row => [row.command, row]));
  const channels = [...new Set([...beforeValues.keys(), ...afterValues.keys()])].sort();
  return channels.map(key => {
    const left = beforeValues.get(key), right = afterValues.get(key), row = left || right;
    const category = CATEGORICAL.has(row.id), comparable = !!left && !!right;
    const delta = comparable && !category ? Math.round((right.value - left.value) * 1e9) / 1e9 : null;
    return { command: row.command, id: row.id, label: row.label, unit: row.unit, kind: category ? 'category' : 'number',
      before: observation(before, beforeReadings.get(row.command), left), after: observation(after, afterReadings.get(row.command), right),
      comparable, changed: comparable ? left.value !== right.value : null, delta };
  });
}
function requestOutcomes(before, after) {
  const left = new Map(before.readings.readings.map(row => [row.command, row]));
  const right = new Map(after.readings.readings.map(row => [row.command, row]));
  const outcome = reading => reading ? { status: reading.status, ...(reading.reason ? { reason: reading.reason } : {}),
    ...(reading.evidence ? { evidence: copy(reading.evidence) } : {}) } : { status: 'not-requested' };
  return [...new Set([...left.keys(), ...right.keys()])].sort().map(command => ({ command, before: outcome(left.get(command)), after: outcome(right.get(command)) }));
}
function dtcChanges(before, after) {
  return Object.fromEntries(CATEGORIES.map(category => {
    const left = before.capabilities.dtcs[category], right = after.capabilities.dtcs[category];
    const comparable = left.status === 'available' && right.status === 'available';
    return [category, { before: copy(left), after: copy(right), comparable,
      added: comparable ? right.codes.filter(code => !left.codes.includes(code)) : null,
      retained: comparable ? right.codes.filter(code => left.codes.includes(code)) : null,
      noLongerReported: comparable ? left.codes.filter(code => !right.codes.includes(code)) : null }];
  }));
}
function monitorChanges(before, after) {
  const left = before.capabilities.monitor, right = after.capabilities.monitor;
  const available = left.status === 'available' && right.status === 'available';
  const sameIgnition = available && left.data.ignition === right.data.ignition;
  const monitors = sameIgnition ? left.data.monitors.map(item => {
    const next = right.data.monitors.find(candidate => candidate.id === item.id);
    const comparable = item.supported && next?.supported;
    return { id: item.id, label: item.label, before: copy(item), after: next ? copy(next) : null, comparable: !!comparable,
      transition: !comparable ? 'not-comparable' : item.completed === next.completed ? 'unchanged' : next.completed ? 'now-completed' : 'now-incomplete' };
  }) : [];
  return { before: copy(left), after: copy(right), comparable: sameIgnition,
    mil: available ? { before: left.data.milOn, after: right.data.milOn, changed: left.data.milOn !== right.data.milOn } : null,
    reportedDtcCount: available ? { before: left.data.dtcCount, after: right.data.dtcCount, delta: right.data.dtcCount - left.data.dtcCount } : null,
    ignitionChanged: available ? left.data.ignition !== right.data.ignition : null, monitors };
}

/** Compare only two distinct, chronological, canonically validated reports.
 * Identity/condition confirmations are user statements, not hardware attestation. */
export function compareAutoReports(beforeInput, afterInput, options) {
  const confirmed = confirmations(options);
  const before = validateAutoReport(beforeInput), after = validateAutoReport(afterInput);
  ensure(before.id !== after.id, 'Odaberite dva različita nalaza.');
  const first = capture(before), second = capture(after);
  ensure(first.completedAt <= second.startedAt && first.completedAt < second.completedAt,
    'Kasniji nalaz mora imati odvojeno, hronološki kasnije očitavanje. Kopija istog nalaza nije novo mjerenje.');
  const warnings = [];
  if (before.origin === 'imported' || after.origin === 'imported') warnings.push('Poređenje sadrži uvezeni zapis. Njegovo porijeklo nije fizički autentifikovano.');
  if (before.device.name !== after.device.name || before.device.profileId !== after.device.profileId) warnings.push('Oznaka adaptera ili profil veze se razlikuje. Potvrda istog vozila je vaša izjava, ne automatska identifikacija.');
  if (before.context.engineState !== after.context.engineState) warnings.push('Zabilježeni režimi motora se razlikuju. Razlike ne predstavljaju automatski poboljšanje ili pogoršanje.');
  const monitor = monitorChanges(before, after);
  if (monitor.ignitionChanged) warnings.push('Nalazi prijavljuju različitu vrstu paljenja. Ugrađene provjere se zato ne porede kao isti skup.');
  return {
    format: AUTO_COMPARISON_FORMAT, policyVersion: '1', confirmations: confirmed,
    before: summary(before), after: summary(after),
    elapsedMs: Date.parse(second.completedAt) - Date.parse(first.completedAt),
    gapMs: Date.parse(second.startedAt) - Date.parse(first.completedAt),
    measurements: measurementChanges(before, after), requests: requestOutcomes(before, after), dtcs: dtcChanges(before, after), monitor,
    testOnly: before.testOnly || after.testOnly, warnings,
    limitations: [
      'Razlike su zabilježene promjene, a ne dokaz uzroka, uspješne popravke ili tehničke ispravnosti.',
      'Isto vozilo i odgovarajući uslovi su izričite korisničke izjave; softver ih ne može potvrditi iz naziva adaptera.',
      'Očitanja su uzastopna, ne istovremena. Razlika nedostupnih ili nezatraženih podataka se ne računa.',
      'Kod koji nije prijavljen u kasnijem valjanom odgovoru nije time potvrđen kao popravljen ili obrisan.',
      'Statusi sistema goriva su kategorije: njihova numerička razlika nema fizičko značenje.'
    ]
  };
}
