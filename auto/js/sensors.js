/* Original BL CLEA Tools measurement adapters. Only standard ESS BLE reads and
 * a documented passive serial JSON protocol are supported. No device writes. */

import { CHANNELS } from './evidence-engine.js';

export const SENSOR_PROTOCOL = 'clea.sensor/1';
export const ENVIRONMENTAL_PROFILE = Object.freeze({ service: 0x181a, temperature: 0x2a6e, humidity: 0x2a6f, pressure: 0x2a6d });
// The closed clea.sensor/1 vocabulary shares the runtime's trusted canonical
// registry. Firmware must supply actual values and the exact registered units.
export const SENSOR_UNITS = Object.freeze(Object.fromEntries(Object.entries(CHANNELS).map(([id, channel]) => [id, channel.unit])));
const MAX_LINE = 8192, MAX_CHANNELS = 32, MAX_FRAME_RATE = 20;
const CONTEXT_KEYS = new Set(['label', 'location', 'condition', 'instrument', 'note', 'session']);
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const BAUD_RATES = new Set([9600, 19200, 38400, 57600, 115200]);
const clone = value => JSON.parse(JSON.stringify(value));

function viewOf(value) {
  if (value instanceof DataView) return value;
  if (value instanceof Uint8Array) return new DataView(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new DataView(value);
  throw new Error('Senzor nije poslao binarno očitanje.');
}

/** Decode the Bluetooth SIG Environmental Sensing little-endian value. */
export function decodeEnvironmental(kind, value) {
  const numeric = typeof kind === 'number' ? kind : typeof kind === 'string' && /^[0-9a-f]{8}-0000-1000-8000-00805f9b34fb$/i.test(kind) ? parseInt(kind.slice(0, 8), 16) : null;
  const name = ['temperature', 'humidity', 'pressure'].includes(kind) ? kind : Object.keys(ENVIRONMENTAL_PROFILE).find(key => key !== 'service' && ENVIRONMENTAL_PROFILE[key] === numeric);
  const view = viewOf(value);
  if (!name) throw new Error('Nepodržana Environmental Sensing karakteristika.');
  const expected = name === 'pressure' ? 4 : 2;
  if (view.byteLength !== expected) throw new Error('Neočekivana dužina senzorskog očitanja.');
  let decoded;
  if (name === 'temperature') {
    decoded = view.getInt16(0, true) / 100;
    if (decoded < -273.15) throw new Error('Temperaturni senzor je poslao nevažeću vrijednost.');
  } else if (name === 'humidity') {
    decoded = view.getUint16(0, true) / 100;
    if (decoded > 100) throw new Error('Senzor relativne vlažnosti je poslao nevažeću vrijednost.');
  } else decoded = view.getUint32(0, true) / 10000; // 0.1 Pa → kPa
  return { id: name, unit: SENSOR_UNITS[name], value: decoded };
}

/** One serial line, not an executable script or a generic instrument protocol. */
export function parseSensorLine(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_LINE || /[\r\n\u0000]/.test(text)) throw new Error('Senzorska poruka mora biti jedan JSON red do 8 KiB.');
  let record;
  try {
    record = JSON.parse(text, (key, value) => { if (BAD_KEYS.has(key)) throw new Error('Nedozvoljen ključ.'); return value; });
  } catch { throw new Error('Neispravan ili nedozvoljen JSON senzorski red.'); }
  if (!record || typeof record !== 'object' || Array.isArray(record) || record.schema !== SENSOR_PROTOCOL || Object.keys(record).some(key => !['schema', 'channels', 'context'].includes(key))) throw new Error('Potreban je clea.sensor/1 JSON protokol.');
  if (!Array.isArray(record.channels) || !record.channels.length || record.channels.length > MAX_CHANNELS) throw new Error('Poruka mora imati 1–32 podržana mjerna kanala.');
  const ids = new Set();
  const channels = record.channels.map(channel => {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel) || Object.keys(channel).sort().join(',') !== 'id,unit,value') throw new Error('Svaki kanal mora sadržati samo id, unit i value.');
    if (typeof channel.id !== 'string' || !Object.hasOwn(SENSOR_UNITS, channel.id) || ids.has(channel.id)) throw new Error('Nepodržan ili ponovljen mjerni kanal.');
    ids.add(channel.id);
    const unit = SENSOR_UNITS[channel.id] === 'ohm' && channel.unit === 'Ω' ? 'ohm' : channel.unit;
    if (unit !== SENSOR_UNITS[channel.id]) throw new Error('Mjerna jedinica ne odgovara kanalu ' + channel.id + '.');
    if (typeof channel.value !== 'number' || !Number.isFinite(channel.value) || Math.abs(channel.value) > 1e12) throw new Error('Mjerenje mora biti konačan broj unutar podržanog opsega.');
    if (unit === '°C' && channel.value < -273.15) throw new Error('Temperatura ne može biti ispod apsolutne nule.');
    if (unit === '%' && (channel.value < 0 || channel.value > 100)) throw new Error('Procentualni kanal mora biti između 0 i 100.');
    return { id: channel.id, unit, value: channel.value };
  });
  const context = record.context ?? {};
  if (!context || typeof context !== 'object' || Array.isArray(context) || Object.keys(context).length > CONTEXT_KEYS.size || Object.entries(context).some(([key, value]) => !CONTEXT_KEYS.has(key) || typeof value !== 'string' || value.length > 256 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))) throw new Error('Kontekst senzora smije sadržavati samo kratke tekstualne oznake.');
  return { schema: SENSOR_PROTOCOL, channels, context: { ...context } };
}

