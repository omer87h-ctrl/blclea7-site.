/* BL CLEA Tools — original, read-only OBD transport and evidence parser.
 * Web Bluetooth uses an explicitly selected, fixed BLE profile. Web Serial
 * carries the same bounded ELM requests through a user-selected serial port.
 * This adapter has no ECU mutation, fault-code clearing or actuator commands.
 */

export const OBD_PROFILES = Object.freeze([
  Object.freeze({ id: 'elm-ffe0/1', service: 0xffe0, characteristic: 0xffe1, writeCharacteristic: 0xffe1, notifyCharacteristic: 0xffe1, name: 'ELM BLE · FFE0 / FFE1' }),
  Object.freeze({ id: 'elm-nus/1', service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', writeCharacteristic: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', notifyCharacteristic: '6e400003-b5a3-f393-e0a9-e50e24dcca9e', name: 'ELM BLE · Nordic UART Service' })
]);
// Kept for clients that used the original single-profile export.
export const OBD_PROFILE = OBD_PROFILES[0];
// Mode02 is a separate historical source. Only frame zero and reviewed PIDs
// are allowed; this list never authorizes clearing codes or ECU mutation.
export const FREEZE_FRAME_READ_COMMANDS = Object.freeze(['020000', '022000', '024000', '020200', '020300', '020400', '020500', '020600', '020700', '020B00', '020C00', '020D00', '020F00', '021000', '021100', '021F00', '022F00', '024200', '024600']);
export const READ_COMMANDS = Object.freeze(['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0', '0100', '0120', '0140', '0103', '0104', '0105', '010B', '010C', '010D', '010F', '0110', '0111', '0142', '0101', '0106', '0107', '011F', '012F', '0146', '03', '07', '0A', ...FREEZE_FRAME_READ_COMMANDS]);
const ALLOWED = new Set(READ_COMMANDS);
const INITIALIZATION = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];
const MAX_RESPONSE = 8192;
const MAX_QUEUED = 16;
const MAX_DTCS = 128;
const FUEL_SYSTEM_STATUSES = new Set([0, 1, 2, 4, 8, 16]);
function fuelSystemStatus(value) {
  // PID 03 reports one enumerated state per system. Multiple state bits and
  // reserved bits do not form another valid state; 0 denotes unused/unreported.
  if (!FUEL_SYSTEM_STATUSES.has(value)) throw new Error('Nepodržan ili kombinovan status sistema goriva.');
  return value;
}
const PID = Object.freeze({
  '03': { bytes: 2, fields: [
    { id: 'fuelSystem1Status', label: 'Status sistema goriva · sistem 1', unit: '1', decode: a => fuelSystemStatus(a) },
    { id: 'fuelSystem2Status', label: 'Status sistema goriva · sistem 2', unit: '1', decode: (a, b) => fuelSystemStatus(b) }
  ] },
  '04': { id: 'engineLoadPct', label: 'Izračunato opterećenje motora', unit: '%', bytes: 1, decode: a => a * 100 / 255 },
  '05': { id: 'coolantC', label: 'Temperatura rashladne tečnosti', unit: '°C', bytes: 1, decode: a => a - 40 },
  '06': { id: 'shortFuelTrimB1Pct', label: 'Kratkoročna korekcija goriva · banka 1', unit: '%', bytes: 1, decode: a => (a - 128) * 100 / 128 },
  '07': { id: 'longFuelTrimB1Pct', label: 'Dugoročna korekcija goriva · banka 1', unit: '%', bytes: 1, decode: a => (a - 128) * 100 / 128 },
  '0B': { id: 'manifoldKpa', label: 'Apsolutni pritisak usisa', unit: 'kPa', bytes: 1, decode: a => a },
  '0C': { id: 'rpm', label: 'Broj obrtaja motora', unit: 'o/min', bytes: 2, decode: (a, b) => (a * 256 + b) / 4 },
  '0D': { id: 'speedKph', label: 'Brzina vozila', unit: 'km/h', bytes: 1, decode: a => a },
  '0F': { id: 'intakeC', label: 'Temperatura usisnog zraka', unit: '°C', bytes: 1, decode: a => a - 40 },
  '10': { id: 'airflowGps', label: 'Protok zraka', unit: 'g/s', bytes: 2, decode: (a, b) => (a * 256 + b) / 100 },
  '11': { id: 'throttlePct', label: 'Položaj zaklopke', unit: '%', bytes: 1, decode: a => a * 100 / 255 },
  '1F': { id: 'engineRunSeconds', label: 'Vrijeme rada od pokretanja motora', unit: 's', bytes: 2, decode: (a,b) => a * 256 + b },
  '2F': { id: 'fuelLevelPct', label: 'Prijavljeni nivo goriva', unit: '%', bytes: 1, decode: a => a * 100 / 255 },
  '46': { id: 'ambientC', label: 'Prijavljena temperatura okoline', unit: '°C', bytes: 1, decode: a => a - 40 },
  '42': { id: 'moduleVoltageV', label: 'Napon upravljačkog modula', unit: 'V', bytes: 2, decode: (a, b) => (a * 256 + b) / 1000 }
});
const fieldsOf = definition => definition.fields || [definition];

function commandOf(value) {
  if (typeof value !== 'string' || value.length > 16 || /[\r\n\x00]/.test(value)) throw new Error('Nedozvoljena OBD naredba. Dostupna su samo navedena očitanja.');
  const command = value.trim().toUpperCase();
  if (!ALLOWED.has(command)) throw new Error('Nedozvoljena OBD naredba. Brisanje kodova i upravljanje vozilom nisu podržani.');
  return command;
}

function sourceText(text) {
  if (typeof text !== 'string' || text.length > MAX_RESPONSE) throw new Error('OBD odgovor mora biti tekst do 8 KiB.');
  if (/[^\x09\x0A\x0D\x20-\x7E]/.test(text)) throw new Error('OBD odgovor sadrži neočekivane binarne znakove.');
  return text;
}

function linesOf(command, text) {
  return sourceText(text).replace(/>/g, '\n').split(/[\r\n]+/).map(line => line.trim()).filter(Boolean)
    .filter(line => line.replace(/\s/g, '').toUpperCase() !== command)
    .filter(line => !/^(SEARCHING\.{0,3}|BUS INIT:\s*(?:\.{3}\s*)?OK)$/i.test(line));
}

function responseError(lines) {
  const error = lines.find(line => /^(NO DATA|STOPPED|UNABLE TO CONNECT|CAN ERROR|BUS ERROR|BUFFER FULL|DATA ERROR|FB ERROR|LV RESET|\?|ERROR)$/i.test(line));
  return error ? 'Adapter je vratio: ' + error + '. Nema potvrđenog očitanja.' : null;
}

function hexBytes(line) {
  const clean = line.replace(/\s/g, '').toUpperCase();
  if (!/^(?:[0-9A-F]{2})+$/.test(clean)) throw new Error('Nepotpun ili neispravan heksadecimalni OBD okvir. Koristi odgovor bez zaglavlja (ATH0).');
  return clean.match(/../g).map(byte => parseInt(byte, 16));
}

function codePair(a, b) {
  return 'PCBU'[a >> 6] + ((a >> 4) & 3).toString(16).toUpperCase() + (a & 15).toString(16).toUpperCase() + b.toString(16).toUpperCase().padStart(2, '0');
}

