/* CLEA Link Session — original bounded device-acquisition broker.
 * Providers are trusted, explicitly connected application adapters. This module
 * does not discover devices, execute imported code or simulate measurements.
 */

const MIN_INTERVAL = 500;
const MAX_INTERVAL = 5000;
const MAX_DURATION = 120000;
const MAX_SOURCES = 4;
const DEVICE_KINDS = new Set(['obd-ble', 'sensor-ble', 'serial']);
const FRAME_KEYS = new Set(['format', 'id', 'sourceId', 'sourceKind', 'capturedAt', 'channels', 'context']);
const CONFIG_KEYS = new Set(['id', 'label', 'kind', 'read', 'intervalMs']);

function error(message, code = 'LINK_SESSION') { const e = new Error(message); e.code = code; return e; }
function assert(condition, message, code) { if (!condition) throw error(message, code); }
function identifier(value) { assert(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value), 'Neispravan identifikator izvora.'); return value; }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }
function boundedInterval(value) { assert(typeof value === 'number' && Number.isFinite(value) && value >= MIN_INTERVAL && value <= MAX_INTERVAL, 'Interval izvora mora biti između 500 i 5000 ms.'); return Math.ceil(value); }
function median(values) { const a = [...values].sort((x, y) => x - y), mid = Math.floor(a.length / 2); return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2; }
function defaultSleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export class LinkSession {
  constructor({ engine, onUpdate = () => {}, now = () => Date.now(), sleep = defaultSleep } = {}) {
    assert(engine && ['ingest', 'analyze', 'setBaseline', 'replay', 'shadow', 'exportSession'].every(method => typeof engine[method] === 'function'), 'Link Session zahtijeva provjeren EvidenceEngine.');
    assert(typeof onUpdate === 'function' && typeof now === 'function' && typeof sleep === 'function', 'Neispravni lokalni adapteri brokera.');
    this._engine = engine;
    this._onUpdate = onUpdate;
    this._now = now;
    this._sleep = sleep;
    this._session = null;
    this._report = null;
    this._sources = new Map();
    this._locks = new Map();
    this._generation = 0;
    this._sourceGeneration = 0;
    this._activeToken = null;
    this._waiters = new Set();
  }

  get capturing() { return this._activeToken !== null; }
  _ms() {
    const supplied = this._now();
    const value = typeof supplied === 'string' ? Date.parse(supplied) : supplied;
    assert(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8.64e15, 'Sat brokera nije dostupan.');
    return value;
  }
  _cloneSession(session) { return JSON.parse(this._engine.exportSession(session)); }
  _requireSession() { assert(this._session, 'Prvo otvori mjernu sesiju.', 'NO_SESSION'); }
  _snapshot(extra = {}) { return { session: this.getSession(), report: this._report ? JSON.parse(JSON.stringify(this._report)) : null, health: this.getHealth(), ...extra }; }
  _emit() {
    if (!this._session) return;
    this._report = this._engine.analyze(this._session);
    const data = this._snapshot();
    try { this._onUpdate(data.session, data.report, data.health); }
    catch { /* UI/storage observers cannot acquire additional device privileges or undo ingestion. */ }
  }
  _wake() { for (const resolve of this._waiters) resolve(); this._waiters.clear(); }
  _wait(ms, token) {
    if (token !== this._generation) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = () => { if (settled) return; settled = true; this._waiters.delete(done); resolve(); };
      this._waiters.add(done);
      Promise.resolve().then(() => this._sleep(ms)).then(done, failure => {
        if (settled) return;
        settled = true; this._waiters.delete(done); reject(failure);
      });
    });
  }

  start(input) {
    // Invalid imported sessions cannot stop or replace a valid active session.
    const session = this._cloneSession(input);
    this.stopCapture();
    this._session = session;
    this._emit();
    return this._snapshot();
  }
  attach(config) {
    assert(plain(config), 'Izvor mora biti lokalno definisan adapter.');
    for (const key of Object.keys(config)) {
      assert(CONFIG_KEYS.has(key), 'Nepodržano polje konfiguracije izvora.');
      assert('value' in Object.getOwnPropertyDescriptor(config, key), 'Izvršni pristupnici nisu dozvoljeni u konfiguraciji.');
    }
    const sourceId = identifier(config.id);
    assert(!this._sources.has(sourceId), 'Izvor je već priključen. Prvo ga odspoji.', 'SOURCE_EXISTS');
    assert(this._sources.size < MAX_SOURCES, 'Istovremeno su dozvoljena najviše četiri izvora.', 'SOURCE_LIMIT');
    assert(typeof config.label === 'string' && config.label.trim().length > 0 && config.label.length <= 100, 'Izvor mora imati kratak lokalni naziv.');
    assert(DEVICE_KINDS.has(config.kind), 'Broker prihvata samo eksplicitne podržane uređajne adaptere.', 'SOURCE_KIND');
    assert(typeof config.read === 'function', 'Izvor mora imati lokalnu funkciju stvarnog očitanja.');
    const interval = boundedInterval(config.intervalMs ?? 1000);
    this._sources.set(sourceId, {
      id: sourceId, label: config.label, kind: config.kind, read: config.read,
      configuredIntervalMs: interval, intervalMs: interval, connected: false,
      reads: 0, errors: 0, lastDurationMs: null, lastAt: null, state: 'attached',
      recentDurations: [], nextDue: 0, promise: null, token: ++this._sourceGeneration, errorCode: null
    });
    this._emit();
    return this.getHealth().find(source => source.id === sourceId);
  }
  detach(sourceId) {
    identifier(sourceId);
    const source = this._sources.get(sourceId);
    if (!source) return false;
    source.token = ++this._sourceGeneration;
    source.connected = false;
    source.state = 'detached';
    this._sources.delete(sourceId);
    this._wake();
    this._emit();
    return true;
  }
  getSession() { return this._session ? this._cloneSession(this._session) : null; }
  getHealth() {
    return [...this._sources.values()].map(source => ({
      id: source.id, label: source.label, kind: source.kind, connected: source.connected,
      reads: source.reads, errors: source.errors, lastDurationMs: source.lastDurationMs,
      lastAt: source.lastAt, state: source.state, intervalMs: source.intervalMs,
      errorCode: source.errorCode
    }));
  }
  _valid(source, generation, token) { return generation === this._generation && this._sources.get(source.id) === source && source.token === token; }
  _normalizeFrame(input, source) {
    assert(plain(input), 'Adapter nije vratio strukturirani mjerni okvir.', 'SOURCE_FRAME');
    const result = {};
    for (const key of Object.keys(input)) {
      assert(FRAME_KEYS.has(key), 'Adapter je vratio nepodržano polje okvira.', 'SOURCE_FRAME');
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      assert(descriptor && 'value' in descriptor, 'Adapter je vratio izvršni pristupnik.', 'SOURCE_FRAME');
      result[key] = descriptor.value;
    }
    assert(result.format === 'clea.measurement/1', 'Adapter nema podržanu verziju mjernog okvira.', 'SOURCE_FRAME');
    assert(result.sourceKind === source.kind, 'Vrsta transporta ne odgovara priključenom izvoru.', 'SOURCE_FRAME');
    // Device-assigned or hardware-derived identifiers are never propagated.
    result.sourceId = source.id;
    return result;
  }
  _read(source, generation, requestedInterval = MIN_INTERVAL) {
    if (this._locks.has(source.id)) return this._locks.get(source.id);
    if (source.promise) return source.promise; // No queue and no overlapping device operation.
    if (source.state === 'unavailable') return Promise.resolve({ id: source.id, status: 'unavailable' });
    const token = source.token, started = this._ms();
    source.state = 'reading';
    const operation = Promise.resolve().then(() => source.read()).then(raw => {
      if (!this._valid(source, generation, token)) return { id: source.id, status: 'cancelled' };
      const finished = this._ms();
      source.lastDurationMs = Math.max(0, Math.round(finished - started));
      source.lastAt = new Date(finished).toISOString();
      source.recentDurations.push(source.lastDurationMs);
      source.recentDurations = source.recentDurations.slice(-5);
      source.intervalMs = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, source.configuredIntervalMs, requestedInterval, Math.ceil(median(source.recentDurations) * 1.25)));
      source.nextDue = finished + source.intervalMs;
      if (raw === null) {
        source.state = 'no-data';
        this._emit();
        return { id: source.id, status: 'no-data' };
      }
      const frame = this._normalizeFrame(raw, source);
      const next = this._engine.ingest(this._session, frame);
      // Ingestion is synchronous and validated before replacing this session.
      this._session = next;
      source.reads++;
      source.connected = true;
      source.errorCode = null;
      source.state = 'ready';
      this._emit();
      return { id: source.id, status: 'captured', frameId: frame.id };
    }).catch(failure => {
      if (!this._valid(source, generation, token)) return { id: source.id, status: 'cancelled' };
      source.lastDurationMs = Math.max(0, Math.round(this._ms() - started));
      source.lastAt = new Date(this._ms()).toISOString();
      source.errors++;
      source.connected = false;
      source.state = 'unavailable';
      // Do not echo raw exceptions: transport errors may contain hardware IDs.
      source.errorCode = ['UNIT_MISMATCH', 'CHANNEL_UNSUPPORTED', 'DUPLICATE_FRAME', 'SOURCE_FRAME'].includes(failure?.code) ? failure.code : 'DEVICE_UNAVAILABLE';
      this._emit();
      return { id: source.id, status: 'unavailable', errorCode: source.errorCode };
    }).finally(() => {
      if (source.promise === operation) source.promise = null;
      if (this._locks.get(source.id) === operation) this._locks.delete(source.id);
    });
    source.promise = operation;
    this._locks.set(source.id, operation);
    this._emit();
    return operation;
  }

  async captureOnce(sourceId) {
    this._requireSession();
    if (sourceId !== undefined) identifier(sourceId);
    const sources = sourceId === undefined ? [...this._sources.values()] : [this._sources.get(sourceId)];
    assert(sources.length > 0 && sources.every(Boolean), 'Nema priključenog izvora za očitanje.', 'NO_SOURCE');
    const generation = this._generation;
    const results = await Promise.all(sources.map(source => this._read(source, generation)));
    return this._snapshot({ results });
  }

  startCapture({ durationMs = 30000, intervalMs = MIN_INTERVAL } = {}) {
    this._requireSession();
    assert(!this.capturing, 'Kontrolisano snimanje već traje.', 'CAPTURE_ACTIVE');
    assert(typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 1 && durationMs <= MAX_DURATION, 'Trajanje snimanja mora biti između 1 i 120000 ms.');
    const requestedInterval = boundedInterval(intervalMs);
    assert([...this._sources.values()].some(source => source.state !== 'unavailable'), 'Nema dostupnog izvora. Ponovo ga eksplicitno poveži.', 'NO_SOURCE');
    const generation = this._generation;
    const deadline = this._ms() + durationMs;
    this._activeToken = generation;
    for (const source of this._sources.values()) source.nextDue = 0;
    const run = async () => {
      let iterations = 0, status = 'duration-complete';
      try {
        while (generation === this._generation && this._ms() < deadline) {
          // The scheduler may wake before a read is due, but device reads remain
          // at least the configured/effective interval apart, without a backlog.
          assert(++iterations <= Math.ceil(durationMs / 25) + 8, 'Raspoređivač je zaustavljen zbog ograničenja resursa.', 'SCHEDULER_LIMIT');
          const sources = [...this._sources.values()].filter(source => source.state !== 'unavailable');
          if (!sources.length) { status = 'sources-unavailable'; break; }
          const now = this._ms();
          for (const source of sources) if (!source.promise && now >= source.nextDue) this._read(source, generation, requestedInterval);
          const future = sources.filter(source => !source.promise).map(source => source.nextDue).filter(time => time > now);
          const untilDue = future.length ? Math.max(25, Math.min(...future) - now) : MIN_INTERVAL;
          await this._wait(Math.min(untilDue, MIN_INTERVAL, Math.max(1, deadline - this._ms())), generation);
        }
        if (generation !== this._generation) status = 'stopped';
      } finally {
        if (this._activeToken === generation) this.stopCapture();
      }
      return this._snapshot({ captureStatus: status });
    };
    return run();
  }
  stopCapture() {
    this._generation++;
    this._activeToken = null;
    this._wake();
    for (const source of this._sources.values()) if (source.state === 'reading') source.state = source.connected ? 'ready' : 'attached';
    this._emit();
    return this._snapshot({ captureStatus: 'stopped' });
  }
  setBaseline() {
    this._requireSession();
    this._session = this._engine.setBaseline(this._session);
    this._emit();
    return this._snapshot();
  }
  replay() { this._requireSession(); return this._engine.replay(this._session); }
  shadow(excludedSourceIds) { this._requireSession(); return this._engine.shadow(this._session, excludedSourceIds); }
}