function token(prefix) { return prefix + '-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)); }
function secure() { if (globalThis.isSecureContext === false) throw new Error('Povezivanje uređaja zahtijeva HTTPS i podržani preglednik.'); }
function timestamp(now) { const value = now(); if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Nije moguće odrediti vrijeme mjerenja.'); return new Date(value).toISOString(); }

/** Explicit sources, local frames. No telemetry and no hardware identity export. */
export class SensorBridge {
  constructor({ onFrame, onStatus, bluetooth, serial, now = () => new Date().toISOString(), timeoutMs = 5000, idleTimeoutMs = 30000 } = {}) {
    this.onFrame = onFrame; this.onStatus = onStatus;
    this.bluetooth = bluetooth; this.serial = serial; this.now = now;
    this.timeoutMs = Math.max(10, Math.min(15000, Number(timeoutMs) || 5000));
    this.idleTimeoutMs = Math.max(20, Math.min(120000, Number(idleTimeoutMs) || 30000));
    this.connected = false; this.state = 'disconnected'; this.kind = null;
    this._session = null; this._generation = 0;
  }

  _status(state, message) { this.state = state; try { this.onStatus?.({ state, message, connected: this.connected, sourceKind: this.kind }); } catch { /* observer isolation */ } }
  _check(session) { if (this._session !== session || session.stopped) throw new Error('Povezivanje ili očitanje je otkazano.'); }
  _deadline(promise, session, message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); session.pending.delete(cancel); fn(value); };
      const cancel = () => finish(reject, new Error('Povezivanje ili očitanje je otkazano.'));
      const timer = setTimeout(() => { const error = new Error(message); finish(reject, error); this._fail(error, session); }, this.timeoutMs);
      session.pending.add(cancel);
      Promise.resolve(promise).then(value => {
        if (session.stopped) { this._closeSession(session); finish(reject, new Error('Povezivanje ili očitanje je otkazano.')); return; }
        try { this._check(session); finish(resolve, value); } catch (error) { finish(reject, error); }
      }, error => finish(reject, error));
    });
  }
  async _begin(kind) {
    const cleanup = this.disconnect();
    const generation = this._generation;
    await cleanup;
    if (generation !== this._generation) throw new Error('Novije povezivanje je zamijenilo ovaj zahtjev.');
    secure();
    const session = { id: token('source'), kind, stopped: false, generation, characteristics: new Map(), pending: new Set() };
    this._session = session; this.kind = kind;
    this._status('connecting', 'Odaberi uređaj; podaci ostaju na ovom uređaju.');
    return session;
  }
  _frame(session, channels, context = {}) {
    this._check(session);
    const frame = { format: 'clea.measurement/1', id: token('frame'), sourceId: session.id, sourceKind: session.kind, capturedAt: timestamp(this.now), channels: clone(channels), context: clone(context) };
    try { this.onFrame?.(clone(frame)); } catch { /* rendering callback has no device privileges */ }
    return frame;
  }

  async connectEnvironmental() {
    const session = await this._begin('sensor-ble');
    try {
      const bluetooth = this.bluetooth || globalThis.navigator?.bluetooth;
      if (!bluetooth?.requestDevice) throw new Error('Web Bluetooth nije dostupan. Koristi podržani Chrome/Edge preglednik i BLE ESS senzor.');
      const device = await bluetooth.requestDevice({ filters: [{ services: [ENVIRONMENTAL_PROFILE.service] }], optionalServices: [ENVIRONMENTAL_PROFILE.service] });
      session.device = device;
      this._check(session);
      if (!device?.gatt) throw new Error('Odabrani uređaj nema BLE GATT pristup.');
      session.disconnected = () => this._fail(new Error('BLE senzor je prekinuo vezu.'), session);
      device.addEventListener('gattserverdisconnected', session.disconnected);
      const server = await this._deadline(device.gatt.connect(), session, 'Isteklo je vrijeme povezivanja BLE senzora.');
      const service = await this._deadline(server.getPrimaryService(ENVIRONMENTAL_PROFILE.service), session, 'ESS servis nije odgovorio.');
      for (const kind of ['temperature', 'humidity', 'pressure']) {
        try {
          const characteristic = await this._deadline(service.getCharacteristic(ENVIRONMENTAL_PROFILE[kind]), session, 'ESS karakteristika nije odgovorila.');
          if (characteristic.properties?.read && typeof characteristic.readValue === 'function') session.characteristics.set(kind, characteristic);
        } catch (error) { this._check(session); if (error?.name !== 'NotFoundError') throw error; }
      }
      if (!session.characteristics.size) throw new Error('Senzor nema podržanu čitljivu temperaturu, vlažnost ili pritisak.');
      this._check(session); this.connected = true;
      this._status('ready', 'ESS senzor je povezan. Snimi očitanje kada želiš; nema pozadinskog ispitivanja.');
      return { sourceId: session.id, sourceKind: session.kind, channels: [...session.characteristics.keys()], name: String(device.name || 'ESS BLE senzor').slice(0, 100) };
    } catch (error) { this._fail(error, session); throw error; }
  }

  async readEnvironmental() {
    const session = this._session;
    if (!this.connected || session?.kind !== 'sensor-ble') throw new Error('Prvo poveži BLE Environmental Sensing uređaj.');
    if (session.reading) throw new Error('Sačekaj završetak trenutnog senzorskog očitanja.');
    session.reading = true;
    try {
      const channels = [];
      for (const [kind, characteristic] of session.characteristics) {
        const value = await this._deadline(characteristic.readValue(), session, 'Senzor nije odgovorio na zahtjev za očitanje.');
        channels.push(decodeEnvironmental(kind, value));
      }
      const frame = this._frame(session, channels, { condition: 'Uzastopna BLE ESS očitanja; vrijeme okvira označava završetak snimanja.' });
      this._status('ready', 'Stvarno senzorsko očitanje je snimljeno lokalno.');
      return frame;
    } catch (error) { this._fail(error, session); throw error; }
    finally { session.reading = false; }
  }

  async connectSerial({ baudRate = 115200 } = {}) {
    if (!BAUD_RATES.has(baudRate)) throw new Error('Podržane serijske brzine: 9600, 19200, 38400, 57600 i 115200.');
    const session = await this._begin('serial');
    try {
      const serial = this.serial || globalThis.navigator?.serial;
      if (!serial?.requestPort) throw new Error('Web Serial nije dostupan u ovom pregledniku. Koristi podržani desktop Chrome/Edge ili uvezi dokumentovani zapis senzora.');
      session.port = await serial.requestPort();
      this._check(session);
      await this._deadline(session.port.open({ baudRate, bufferSize: MAX_LINE }), session, 'Serijski uređaj nije otvoren na vrijeme.');
      if (!session.port.readable?.getReader) throw new Error('Serijski uređaj nema čitljiv tok.');
      session.reader = session.port.readable.getReader();
      this._check(session); this.connected = true;
      this._status('ready', 'Pasivno čitanje clea.sensor/1 JSON redova. Uređaju se ne šalju naredbe.');
      session.task = this._readSerial(session);
      return { sourceId: session.id, sourceKind: session.kind, baudRate, protocol: SENSOR_PROTOCOL };
    } catch (error) { this._fail(error, session); throw error; }
  }

  _armIdle(session) {
    clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => this._fail(new Error('Nema serijskih podataka u dozvoljenom vremenu. Veza je zatvorena; nema izmišljenih očitanja.'), session), this.idleTimeoutMs);
  }

  async _readSerial(session) {
    let buffer = '', invalid = 0, windowStart = Date.now(), count = 0;
    const decoder = new TextDecoder('utf-8', { fatal: true });
    this._armIdle(session);
    try {
      while (this._session === session && !session.stopped) {
        const { value, done } = await session.reader.read();
        this._check(session);
        if (done) throw new Error('Serijski tok je završen.');
        if (!(value instanceof Uint8Array) || value.byteLength > MAX_LINE) throw new Error('Prevelik ili nevažeći serijski paket.');
        this._armIdle(session);
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > MAX_LINE) throw new Error('Serijski red premašuje ograničenje od 8 KiB.');
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const raw of lines) {
          const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
          if (!line.trim()) continue;
          if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); count = 0; }
          if (++count > MAX_FRAME_RATE) throw new Error('Senzor šalje više od 20 redova u sekundi. Veza je zatvorena radi ograničenja resursa.');
          try {
            const parsed = parseSensorLine(line);
            this._frame(session, parsed.channels, parsed.context);
            invalid = 0;
          } catch (error) {
            if (++invalid >= 3) throw new Error('Tri uzastopne neispravne senzorske poruke. ' + error.message);
            this._status('ready', 'Senzorski red je odbijen: ' + error.message);
          }
        }
      }
    } catch (error) { if (!session.stopped) this._fail(error, session); }
    finally { clearTimeout(session.idleTimer); try { session.reader?.releaseLock(); } catch { /* cancellation may have released it */ } }
  }

  _fail(error, session) {
    if (this._session !== session) {
      session.stopped = true;
      for (const cancel of session.pending) cancel();
      this._closeSession(session);
      return;
    }
    this.disconnect();
    this._status('disconnected', error?.message || 'Senzorska veza je zatvorena.');
  }

  async disconnect() {
    ++this._generation;
    const session = this._session;
    this._session = null; this.connected = false; this.kind = null;
    this._status('disconnected', 'Senzorska veza je zatvorena.');
    if (!session) return;
    session.stopped = true;
    for (const cancel of session.pending) cancel();
    await this._closeSession(session);
  }

  async _closeSession(session) {
    clearTimeout(session.idleTimer);
    if (session.device && session.disconnected) session.device.removeEventListener('gattserverdisconnected', session.disconnected);
    try { if (session.device?.gatt?.connected) session.device.gatt.disconnect(); } catch { /* OS may have closed it */ }
    try { await session.reader?.cancel(); } catch { /* detached serial reader */ }
    try { session.reader?.releaseLock(); } catch { /* read loop also releases it */ }
    try { await session.port?.close(); } catch { /* cancelled chooser or unplugged port */ }
  }
}