function decodePayload(bytes, service = 0x43) {
  if (bytes[0] !== service) throw new Error('Kodovi nisu odgovor na traženi OBD servis '+service.toString(16).toUpperCase()+'.');
  let payload = bytes.slice(1), count = null;
  // Some CAN replies carry an explicit count. Odd payload size identifies that
  // layout; trailing pairs must be zero padding, rather than guessed data.
  if (payload.length % 2) {
    count = payload.shift();
    if (count > payload.length / 2) throw new Error('Broj kodova u OBD okviru ne odgovara podacima.');
    if (payload.slice(count * 2).some(byte => byte !== 0)) throw new Error('Neočekivani podaci poslije broja OBD kodova.');
    payload = payload.slice(0, count * 2);
  }
  const codes = [];
  for (let i = 0; i < payload.length; i += 2) {
    if (payload[i] === 0 && payload[i + 1] === 0) continue;
    codes.push(codePair(payload[i], payload[i + 1]));
    if (codes.length > MAX_DTCS) throw new Error('Previše kodova u jednom OBD odgovoru.');
  }
  return codes;
}

/** Decode actual ELM DTC text. Headerless replies and ordered ELM chunks only.
 * Default mode03 remains compatible; new modes and scans select strict source checks. */
export function decodeDTC(text, command = '03', { singleModule = false } = {}) {
  if (!['03', '07', '0A'].includes(command)) throw new Error('Nepodržan servis kodova.');
  const service = { '03': 0x43, '07': 0x47, '0A': 0x4a }[command];
  const lines = linesOf(command, text);
  const failure = responseError(lines);
  if (failure) throw new Error(failure);
  if (!lines.length) throw new Error('Nema odgovora traženog servisa kodova.');
  const replies = [];
  let numbered = null, expectedIndex = 0, advertisedLength = null, expectsFirst = false;
  const pushReply = reply => {
    if (singleModule && advertisedLength !== null) {
      if (reply.length !== advertisedLength) throw new Error('Dužina višedijelnog odgovora ne odgovara najavljenom broju bajtova.');
      advertisedLength = null;
    }
    replies.push(reply);
  };
  for (const line of lines) {
    // ELM multi-frame length line, e.g. 014. Only accepted immediately before 0:.
    if (/^[0-9A-F]{3}$/i.test(line) && !numbered) {
      if (singleModule) {
        if (advertisedLength !== null) throw new Error('Ponovljena dužina višedijelnog odgovora.');
        advertisedLength=parseInt(line,16);expectsFirst=true;
        if (advertisedLength<1 || advertisedLength>MAX_RESPONSE/2) throw new Error('Neispravna dužina višedijelnog odgovora.');
      }
      continue;
    }
    const part = line.match(/^([0-9A-F]):\s*(.*)$/i);
    if (part) {
      const index = parseInt(part[1], 16);
      if (expectsFirst && index!==0) throw new Error('Najavljena dužina mora biti praćena prvim dijelom odgovora.');
      expectsFirst=false;
      if (index === 0) { if (numbered) pushReply(numbered); numbered = []; expectedIndex = 0; }
      if (!numbered || index !== expectedIndex++) throw new Error('Nepotpun redoslijed višedijelnog OBD odgovora.');
      numbered.push(...hexBytes(part[2]));
    } else {
      if (expectsFirst) throw new Error('Najavljena dužina mora biti praćena višedijelnim odgovorom.');
      if (numbered) { pushReply(numbered); numbered = null; }
      pushReply(hexBytes(line));
    }
  }
  if (numbered) pushReply(numbered);
  if (singleModule && advertisedLength !== null) throw new Error('Nedostaje najavljeni višedijelni odgovor.');
  if (!replies.length) throw new Error('Nema potpunog odgovora traženog servisa kodova.');
  const decoded = replies.map(reply => decodePayload(reply, service));
  const codes = [...new Set(decoded.flat())];
  if (codes.length > MAX_DTCS) throw new Error('Previše različitih kodova u jednom OBD odgovoru. Podaci nisu skraćeni niti prihvaćeni.');
  if (singleModule && new Set(decoded.map(list => JSON.stringify([...list].sort()))).size > 1) throw new Error('Različiti moduli prijavljuju različite kodove; ovaj profil ih ne može pouzdano razdvojiti.');
  return codes;
}

const CONTINUOUS_MONITORS = Object.freeze([['misfire','Praćenje preskakanja paljenja'],['fuel-system','Praćenje sistema goriva'],['components','Praćenje komponenti']]);
const SPARK_MONITORS = Object.freeze([['catalyst','Katalizator'],['heated-catalyst','Grijani katalizator'],['evaporative','Isparavanje goriva'],['secondary-air','Sekundarni zrak'],['ac-refrigerant','Rashladno sredstvo klime'],['oxygen-sensor','Senzor kisika'],['oxygen-heater','Grijač senzora kisika'],['egr','EGR sistem']]);
const COMPRESSION_MONITORS = Object.freeze([['nmhc-catalyst','NMHC katalizator'],['nox-scr','NOx / SCR'],null,['boost-pressure','Pritisak punjenja'],null,['exhaust-sensor','Senzor izduvnih gasova'],['particulate-filter','Filter čestica'],['egr-vvt','EGR / VVT']]);

/** Standard mode01 PID01 bit fields: status since codes were last cleared.
 * Unsupported monitor completion is null, never a successful completed test. */
export function decodeMonitorStatus(bytes) {
  if (!Array.isArray(bytes) || bytes.length !== 4 || bytes.some(b => !Number.isInteger(b) || b < 0 || b > 255)) throw new Error('Status monitora zahtijeva tačno četiri bajta.');
  const [a,b,c,d] = bytes;
  if (b & 0x80) throw new Error('Rezervisani bit statusa monitora nije podržan.');
  const compression = !!(b & 8);
  if (compression && ((c | d) & 0x14)) throw new Error('Rezervisani bit kompresijskog monitora nije podržan.');
  const monitor = (item, support, incomplete) => ({ id:item[0], label:item[1], supported:!!support, completed:support ? !incomplete : null });
  const monitors = CONTINUOUS_MONITORS.map((item,i) => monitor(item,b & (1<<i),b & (1<<(i+4))));
  for (const [i,item] of (compression ? COMPRESSION_MONITORS : SPARK_MONITORS).entries()) if (item) monitors.push(monitor(item,c & (1<<i),d & (1<<i)));
  return { milOn:!!(a & 0x80), dtcCount:a & 0x7f, ignition:compression ? 'compression' : 'spark', monitors };
}

