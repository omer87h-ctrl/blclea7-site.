/* CLEA Evidence Graph — original bounded measurement analysis by Brzo i Lokalno.
 * It evaluates structured observations, never programs or generated explanations.
 * A recorded source kind is provenance supplied by an adapter, not attestation.
 */

export const FRAME_FORMAT = 'clea.measurement/1';
export const SESSION_FORMAT = 'clea.evidence-session/1';
export const EVIDENCE_RULES = 'clea.evidence-rules/1';
const MAX_FRAMES = 240;
const MAX_CHANNELS = 32;
const MAX_SOURCES = 32;
const MAX_TEXT = 2 * 1024 * 1024;
const TOOLS = new Set(['auto', 'electric', 'build', 'climate', 'workshop']);
const SOURCE_KINDS = new Set(['obd-ble', 'sensor-ble', 'serial', 'file']);
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const DEF = {
  temperature: ['Temperatura', '°C'], humidity: ['Relativna vlažnost', '%'], pressure: ['Pritisak', 'kPa'],
  voltage: ['Napon', 'V'], current: ['Struja', 'A'], resistance: ['Otpor', 'ohm'], power: ['Snaga', 'W'],
  vibration: ['Brzina vibracije', 'mm/s'], moisture: ['Vlažnost materijala', '%'], length: ['Dužina', 'mm'],
  rpm: ['Broj okretaja', 'rpm'], coolantTemperature: ['Temperatura rashladne tečnosti', '°C'], speed: ['Brzina', 'km/h'],
  controlModuleVoltage: ['Napon upravljačkog modula', 'V'], engineLoad: ['Opterećenje motora', '%'],
  intakeTemperature: ['Temperatura usisa', '°C'], intakePressure: ['Apsolutni pritisak usisa', 'kPa'],
  massAirFlow: ['Maseni protok zraka', 'g/s'], throttlePosition: ['Položaj leptira', '%'],
  batteryVoltage: ['Napon na akumulatoru', 'V'], runningVoltage: ['Napon pri radu motora', 'V'],
  insulation: ['Izolacijski otpor', 'ohm'], frequency: ['Frekvencija', 'Hz'], powerFactor: ['Faktor snage', '1'],
  width: ['Širina', 'mm'], height: ['Visina', 'mm'], area: ['Površina', 'm²'], thickness: ['Debljina', 'mm'],
  inletTemp: ['Ulazna temperatura', '°C'], outletTemp: ['Izlazna temperatura', '°C'], ambientTemp: ['Temperatura okoline', '°C'],
  airFlow: ['Protok zraka', 'm³/h'], waterFlow: ['Protok vode', 'L/min'], waterPressure: ['Pritisak vode', 'kPa'],
  stockLength: ['Dužina sirovine', 'mm'], stockWidth: ['Širina sirovine', 'mm'], partLength: ['Dužina komada', 'mm'],
  partWidth: ['Širina komada', 'mm'], accepted: ['Prihvaćeni komadi', 'count'], rejected: ['Odvojeni komadi', 'count']
};
export const CHANNELS = Object.freeze(Object.fromEntries(Object.entries(DEF).map(([key, [label, unit]]) => [key, Object.freeze({ id: key, label, unit })])));
const ALIASES = Object.freeze({ coolantC: 'coolantTemperature', intakeC: 'intakeTemperature', moduleVoltageV: 'controlModuleVoltage', speedKph: 'speed', engineLoadPct: 'engineLoad', manifoldKpa: 'intakePressure', airflowGps: 'massAirFlow', throttlePct: 'throttlePosition', batteryVoltageV: 'batteryVoltage', runningVoltageV: 'runningVoltage' });
const COMMON = ['temperature', 'humidity', 'pressure', 'voltage', 'current', 'resistance', 'power', 'vibration', 'moisture', 'length'];
export const TOOL_CHANNELS = Object.freeze({
  auto: Object.freeze([...COMMON, 'rpm', 'coolantTemperature', 'speed', 'controlModuleVoltage', 'engineLoad', 'intakeTemperature', 'intakePressure', 'massAirFlow', 'throttlePosition', 'batteryVoltage', 'runningVoltage']),
  electric: Object.freeze([...COMMON, 'insulation', 'frequency', 'powerFactor']),
  build: Object.freeze([...COMMON, 'width', 'height', 'area', 'thickness']),
  climate: Object.freeze([...COMMON, 'inletTemp', 'outletTemp', 'ambientTemp', 'airFlow', 'waterFlow', 'waterPressure']),
  workshop: Object.freeze([...COMMON, 'stockLength', 'stockWidth', 'partLength', 'partWidth', 'thickness', 'accepted', 'rejected'])
});

