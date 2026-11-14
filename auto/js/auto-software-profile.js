/* Original CLEA AUTO software policy. BIL selects a bounded read strategy;
 * the host maps that enum to fixed advertised PIDs. No vehicle operation is
 * performed here, and request counts do not measure hardware performance. */
import { BILToolsBridge, BIL_TOOL_RESULT_FORMAT } from './bil-tools-bridge.js';
import { DEFAULT_OBD_SNAPSHOT_COMMANDS } from './diagnostics.js';

export const AUTO_PROFILE_BIL_SOURCE = `let symptomText = "general"
let hasFuelPairBool = false
let hasFuelTrimBool = false
let hasAirBool = false
let hasVoltageBool = false
let hasEngineBool = false
let hasFuelStatusBool = false
let hasRuntimeBool = false
const policyVersion = "1"
let strategy = "general"
show strategy
on select {
 strategy = "general"
 if symptomText == "rough-running" {
  if hasFuelPairBool or hasFuelTrimBool or hasAirBool or hasEngineBool or hasFuelStatusBool {
   strategy = "rough-running"
  }
 }
 if symptomText == "power-loss" {
  if hasAirBool or hasVoltageBool or hasEngineBool or hasFuelStatusBool {
   strategy = "power-loss"
  }
 }
 if symptomText == "starting" {
  if hasVoltageBool or hasEngineBool or hasFuelStatusBool or hasRuntimeBool {
   strategy = "starting"
  }
 }
}`;

const STRATEGIES = Object.freeze({
  general: DEFAULT_OBD_SNAPSHOT_COMMANDS,
  'rough-running': Object.freeze(['010C', '0103', '0106', '0107', '010B', '0110', '0104']),
  'power-loss': Object.freeze(['010C', '0103', '0104', '010B', '0110', '0142']),
  starting: Object.freeze(['010C', '0142', '011F', '0103'])
});
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function fault(message, code = 'AUTO_SOFTWARE_PROFILE_INPUT') { return Object.assign(new Error(message), { code }); }
function ensure(condition, message, code) { if (!condition) throw fault(message, code); }
function supportedSet(symptom, supportedPids) {
  ensure(typeof symptom === 'string' && own(STRATEGIES, symptom), 'Odaberite podržan AUTO simptom za BIL profil.');
  ensure(Array.isArray(supportedPids) && Object.getPrototypeOf(supportedPids) === Array.prototype && supportedPids.length <= 96, 'BIL profil zahtijeva ograničen skup prijavljenih PID-ova.');
  const names = Reflect.ownKeys(supportedPids);
  ensure(names.length === supportedPids.length + 1, 'Lista podrške mora biti potpuna i bez dodatnih polja.');
  const supported = new Set();
  for (let index = 0; index < supportedPids.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(supportedPids, String(index));
    ensure(descriptor && own(descriptor, 'value') && descriptor.enumerable, 'Izvršni ili nepotpuni PID ulazi nisu dozvoljeni.');
    const command = descriptor.value;
    ensure(typeof command === 'string' && /^01[0-9A-F]{2}$/.test(command) && !supported.has(command), 'PID ulazi moraju biti jedinstveni standardni identifikatori.');
    supported.add(command);
  }
  return supported;
}

/** Only these copied primitive flags enter the original BIL interpreter. */
export function buildAutoProfileInput(symptom, supportedPids) {
  const supported = supportedSet(symptom, supportedPids), has = command => supported.has(command);
  return {
    symptomText: symptom,
    hasFuelPairBool: has('0106') && has('0107'),
    hasFuelTrimBool: has('0106') || has('0107'),
    hasAirBool: ['0104', '010B', '0110'].some(has),
    hasVoltageBool: has('0142'),
    hasEngineBool: has('010C'),
    hasFuelStatusBool: has('0103'),
    hasRuntimeBool: has('011F')
  };
}