/** Parse imported or live data with identical validation. No sample values. */
export function parseELMResponse(command, text) {
  command = commandOf(command);
  const result = { command, ok: false, kind: command.startsWith('AT') ? 'adapter' : command.startsWith('02') ? 'freeze-frame' : ['03','07','0A'].includes(command) ? 'dtc' : command === '0101' ? 'readiness' : 'measurement', values: [], dtcs: [], raw: '', notes: [], errors: [] };
  try {
    result.raw = sourceText(text);
    const lines = linesOf(command, text), failure = responseError(lines);
    if (failure) throw new Error(failure);
    if (!lines.length) throw new Error('Adapter nije poslao podatke.');
    if (command.startsWith('AT')) {
      if (command === 'ATZ') {
        if (!lines.some(line => /ELM327|OBDII|OBD-II|STN\d+/i.test(line))) throw new Error('Reset nije potvrdio prepoznatljiv ELM-kompatibilan odgovor.');
        result.notes.push(lines.join(' · '));
      } else if (!lines.every(line => line === 'OK')) throw new Error('Adapter nije potvrdio postavku odgovorom OK.');
      result.ok = true;
      return result;
    }
    if (['03','07','0A'].includes(command)) {
      result.dtcs = decodeDTC(text, command, { singleModule: command !== '03' });
      result.dtcCategory = { '03':'stored', '07':'pending', '0A':'permanent' }[command];
      result.notes.push(result.dtcs.length ? 'Kodovi su očitani podaci; sami po sebi ne potvrđuju uzrok kvara.' : 'U ovom odgovoru nisu prijavljeni kodovi tražene kategorije. To nije potvrda ispravnosti vozila.');
      result.ok = true;
      return result;
    }
    if (command.startsWith('02')) {
      const pid = command.slice(2, 4), definition = PID[pid], supportedRange = ['00', '20', '40'].includes(pid);
      const frames = lines.map(hexBytes), required = supportedRange ? 4 : pid === '02' ? 2 : definition.bytes;
      for (const frame of frames) {
        if (frame[0] === 0x7f) throw new Error('Vozilo je odbilo zahtjev za pohranjeni okvir.');
        if (frame[0] !== 0x42 || frame[1] !== parseInt(pid, 16) || frame[2] !== 0) throw new Error('Odgovor nije traženi Mode 02 PID i pohranjeni okvir 0.');
        if (frame.length < 3 + required || frame.length > 8 || frame.slice(3 + required).some(byte => byte !== 0)) throw new Error('Pohranjeni OBD okvir nema očekivan broj bajtova.');
      }
      const payloads = frames.map(frame => frame.slice(3, 3 + required));
      if (new Set(payloads.map(payload => payload.join(','))).size !== 1) throw new Error('Različiti moduli prijavljuju različite pohranjene okvire; izvor nije razdvojen.');
      const data = payloads[0];
      result.kind = 'freeze-frame'; result.freezeFrame = 0;
      if (supportedRange) {
        const base = parseInt(pid, 16); result.supportedCommands = [];
        for (let n = 1; n <= 32; n++) if (data[Math.floor((n - 1) / 8)] & (1 << (7 - ((n - 1) % 8)))) result.supportedCommands.push('02' + (base + n).toString(16).toUpperCase().padStart(2, '0') + '00');
      } else if (pid === '02') result.causeDTC = data[0] === 0 && data[1] === 0 ? null : codePair(data[0], data[1]);
      else result.values.push(...fieldsOf(definition).map(field => ({id:field.id,label:field.label,value:Math.round(field.decode(...data)*1000)/1000,unit:field.unit})));
      result.notes.push('Pohranjeni ECU okvir 0; vrijeme čitanja nije vrijeme nastanka događaja.');
      result.ok = true; return result;
    }
    const pid = command.slice(2), definition = PID[pid], supportedRange = ['00', '20', '40'].includes(pid);
    const frames = lines.map(hexBytes);
    for (const frame of frames) {
      if (frame[0] === 0x7f) throw new Error('Vozilo je odbilo zahtjev za očitanje.');
      if (frame[0] !== 0x41 || frame[1] !== parseInt(pid, 16)) throw new Error('Primljen je odgovor na drugi PID ili nepodržano zaglavlje.');
      const required = supportedRange || pid === '01' ? 4 : definition.bytes;
      if (frame.length < 2 + required || frame.length > 8 || frame.slice(2 + required).some(byte => byte !== 0)) throw new Error('OBD okvir nema očekivan broj bajtova.');
    }
    if (supportedRange) {
      const masks = [...new Set(frames.map(frame => frame.slice(2, 6).map(b => b.toString(16).padStart(2, '0')).join('')))];
      if (masks.length > 1) throw new Error('Različiti moduli su vratili različite liste PID-ova; ovaj profil ih ne može pouzdano razdvojiti.');
      const data = frames[0].slice(2, 6);
      result.supportedPids = [];
      const base = parseInt(pid, 16);
      for (let n = 1; n <= 32; n++) if (data[Math.floor((n - 1) / 8)] & (1 << (7 - ((n - 1) % 8)))) result.supportedPids.push('01' + (base + n).toString(16).toUpperCase().padStart(2, '0'));
      result.notes.push('Vozilo je prijavilo ' + result.supportedPids.length + ' PID-ova u rasponu ' + (base + 1).toString(16).toUpperCase().padStart(2, '0') + '–' + (base + 32).toString(16).toUpperCase() + '. Čitač podržava samo svoju ograničenu listu.');
    } else if (pid === '01') {
      const payloads = [...new Set(frames.map(frame => frame.slice(2,6).join(',')))];
      if (payloads.length !== 1) throw new Error('Različiti moduli prijavljuju različit status monitora; izvor nije razdvojen.');
      result.monitor = decodeMonitorStatus(frames[0].slice(2,6));
      result.notes.push('Status nadzora od posljednjeg brisanja kodova; završen monitor nije potvrda ukupne ispravnosti vozila.');
    } else {
      const fields = fieldsOf(definition), payloads = frames.map(frame => fields.map(field => field.decode(...frame.slice(2))));
      if (new Set(payloads.map(values => JSON.stringify(values))).size !== 1) throw new Error('Više različitih očitanja u odgovoru; izvorni modul nije razdvojen. Ponovi mjerenje na odgovarajućem adapteru.');
      result.values.push(...fields.map((field, index) => ({ id: field.id, label: field.label, value: Math.round(payloads[0][index] * 1000) / 1000, unit: field.unit })));
    }
    result.ok = true;
  } catch (error) {
    result.errors.push(error.message);
    result.values = [];
    result.dtcs = [];
  }
  return result;
}

function metricOf(measurements, ...ids) {
  for (const id of ids) {
    const value = measurements?.[id];
    if (typeof value === 'number' && Number.isFinite(value)) return { id, value };
    if (value && typeof value.value === 'number' && Number.isFinite(value.value)) return { id, value: value.value };
  }
  return null;
}

/** Evidence-led next checks. A reading is never promoted into a confirmed fault. */
export function analyzeAuto(measurements = {}, dtcs = []) {
  const findings = [], limits = ['Ovo je pregled unesenih ili očitanih podataka, bez potvrde kvara, tehničke ispravnosti ili sigurnosti vozila.', 'Granice proizvođača, uslovi mjerenja i tačnost instrumenta moraju se provjeriti u servisnoj dokumentaciji.'];
  const codes = [...new Set(Array.isArray(dtcs) ? dtcs.filter(code => typeof code === 'string' && /^[PCBU][0-3][0-9A-F]{3}$/.test(code)).slice(0, MAX_DTCS) : [])];
  if (codes.length) findings.push({ severity: 'review', title: 'Zabilježeni dijagnostički kodovi', evidence: codes.join(', '), recommendation: 'Sačuvaj izvještaj i provjeri servisni postupak za vozilo. Kod opisuje prijavljeno stanje, ne određuje automatski dio za zamjenu.' });
  const voltage = metricOf(measurements, 'moduleVoltageV', 'batteryVoltageV', 'batteryVoltage', 'voltage');
  if (voltage) findings.push({ severity: 'info', title: 'Napon treba tumačiti uz radno stanje', evidence: voltage.value + ' V (' + voltage.id + ')', recommendation: 'Zapiši da li je motor ugašen, pokrenut ili u radu i na kojem mjestu je napon izmjeren. Napon modula i napon na polovima akumulatora nisu ista mjerna tačka.' });
  const coolant = metricOf(measurements, 'coolantC', 'coolantTemperature');
  if (coolant) findings.push({ severity: 'info', title: 'Temperatura je pojedinačno očitanje', evidence: coolant.value + ' °C', recommendation: 'Zabilježi temperaturu okoline i trajanje rada; uporedi trend s dokumentovanim uslovima proizvođača. Ne otvaraj vruć rashladni sistem.' });
  const rpm = metricOf(measurements, 'rpm');
  const speed = metricOf(measurements, 'speedKph', 'speed');
  if (rpm || speed) findings.push({ severity: 'info', title: 'Radno stanje uz mjerenje', evidence: [rpm && rpm.value + ' o/min', speed && speed.value + ' km/h'].filter(Boolean).join(' · '), recommendation: 'Poveži očitanje s vremenom i uslovima. Očitavanja su uzastopna, nisu sinhronizovan zapis. Ovim interfejsom rukuj samo dok je vozilo sigurno parkirano.' });
  if (!findings.length) findings.push({ severity: 'missing', title: 'Nema podataka za zaključivanje', evidence: 'Nisu unesena podržana numerička mjerenja ni validni kodovi.', recommendation: 'Unesi stvarne podatke ili poveži podržani BLE adapter. Softver neće izmišljati rezultate.' });
  return { findings, limitations: limits };
}

