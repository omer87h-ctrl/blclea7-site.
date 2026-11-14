/* CLEA Tool Composer — original declarative measurement pipelines.
 * A recipe contains versioned data operators, never JavaScript or device commands.
 * Source labels and imported origins are reported provenance, not attestation. */
import { validateInvestigation, INVESTIGATION_FORMAT } from './investigation-engine.js';
import { EvidenceEngine, CHANNELS, SESSION_FORMAT } from './evidence-engine.js';
import { DEVICE_OBSERVATIONS } from './device-core.js';

export const TOOL_FORMAT = 'blclea.tool/1';
export const TOOL_RESULT_FORMAT = 'blclea.tool-result/1';
export const TOOL_OPERATION_DEFINITIONS = Object.freeze([
  { operator: 'moving-median/1', label: 'Pomični medijan', window: true, description: 'Medijan punog završnog prozora u istoj grupi kontinuiteta.' },
  { operator: 'moving-mean/1', label: 'Pomični prosjek', window: true, description: 'Aritmetički prosjek punog završnog prozora; uzorci imaju jednaku težinu.' },
  { operator: 'rms/1', label: 'RMS očitanja', window: true, description: 'Korijen prosjeka kvadrata stvarnih očitanja u punom prozoru; bez tvrdnje o snazi ili kalibraciji.' },
  { operator: 'absolute/1', label: 'Apsolutna vrijednost', window: false, description: 'Apsolutna vrijednost svake tačke, uz sačuvanu jedinicu i dokaz.' },
  { operator: 'rate/1', label: 'Stopa promjene', window: false, description: 'Razlika susjednih vrijednosti podijeljena stvarnim pozitivnim vremenom u sekundama.' },
  { operator: 'integrate/1', label: 'Vremenski integral', window: false, description: 'Zbir trapeza kroz stvarno pozitivno vrijeme; početna konstanta je izričito nula u svakoj grupi.' }
].map(definition => Object.freeze(definition)));
export const TOOL_OPERATORS = Object.freeze(['select/1', ...TOOL_OPERATION_DEFINITIONS.map(definition => definition.operator), 'summarize/1', 'compare-reference/1']);
const WINDOW_OPERATORS = new Set(TOOL_OPERATION_DEFINITIONS.filter(definition => definition.window).map(definition => definition.operator));
const MAX_BYTES = 1024 * 1024, MAX_SAMPLES = 240, MAX_STAGES = 8;
const BAD = new Set(['__proto__', 'prototype', 'constructor']);
const fail = message => { const error = new Error(message); error.code = 'TOOL_INPUT'; throw error; };
const ensure = (condition, message) => { if (!condition) fail(message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const bytes = value => new TextEncoder().encode(value).length;
const copy = value => JSON.parse(JSON.stringify(value));
function inspect(root) {
  const active = new WeakSet(), stack = [{ value: root, depth: 0, leave: false }]; let nodes = 0;
  while (stack.length) {
    const { value, depth, leave } = stack.pop();
    if (leave) { active.delete(value); continue; }
    ensure(++nodes <= 140000 && depth <= 24, 'Strukturirani podaci su previše složeni.');
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'number') { ensure(Number.isFinite(value), 'Broj mora biti konačan.'); continue; }
    if (typeof value === 'string') { ensure(value.length <= MAX_BYTES, 'Tekst je predug.'); continue; }
    ensure(Array.isArray(value) ? Object.getPrototypeOf(value) === Array.prototype : plain(value), 'Dozvoljeni su samo obični JSON podaci bez prilagođenog prototipa.');
    ensure(!active.has(value), 'Kružne reference nisu dozvoljene.'); active.add(value); stack.push({ value, leave: true });
    const names = Reflect.ownKeys(value); ensure(names.length <= 4096, 'Previše polja u strukturiranim podacima.');
    if (Array.isArray(value)) ensure(value.length <= 4095 && names.length === value.length + 1, 'Niz mora biti potpun, bez dodatnih polja.');
    for (const name of names) {
      ensure(typeof name === 'string' && !BAD.has(name), 'Opasno ili simboličko ime polja nije dozvoljeno.');
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      ensure(descriptor && Object.hasOwn(descriptor, 'value'), 'Izvršni pristupnici nisu dozvoljeni.');
      if (Array.isArray(value) && name === 'length') continue;
      ensure(descriptor.enumerable, 'Skrivena polja nisu dozvoljena.');
      if (Array.isArray(value)) ensure(/^(0|[1-9][0-9]*)$/.test(name) && Number(name) < value.length, 'Niz sadrži dodatna polja.');
      stack.push({ value: descriptor.value, depth: depth + 1, leave: false });
    }
  }
  ensure(bytes(JSON.stringify(root)) <= MAX_BYTES, 'Strukturirani JSON premašuje 1 MiB.');
}
function keys(value, allowed) { ensure(plain(value), 'Očekivan je strukturirani objekat.'); for (const key of Object.keys(value)) ensure(allowed.includes(key), 'Nepodržano polje alata: ' + key + '.'); }
function text(value, max = 160, empty = false) { ensure(typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0), 'Neispravan tekst alata.'); return value; }
function id(value) { ensure(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(value) && !BAD.has(value), 'Neispravan identifikator alata ili dokaza.'); return value; }
function date(value) { ensure(typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)), 'Neispravna vremenska oznaka.'); return value; }
function numeric(value) { ensure(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12, 'Referenca mora biti konačan broj do 10¹².'); return value; }
function channelSpec(channelId) {
  if (Object.hasOwn(CHANNELS, channelId)) return CHANNELS[channelId];
  if (Object.hasOwn(DEVICE_OBSERVATIONS, channelId) && DEVICE_OBSERVATIONS[channelId].type !== 'text') return DEVICE_OBSERVATIONS[channelId];
  if (/^gamepadAxis(?:[0-9]|[12][0-9]|3[01])$/.test(channelId) || /^gamepadButton(?:[0-9]|[1-5][0-9]|6[0-3])$/.test(channelId)) return { label: channelId, unit: '1' };
  fail('Kanal nije registrovana numerička veličina.');
}
const SELECTION_KEYS = ['channelId', 'sourceId', 'sourceKind', 'profileId', 'originSession', 'unit'];
function selection(value, allowDescriptor = false) {
  keys(value, allowDescriptor ? [...SELECTION_KEYS, 'key', 'label', 'count', 'imported', 'testOnly'] : SELECTION_KEYS);
  const spec = channelSpec(id(value.channelId)); id(value.sourceId); id(value.sourceKind); id(value.profileId);
  ensure(value.originSession === null || typeof value.originSession === 'string', 'Nedostaje izvorna sesija odabranog toka.'); if (value.originSession !== null) id(value.originSession);
  ensure(value.unit === spec.unit, 'Odabrani kanal zahtijeva istu registrovanu jedinicu.');
  return Object.fromEntries(SELECTION_KEYS.map(key => [key, value[key]]));
}
function boundedUnit(unit) { ensure(typeof unit === 'string' && unit.length > 0 && unit.length <= 48, 'Izvedena jedinica mora imati najviše 48 znakova.'); return unit; }
const rateUnit = unit => boundedUnit(unit.includes('/') ? '(' + unit + ')/s' : unit + '/s');
const integralUnit = unit => boundedUnit(unit + '·s');
const fresh = () => { ensure(globalThis.crypto?.randomUUID, 'Sigurno generisanje identifikatora nije dostupno.'); return globalThis.crypto.randomUUID(); };
export function validateRecipe(input) {
  inspect(input); keys(input, ['format', 'id', 'title', 'createdAt', 'origin', 'importedFrom', 'importedAt', 'stages']);
  ensure(input.format === TOOL_FORMAT, 'Nepodržana verzija recepta.'); id(input.id); text(input.title); date(input.createdAt);
  ensure(['local', 'imported'].includes(input.origin), 'Nepoznato porijeklo recepta.');
  ensure(input.importedFrom === null || typeof input.importedFrom === 'string', 'Neispravno porijeklo recepta.'); if (input.importedFrom !== null) id(input.importedFrom);
  ensure(input.importedAt === null || typeof input.importedAt === 'string', 'Neispravno vrijeme uvoza.'); if (input.importedAt !== null) date(input.importedAt);
  ensure(input.origin === 'imported' ? input.importedFrom !== null && input.importedAt !== null : input.importedFrom === null && input.importedAt === null, 'Porijeklo recepta nije dosljedno.');
  ensure(Array.isArray(input.stages) && input.stages.length >= 2 && input.stages.length <= MAX_STAGES, 'Recept mora imati 2–8 koraka.');
  let summarized = false, compared = false, unit = null;
  input.stages.forEach((stage, index) => {
    ensure(plain(stage) && TOOL_OPERATORS.includes(stage.operator), 'Nepoznat operator ili verzija operatora.');
    if (stage.operator === 'select/1') { keys(stage, ['operator', ...SELECTION_KEYS]); ensure(index === 0, 'Odabir toka mora biti prvi i jedini.'); unit = selection(Object.fromEntries(SELECTION_KEYS.map(key => [key, stage[key]]))).unit; }
    else {
      ensure(index > 0 && unit !== null && !compared, 'Operator nema odgovarajući prethodni korak.');
      if (WINDOW_OPERATORS.has(stage.operator)) { keys(stage, ['operator', 'window']); ensure(!summarized && Number.isInteger(stage.window) && stage.window >= 3 && stage.window <= 21 && stage.window % 2 === 1, 'Operator prozora zahtijeva neparan puni prozor 3–21 prije sažetka.'); }
      if (stage.operator === 'absolute/1') { keys(stage, ['operator']); ensure(!summarized, 'Apsolutna vrijednost mora prethoditi sažetku.'); }
      if (stage.operator === 'rate/1') { keys(stage, ['operator']); ensure(!summarized, 'Stopa promjene mora prethoditi sažetku.'); unit = rateUnit(unit); }
      if (stage.operator === 'integrate/1') { keys(stage, ['operator']); ensure(!summarized, 'Integral mora prethoditi sažetku.'); unit = integralUnit(unit); }
      if (stage.operator === 'summarize/1') { keys(stage, ['operator']); ensure(!summarized, 'Sažetak se može izvršiti samo jednom.'); summarized = true; }
      if (stage.operator === 'compare-reference/1') { keys(stage, ['operator', 'value', 'unit', 'documentLabel']); ensure(summarized && stage.unit === unit && index === input.stages.length - 1, 'Poređenje zahtijeva sažetak, istu izvedenu jedinicu i posljednji korak.'); numeric(stage.value); text(stage.documentLabel, 600); compared = true; }
    }
  });
  boundedUnit(unit); rateUnit(unit);
  ensure(summarized && (input.stages.at(-1).operator === 'summarize/1' || compared), 'Recept mora završiti sažetkom ili eksplicitnom referencom.');
  return copy(input);
}
const streamKey = value => JSON.stringify([value.channelId, value.sourceId, value.sourceKind, value.profileId, value.originSession, value.unit]);
const sourceKey = value => JSON.stringify([value.sourceId, value.sourceKind, value.profileId, value.originSession]);
function sourceRows(raw) {
  inspect(raw); let state, rows, sameDevice = false;
  if (raw.format === INVESTIGATION_FORMAT) {
    state = validateInvestigation(raw); sameDevice = state.context.sameDeviceConfirmed === true;
    rows = state.samples.map(sample => ({ evidenceId: sample.id, originId: sample.originId, originSession: sample.originSession, sourceId: sample.sourceId, sourceKind: sample.transport, profileId: sample.profileId, at: sample.at, phase: sample.phase, kind: sample.kind, windowMs: sample.windowMs, imported: sample.imported || state.origin === 'imported', testOnly: sample.testOnly, ordinal: sample.addedOrdinal, values: sample.values.map(value => ({ channelId: value.id, value: value.value, unit: value.unit, at: value.at })) }));
  } else if (raw.format === SESSION_FORMAT) {
    state = JSON.parse(new EvidenceEngine().exportSession(raw));
    rows = state.frames.map(frame => {
      const context = frame.context; const hasOrigin = context.originSession !== undefined || context.originFrameId !== undefined;
      if (hasOrigin) { id(context.originSession); id(context.originFrameId); }
      return { evidenceId: frame.id, originId: hasOrigin ? context.originFrameId : frame.id, originSession: hasOrigin ? context.originSession : state.id, sourceId: frame.sourceId, sourceKind: frame.sourceKind, profileId: 'clea.measurement/1', at: frame.capturedAt, phase: 'observation', kind: 'series', windowMs: context.windowMs || 0, imported: state.origin === 'imported' || frame.sourceKind === 'file' || hasOrigin, testOnly: context.synthetic === true || context.sample === true || context.testOnly === true || ['sample', 'demo'].includes(context.dataset), ordinal: frame.ordinal, values: frame.channels.map(channel => ({ channelId: channel.id, value: channel.value, unit: channel.unit, at: frame.capturedAt })) };
    });
  } else fail('Izvor mora biti provjerena istraga ili mjerna sesija.');
  ensure(rows.length <= MAX_SAMPLES, 'Izvor premašuje 240 uzoraka.');
  const origins = new Set(); for (const row of rows) { const origin = JSON.stringify([row.kind, row.originSession, row.originId]); ensure(!origins.has(origin), 'Ponovljeni izvorni dokaz se ne može brojati kao novo mjerenje.'); origins.add(origin); }
  return { state, rows, sameDevice };
}
function availableChannels(rows) {
  const groups = new Map();
  for (const row of rows) for (const value of row.values) {
    const descriptor = { channelId: value.channelId, sourceId: row.sourceId, sourceKind: row.sourceKind, profileId: row.profileId, originSession: row.originSession, unit: value.unit };
    const key = streamKey(descriptor); if (!groups.has(key)) groups.set(key, { key, ...descriptor, label: channelSpec(value.channelId).label || value.channelId, count: 0, imported: false, testOnly: false });
    const group = groups.get(key); group.count++; group.imported ||= row.imported; group.testOnly ||= row.testOnly;
  }
  return [...groups.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
function selectPoints(rows, selected, sameDevice, missing) {
  const points = [], evidence = []; let group = 0, previous = null, pendingBreak = true;
  for (const row of rows) {
    if (sourceKey(row) !== sourceKey(selected)) continue;
    const value = row.values.find(value => value.channelId === selected.channelId);
    if (!value) { pendingBreak = true; missing.push('Odabrani kanal nedostaje u dokazu ' + row.evidenceId + '; kontinuitet je prekinut.'); continue; }
    ensure(value.unit === selected.unit, 'Izvor je promijenio jedinicu odabranog kanala.');
    const flags = JSON.stringify([row.phase, row.imported, row.testOnly]);
    const currentTime = Date.parse(value.at), priorTime = previous ? Date.parse(previous.at) : null;
    const isolatedDevice = row.kind === 'device' && !sameDevice;
    if (pendingBreak || isolatedDevice || !previous || previous.flags !== flags || currentTime <= priorTime) {
      group++; if (previous && currentTime <= priorTime) missing.push('Nepozitivna razlika vremenskih oznaka prekida kontinuitet: ' + row.evidenceId + '.');
    }
    evidence.push({ evidenceId: row.evidenceId, originId: row.originId, originSession: row.originSession, sourceId: row.sourceId, sourceKind: row.sourceKind, profileId: row.profileId, channelId: value.channelId, value: value.value, at: value.at, sampleAt: row.at, unit: value.unit, phase: row.phase, kind: row.kind, windowMs: row.windowMs, ordinal: row.ordinal, imported: row.imported, testOnly: row.testOnly, authenticity: 'not-verified' });
    points.push({ value: value.value, at: value.at, unit: value.unit, groupId: 'g' + group, evidenceIds: [row.evidenceId], imported: row.imported, testOnly: row.testOnly });
    previous = { at: value.at, flags }; pendingBreak = false;
  }
  return { points, evidence, groupCount: group };
}
function median(values) { if (!values.length) return null; const ordered = [...values].sort((a, b) => a - b), mid = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[mid] : ordered[mid - 1] / 2 + ordered[mid] / 2; }
const unions = points => [...new Set(points.flatMap(point => point.evidenceIds))];
function groupsOf(points) { const groups = new Map(); for (const point of points) { if (!groups.has(point.groupId)) groups.set(point.groupId, []); groups.get(point.groupId).push(point); } return [...groups.entries()]; }
function mean(values) { let sum = 0; for (const value of values) { sum += value / values.length; ensure(Number.isFinite(sum), 'Izvedeni prosjek nije konačan.'); } return sum; }
function rms(values) {
  const scale = Math.max(...values.map(value => Math.abs(value))); if (scale === 0) return 0;
  const value = scale * Math.sqrt(mean(values.map(value => (value / scale) ** 2))); ensure(Number.isFinite(value), 'Izvedeni RMS nije konačan.'); return value;
}
function movingWindow(points, window, aggregate) {
  const output = [];
  for (const [, group] of groupsOf(points)) for (let index = window - 1; index < group.length; index++) {
    const contributors = group.slice(index - window + 1, index + 1), last = contributors.at(-1), value = aggregate(contributors.map(point => point.value)); ensure(Number.isFinite(value), 'Izvedena vrijednost prozora nije konačna.');
    const point = { ...last, value, evidenceIds: unions(contributors) };
    if (contributors.some(value => value.interval)) { const fromAt = contributors[0].interval?.fromAt || contributors[0].at; point.interval = { fromAt, toAt: last.at, seconds: (Date.parse(last.at) - Date.parse(fromAt)) / 1000 }; }
    output.push(point);
  }
  return output;
}
function rate(points) {
  const output = [];
  for (const [, group] of groupsOf(points)) for (let index = 1; index < group.length; index++) {
    const before = group[index - 1], after = group[index], seconds = (Date.parse(after.at) - Date.parse(before.at)) / 1000;
    ensure(seconds > 0, 'Stopa promjene zahtijeva pozitivan stvarni vremenski interval.');
    const value = (after.value - before.value) / seconds; ensure(Number.isFinite(value), 'Izvedena stopa nije konačna.');
    output.push({ ...after, value, unit: rateUnit(after.unit), evidenceIds: unions([before, after]), interval: { fromAt: before.at, toAt: after.at, seconds } });
  }
  return output;
}
function integrate(points) {
  const output = [];
  for (const [, group] of groupsOf(points)) {
    let total = 0; const evidenceIds = new Set(), firstAt = group[0].at;
    group.forEach((point, index) => {
      point.evidenceIds.forEach(evidenceId => evidenceIds.add(evidenceId));
      if (index > 0) {
        const before = group[index - 1], seconds = (Date.parse(point.at) - Date.parse(before.at)) / 1000;
        ensure(seconds > 0, 'Integral zahtijeva pozitivan stvarni vremenski interval.');
        const area = (before.value / 2 + point.value / 2) * seconds; ensure(Number.isFinite(area), 'Izvedena površina trapeza nije konačna.');
        total += area; ensure(Number.isFinite(total), 'Izvedeni integral nije konačan.');
      }
      output.push({ ...point, value: total, unit: integralUnit(point.unit), evidenceIds: [...evidenceIds], interval: { fromAt: firstAt, toAt: point.at, seconds: (Date.parse(point.at) - Date.parse(firstAt)) / 1000 }, integration: { method: 'trapezoidal', initialConstant: 0 } });
    });
  }
  return output;
}
function statistics(points, unit, allowTrend = true) {
  const values = points.map(point => point.value), center = median(values); let trend = null, durationSeconds = 0;
  if (allowTrend && points.length > 1) {
    durationSeconds = (Date.parse(points.at(-1).at) - Date.parse(points[0].at)) / 1000;
    if (durationSeconds > 0) {
      const times = points.map(point => (Date.parse(point.at) - Date.parse(points[0].at)) / 1000), meanTime = times.reduce((sum, value) => sum + value, 0) / times.length, meanValue = values.reduce((sum, value) => sum + value / values.length, 0);
      let variance = 0, covariance = 0; times.forEach((time, index) => { variance += (time - meanTime) ** 2; covariance += (time - meanTime) * (values[index] - meanValue); });
      if (variance > 0) { trend = covariance / variance; ensure(Number.isFinite(trend), 'Izvedeni trend nije konačan.'); }
    }
  }
  return { count: points.length, unit, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, median: center, mad: center === null ? null : median(values.map(value => Math.abs(value - center))), trend, trendUnit: rateUnit(unit), durationSeconds };
}
function summarize(points, unit) {
  const groups = groupsOf(points).map(([groupId, group]) => ({ groupId, ...statistics(group, unit) }));
  const summary = { ...statistics(points, unit, groups.length <= 1), groups };
  if (groups.length > 1) { summary.trend = null; summary.durationSeconds = null; }
  return summary;
}
function recipeUnit(recipe) { let unit = recipe.stages[0].unit; for (const stage of recipe.stages) { if (stage.operator === 'rate/1') unit = rateUnit(unit); if (stage.operator === 'integrate/1') unit = integralUnit(unit); } return boundedUnit(unit); }

export class ComposerEngine {
  constructor({ now = () => Date.now(), id: makeId = fresh } = {}) { this.now = now; this.id = makeId; }
  channels(source) { return availableChannels(sourceRows(source).rows); }
  createRecipe(config) {
    inspect(config); keys(config, ['title', 'selection', 'transforms', 'reference']);
    const selected = selection(config.selection, true), transforms = config.transforms === undefined ? [] : config.transforms;
    ensure(Array.isArray(transforms) && transforms.length <= MAX_STAGES - 2, 'Previše transformacija u receptu.');
    const stages = [{ operator: 'select/1', ...selected }, ...copy(transforms), { operator: 'summarize/1' }];
    if (config.reference !== undefined && config.reference !== null) { keys(config.reference, ['value', 'unit', 'documentLabel']); stages.push({ operator: 'compare-reference/1', ...config.reference }); }
    return validateRecipe({ format: TOOL_FORMAT, id: id(this.id()), title: config.title, createdAt: new Date(this.now()).toISOString(), origin: 'local', importedFrom: null, importedAt: null, stages });
  }
  validateRecipe(recipe) { return validateRecipe(recipe); }
  outputUnit(recipe) { return recipeUnit(validateRecipe(recipe)); }
  export(recipe) { return JSON.stringify(validateRecipe(recipe), null, 2); }
  import(raw) {
    ensure(typeof raw === 'string' && bytes(raw) <= MAX_BYTES, 'Datoteka recepta premašuje 1 MiB.'); let parsed;
    try { parsed = JSON.parse(raw); } catch { fail('Recept nije ispravan JSON.'); }
    const recipe = validateRecipe(parsed), freshId = id(this.id()); ensure(freshId !== recipe.id, 'Uvoz mora dobiti novi nezavisan identitet.');
    recipe.importedFrom = recipe.importedFrom || recipe.id; recipe.id = freshId; recipe.origin = 'imported'; recipe.importedAt = new Date(this.now()).toISOString();
    return validateRecipe(recipe);
  }
  run(rawRecipe, rawSource) {
    const recipe = validateRecipe(rawRecipe), { state, rows, sameDevice } = sourceRows(rawSource), selected = recipe.stages[0], missing = [], limits = [];
    const selectionResult = selectPoints(rows, selected, sameDevice, missing); let points = selectionResult.points, summary = null, reference;
    const stages = [{ operator: 'select/1', inputCount: rows.length, outputCount: points.length }]; let unit = selected.unit;
    if (!points.length) missing.push('Odabrani izvor i numerički kanal nemaju sačuvane uzorke.');
    for (const stage of recipe.stages.slice(1)) {
      const inputCount = points.length;
      if (WINDOW_OPERATORS.has(stage.operator)) {
        const aggregates = { 'moving-median/1': median, 'moving-mean/1': mean, 'rms/1': rms }, label = TOOL_OPERATION_DEFINITIONS.find(definition => definition.operator === stage.operator).label;
        points = movingWindow(points, stage.window, aggregates[stage.operator]); if (points.length < inputCount) missing.push(label + ' ' + stage.window + ': ' + (inputCount - points.length) + ' početnih ili odvojenih uzoraka nema puni prozor.');
      }
      if (stage.operator === 'absolute/1') points = points.map(point => ({ ...point, value: Math.abs(point.value), evidenceIds: [...point.evidenceIds] }));
      if (stage.operator === 'rate/1') { points = rate(points); unit = rateUnit(unit); if (points.length < inputCount) missing.push('Stopa promjene: ' + (inputCount - points.length) + ' početnih uzoraka nema prethodni uzorak u istom kontinuitetu.'); }
      if (stage.operator === 'integrate/1') { points = integrate(points); unit = integralUnit(unit); const singleGroups = groupsOf(points).filter(([, group]) => group.length === 1).length; if (singleGroups) missing.push('Integral: ' + singleGroups + ' grupa ima samo početnu konstantu nula, bez vremenskog intervala za procjenu.'); }
      ensure(points.every(point => Number.isFinite(point.value)), 'Izvedena tačka nije konačna.');
      if (stage.operator === 'summarize/1') summary = summarize(points, unit);
      if (stage.operator === 'compare-reference/1') reference = { value: stage.value, unit: stage.unit, documentLabel: stage.documentLabel, observedMedian: summary.median, delta: summary.median === null ? null : summary.median - stage.value, relation: summary.median === null ? 'unknown' : summary.median === stage.value ? 'equal' : summary.median > stage.value ? 'above' : 'below', status: 'user-supplied-reference' };
      stages.push({ operator: stage.operator, inputCount, outputCount: points.length });
    }
    if (selectionResult.groupCount > 1) limits.push('Kontinuitet je razdvojen u ' + selectionResult.groupCount + ' grupe; filteri i stopa ne prelaze njihove granice, a zajednički trend nije izveden.');
    if (selectionResult.evidence.some(value => value.testOnly)) limits.push('OZNAČENI TESTNI PODACI: dio ili sva očitanja su prijavljena kao testna.');
    if (selectionResult.evidence.some(value => value.imported)) limits.push('Uvezeni podaci ostaju uvezeni; fizičko porijeklo nije potvrđeno.');
    if (rows.some(row => row.kind === 'device') && !sameDevice) limits.push('Isti fizički uređaj nije potvrđen; snimci uređaja ostaju u odvojenim grupama.');
    if (state.droppedFrames > 0) limits.push('Izvor je ranije uklonio ' + state.droppedFrames + ' okvira; njihov sadržaj nije rekonstruisan.');
    if (state.baseline) limits.push('Obrada koristi trenutne okvire zapisa; odvojena referentna kopija nije dodata kao novo mjerenje.');
    if (recipe.origin === 'imported') limits.push('Recept je uvezen i izvršava samo podržane deklarativne operatore.');
    if (recipe.stages.some(stage => stage.operator === 'integrate/1')) limits.push('Integral koristi trapeznu aproksimaciju između sačuvanih tačaka i izričito nultu početnu konstantu u svakoj grupi; ne dokazuje ponašanje između očitanja niti fizičku energiju.');
    if (recipe.stages.some(stage => stage.operator === 'rms/1')) limits.push('RMS je matematički RMS dostavljenih očitanja; snaga, oblik kontinuiranog signala i kalibracija nisu potvrđeni.');
    if (!reference) limits.push('Dokumentovana referentna vrijednost nije zadata; sažetak nije ocjena ispravnosti.');
    limits.push('Oznaka izvora i korisnička potvrda nisu hardverska potvrda identiteta ili tačnosti.', 'Nema ukupnog rezultata zdravlja, pretpostavljenih fabričkih granica ili zaključka o uzroku.');
    const uniqueMissing = [...new Set(missing)], trace = [
      { pillar: 'Core AI Manager', operation: 'recipe.validate', inputCount: recipe.stages.length, outputCount: recipe.stages.length, detail: 'Provjereni su verzionirani operatori; AI i proizvoljni kod nisu izvršavani.' },
      { pillar: 'Link Bridge Elite', operation: 'source.validate', inputCount: rows.length, outputCount: rows.length, detail: 'Primljen je validiran postojeći zapis ' + state.format + '; nova očitanja nisu proizvedena.' },
      { pillar: 'Expansion Q', operation: 'stream.select', inputCount: rows.length, outputCount: selectionResult.points.length, detail: 'Odabran je jedan kanal, jedinica, izvor, profil i izvorna sesija.' },
      { pillar: 'Adaptive Recovery', operation: 'continuity.partition', inputCount: selectionResult.points.length, outputCount: selectionResult.groupCount, detail: 'Granice konteksta i nepozitivna vremena razdvajaju grupe bez nadomještanja vrijednosti.' },
      { pillar: 'Holo Interaction', operation: 'pipeline.execute', inputCount: selectionResult.points.length, outputCount: points.length, detail: 'Izvršeno je ' + stages.length + ' deklarativnih koraka; pripremljene su stvarne izvedene tačke.' },
      { pillar: 'Fallback Executor', operation: 'missing.report', inputCount: selectionResult.points.length, outputCount: uniqueMissing.length, detail: 'Nedovoljni prozori i nedostajući dokazi su izričito prijavljeni.' },
      { pillar: 'Vision Q', operation: 'summary.explain', inputCount: points.length, outputCount: summary.count, detail: 'Sažetak i ' + (reference ? 'korisnička referenca' : 'odsustvo reference') + ' vezani su za sačuvane oznake dokaza.' }
    ];
    const result = { format: TOOL_RESULT_FORMAT, recipeId: recipe.id, points, summary, ...(reference ? { reference } : {}), missing: uniqueMissing, limits, trace, provenance: { sourceFormat: state.format, sourceId: state.id, sourceRevision: state.revision, sourceOrigin: state.origin, sourceImportedAt: state.importedAt, recipeOrigin: recipe.origin, recipeImportedFrom: recipe.importedFrom, selection: selection(Object.fromEntries(SELECTION_KEYS.map(key => [key, selected[key]]))), inputCount: rows.length, selectedCount: selectionResult.evidence.length, excludedCount: rows.length - selectionResult.evidence.length, stages, evidence: selectionResult.evidence, authenticity: 'not-verified' } };
    inspect(result); return result;
  }
}