function copyResult(input) {
  const active = new WeakSet(), stack = [{ value: input, depth: 0 }]; let nodes = 0;
  while (stack.length) {
    const { value, depth, leave } = stack.pop();
    if (leave) { active.delete(value); continue; }
    ensure(++nodes <= 30000 && depth <= 24, 'BIL rezultat je previše složen.', 'AUTO_SOFTWARE_PROFILE_RESULT');
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'string') { ensure(value.length <= 32768, 'BIL rezultat sadrži predug tekst.', 'AUTO_SOFTWARE_PROFILE_RESULT'); continue; }
    if (typeof value === 'number') { ensure(Number.isFinite(value), 'BIL rezultat sadrži neispravan broj.', 'AUTO_SOFTWARE_PROFILE_RESULT'); continue; }
    const array = Array.isArray(value);
    ensure(array ? Object.getPrototypeOf(value) === Array.prototype : plain(value), 'BIL rezultat mora sadržavati obične podatke.', 'AUTO_SOFTWARE_PROFILE_RESULT');
    ensure(!active.has(value), 'BIL rezultat sadrži kružnu referencu.', 'AUTO_SOFTWARE_PROFILE_RESULT');
    active.add(value); stack.push({ value, leave: true });
    const names = Reflect.ownKeys(value);
    ensure(names.length <= 2049 && (!array || names.length === value.length + 1), 'BIL rezultat ima neispravnu strukturu.', 'AUTO_SOFTWARE_PROFILE_RESULT');
    for (const key of names) {
      ensure(typeof key === 'string' && !BAD_KEYS.has(key), 'Nedozvoljeno polje BIL rezultata.', 'AUTO_SOFTWARE_PROFILE_RESULT');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      ensure(descriptor && own(descriptor, 'value'), 'Izvršni BIL rezultat nije dozvoljen.', 'AUTO_SOFTWARE_PROFILE_RESULT');
      if (array && key === 'length') continue;
      ensure(descriptor.enumerable && (!array || /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < value.length), 'Neispravno polje BIL rezultata.', 'AUTO_SOFTWARE_PROFILE_RESULT');
      stack.push({ value: descriptor.value, depth: depth + 1 });
    }
  }
  const serialized = JSON.stringify(input);
  ensure(new TextEncoder().encode(serialized).length <= 1048576, 'BIL rezultat premašuje 1 MiB.', 'AUTO_SOFTWARE_PROFILE_RESULT');
  return JSON.parse(serialized);
}

/** Runs the real original BIL compiler/runtime in its existing disposable worker.
 * The returned enum never becomes a raw adapter command or executable source. */
export async function selectAutoSoftwareProfile(symptom, supportedPids, { bridge = new BILToolsBridge(), signal } = {}) {
  const input = buildAutoProfileInput(symptom, supportedPids), supported = supportedSet(symptom, supportedPids);
  ensure(bridge && typeof bridge.run === 'function', 'Nedostaje izvršni BIL most.');
  ensure(signal == null || signal instanceof AbortSignal, 'Neispravan signal otkazivanja BIL profila.');
  if (signal?.aborted) throw fault('BIL profil je zaustavljen.', 'BIL_TOOLS_ABORT');
  const result = copyResult(await bridge.run({ source: AUTO_PROFILE_BIL_SOURCE, inputs: { ...input }, event: 'select', mode: 'LIVE' }, { signal }));
  if (signal?.aborted) throw fault('BIL profil je zaustavljen.', 'BIL_TOOLS_ABORT');
  const invalid = 'AUTO_SOFTWARE_PROFILE_RESULT';
  ensure(plain(result) && result.format === BIL_TOOL_RESULT_FORMAT && result.mode === 'LIVE' && plain(result.values), 'Nedostaje stvarni BIL rezultat profila.', invalid);
  const values = result.values, expectedNames = [...Object.keys(input), 'policyVersion', 'strategy'];
  ensure(Object.keys(values).length === expectedNames.length && Object.keys(values).every(key => expectedNames.includes(key)), 'BIL rezultat ne odgovara fiksnom programu profila.', invalid);
  ensure(Object.entries(input).every(([key, value]) => values[key] === value) && values.policyVersion === '1', 'BIL ulazi ili verzija politike ne odgovaraju ovom zahtjevu.', invalid);
  ensure(typeof values.strategy === 'string' && own(STRATEGIES, values.strategy), 'BIL je vratio nepoznatu strategiju.', invalid);
  // Check the enum against this policy's admitted input combinations. Selection
  // still comes from BIL; this check prevents another known enum crossing input.
  const expectedStrategy = STRATEGIES[symptom].some(command => supported.has(command)) ? symptom : 'general';
  ensure(values.strategy === expectedStrategy, 'BIL strategija ne odgovara prijavljenom simptomu i podršci.', invalid);
  ensure(Array.isArray(result.trace) && result.trace.some(row => row && row.phase === 'select' && row.instruction === 'STORE' && Array.isArray(row.writes) && row.writes.includes('strategy')), 'Nedostaje stvarni BIL trag upisa strategije.', invalid);
  const baselineCommands = DEFAULT_OBD_SNAPSHOT_COMMANDS.filter(command => supported.has(command));
  const selected = STRATEGIES[values.strategy].filter(command => supported.has(command));
  const selectedCount = selected.length, baselineCount = baselineCommands.length;
  return {
    format: 'blclea.auto-software-profile/1', policyVersion: '1', strategy: values.strategy,
    commands: selectedCount ? selected : [...DEFAULT_OBD_SNAPSHOT_COMMANDS],
    baselineCommands, selectedCount, baselineCount,
    reducedRequests: selectedCount > 0 && selectedCount < baselineCount,
    bil: { source: AUTO_PROFILE_BIL_SOURCE, input: { ...input }, result }
  };
}