function chunkText(value) {
  if (typeof value === 'string') return sourceText(value);
  let bytes;
  if (value instanceof DataView) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  else if (value instanceof Uint8Array) bytes = value;
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else throw new Error('Adapter je poslao nepodržan tip podataka.');
  if (bytes.length > MAX_RESPONSE) throw new Error('Prevelika Bluetooth poruka.');
  return sourceText(new TextDecoder('ascii').decode(bytes));
}

const SPP_SERVICE = '00001101-0000-1000-8000-00805f9b34fb';
const SERIAL_BAUD_RATES = new Set([9600, 19200, 38400, 57600, 115200]);

/** Explicit Web Serial chooser; never enumerates ports or reconnects silently. */
export function createSerialOBDTransport({ serial = globalThis.navigator?.serial, baudRate = 38400, bluetoothOnly = false } = {}) {
  if (!SERIAL_BAUD_RATES.has(baudRate)) throw new Error('Nepodržana serijska brzina za ELM adapter.');
  if (typeof bluetoothOnly !== 'boolean') throw new Error('Neispravan izbor serijskog profila.');
  let current = null, generation = 0, receive = () => {}, closed = () => {}, writes = Promise.resolve();
  const info = Object.freeze({ name: bluetoothOnly ? 'Bluetooth Classic SPP ELM' : 'Serijski ELM adapter', profile: bluetoothOnly ? 'ELM · Bluetooth Classic SPP' : 'ELM · USB / Web Serial', profileId: bluetoothOnly ? 'elm-spp/1' : 'elm-serial/1', source: 'obd-serial' });
  const closeSession = session => {
    if (!session || session.cleanup) return session?.cleanup || Promise.resolve();
    session.cancelled = true;
    session.cleanup = (async () => {
      try { await session.reader?.cancel(); } catch { /* unplugged or already cancelled */ }
      try { await session.pump; } catch { /* reported by the read loop */ }
      try { session.reader?.releaseLock(); } catch { /* already released */ }
      try { await session.writer?.abort(); } catch { /* disconnected writable stream */ }
      try { session.writer?.releaseLock(); } catch { /* already released */ }
      try { await session.port?.close(); } catch { /* chooser cancelled, not opened, or unplugged */ }
    })();
    return session.cleanup;
  };
  return {
    source: 'obd-serial',
    async connect() {
      if (globalThis.isSecureContext === false) throw new Error('Web Serial zahtijeva HTTPS i podržani preglednik.');
      if (!serial?.requestPort) throw new Error('Ovaj preglednik nema Web Serial za serijski ELM adapter.');
      if (current) throw new Error('Serijski adapter se već povezuje ili je povezan.');
      const session = { generation: ++generation, cancelled: false };
      current = session;
      const valid = () => current === session && !session.cancelled && generation === session.generation;
      try {
        session.port = await serial.requestPort(bluetoothOnly ? { filters: [{ bluetoothServiceClassId: SPP_SERVICE }] } : {});
        if (!valid()) throw new Error('Povezivanje je otkazano.');
        await session.port.open({ baudRate, bufferSize: MAX_RESPONSE });
        if (!valid()) throw new Error('Povezivanje je otkazano.');
        if (!session.port.readable || !session.port.writable) throw new Error('Odabrani port nema serijski ulaz i izlaz za ELM.');
        session.reader = session.port.readable.getReader();
        session.writer = session.port.writable.getWriter();
        session.pump = (async () => {
          try {
            while (valid()) {
              const { value, done } = await session.reader.read();
              if (!valid()) return;
              if (done) throw new Error('Serijski ELM adapter je zatvorio ulaz.');
              receive(value);
            }
          } catch (error) {
            if (valid()) {
              current = null; ++generation;
              const notifyClose = closed;
              // Do not await cleanup from the read loop itself.
              void closeSession(session);
              notifyClose(error);
            }
          } finally { try { session.reader.releaseLock(); } catch { /* cancellation */ } }
        })();
        return { ...info };
      } catch (error) {
        if (current === session) current = null;
        // A pending open may finish after cancellation; clean up its port too.
        await closeSession(session);
        try { await session.port?.close(); } catch { /* already closed */ }
        throw error;
      }
    },
    subscribe(callback, onClose) { receive = callback; closed = onClose; return () => { receive = () => {}; closed = () => {}; }; },
    write(text) {
      try {
        if (typeof text !== 'string' || !text.endsWith('\r') || commandOf(text.slice(0, -1)) + '\r' !== text) throw new Error('Nedozvoljena ELM serijska naredba.');
      } catch (error) { return Promise.reject(error); }
      const session = current;
      const run = writes.catch(() => {}).then(async () => {
        if (!session?.writer || current !== session || session.cancelled) throw new Error('Serijski ELM adapter nije povezan.');
        await session.writer.write(new TextEncoder().encode(text));
      });
      writes = run;
      return run;
    },
    disconnect() {
      ++generation;
      const session = current; current = null;
      return closeSession(session);
    }
  };
}

function bluetoothTransport(bluetooth, profile) {
  let current = null, receive = () => {}, closed = () => {};
  const closeSession = session => {
    if (!session) return;
    session.cancelled = true;
    if (session.notify && session.notification) session.notify.removeEventListener('characteristicvaluechanged', session.notification);
    if (session.device && session.disconnected) session.device.removeEventListener('gattserverdisconnected', session.disconnected);
    if (session.device?.gatt?.connected) session.device.gatt.disconnect();
  };
  return {
    source: 'obd-ble',
    async connect() {
      const session = { cancelled: false }; current = session;
      const check = () => { if (session.cancelled || current !== session) throw new Error('Povezivanje je otkazano.'); };
      try {
        session.device = await bluetooth.requestDevice({ filters: [{ services: [profile.service] }], optionalServices: [profile.service] });
        check();
        if (!session.device?.gatt) throw new Error('Odabrani uređaj nema podržani BLE GATT pristup.');
        session.disconnected = () => { if (current === session && !session.cancelled) closed(new Error('Bluetooth veza je prekinuta.')); };
        session.device.addEventListener('gattserverdisconnected', session.disconnected);
        const server = await session.device.gatt.connect(); check();
        const service = await server.getPrimaryService(profile.service); check();
        session.write = await service.getCharacteristic(profile.writeCharacteristic); check();
        session.notify = profile.notifyCharacteristic === profile.writeCharacteristic ? session.write : await service.getCharacteristic(profile.notifyCharacteristic); check();
        const writable = session.write.properties, readable = session.notify.properties;
        if (!(readable?.notify || readable?.indicate) || !(writable?.write || writable?.writeWithoutResponse)) throw new Error('Odabrani ELM profil (FFE1 ili NUS RX/TX) mora podržavati obavijesti i pisanje ELM zahtjeva.');
        session.notification = event => { if (current === session && !session.cancelled) receive(event.target.value); };
        session.notify.addEventListener('characteristicvaluechanged', session.notification);
        await session.notify.startNotifications(); check();
        return { name: String(session.device.name || 'BLE OBD adapter').slice(0, 100), profile: profile.name, profileId: profile.id, source: 'obd-ble' };
      } catch (error) { closeSession(session); if (current === session) current = null; throw error; }
    },
    subscribe(callback, onClose) { receive = callback; closed = onClose; return () => { receive = () => {}; closed = () => {}; }; },
    async write(text) {
      const session = current, characteristic = session?.write;
      if (!characteristic || session.cancelled || !session.device?.gatt?.connected) throw new Error('Bluetooth uređaj nije povezan.');
      const bytes = new TextEncoder().encode(text);
      if (characteristic.properties.write && characteristic.writeValueWithResponse) await characteristic.writeValueWithResponse(bytes);
      else if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(bytes);
      else if (characteristic.writeValue) await characteristic.writeValue(bytes);
      else throw new Error('Preglednik nema podržanu BLE metodu slanja.');
    },
    disconnect() {
      receive = () => {}; closed = () => {};
      const session = current; current = null; closeSession(session);
    }
  };
}