function fail(message, code = 'EVIDENCE_INPUT') { const e = new Error(message); e.code = code; throw e; }
function assert(condition, message, code) { if (!condition) fail(message, code); }
function plain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v)); }
function finite(v) { return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12; }
function identifier(v, label) { assert(typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(v) && !BAD_KEYS.has(v), `${label}: neispravan identifikator.`); return v; }
function date(v) { assert(typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)), 'Neispravna vremenska oznaka.'); return v; }
function keys(v, allowed, label) { assert(plain(v), `${label}: potreban je objekat.`); for (const k of Object.keys(v)) assert(allowed.includes(k) && !BAD_KEYS.has(k), `${label}: nepodržano polje ${k}.`); }
function inspect(root) {
  const stack = [{ value: root, depth: 0 }];
  let size = 0;
  while (stack.length) {
    const { value, depth } = stack.pop();
    assert(++size <= 100000 && depth <= 20, 'Mjerni zapis premašuje ograničenje složenosti.');
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'number') { assert(Number.isFinite(value), 'Mjerni zapis sadrži neispravan broj.'); continue; }
    if (typeof value === 'string') { assert(value.length <= 4000, 'Mjerni zapis sadrži predug tekst.'); continue; }
    assert(Array.isArray(value) || plain(value), 'Dozvoljeni su samo strukturirani JSON podaci.');
    const names = Object.keys(value);
    assert(names.length <= 8000, 'Mjerni zapis ima previše polja.');
    for (const name of names) {
      assert(!BAD_KEYS.has(name), 'Opasno ime polja u mjernom zapisu.');
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      assert(descriptor && 'value' in descriptor, 'Izvršni pristupnici nisu dozvoljeni.');
      stack.push({ value: descriptor.value, depth: depth + 1 });
    }
  }
}
function copy(value) { inspect(value); const text = JSON.stringify(value); assert(text.length <= MAX_TEXT, 'Mjerni zapis premašuje 2 MiB znakova.'); return JSON.parse(text); }
function parse(text) {
  assert(typeof text === 'string' && text.length <= MAX_TEXT, 'Mjerni zapis je prevelik ili nije tekst.');
  let result;
  try { result = JSON.parse(text); } catch { fail('Mjerni zapis nije ispravan JSON.'); }
  inspect(result);
  return result;
}
function freshId() {
  assert(globalThis.crypto?.randomUUID, 'Siguran generator identifikatora nije dostupan.');
  return globalThis.crypto.randomUUID();
}
function normalizeChannel(channel, toolId) {
  keys(channel, ['id', 'unit', 'value'], 'Kanal');
  const channelId = ALIASES[channel.id] || channel.id;
  assert(CHANNELS[channelId] && TOOL_CHANNELS[toolId].includes(channelId), 'Kanal nije registrovan za izabrani alat.', 'CHANNEL_UNSUPPORTED');
  assert(finite(channel.value), 'Kanal mora imati konačnu numeričku vrijednost.');
  assert(typeof channel.unit === 'string' && channel.unit.length <= 20, 'Mjerna jedinica nije ispravna.', 'UNIT_MISMATCH');
  const wanted = CHANNELS[channelId].unit;
  let factor = 1;
  const accepted = channel.unit === wanted || (wanted === '°C' && channel.unit === 'C') || (wanted === 'rpm' && channel.unit === 'o/min') || (wanted === 'ohm' && channel.unit === 'Ω') || (wanted === '1' && channel.unit === '') || (wanted === 'count' && channel.unit === 'kom');
  if (!accepted) {
    if (wanted === 'kPa' && channel.unit === 'bar') factor = 100;
    else if (wanted === 'kPa' && channel.unit === 'Pa') factor = 0.001;
    else if (wanted === 'mm' && channel.unit === 'cm') factor = 10;
    else if (wanted === 'mm' && channel.unit === 'm') factor = 1000;
    else if (wanted === 'ohm' && ['kΩ', 'kohm'].includes(channel.unit)) factor = 1000;
    else if (wanted === 'ohm' && ['MΩ', 'Mohm'].includes(channel.unit)) factor = 1e6;
    else fail(`Kanal ${channelId} zahtijeva jedinicu ${wanted}; primljeno ${channel.unit || '(prazno)'}.`, 'UNIT_MISMATCH');
  }
  const value = channel.value * factor;
  assert(finite(value), 'Pretvorena vrijednost kanala premašuje ograničenje.');
  return { id: channelId, unit: wanted, value };
}
function validateFrame(input, toolId, stored = false) {
  inspect(input);
  keys(input, ['format', 'id', 'sourceId', 'sourceKind', 'capturedAt', 'channels', 'context', ...(stored ? ['ordinal', 'receivedAt', 'provenance'] : [])], 'Mjerni okvir');
  assert(input.format === FRAME_FORMAT, 'Nepodržana verzija mjernog okvira.');
  identifier(input.id, 'Okvir'); identifier(input.sourceId, 'Izvor'); date(input.capturedAt);
  assert(SOURCE_KINDS.has(input.sourceKind), 'Nepodržan izvor mjerenja.');
  assert(Array.isArray(input.channels) && input.channels.length > 0 && input.channels.length <= MAX_CHANNELS, 'Okvir mora imati 1–32 podržana kanala.');
  const channels = input.channels.map(channel => normalizeChannel(channel, toolId));
  assert(new Set(channels.map(channel => channel.id)).size === channels.length, 'Isti kanal se ne može ponoviti u jednom okviru.');
  assert(input.context === undefined || plain(input.context), 'Kontekst mjerenja mora biti objekat.');
  const context = input.context || {};
  assert(Object.keys(context).length <= 32, 'Previše polja konteksta.');
  if (context.windowMs !== undefined) assert(finite(context.windowMs) && context.windowMs >= 0 && context.windowMs <= 2000, 'Deklarisani interval mjerenja mora biti između 0 i 2000 ms.');
  const frame = { format: FRAME_FORMAT, id: input.id, sourceId: input.sourceId, sourceKind: input.sourceKind, capturedAt: input.capturedAt, channels, context: copy(context) };
  if (stored) {
    assert(Number.isSafeInteger(input.ordinal) && input.ordinal > 0, 'Neispravan redni broj okvira.');
    date(input.receivedAt);
    keys(input.provenance, ['level', 'authenticity'], 'Porijeklo okvira');
    assert(input.provenance.level === 'reported' && input.provenance.authenticity === 'not-verified', 'Nepodržana tvrdnja o porijeklu mjerenja.');
    Object.assign(frame, { ordinal: input.ordinal, receivedAt: input.receivedAt, provenance: { level: 'reported', authenticity: 'not-verified' } });
  }
  return frame;
}
function validateSession(input) {
  inspect(input);
  keys(input, ['format', 'id', 'toolId', 'revision', 'createdAt', 'frames', 'baseline', 'nextOrdinal', 'droppedFrames', 'origin', 'importedAt'], 'Mjerna sesija');
  assert(input.format === SESSION_FORMAT && TOOLS.has(input.toolId), 'Nepodržana mjerna sesija ili alat.');
  identifier(input.id, 'Sesija'); date(input.createdAt);
  assert(Number.isSafeInteger(input.revision) && input.revision >= 0 && input.revision <= 1e9, 'Neispravna revizija sesije.');
  assert(Number.isSafeInteger(input.nextOrdinal) && input.nextOrdinal >= 1 && input.nextOrdinal <= 1e9, 'Neispravan sljedeći redni broj.');
  assert(Number.isSafeInteger(input.droppedFrames) && input.droppedFrames >= 0 && input.droppedFrames <= 1e9, 'Neispravan broj uklonjenih okvira.');
  assert(['local', 'imported'].includes(input.origin), 'Nepoznato porijeklo sesije.');
  assert(input.importedAt === null || typeof input.importedAt === 'string', 'Neispravan datum uvoza.');
  if (input.importedAt !== null) date(input.importedAt);
  assert(Array.isArray(input.frames) && input.frames.length <= MAX_FRAMES, 'Sesija može zadržati najviše 240 okvira.');
  const frames = input.frames.map(frame => validateFrame(frame, input.toolId, true));
  const ids = new Set();
  let last = 0;
  for (const frame of frames) {
    assert(frame.ordinal > last && frame.ordinal < input.nextOrdinal && !ids.has(frame.id), 'Okviri moraju imati jedinstven identitet i rastući redoslijed prijema.');
    last = frame.ordinal; ids.add(frame.id);
  }
  let baseline = null;
  if (input.baseline !== null) {
    keys(input.baseline, ['id', 'at', 'throughOrdinal', 'frames'], 'Referentni zapis');
    identifier(input.baseline.id, 'Referentni zapis'); date(input.baseline.at);
    assert(Number.isSafeInteger(input.baseline.throughOrdinal) && input.baseline.throughOrdinal > 0 && input.baseline.throughOrdinal < input.nextOrdinal, 'Neispravna referentna granica.');
    assert(Array.isArray(input.baseline.frames) && input.baseline.frames.length > 0 && input.baseline.frames.length <= MAX_FRAMES, 'Neispravan broj referentnih okvira.');
    const baselineFrames = input.baseline.frames.map(frame => validateFrame(frame, input.toolId, true));
    let previous = 0;
    const baselineIds = new Set();
    for (const frame of baselineFrames) {
      assert(frame.ordinal > previous && frame.ordinal <= input.baseline.throughOrdinal && !baselineIds.has(frame.id), 'Neispravan redoslijed referentnih okvira.');
      previous = frame.ordinal; baselineIds.add(frame.id);
      const overlapping = frames.find(item => item.id === frame.id || item.ordinal === frame.ordinal);
      assert(!overlapping || JSON.stringify(overlapping) === JSON.stringify(frame), 'Referentni okvir se ne slaže s originalnim zapisom.');
    }
    assert(baselineFrames.at(-1).ordinal === input.baseline.throughOrdinal, 'Referentna granica ne odgovara posljednjem okviru.');
    baseline = { id: input.baseline.id, at: input.baseline.at, throughOrdinal: input.baseline.throughOrdinal, frames: baselineFrames };
  }
  const sources = new Set([...frames, ...(baseline?.frames || [])].map(frame => frame.sourceId));
  assert(sources.size <= MAX_SOURCES, 'Sesija može sadržati najviše 32 izvora.');
  const sourceKinds = new Map();
  for (const frame of [...frames, ...(baseline?.frames || [])]) {
    assert(!sourceKinds.has(frame.sourceId) || sourceKinds.get(frame.sourceId) === frame.sourceKind, 'Identitet izvora ne može promijeniti vrstu transporta.');
    sourceKinds.set(frame.sourceId, frame.sourceKind);
  }
  return copy({ ...input, frames, baseline });
}

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
}
function round(value) { return value === null ? null : Number.isFinite(value) ? Number(value.toPrecision(12)) : null; }
function points(frames) {
  const grouped = new Map();
  for (const frame of frames) for (const channel of frame.channels) {
    if (!grouped.has(channel.id)) grouped.set(channel.id, []);
    grouped.get(channel.id).push({ value: channel.value, time: Date.parse(frame.capturedAt), at: frame.capturedAt, ordinal: frame.ordinal, frameId: frame.id, sourceId: frame.sourceId, sourceKind: frame.sourceKind, windowMs: frame.context.windowMs || 0 });
  }
  return grouped;
}
function statistics(input) {
  const p = [...input].sort((a, b) => a.time - b.time || a.ordinal - b.ordinal);
  const values = p.map(item => item.value), center = median(values);
  const mad = center === null ? null : median(values.map(v => Math.abs(v - center)));
  const duration = p.length > 1 ? (p.at(-1).time - p[0].time) / 1000 : 0;
  let slope = null;
  if (p.length >= 3 && duration > 0) {
    const xs = p.map(item => (item.time - p[0].time) / 1000), meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = values.reduce((a, b) => a + b, 0) / values.length;
    let covariance = 0, variance = 0;
    xs.forEach((x, i) => { covariance += (x - meanX) * (values[i] - meanY); variance += (x - meanX) ** 2; });
    slope = variance ? covariance / variance : null;
  }
  const gaps = p.slice(1).map((item, i) => (item.time - p[i].time) / 1000).filter(v => v > 0);
  const cadence = median(gaps);
  const cadenceMad = cadence === null ? null : median(gaps.map(gap => Math.abs(gap - cadence)));
  return { count: p.length, median: round(center), min: values.length ? round(Math.min(...values)) : null, max: values.length ? round(Math.max(...values)) : null, mad: round(mad), slopePerSecond: round(slope), durationSeconds: round(duration), medianIntervalSeconds: round(cadence), intervalMadSeconds: round(cadenceMad), minIntervalSeconds: gaps.length ? round(Math.min(...gaps)) : null, maxIntervalSeconds: gaps.length ? round(Math.max(...gaps)) : null, sourceIds: [...new Set(p.map(item => item.sourceId))].sort(), firstAt: p[0]?.at || null, lastAt: p.at(-1)?.at || null };
}
function compareBaseline(current, reference, baselineId, unit) {
  if (!reference) return null;
  const delta = current.median === null ? null : current.median - reference.median;
  const sourceSame = JSON.stringify(current.sourceIds) === JSON.stringify(reference.sourceIds);
  let kind = 'insufficient-evidence', score = null;
  if (current.count >= 5 && reference.count >= 5) {
    if (!sourceSame) kind = 'source-set-changed';
    else if (reference.mad === 0) kind = delta === 0 ? 'within-observed-variation' : 'zero-mad-delta';
    else { score = Math.abs(delta) / (1.4826 * reference.mad); kind = Math.abs(delta) > 3 * 1.4826 * reference.mad ? 'robust-change' : 'within-observed-variation'; }
  }
  return { id: baselineId, count: reference.count, median: reference.median, mad: reference.mad, sourceIds: reference.sourceIds, delta: round(delta), ratePercent: delta === null || reference.median === 0 || unit === '°C' ? null : round(100 * delta / Math.abs(reference.median)), rateNote: unit === '°C' ? 'Postotna promjena nije prikazana za Celzijusovu skalu s proizvoljnom nulom.' : reference.median === 0 ? 'Postotna promjena nije definisana za nultu referencu.' : 'Aritmetička promjena medijana prema apsolutnoj vrijednosti referentnog medijana; nije ocjena ispravnosti.', deviation: { kind, robustScore: round(score), sourceComparable: sourceSame, minimumReadingsEach: 5, rule: 'absolute median delta / (1.4826 × baseline MAD) > 3; zero MAD uses explicit delta' } };
}
function fact(id, severity, title, detail, channelIds = [], frameIds = []) { return { id, severity, title, detail, channelIds, frameIds: frameIds.slice(0, 12) }; }
function trace(pillar, operation, inputCount, outputCount, detail) { return { pillar, operation, inputCount, outputCount, detail }; }