/** A strictly bounded single-command-at-a-time transport; no automatic retries. */
export class OBDBridge {
  constructor({ bluetooth, transport, profileId = OBD_PROFILE.id, timeoutMs = 5000, onStatus, now = () => new Date().toISOString() } = {}) {
    this.profile = OBD_PROFILES.find(profile => profile.id === profileId);
    if (!this.profile) throw new Error('Nepodržan OBD BLE profil. Dostupni su samo navedeni FFE0 i Nordic UART profili.');
    this.bluetooth = bluetooth;
    this.transport = transport || null;
    this.injected = !!transport;
    this.source = transport?.source === 'obd-serial' ? 'obd-serial' : 'obd-ble';
    this.timeoutMs = Math.max(10, Math.min(15000, Number(timeoutMs) || 5000));
    this.onStatus = onStatus;
    this.now = now;
    this.connected = false;
    this.state = 'disconnected';
    this._generation = 0;
    this._queue = Promise.resolve();
    this._queued = 0;
    this._pending = null;
    this._connecting = null;
    this._lastWrite = 0;
  }

  _status(state, message = '') {
    this.state = state;
    try { this.onStatus?.({ state, message, connected: this.connected }); } catch { /* UI observers cannot affect transport safety. */ }
  }

  connect() {
    if (this.connected && this.state === 'ready') return Promise.resolve(this.deviceInfo);
    if (this._connecting) return this._connecting;
    const generation = ++this._generation;
    this._status('connecting', 'Odaberi adapter za odabrani ELM profil veze.');
    this._connecting = this._connect(generation).finally(() => { this._connecting = null; });
    return this._connecting;
  }

  async _connect(generation) {
    let transport;
    try {
      if (!this.transport) {
        if (globalThis.isSecureContext === false) throw new Error('Bluetooth zahtijeva HTTPS i direktno otvaranje u podržanom pregledniku.');
        const bluetooth = this.bluetooth || globalThis.navigator?.bluetooth;
        if (!bluetooth?.requestDevice) throw new Error('Ovaj preglednik nema Web Bluetooth. Za BLE koristi podržani preglednik; za Classic SPP ili USB izaberi Web Serial profil.');
        this.transport = bluetoothTransport(bluetooth, this.profile);
      }
      transport = this.transport;
      this._unsubscribe = transport.subscribe(chunk => { if (generation === this._generation) this._receive(chunk); }, error => { if (generation === this._generation) this._failed(error || new Error('Adapter je prekinuo vezu.')); });
      const info = await transport.connect();
      if (generation !== this._generation) throw new Error('Povezivanje je otkazano.');
      this.connected = true;
      this._status('initializing', 'Provjera ELM odgovora i postavljanje načina očitanja.');
      let versionInfo = {};
      for (const command of INITIALIZATION) {
        if (generation !== this._generation) throw new Error('Povezivanje je otkazano.');
        const response = await this._schedule(command, generation);
        if (!response.ok) throw new Error(response.errors.join(' '));
        if (command === 'ATZ') versionInfo = { reportedVersion: response.notes.join(' · ').slice(0, 240), versionReply: response.raw };
      }
      if (generation !== this._generation) throw new Error('Povezivanje je otkazano.');
      this.deviceInfo = { name: String(info?.name || 'ELM adapter').slice(0, 100), profile: this.source === 'obd-serial' ? String(info?.profile || 'ELM · Web Serial').slice(0, 100) : this.profile.name, profileId: this.source === 'obd-serial' ? info?.profileId || 'elm-serial/1' : this.profile.id, source: this.source, ...versionInfo };
      this._status('ready', 'ELM profil je odgovorio. Očitavanje je dostupno; kompatibilnost vozila zavisi od adaptera i vozila.');
      return { ...this.deviceInfo };
    } catch (error) {
      if (generation === this._generation) {
        this.disconnect();
        this._status('disconnected', error?.message || 'Povezivanje nije uspjelo.');
      } else { try { await transport?.disconnect(); } catch { /* cancelled chooser cleanup */ } }
      throw error;
    }
  }

  read(command) {
    try {
      command = commandOf(command);
      if (!this.connected || this.state !== 'ready') throw new Error('Prvo poveži i provjeri ELM adapter.');
      return this._schedule(command, this._generation);
    } catch (error) { return Promise.reject(error); }
  }

  /** Ask only the next bitmap range explicitly advertised by the vehicle. */
  async discoverSupportedPids() {
    const supported = new Set();
    for (const [command, next] of [['0100', '0120'], ['0120', '0140'], ['0140', null]]) {
      const response = await this.read(command);
      if (!response.ok) throw new Error(response.errors.join(' '));
      for (const pid of response.supportedPids) supported.add(pid);
      if (!next || !response.supportedPids.includes(next)) break;
    }
    const supportedPids = [...supported].sort();
    return { supportedPids, supportedReadablePids: supportedPids.filter(command => Object.hasOwn(PID, command.slice(2))) };
  }

  _schedule(command, generation) {
    if (this._queued >= MAX_QUEUED) return Promise.reject(new Error('Red očitanja je pun. Sačekaj završetak postojećih zahtjeva.'));
    this._queued++;
    const run = this._queue.then(async () => {
      if (generation !== this._generation || !this.connected) throw new Error('Očitanje je otkazano nakon prekida veze.');
      // Single in-flight request and a minimum interval also protect adapters
      // from a flood of repeated UI requests. No polling runs in the background.
      const delay = Math.max(0, 80 - (Date.now() - this._lastWrite));
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (generation !== this._generation || !this.connected) throw new Error('Očitanje je otkazano nakon prekida veze.');
      return this._execute(command, generation);
    });
    this._queue = run.catch(() => {});
    return run.finally(() => { this._queued--; });
  }

  _execute(command, generation) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this._failed(new Error('Isteklo je vrijeme odgovora. Veza je zatvorena da se zakašnjeli odgovor ne pripiše drugom mjerenju.')), this.timeoutMs);
      const pending = { command, generation, buffer: '', timer, resolve, reject }, transport = this.transport;
      this._pending = pending;
      this._lastWrite = Date.now();
      Promise.resolve().then(() => {
        if (generation === this._generation && this.connected && this._pending === pending) return transport.write(command + '\r');
      }).catch(error => { if (generation === this._generation && this._pending === pending) this._failed(error); });
    });
  }

  _receive(chunk) {
    const pending = this._pending;
    if (!pending || pending.generation !== this._generation) return;
    try {
      pending.buffer += chunkText(chunk);
      if (pending.buffer.length > MAX_RESPONSE) throw new Error('Adapter je premašio ograničenje odgovora od 8 KiB.');
      const prompt = pending.buffer.indexOf('>');
      if (prompt === -1) return;
      if (pending.buffer.slice(prompt + 1).trim()) throw new Error('Adapter je poslao neočekivane podatke iza završetka odgovora.');
      clearTimeout(pending.timer);
      this._pending = null;
      const result = parseELMResponse(pending.command, pending.buffer.slice(0, prompt + 1));
      pending.resolve({ ...result, source: this.source, capturedAt: this.now() });
    } catch (error) { this._failed(error); }
  }

  _failed(error) {
    const pending = this._pending;
    if (pending) { clearTimeout(pending.timer); this._pending = null; pending.reject(error); }
    this.disconnect();
    this._status('disconnected', error?.message || 'Spoj je prekinut.');
  }

  disconnect() {
    ++this._generation;
    this.connected = false;
    if (this._pending) {
      clearTimeout(this._pending.timer);
      this._pending.reject(new Error('Očitanje je otkazano prekidom veze.'));
      this._pending = null;
    }
    try { this._unsubscribe?.(); } catch { /* best-effort observer teardown */ }
    this._unsubscribe = null;
    try { Promise.resolve(this.transport?.disconnect()).catch(() => {}); } catch { /* OS may have already closed transport */ }
    if (!this.injected) this.transport = null;
    this._status('disconnected', 'Veza je zatvorena.');
  }
}

const ACTIVE_CAPABILITY_SCANS = new WeakSet();
const scanFailure = (name,message) => Object.assign(new Error(message),{name});

/** One acquisition owns a connected bridge across pauses between its reads.
 * The lease coordinates reviewed acquisition modules; it is not a sandbox for
 * arbitrary host scripts. Release is idempotent, including after disconnect. */
export function claimOBDAcquisition(bridge) {
  if (!(bridge instanceof OBDBridge) || !bridge.connected || bridge.state !== 'ready') throw new Error('Prvo poveži i provjeri ELM adapter.');
  if (bridge._pending || bridge._queued || ACTIVE_CAPABILITY_SCANS.has(bridge)) throw new Error('Drugo očitanje je u toku; sačekajte njegov završetak.');
  ACTIVE_CAPABILITY_SCANS.add(bridge);
  let released = false;
  return () => { if (!released) { released = true; ACTIVE_CAPABILITY_SCANS.delete(bridge); } };
}

/** Fixed, bounded diagnostic inventory on an already connected OBDBridge.
 * No chooser, connection, retries, code clearing, VIN request or ECU writes.
 * Each category retains an independent outcome; unavailable is never []. */
export async function scanOBDCapabilities(bridge,{signal,timeoutMs=45000}={}) {
  if (!(bridge instanceof OBDBridge)) throw new Error('Pregled zahtijeva povezani CLEA OBD adapter.');
  if (!bridge.connected || bridge.state !== 'ready') throw new Error('Prvo poveži i provjeri ELM adapter.');
  if (bridge._pending || bridge._queued || ACTIVE_CAPABILITY_SCANS.has(bridge)) throw new Error('Drugo očitanje je u toku; sačekajte njegov završetak.');
  if (signal != null && !(signal instanceof AbortSignal)) throw new Error('Neispravan signal otkazivanja pregleda.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 500 || timeoutMs > 60000) throw new Error('Pregled mora imati granicu između 500 i 60000 ms.');
  const abortError = () => scanFailure('AbortError','Pregled OBD mogućnosti je otkazan.');
  if (signal?.aborted) throw abortError();
  let terminal = null;
  const stop = error => { if (!terminal) terminal=error; bridge.disconnect(); };
  const onAbort = () => stop(abortError());
  const check = () => { if (terminal) throw terminal; if (signal?.aborted) throw abortError(); };
  const startedAt = new Date().toISOString();
  const releaseAcquisition=claimOBDAcquisition(bridge);
  signal?.addEventListener('abort',onAbort,{once:true});
  const timer=setTimeout(()=>stop(scanFailure('TimeoutError','Pregled je dosegao ukupnu vremensku granicu; veza je zatvorena.')),timeoutMs);
  const evidence = response => ({command:response.command,capturedAt:response.capturedAt,source:response.source,raw:response.raw,notes:[...response.notes]});
  const read = async command => {
    check();
    if (!bridge.connected || bridge.state !== 'ready') return {status:'not-run',reason:'Veza nije dostupna; ova naredba nije poslana.'};
    try {
      const response=await bridge.read(command);check();
      if (!Number.isFinite(Date.parse(response.capturedAt)) || !['obd-ble','obd-serial'].includes(response.source)) throw new Error('Odgovor nema valjano vrijeme i porijeklo.');
      const parsed=parseELMResponse(command,response.raw);
      const withProvenance={...parsed,capturedAt:response.capturedAt,source:response.source};
      if (!parsed.ok) return {status:linesOf(command,response.raw).some(line=>/^NO DATA$/i.test(line))?'unavailable':'failed',reason:parsed.errors.join(' '),evidence:evidence(withProvenance)};
      return {status:'available',response:withProvenance};
    } catch(error) {
      check();
      return {status:'failed',reason:String(error?.message||'Očitanje nije uspjelo.').slice(0,600)};
    }
  };
  try {
    check();
    const ranges=[],supported=new Set();let discoveryFailure=null;
    for (const [command,next] of [['0100','0120'],['0120','0140'],['0140',null]]) {
      const item=await read(command);
      if (item.status!=='available') {discoveryFailure=item;ranges.push({command,...item});break;}
      ranges.push({status:'available',...evidence(item.response),supportedPids:[...item.response.supportedPids]});
      for(const pid of item.response.supportedPids)supported.add(pid);
      if(!next||!item.response.supportedPids.includes(next))break;
    }
    const supportedPids=[...supported].sort();
    const discovery={status:discoveryFailure?.status||'available',ranges,supportedPids,supportedReadablePids:supportedPids.filter(command=>Object.hasOwn(PID,command.slice(2))),...(discoveryFailure?{reason:discoveryFailure.reason}:{}),complete:!discoveryFailure};
    let monitor;
    if (discoveryFailure) monitor={status:'not-run',reason:'Mapa podržanih PID-ova nije potpuna; status monitora nije automatski tražen.'};
    else if (!supported.has('0101')) monitor={status:'unsupported',reason:'Vozilo nije prijavilo PID 01 u potvrđenoj mapi mogućnosti.'};
    else {
      const item=await read('0101');
      monitor=item.status==='available'?{status:'available',data:item.response.monitor,evidence:evidence(item.response)}:item;
    }
    const dtcs={};
    for (const [category,command] of [['stored','03'],['pending','07'],['permanent','0A']]) {
      const item=await read(command);
      if(item.status!=='available'){dtcs[category]=item;continue;}
      try {
        const codes=decodeDTC(item.response.raw,command,{singleModule:true});
        dtcs[category]={status:'available',codes,evidence:evidence(item.response)};
      } catch(error) {
        dtcs[category]={status:'failed',reason:String(error.message).slice(0,600),evidence:evidence(item.response)};
      }
    }
    check();
    return {format:'blclea.obd-capabilities/1',startedAt,completedAt:new Date().toISOString(),discovery,monitor,dtcs,limitations:[
      'Obuhvaćeni su generički OBD podaci koje adapter i vozilo stvarno izlažu. ABS, airbag i proizvođački protokoli nisu dio ovog profila.',
      'Pohranjeni, privremeni i trajni kodovi su različite kategorije. Nedostupan odgovor nije prazna lista kodova.',
      'Kod ili završen monitor ne potvrđuje uzrok kvara, dio za zamjenu ni ukupnu tehničku ispravnost.',
      'Različiti odgovori bez identiteta izvornog modula odbijaju se; ovaj profil ne razdvaja ECU adrese.',
      'Nisu traženi VIN ni drugi lični identifikatori. Nema brisanja kodova, aktivacije aktuatora ili automatskog ponavljanja zahtjeva.'
    ]};
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',onAbort);releaseAcquisition();
  }
}

export const DEFAULT_OBD_SNAPSHOT_COMMANDS=Object.freeze(['010C','0142','0104','010B','0110','0103','0106','0107','011F']);

/** An explicit finite measurement snapshot; only actually advertised fixed PIDs.
 * All responses are sequential observations, never a synchronized freeze frame. */
export async function scanOBDMeasurements(bridge,{supportedPids,signal,commands=DEFAULT_OBD_SNAPSHOT_COMMANDS,timeoutMs=45000}={}) {
  if (!(bridge instanceof OBDBridge) || !bridge.connected || bridge.state!=='ready') throw new Error('Prvo poveži i provjeri CLEA ELM adapter.');
  if (bridge._pending || bridge._queued || ACTIVE_CAPABILITY_SCANS.has(bridge)) throw new Error('Drugo očitanje je u toku; sačekajte završetak.');
  if (!Array.isArray(supportedPids) || supportedPids.length>96 || supportedPids.some(pid=>typeof pid!=='string'||!/^01[0-9A-F]{2}$/.test(pid)) || new Set(supportedPids).size!==supportedPids.length) throw new Error('Potreban je potvrđeni skup podržanih PID-ova.');
  if (!Array.isArray(commands) || !commands.length || commands.length>9 || new Set(commands).size!==commands.length || commands.some(command=>typeof command!=='string'||!/^01[0-9A-F]{2}$/.test(command)||!Object.hasOwn(PID,command.slice(2)))) throw new Error('Snimak dopušta najviše devet različitih registrovanih mjernih naredbi.');
  if (signal!=null && !(signal instanceof AbortSignal)) throw new Error('Neispravan signal otkazivanja.');
  if (!Number.isFinite(timeoutMs)||timeoutMs<500||timeoutMs>60000) throw new Error('Neispravna ukupna vremenska granica snimka.');
  const abortError=()=>scanFailure('AbortError','Snimanje OBD mjerenja je otkazano.');
  if(signal?.aborted)throw abortError();
  let terminal=null;
  const stop=error=>{if(!terminal)terminal=error;bridge.disconnect();};
  const onAbort=()=>stop(abortError());
  const check=()=>{if(terminal)throw terminal;if(signal?.aborted)throw abortError();};
  const supported=new Set(supportedPids),startedAt=new Date().toISOString(),readings=[],measurements=[];
  const releaseAcquisition=claimOBDAcquisition(bridge);signal?.addEventListener('abort',onAbort,{once:true});
  const timer=setTimeout(()=>stop(scanFailure('TimeoutError','Snimanje je doseglo ukupnu vremensku granicu; veza je zatvorena.')),timeoutMs);
  try {
    for(const command of commands) {
      check();
      if(!supported.has(command)){readings.push({command,status:'unsupported',reason:'Ovaj PID nije prijavljen u dostavljenoj mapi mogućnosti; naredba nije poslana.'});continue;}
      if(!bridge.connected||bridge.state!=='ready'){readings.push({command,status:'not-run',reason:'Veza nije dostupna; naredba nije poslana.'});continue;}
      try {
        const actual=await bridge.read(command);check();
        if(!Number.isFinite(Date.parse(actual.capturedAt))||!['obd-ble','obd-serial'].includes(actual.source))throw new Error('Odgovor nema valjano vrijeme i porijeklo.');
        const parsed=parseELMResponse(command,actual.raw);
        const evidence={command,capturedAt:actual.capturedAt,source:actual.source,raw:parsed.raw,notes:[...parsed.notes]};
        if(!parsed.ok){readings.push({command,status:linesOf(command,parsed.raw).some(line=>/^NO DATA$/i.test(line))?'unavailable':'failed',reason:parsed.errors.join(' '),evidence});continue;}
        const values=parsed.values.map(item=>({...item}));
        readings.push({command,status:'available',values,evidence});
        for(const value of values)measurements.push({...value,command,capturedAt:actual.capturedAt,source:actual.source,raw:parsed.raw});
      }catch(error){check();readings.push({command,status:'failed',reason:String(error?.message||'Očitanje nije uspjelo.').slice(0,600)});}
    }
    check();return{format:'blclea.obd-measurements/1',startedAt,completedAt:new Date().toISOString(),readings,measurements,limitations:[
      'Očitanja su uzastopna; nisu istovremeni freeze-frame zapis ni dokaz uzroka kvara.',
      'Mapa podržanih PID-ova mora poticati iz pregleda ovog vozila u istoj vezi. Naziv ili cijena adaptera ne potvrđuje tačnost.',
      'Nisu primijenjene univerzalne granice ispravnosti. Uslovi rada i važeća servisna dokumentacija potrebni su za tumačenje.',
      'Korekcije goriva odnose se samo na prijavljenu banku 1. Režim sistema goriva poznat je samo kada stvarni PID 03 uspije; 0 ne potvrđuje korišten sistem, a dva sistema nisu mjerenja korekcija obje banke.',
      'Nema VIN-a, brisanja kodova, upravljanja aktuatorima, pozadinskog snimanja ili automatskog ponavljanja.'
    ]};
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);releaseAcquisition();}
}