export class EvidenceEngine {
  constructor({ now = () => new Date().toISOString(), id = freshId } = {}) { this._now = now; this._id = id; }
  createSession(toolId) {
    assert(TOOLS.has(toolId), 'Nepodržan alat.');
    return { format: SESSION_FORMAT, id: identifier(this._id(), 'Sesija'), toolId, revision: 0, createdAt: date(this._now()), frames: [], baseline: null, nextOrdinal: 1, droppedFrames: 0, origin: 'local', importedAt: null };
  }
  ingest(input, rawFrame) {
    const session = validateSession(input), frame = validateFrame(rawFrame, session.toolId);
    assert(![...session.frames, ...(session.baseline?.frames || [])].some(item => item.id === frame.id), 'Mjerni okvir je već zabilježen.', 'DUPLICATE_FRAME');
    assert(new Set([...session.frames, ...(session.baseline?.frames || []), frame].map(item => item.sourceId)).size <= MAX_SOURCES, 'Previše različitih izvora u sesiji.');
    const stored = { ...frame, ordinal: session.nextOrdinal, receivedAt: date(this._now()), provenance: { level: 'reported', authenticity: 'not-verified' } };
    const frames = [...session.frames, stored];
    const dropped = Math.max(0, frames.length - MAX_FRAMES);
    return validateSession({ ...session, revision: session.revision + 1, nextOrdinal: session.nextOrdinal + 1, frames: frames.slice(-MAX_FRAMES), droppedFrames: session.droppedFrames + dropped });
  }
  setBaseline(input) {
    const session = validateSession(input);
    assert(session.frames.length > 0, 'Za referentni zapis prvo prikupi mjerenja.');
    return validateSession({ ...session, revision: session.revision + 1, baseline: { id: identifier(this._id(), 'Referentni zapis'), at: date(this._now()), throughOrdinal: session.frames.at(-1).ordinal, frames: copy(session.frames) } });
  }
  analyze(input, { baselineId } = {}) {
    return this._analyze(validateSession(input), baselineId, 'LIVE', []);
  }
  replay(input) {
    return this._analyze(validateSession(input), undefined, 'REPLAY', []);
  }
  shadow(input, excludedSourceIds = []) {
    const original = validateSession(input);
    assert(Array.isArray(excludedSourceIds) && excludedSourceIds.length <= MAX_SOURCES, 'Alternativa zahtijeva listu izvora.');
    excludedSourceIds.forEach(value => identifier(value, 'Izvor alternative'));
    const sourceIds = new Set([...original.frames, ...(original.baseline?.frames || [])].map(frame => frame.sourceId));
    const excluded = [...new Set(excludedSourceIds)].sort();
    excluded.forEach(source => assert(sourceIds.has(source), 'Alternativa navodi izvor koji nije zabilježen.'));
    const session = copy(original);
    session.frames = session.frames.filter(frame => !excluded.includes(frame.sourceId));
    if (session.baseline) {
      session.baseline.frames = session.baseline.frames.filter(frame => !excluded.includes(frame.sourceId));
      if (!session.baseline.frames.length) session.baseline = null;
    }
    // This internal filtered view deliberately preserves original ordinals/identity;
    // no install, storage write, external action or live-session mutation occurs.
    return this._analyze(session, undefined, 'SHADOW', excluded);
  }
  exportSession(input) { return JSON.stringify(validateSession(input), null, 2); }
  importSession(text) {
    const session = validateSession(parse(text));
    return validateSession({ ...session, id: identifier(this._id(), 'Uvezena sesija'), revision: 0, origin: 'imported', importedAt: date(this._now()) });
  }