function safeAssessmentData(input) {
  const pending=[{value:input,depth:0}];let count=0;
  while(pending.length){const {value,depth}=pending.pop();if(++count>12000||depth>16)throw new Error('Podaci procjene su previše složeni.');
    if(value===null||typeof value==='boolean')continue;
    if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>1e12)throw new Error('Neispravan broj procjene.');continue;}
    if(typeof value==='string'){if(value.length>8192)throw new Error('Tekst procjene je predug.');continue;}
    if(typeof value!=='object'||(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value))))throw new Error('Procjena prihvata samo obične JSON podatke.');
    for(const key of Reflect.ownKeys(value)){
      if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key))throw new Error('Nedozvoljeno polje procjene.');
      const item=Object.getOwnPropertyDescriptor(value,key);if(!item||!('value'in item))throw new Error('Izvršni pristupnici nisu dozvoljeni.');
      // Array length is data too, but has no child structure to inspect.
      if(Array.isArray(value)&&key==='length')continue;pending.push({value:item.value,depth:depth+1});
    }
  }
  const text=JSON.stringify(input);if(new TextEncoder().encode(text).byteLength>262144)throw new Error('Podaci procjene premašuju 256 KiB.');return JSON.parse(text);
}

/** Deterministic assessment of recorded facts, without a health score or a
 * diagnostic code database. No inference of a failed part or repair success. */