  _analyze(session, requestedBaseline, mode, excluded) {
    if (requestedBaseline !== undefined) assert(session.baseline && session.baseline.id === requestedBaseline, 'Traženi referentni zapis nije dostupan.');
    const baseline = session.baseline;
    const currentFrames = baseline ? session.frames.filter(frame => frame.ordinal > baseline.throughOrdinal) : session.frames;
    const currentGroups = points(currentFrames), referenceGroups = points(baseline?.frames || []);
    const channelIds = [...new Set([...currentGroups.keys(), ...referenceGroups.keys()])].sort();
    const findings = [], decisions = [], nextChecks = [];
    const metrics = channelIds.map(channelId => {
      const current = statistics(currentGroups.get(channelId) || []);
      const reference = referenceGroups.has(channelId) ? statistics(referenceGroups.get(channelId)) : null;
      return { id: channelId, label: CHANNELS[channelId].label, unit: CHANNELS[channelId].unit, ...current, totalCount: current.count + (reference?.count || 0), baseline: compareBaseline(current, reference, baseline?.id, CHANNELS[channelId].unit), confidence: { level: current.count >= 5 ? 'observational' : 'insufficient-readings', sampleCount: current.count, sourceCount: current.sourceIds.length, calibrationVerified: false } };
    });
    const allFrames = [...(baseline?.frames || []), ...session.frames].filter((frame, index, array) => array.findIndex(item => item.id === frame.id) === index).sort((a, b) => a.ordinal - b.ordinal);
    const bySource = new Map();
    for (const frame of allFrames) {
      if (!bySource.has(frame.sourceId)) bySource.set(frame.sourceId, []);
      bySource.get(frame.sourceId).push(frame);
    }
    for (const [sourceId, frames] of bySource) {
      let previous = null;
      for (const frame of frames) {
        if (previous && Date.parse(frame.capturedAt) < Date.parse(previous.capturedAt)) findings.push(fact(`time-reversal:${sourceId}:${frame.id}`, 'warning', 'Vremenski redoslijed izvora se vratio unazad', 'Redoslijed prijema je sačuvan. Provjeri sat izvora i evidenciju prije poređenja trendova.', frame.channels.map(channel => channel.id), [previous.id, frame.id]));
        previous = frame;
      }
    }
    const sessionEnd = allFrames.length ? Math.max(...allFrames.map(frame => Date.parse(frame.capturedAt))) : null;
    for (const metric of metrics) {
      const samples = currentGroups.get(metric.id) || [];
      const evidenceIds = samples.map(sample => sample.frameId);
      if (metric.count < 5) {
        findings.push(fact(`insufficient:${metric.id}`, 'info', `${metric.label}: malo uporedivih očitanja`, `Zabilježeno ${metric.count}; pravilo poređenja zahtijeva najmanje 5 referentnih i 5 kasnijih očitanja.`, [metric.id], evidenceIds));
        nextChecks.push({ id: `collect:${metric.id}`, priority: 'data', channelIds: [metric.id], title: `Prikupi još očitanja: ${metric.label}`, reason: 'Bez dovoljnog niza nema pouzdanog poređenja s referencom.', neededReadings: Math.max(0, 5 - metric.count) });
      }
      if (metric.count >= 4 && metric.medianIntervalSeconds > 0 && (metric.intervalMadSeconds / metric.medianIntervalSeconds > 0.25 || metric.maxIntervalSeconds > 3 * metric.medianIntervalSeconds)) findings.push(fact(`sampling:${metric.id}`, 'warning', `${metric.label}: promjenjiv razmak uzoraka`, 'MAD razmaka prelazi 25% medijana ili najveći razmak prelazi tri medijana. Trend koristi stvarne vremenske oznake; uzroci nisu izvedeni iz same neravnomjernosti.', [metric.id], evidenceIds));
      if (metric.count >= 3 && metric.medianIntervalSeconds > 0 && (sessionEnd - Date.parse(metric.lastAt)) / 1000 > 3 * metric.medianIntervalSeconds) {
        findings.push(fact(`stale:${metric.id}`, 'warning', `${metric.label}: kanal zaostaje za ostatkom zapisa`, 'Razmak do kraja zapisa prelazi tri opažena medijana intervala ovog kanala. To je relativna provjera zapisa, ne provjera sata u realnom vremenu.', [metric.id], evidenceIds));
        nextChecks.push({ id: `refresh:${metric.id}`, priority: 'data', channelIds: [metric.id], title: `Obnovi kanal ${metric.label}`, reason: 'Kasniji okviri postoje bez ovog kanala.' });
      }
      if (metric.baseline) {
        const comparison = metric.baseline;
        if (['robust-change', 'zero-mad-delta'].includes(comparison.deviation.kind)) {
          findings.push(fact(`baseline-change:${metric.id}`, 'observation', `${metric.label}: opažena promjena prema referenci`, comparison.deviation.kind === 'zero-mad-delta' ? 'Referentni MAD je nula; prikazana je stvarna razlika medijana, bez izmišljenog statističkog skora.' : 'Razlika medijana prelazi tri robusno skalirana referentna MAD-a. Ovo je promjena mjerenja, a ne dokaz kvara.', [metric.id], evidenceIds));
          decisions.push({ id: `compare:${metric.id}`, kind: 'observed-change', channelIds: [metric.id], evidence: { baselineId: baseline.id, baselineCount: comparison.count, currentCount: metric.count, delta: comparison.delta, unit: metric.unit, robustScore: comparison.deviation.robustScore }, candidates: ['Promijenjeni uslovi ili režim rada', 'Promijenjena mjerna tačka, instrument ili kalibracija', 'Stvarna promjena posmatranog sistema'], conclusion: 'Podaci podržavaju opaženu promjenu. Ne razdvajaju navedene moguće uzroke.', missingContext: ['Uporediv režim rada i mjerna tačka', 'Instrument i mjerna nesigurnost', 'Relevantna servisna specifikacija'] });
          nextChecks.push({ id: `verify:${metric.id}`, priority: 'context', channelIds: [metric.id], title: `Ponovi ${metric.label} u istim uslovima`, reason: 'Odvoji promjenu sistema od uslova i mjernog postupka.' });
        } else if (comparison.deviation.kind === 'source-set-changed') findings.push(fact(`source-change:${metric.id}`, 'warning', `${metric.label}: promijenjen skup izvora`, 'Razlika je prikazana, ali statistički zaključak je odbijen jer referenca i kasniji niz nemaju isti skup izvora.', [metric.id], evidenceIds));
      }
      // Conflicts require overlapping declared acquisition windows, or the exact
      // same timestamp. No assumption that sequential Bluetooth reads are simultaneous.
      const sourceStats = new Map(metric.sourceIds.map(source => [source, statistics(samples.filter(p => p.sourceId === source))]));
      let disagreement = null;
      for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) {
        const a = samples[i], b = samples[j];
        if (a.sourceId === b.sourceId) continue;
        const skew = Math.abs(a.time - b.time);
        if (skew !== 0 && !(a.windowMs > 0 && b.windowMs > 0 && skew <= Math.min(a.windowMs, b.windowMs))) continue;
        const scale = Math.max(sourceStats.get(a.sourceId)?.mad || 0, sourceStats.get(b.sourceId)?.mad || 0);
        if (Math.abs(a.value - b.value) > 3 * 1.4826 * scale && (!disagreement || Math.abs(a.value - b.value) > disagreement.delta)) disagreement = { a, b, delta: Math.abs(a.value - b.value), skewMs: skew };
      }
      if (disagreement) {
        findings.push(fact(`source-disagreement:${metric.id}`, 'warning', `${metric.label}: izvori daju različita istovremena očitanja`, 'Razlika prelazi opaženu varijaciju izvora. Bez poznatih mjernih tačaka i nesigurnosti nije moguće odrediti koji izvor je tačan.', [metric.id], [disagreement.a.frameId, disagreement.b.frameId]));
        decisions.push({ id: `conflict:${metric.id}`, kind: 'source-disagreement', channelIds: [metric.id], evidence: { sourceIds: [disagreement.a.sourceId, disagreement.b.sourceId].sort(), difference: round(disagreement.delta), unit: metric.unit, skewMs: disagreement.skewMs, frameIds: [disagreement.a.frameId, disagreement.b.frameId] }, candidates: ['Različite mjerne tačke ili uslovi', 'Različita kalibracija ili nesigurnost instrumenta', 'Vremenska neusaglašenost unutar deklarisanog intervala'], conclusion: 'Nijedan izvor nije automatski proglašen ispravnim.', missingContext: ['Ista mjerna tačka', 'Mjerna nesigurnost oba izvora'] });
        nextChecks.push({ id: `pair:${metric.id}`, priority: 'conflict', channelIds: [metric.id], title: `Uporedi oba izvora: ${metric.label}`, reason: 'Ponovi očitanje na istoj tački uz poznatu nesigurnost i isti vremenski interval.' });
      }
    }
    if (!metrics.length) nextChecks.push({ id: 'connect-source', priority: 'data', channelIds: TOOL_CHANNELS[session.toolId].slice(0, 3), title: 'Poveži podržan izvor ili uvezi stvarni mjerni zapis', reason: 'Nema mjerenja; rezultati se ne generišu bez podataka.' });
    const relevant = { auto: ['rpm', 'coolantTemperature', 'controlModuleVoltage'], electric: ['voltage', 'current', 'power'], build: ['length', 'moisture', 'temperature'], climate: ['temperature', 'humidity', 'pressure'], workshop: ['length', 'vibration', 'power'] }[session.toolId];
    if (metrics.length) for (const channelId of relevant.filter(channelId => !channelIds.includes(channelId))) nextChecks.push({ id: `missing:${channelId}`, priority: 'context', channelIds: [channelId], title: `Razmotri dodatno opažanje: ${CHANNELS[channelId].label}`, reason: 'Ovaj registrovani kanal nedostaje. Prikupi ga samo ako odgovara izabranom postupku i mjernom instrumentu.' });
    if (!baseline && metrics.length) nextChecks.push({ id: 'baseline', priority: 'reference', channelIds: metrics.map(metric => metric.id), title: 'Zabilježi referentni niz prije zahvata', reason: 'Bez reference nema poređenja prije i poslije.' });
    const sourceIds = [...bySource.keys()].sort();
    const hasSampleData = allFrames.some(frame => frame.context.sample === true || frame.context.synthetic === true || ['sample', 'demo'].includes(frame.context.dataset));
    const limitations = [
      'Ovo je deterministička analiza zabilježenih mjerenja, bez AI modela i bez automatske potvrde tehničke ispravnosti.',
      'Porijeklo izvora i vremenske oznake su zapisani podaci. Identitet uređaja, kalibracija, mjerna nesigurnost i autentičnost nisu kriptografski provjereni.',
      'Nema ugrađenih proizvođačkih pragova kvara. Uočena promjena ili neslaganje ne dokazuje uzrok.',
      'Mjerenja različitih kanala mogu biti uzastopna. Istovremenost se ne pretpostavlja bez jednakih vremenskih oznaka ili preklopljenih deklarisanih intervala.',
      'Zaostajanje kanala računa se prema kraju zabilježenog niza, ne prema tekućem satu. Replay je reproduktivan.'
    ];
    if (session.origin === 'imported') limitations.push('Sesija je uvezena iz datoteke i dobila je novi identitet. Uvezeni transportni opis nije dokaz trenutno povezanog uređaja.');
    if (hasSampleData) limitations.push('Zapis sadrži označene primjerene/sintetičke podatke; ne predstavlja živo mjerenje.');
    if (session.droppedFrames) limitations.push(`Zadržano je najviše ${MAX_FRAMES} posljednjih okvira; ranije uklonjeno: ${session.droppedFrames}. Referenca se čuva zasebno.`);
    if (mode === 'SHADOW') limitations.push('Alternativa isključuje odabrane izvore na kopiji zapisa. Živa sesija i njeni podaci nisu promijenjeni.');
    const orderedChecks = nextChecks.sort((a, b) => ['conflict', 'data', 'context', 'reference'].indexOf(a.priority) - ['conflict', 'data', 'context', 'reference'].indexOf(b.priority) || a.id.localeCompare(b.id));
    const report = {
      mode, rulesVersion: EVIDENCE_RULES,
      summary: { sessionId: session.id, toolId: session.toolId, frameCount: session.frames.length, currentFrameCount: currentFrames.length, baselineFrameCount: baseline?.frames.length || 0, channelCount: metrics.length, sourceCount: sourceIds.length, sourceIds, baselineId: baseline?.id || null, hasSampleData, origin: session.origin, excludedSourceIds: excluded, status: !metrics.length ? 'no-evidence' : decisions.length ? 'observations-to-verify' : 'recorded-evidence', liveDataModified: false },
      metrics, findings: findings.slice(0, 200), decisions: decisions.slice(0, 100), nextChecks: orderedChecks.slice(0, 100), limitations,
      trace: [
        trace('Core AI Manager', 'evidence.coordinate', session.frames.length, currentFrames.length, 'Odabran ograničeni niz; nijedan AI zahtjev nije poslan.'),
        trace('Link Bridge Elite', 'measurement.validate', session.frames.length, session.frames.length, 'Provjeren verzionisani okvir, konačne vrijednosti, jedinice i izvor.'),
        trace('Expansion Q', 'channel.resolve', channelIds.length, metrics.length, `Korišten eksplicitni registar ${EVIDENCE_RULES}.`),
        trace('Adaptive Recovery', 'analysis.isolate', session.frames.length, 0, 'Analiza koristi odvojenu provjerenu kopiju; nema upisa u živu sesiju.'),
        trace('Holo Interaction', 'metrics.prepare', channelIds.length, metrics.length, 'Pripremljene stvarne numeričke serije i sažeci za korisnički prikaz; prikaz nije simuliran u ovom modulu.'),
        trace('Fallback Executor', 'insufficient-evidence.handle', metrics.length, metrics.filter(metric => metric.count < 5).length, 'Kad dokaz nedostaje, predloženo je novo opažanje umjesto izmišljenog rezultata.'),
        trace('Vision Q', 'decision.explain', metrics.length, decisions.length, 'Odluke navode stvarne izvore, brojeve uzoraka i zabilježene razlike.')
      ]
    };
    return copy(report);
  }
}