export function assessAutoEvidence(input={}) {
  const data=safeAssessmentData(input);
  if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('Procjena očekuje objekat mjerenja.');
  const rows=data.measurements??[];
  if(!Array.isArray(rows)||rows.length>64)throw new Error('Procjena očekuje ograničenu listu mjerenja.');
  const measurements=new Map();
  for(const row of rows){
    const definition=typeof row?.command==='string'&&/^01[0-9A-F]{2}$/.test(row.command)?PID[row.command.slice(2)]:null;
    const field=definition&&fieldsOf(definition).find(item=>item.id===row.id);
    if(!field||row.unit!==field.unit||typeof row.value!=='number'||!Number.isFinite(row.value)||!Number.isFinite(Date.parse(row.capturedAt))||!['obd-ble','obd-serial'].includes(row.source)||measurements.has(row.id))throw new Error('Mjerenje procjene nema jednoznačan kanal, jedinicu ili porijeklo.');
    const original=typeof row.raw==='string'?parseELMResponse(row.command,row.raw):null;
    if(!original?.ok||!original.values.some(item=>item.id===row.id&&item.unit===row.unit&&item.value===row.value))throw new Error('Vrijednost procjene nije usklađena s izvornim OBD odgovorom.');
    measurements.set(row.id,row);
  }
  const findings=[],missing=new Set(['engine-operating-context','manufacturer-service-limits']);
  const refs=ids=>ids.map(id=>measurements.get(id)).filter(Boolean).map(row=>({id:row.id,command:row.command,capturedAt:row.capturedAt,source:row.source}));
  const values=ids=>ids.map(id=>measurements.get(id)).filter(Boolean).map(row=>`${fieldsOf(PID[row.command.slice(2)]).find(field=>field.id===row.id).label}: ${row.value} ${row.unit}`).join(' · ');
  const add=(id,title,evidence,recommendation,{ids=[],requires=[],lacking=[],severity='info',details}={})=>{
    for(const key of lacking)missing.add(key);
    findings.push({id,severity,title,evidence,recommendation,evidenceRefs:refs(ids),requires,missing:lacking,...(details?{details}: {})});
  };
  if(!rows.length)add('measurement-coverage','Nema potvrđenih mjerenja','Nije dostavljeno nijedno valjano očitanje.','Povežite adapter i sačuvajte stvarni snimak podržanih PID-ova.',{lacking:['supported-measurements'],severity:'missing'});
  else {
    const times=rows.map(row=>Date.parse(row.capturedAt)),span=(Math.max(...times)-Math.min(...times))/1000;
    add('measurement-coverage','Obuhvat stvarnog snimka',`${rows.length} očitanih kanala; vremenski razmak od prvog do posljednjeg: ${span} s.`,'Tumačite očitanja uz vrijeme snimanja; ovaj skup nije istovremeni freeze frame.',{ids:rows.map(row=>row.id),details:{measurementCount:rows.length,spanSeconds:span}});
  }
  const running=['rpm','engineRunSeconds'].filter(id=>measurements.has(id));
  if(running.length)add('engine-context','Prijavljeno radno stanje',values(running),'Zabilježite da li je motor ugašen, tek pokrenut ili zagrijan. Ova očitanja ne potvrđuju stabilan režim niti zamjenjuju tu provjeru.',{ids:running,requires:['engine-operating-context'],lacking:['engine-operating-context']});
  const trimIds=['shortFuelTrimB1Pct','longFuelTrimB1Pct'],trim=trimIds.filter(id=>measurements.has(id));
  const fuelStatusIds=['fuelSystem1Status','fuelSystem2Status'].filter(id=>measurements.has(id));
  const closedLoop=measurements.get('fuelSystem1Status')?.value===2;
  if(fuelStatusIds.length)add('fuel-system-status','Prijavljeni režim sistema goriva',values(fuelStatusIds),'Kod 2 potvrđuje standardno prijavljenu zatvorenu petlju samo za taj odgovor i sistem. Ostali kodovi, uključujući 0 i 16, ne ispunjavaju ovu pretpostavku za poređenje korekcija banke 1.',{ids:fuelStatusIds,details:{bank1ClosedLoopConfirmed:closedLoop}});
  if(trim.length){
    const complete=trim.length===2;let details;
    if(complete)details={differencePercentagePoints:Math.round((measurements.get(trimIds[0]).value-measurements.get(trimIds[1]).value)*1000)/1000};
    add('bank1-fuel-corrections','Korekcije goriva banke 1',values(trim)+(complete?` · Razlika kratke i duge korekcije: ${details.differencePercentagePoints} postotnih poena.`:''),'Uporedite uz režim petlje i dokumentovane uslove proizvođača. Ovdje nije postavljena univerzalna granica ni utvrđen dio za zamjenu.',{ids:[...trim,...(closedLoop?['fuelSystem1Status']:[])],requires:['closed-loop-context','manufacturer-service-limits'],lacking:[...(closedLoop?[]:['closed-loop-context']),...(complete?[]:['paired-bank1-fuel-trim'])],details});
  }
  if(measurements.has('moduleVoltageV'))add('module-voltage','Napon na upravljačkom modulu',values(['moduleVoltageV']),'Za poređenje s akumulatorom potrebno je posebno očitanje na polovima u istom režimu. Napon modula nije automatski napon akumulatora.',{ids:['moduleVoltageV'],requires:['engine-operating-context','independent-terminal-voltage'],lacking:['independent-terminal-voltage']});
  const airIds=['engineLoadPct','manifoldKpa','airflowGps','throttlePct'].filter(id=>measurements.has(id));
  if(airIds.length)add('air-load-context','Ulazni podaci za provjeru usisa i opterećenja',values(airIds),'Sačuvajte režim rada i provjerite propisani postupak. Ova kombinacija ne dokazuje curenje usisa, kvar senzora niti uzrok promjene korekcija.',{ids:airIds,requires:['engine-operating-context','manufacturer-service-limits']});
  const categories=data.dtcs??{};
  if(!categories||Array.isArray(categories)||typeof categories!=='object')throw new Error('Neispravne kategorije kodova.');
  const known=[];
  for(const [category,label]of[['stored','pohranjeni'],['pending','privremeni'],['permanent','trajni']]){
    const outcome=categories[category];
    if(!outcome||outcome.status!=='available'){missing.add('dtcs-'+category);continue;}
    if(!Array.isArray(outcome.codes)||outcome.codes.length>128||outcome.codes.some(code=>typeof code!=='string'||!/^[PCBU][0-3][0-9A-F]{3}$/.test(code)))throw new Error('Neispravna lista potvrđenih kodova.');
    const codes=[...new Set(outcome.codes)];known.push({category,label,codes});
  }
  if(known.length)add('dtc-categories','Kategorije kodova iz odgovora vozila',known.map(item=>`${item.label}: ${item.codes.length?item.codes.join(', '):'u ovom odgovoru nema kodova'}`).join(' · '),'Sačuvajte kategoriju svakog koda i koristite servisni postupak za konkretno vozilo. Kod nije dijagnoza određenog dijela; ECU upravlja statusom trajnih kodova.',{severity:known.some(item=>item.codes.length)?'review':'info',details:{categories:known.map(({category,codes})=>({category,codes}))}});
  const readiness=data.monitor;
  if(readiness?.status==='available'){
    const m=readiness.data;
    if(!m||typeof m.milOn!=='boolean'||!Number.isInteger(m.dtcCount)||m.dtcCount<0||m.dtcCount>127||!['spark','compression'].includes(m.ignition)||!Array.isArray(m.monitors)||m.monitors.length>11||m.monitors.some(item=>!item||typeof item.id!=='string'||typeof item.supported!=='boolean'||(item.supported?typeof item.completed!=='boolean':item.completed!==null)))throw new Error('Neispravan potvrđeni status monitora.');
    const allowedIDs=[...CONTINUOUS_MONITORS,...(m.ignition==='spark'?SPARK_MONITORS:COMPRESSION_MONITORS).filter(Boolean)].map(item=>item[0]);
    if(m.monitors.length!==allowedIDs.length||new Set(m.monitors.map(item=>item.id)).size!==allowedIDs.length||m.monitors.some(item=>!allowedIDs.includes(item.id)))throw new Error('Status monitora ne sadrži potpun i jednoznačan skup kanala.');
    const supported=m.monitors.filter(item=>item.supported),incomplete=supported.filter(item=>!item.completed);
    add('monitor-status','Status nadzora od posljednjeg brisanja',`MIL: ${m.milOn?'prijavljeno uključeno':'prijavljeno isključeno'} · Broj kodova: ${m.dtcCount} · Podržani monitori: ${supported.length} · Nezavršeni: ${incomplete.length}.`,'Provjerite originalni servisni postupak. Završen monitor i ugašena MIL lampica nisu potvrda ukupne ispravnosti.',{severity:m.milOn||incomplete.length?'review':'info',details:{milOn:m.milOn,reportedDtcCount:m.dtcCount,supportedMonitorCount:supported.length,incompleteMonitorIds:incomplete.map(item=>item.id)}});
  }else missing.add('monitor-status');
  return{format:'blclea.auto-assessment/1',findings,missing:[...missing],limitations:[
    'Deterministička analiza dostavljenih očitanja, bez AI modela, baze proizvođačkih kodova ili tvrdnje o potvrđenom kvaru.',
    'Nema zbirnog rezultata zdravlja, univerzalnih granica goriva/napona niti automatske preporuke dijela za zamjenu.',
    'Nepoznati radni uslovi i servisne granice ostaju izričito navedeni. Slijed očitanja nije dokaz uzročnosti.',
    'Naziv i cijena ELM adaptera ne dokazuju njegovu implementaciju, tačnost ili kompatibilnost s vozilom.'
  ]};
}
