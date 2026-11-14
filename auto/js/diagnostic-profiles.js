/* Original evidence lenses for BL CLEA Tools, by Brzo i Lokalno.
 * This module interprets measured evidence. It does not diagnose a component,
 * certify safety or invent manufacturer specifications. No device writes.
 */

const channel = (id, label, unit) => ({ id, label, unit });
const common = {
  temperature: channel('temperature', 'Temperatura', '°C'),
  humidity: channel('humidity', 'Relativna vlažnost zraka', '%'),
  pressure: channel('pressure', 'Pritisak', 'kPa'),
  voltage: channel('voltage', 'Napon', 'V'),
  current: channel('current', 'Struja', 'A'),
  resistance: channel('resistance', 'Otpor', 'ohm'),
  power: channel('power', 'Aktivna snaga', 'W'),
  vibration: channel('vibration', 'Brzina vibracija — definisani mjerni postupak', 'mm/s'),
  moisture: channel('moisture', 'Sadržaj vlage materijala — definisana skala instrumenta', '%'),
  length: channel('length', 'Dužinska mjera', 'mm')
};

const contextFields = [
  { id: 'equipmentId', label: 'Oznaka predmeta / uređaja', requiredForComparison: true, description: 'Poredi samo isti identifikovani predmet ili izričito uporediv uzorak.' },
  { id: 'measurementPoint', label: 'Mjerna tačka / osa / referentna površina', requiredForComparison: true, description: 'Naznači gdje je senzor ili mjerni instrument postavljen; različite tačke nisu automatski uporedive.' },
  { id: 'operatingMode', label: 'Režim rada / opterećenje', requiredForComparison: true, description: 'Zabilježi režim u kojem je snimanje nastalo; ne mijenjaj opasna radna stanja prema ovom softveru.' },
  { id: 'instrument', label: 'Izvor, instrument i mjerni postupak', requiredForComparison: true, description: 'Navedi uređaj, jedinicu i postupak. Broj iz datoteke nije dokaz kalibracije instrumenta.' },
  { id: 'conditions', label: 'Uslovi i promjene između snimanja', requiredForComparison: true, description: 'Zabilježi promjene temperature okoline, položaja, materijala, opterećenja i druge poznate smetnje.' }
];

function lenses(stable, trend, pair, change, reference) {
  return [
    { id: 'evidence-quality', kind: 'quality', title: 'Kvalitet i porijeklo dokaza', channels: [], minimumSamples: 1, description: 'Pregled raspoloživih kanala, vremena i izvora bez izmišljanja nedostajućih očitanja.', nextCheck: 'Potvrdi izvor, jedinicu, mjernu tačku i instrument prije stručnog tumačenja.' },
    { id: 'repeatability', kind: 'stability', title: 'Raspon i ponovljivost opažanja', channels: [stable], minimumSamples: 5, description: 'Medijan, raspon i medijana apsolutnog odstupanja iz najmanje pet stvarnih uzoraka.', nextCheck: 'Za ocjenu prihvatljivosti pribavi referencu za isti mjerni postupak, tačku i režim.' },
    { id: 'time-trend', kind: 'trend', title: 'Vremenski trag promjene', channels: [trend], minimumSamples: 5, description: 'Prikaz izmjerenog linearnog trenda uz trajanje snimanja; bez predviđanja budućeg kvara.', nextCheck: 'Zabilježi duži uporediv snimak ako je trajanje prekratko za namjeravanu analizu.' },
    { id: 'cross-channel', kind: 'association', title: 'Povezanost dva mjerna traga', channels: pair, minimumSamples: 5, description: 'Pearsonova povezanost stvarno uparenih uzoraka. Podrazumijevano se koriste samo kanali istog mjernog okvira.', nextCheck: 'Provjeri vremensko uparivanje i režim rada. Povezanost ne utvrđuje uzrok niti opravdava zamjenu dijela.' },
    { id: 'before-after', kind: 'change', title: 'Prije / poslije sa sačuvanom osnovom', channels: [change], minimumSamples: 5, description: 'Poređenje medijana s evidentiranom baznom sesijom i najmanje pet uzoraka u oba snimanja.', nextCheck: 'Provjeri da su predmet, instrument, mjerna tačka i režim rada uporedivi. Sačuvaj obje sesije.' },
    { id: 'documented-reference', kind: 'reference', title: 'Provjera prema zadanoj dokumentovanoj granici', channels: [reference], minimumSamples: 1, description: 'Poredi zabilježeni raspon samo s granicom i izvorom koje korisnik izričito unese.', nextCheck: 'Potvrdi da navedena referenca važi za konkretnu opremu, jedinicu, režim i mjerni postupak.' }
  ];
}

export const PROFILES = {
  auto: {
    id: 'auto', name: 'CLEA Auto — mjerna dijagnostika',
    summary: 'Povezuje raspoložive OBD tragove, njihov kontekst i ponovljiva snimanja. Kod greške i statistička promjena nisu zaključak o neispravnom dijelu.',
    channels: [channel('rpm', 'Broj okretaja motora', 'rpm'), channel('coolantTemperature', 'Temperatura rashladne tečnosti', '°C'), channel('speed', 'Brzina vozila', 'km/h'), channel('controlModuleVoltage', 'Napon upravljačkog modula', 'V'), channel('engineLoad', 'Izračunato opterećenje motora', '%'), channel('intakeTemperature', 'Temperatura usisnog zraka', '°C'), channel('intakePressure', 'Apsolutni usisni pritisak', 'kPa'), channel('massAirFlow', 'Maseni protok zraka', 'g/s'), channel('throttlePosition', 'Položaj leptira', '%')],
    contextFields,
    protocol: ['Identifikuj vozilo i podržani izvor podataka. Vozač ne smije rukovati ovim alatom tokom vožnje.', 'Prikupi raspoložive read-only kanale bez brisanja kodova, aktiviranja sklopova ili reprogramiranja.', 'Zabilježi mirovanje/kretanje, režim motora i uslove svakog snimanja. Nisu svi PID-ovi podržani na svakom vozilu.', 'Prije/poslije poređenje zahtijeva sačuvanu osnovnu sesiju i uporedive uslove; promjena ne dokazuje uzrok.'],
    lenses: lenses('rpm', 'coolantTemperature', ['rpm', 'controlModuleVoltage'], 'engineLoad', 'controlModuleVoltage')
  },
  electric: {
    id: 'electric', name: 'CLEA Electric — dokaz mjernog stanja',
    summary: 'Opisuje naponske i strujne tragove iz odobrenog mjernog postupka; ne potvrđuje odsustvo napona, ispravnost zaštite ili usklađenost instalacije.',
    channels: [common.voltage, common.current, common.resistance, common.power, common.temperature],
    contextFields,
    protocol: ['Stručni izvršilac identifikuje krug, shemu, instrument i svoj odobreni postupak. Ovaj softver nije uputstvo za rad pod naponom.', 'Uvezi ili prikupi samo mjerenja koja su zakonito i sigurno dostupna kroz predviđeni mjerni adapter.', 'Odvoji DC i AC kontekst; zajedničko vrijeme napona i struje nije automatski mjerenje aktivne snage.', 'Radne uslove i mjerne tačke sačuvaj uz svaki zapis. Numeričko poređenje nije sigurnosni certifikat.'],
    lenses: lenses('voltage', 'current', ['voltage', 'current'], 'power', 'resistance')
  },
  build: {
    id: 'build', name: 'CLEA Build — mjerni trag gradilišta',
    summary: 'Povezuje ponovljene izmjere, vlagu materijala i okolinu. Mjerne skale i referentne tačke ostaju eksplicitne, bez procjene nosivosti.',
    channels: [common.length, common.moisture, common.temperature, common.humidity],
    contextFields,
    protocol: ['Identifikuj dio objekta, materijal i referentnu tačku. Ponovljene dužine moraju se odnositi na istu dimenziju.', 'Vlagu materijala zabilježi uz model instrumenta, odabrani materijal i korištenu skalu; različite skale nisu neposredno uporedive.', 'Ambijentalnu temperaturu i relativnu vlažnost odvoji od sadržaja vlage materijala.', 'Za geometrijsko odstupanje koristi izričito zadanu projektnu toleranciju i njen dokument. Ovaj profil ne odobrava konstrukciju.'],
    lenses: lenses('length', 'moisture', ['temperature', 'humidity'], 'moisture', 'length')
  },
  climate: {
    id: 'climate', name: 'CLEA Climate — uporedivi servisni trag',
    summary: 'Povezuje temperaturu, vlagu i pritisak u dokumentovanim režimima. Apsolutni i relativni pritisak moraju biti označeni u kontekstu.',
    channels: [common.temperature, common.humidity, common.pressure, common.power, common.current],
    contextFields,
    protocol: ['Identifikuj uređaj, vodni/zračni krug i mjerne tačke bez otvaranja ili promjene opasnog sistema na osnovu softvera.', 'Uz pritisak navedi radi li se o apsolutnom ili relativnom pritisku i koji se medij posmatra.', 'Temperature različitih tačaka snimaj u zasebno označenim sesijama; jedna serija ne smije miješati ulaz i izlaz.', 'Poredi isti režim i uslove okoline. Od ovih tragova se ne izračunava automatski ukupni rashladni kapacitet ili količina rashladnog sredstva.'],
    lenses: lenses('pressure', 'temperature', ['temperature', 'humidity'], 'temperature', 'pressure')
  },
  workshop: {
    id: 'workshop', name: 'CLEA Workshop — mjerna kontrola procesa',
    summary: 'Povezuje mjere gotovih dijelova i tragove procesa. Vibracije zahtijevaju definisanu osu, način agregacije i režim stroja.',
    channels: [common.length, common.vibration, common.temperature, common.current, common.power, common.moisture],
    contextFields,
    protocol: ['Identifikuj dio, reviziju nacrta, materijal i dimenziju. Ponovljivost iste dimenzije nije isto što i ocjena različitih dijelova serije.', 'Za vibracije navedi položaj senzora, osu, frekvencijski opseg i RMS/vršnu definiciju instrumenta. Sama jedinica mm/s nije potpuna specifikacija.', 'Snimaj isključivo kroz predviđeni mjerni postupak, uz važeće zaštite stroja. Softver ne upravlja strojem.', 'Toleranciju preuzmi iz konkretne dokumentacije; profil ne proglašava proizvod ili stroj ispravnim bez stručne provjere.'],
    lenses: lenses('length', 'vibration', ['vibration', 'temperature'], 'vibration', 'length')
  }
};

function freeze(value) {
  for (const x of Object.values(value)) if (x && typeof x === 'object' && !Object.isFrozen(x)) freeze(x);
  return Object.freeze(value);
}
freeze(PROFILES);

export function getDiagnosticProfile(id) { return Object.hasOwn(PROFILES, id) ? PROFILES[id] : undefined; }

const finite = x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1e15;
const unique = values => [...new Set(values.filter(x => typeof x === 'string' && x.length > 0 && x.length <= 200))];
const pretty = x => typeof x === 'number' ? Number(x.toPrecision(9)).toLocaleString('bs-BA', { maximumSignificantDigits: 9 }) : String(x);
const observation = (label, value, unit = '') => ({ label, value, unit });

function normalizeMetrics(profile, input) {
  if (!Array.isArray(input) || input.length > 100) throw new Error('Profil očekuje najviše 100 metričkih zapisa.');
  const channels = new Map(profile.channels.map(x => [x.id, x]));
  const metrics = new Map();
  for (const m of input) {
    if (!m || typeof m !== 'object' || !channels.has(m.id)) continue;
    if (metrics.has(m.id)) throw new Error(`Ponovljen metrički kanal: ${m.id}.`);
    const c = channels.get(m.id);
    if (m.unit !== c.unit || !Number.isInteger(m.count) || m.count < 0 || m.count > 50000) throw new Error(`Neispravna metrika ili jedinica: ${m.id}.`);
    // EvidenceEngine intentionally retains baseline-only channels with zero
    // current samples and null statistics. They are missing current evidence,
    // rather than a malformed session or a numerical zero observation.
    if (m.count === 0) {
      if (![m.min, m.max, m.median, m.mad, m.slopePerSecond].every(v => v === null) || m.durationSeconds !== 0) throw new Error(`Neispravna prazna metrika: ${m.id}.`);
      continue;
    }
    if (![m.min, m.max, m.median, m.mad].every(finite) || m.mad < 0 || m.min > m.median || m.median > m.max) throw new Error(`Neispravna metrika ili jedinica: ${m.id}.`);
    if (m.slopePerSecond != null && !finite(m.slopePerSecond)) throw new Error(`Neispravan vremenski trend: ${m.id}.`);
    if (m.durationSeconds != null && (!finite(m.durationSeconds) || m.durationSeconds < 0)) throw new Error(`Neispravno trajanje: ${m.id}.`);
    metrics.set(m.id, { ...m, sourceIds: unique(Array.isArray(m.sourceIds) ? m.sourceIds : []).slice(0, 128) });
  }
  return metrics;
}

function normalizedFrames(profile, frames) {
  if (!Array.isArray(frames) || frames.length > 10000) throw new Error('Profil očekuje najviše 10.000 mjernih okvira.');
  const allowed = new Map(profile.channels.map(x => [x.id, x.unit]));
  return frames.map((f, ordinal) => {
    if (!f || typeof f !== 'object' || !Array.isArray(f.channels) || f.channels.length > 100) return null;
    const time = typeof f.capturedAt === 'string' ? Date.parse(f.capturedAt) : NaN;
    if (!Number.isFinite(time)) return null;
    const values = new Map();
    for (const c of f.channels) if (c && allowed.has(c.id) && allowed.get(c.id) === c.unit && finite(c.value) && !values.has(c.id)) values.set(c.id, c.value);
    if (!values.size) return null;
    return { id: typeof f.id === 'string' ? f.id.slice(0, 200) : '', sourceId: typeof f.sourceId === 'string' ? f.sourceId.slice(0, 200) : '', time, ordinal, receivedOrdinal: Number.isSafeInteger(f.ordinal) ? f.ordinal : null, values };
  }).filter(Boolean).sort((a, b) => a.time - b.time || a.ordinal - b.ordinal);
}

function pairFrames(frames, a, b, windowMs) {
  if (windowMs === 0) return frames.filter(f => f.values.has(a) && f.values.has(b)).map(f => ({ x: f.values.get(a), y: f.values.get(b), skewMs: 0, ids: [f.id], sourceIds: [f.sourceId] }));
  const xs = frames.filter(f => f.values.has(a)), ys = frames.filter(f => f.values.has(b));
  const pairs = []; let j = 0;
  for (const x of xs) {
    while (j < ys.length && ys[j].time < x.time - windowMs) j++;
    if (j >= ys.length) break;
    while (j + 1 < ys.length && Math.abs(ys[j + 1].time - x.time) < Math.abs(ys[j].time - x.time)) j++;
    const best = j;
    if (Math.abs(ys[best].time - x.time) <= windowMs) {
      const y = ys[best];
      pairs.push({ x: x.values.get(a), y: y.values.get(b), skewMs: Math.abs(y.time - x.time), ids: [x.id, y.id], sourceIds: [x.sourceId, y.sourceId] });
      j = best + 1;
    }
  }
  return pairs;
}

function pearson(pairs) {
  const mx = pairs.reduce((s, p) => s + p.x, 0) / pairs.length, my = pairs.reduce((s, p) => s + p.y, 0) / pairs.length;
  let xx = 0, yy = 0, xy = 0;
  for (const p of pairs) { const dx = p.x - mx, dy = p.y - my; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
  if (xx === 0 || yy === 0) return null;
  const r = xy / Math.sqrt(xx * yy);
  return Number.isFinite(r) ? Math.max(-1, Math.min(1, r)) : null;
}

/**
 * @param {string} toolId
 * @param {Array|object} input canonical EvidenceEngine metrics array, or
 *   {metrics, frames, baseline?, context:{limits:{channel:{min,max,source}}, pairWindowMs?}}.
 * Pass session.baseline with full session.frames, or already-filtered current
 * frames. Baseline frames must not silently enter the current correlation.
 * No runtime state is mutated. No telemetry, random choices or device access.
 */
export function evaluateProfile(toolId, input) {
  const profile = getDiagnosticProfile(toolId);
  if (!profile) throw new Error('Nepoznat dijagnostički profil.');
  const data = Array.isArray(input) ? { metrics: input } : input;
  if (!data || typeof data !== 'object') throw new Error('Nedostaje mjerni skup za profil.');
  const metrics = normalizeMetrics(profile, data.metrics ?? []);
  const frames = normalizedFrames(profile, data.frames ?? []);
  let associationFrames = frames;
  if (data.baseline != null) {
    const boundary = data.baseline.throughOrdinal;
    if (!Number.isSafeInteger(boundary) || boundary < 1) throw new Error('Neispravna granica baznog snimka.');
    associationFrames = frames.filter(f => f.receivedOrdinal > boundary);
  }
  const context = data.context && typeof data.context === 'object' ? data.context : {};
  const pairWindowMs = context.pairWindowMs ?? 0;
  if (!Number.isInteger(pairWindowMs) || pairWindowMs < 0 || pairWindowMs > 2000) throw new Error('Deklarisani prozor uparivanja mora biti cijeli broj od 0 do 2000 ms.');
  const findings = [], missingData = [];
  const channelLabels = new Map(profile.channels.map(c => [c.id, c]));
  const missingContext = contextFields.filter(f => !(typeof context[f.id] === 'string' && context[f.id].trim())).map(f => f.label);

  for (const lens of profile.lenses) {
    const selected = lens.channels.map(id => metrics.get(id));
    const sources = unique(selected.filter(Boolean).flatMap(m => m.sourceIds));
    const ids = unique(frames.filter(f => lens.channels.some(id => f.values.has(id))).map(f => f.id));
    const result = { id: lens.id, kind: lens.kind, title: lens.title, status: 'observed', summary: '', channelIds: [...lens.channels], observations: [], evidence: { sourceIds: sources, frameIds: ids.slice(0, 20), frameIdsTruncated: ids.length > 20 }, nextCheck: { title: lens.nextCheck, prerequisites: ['Identifikovan predmet i mjerni postupak', 'Odgovorni stručni izvršilac za regulisane zahvate'] }, limitations: [] };
    const unavailable = reason => {
      result.status = 'missing-data'; result.summary = reason;
      missingData.push({ lensId: lens.id, reason, requiredChannels: [...lens.channels], minimumSamples: lens.minimumSamples });
    };
    if (lens.kind === 'quality') {
      if (!metrics.size && !frames.length) unavailable('Nema potvrđenih mjernih zapisa. Pokreni podržano očitanje ili uvezi mjerni trag.');
      else {
        const allSources = unique([...metrics.values()].flatMap(m => m.sourceIds).concat(frames.map(f => f.sourceId)));
        result.summary = `Raspoloživo je ${metrics.size} metričkih kanala${frames.length ? ` i ${frames.length} vremenski označenih okvira` : ''}. Kalibracija i fizička tačnost nisu potvrđene softverom.`;
        result.observations = [observation('Kanali sa statistikom', metrics.size), observation('Izvori u tragovima', allSources.length), ...(frames.length ? [observation('Prihvaćeni vremenski okviri', frames.length)] : [])];
        const qualityIds = unique(frames.map(f => f.id));
        result.evidence = { sourceIds: allSources.slice(0, 128), frameIds: qualityIds.slice(0, 20), frameIdsTruncated: qualityIds.length > 20 };
        if (!frames.length) result.limitations.push('Dostupna je agregirana statistika; sirovi vremenski okviri nisu proslijeđeni ovom pregledu.');
        if (missingContext.length) result.limitations.push(`Nedostaje kontekst: ${missingContext.join('; ')}.`);
      }
    } else if (lens.kind === 'association') {
      const pairs = pairFrames(associationFrames, lens.channels[0], lens.channels[1], pairWindowMs);
      if (pairs.length < lens.minimumSamples) unavailable(`Potrebno je najmanje ${lens.minimumSamples} stvarnih parova kanala ${lens.channels.join(' / ')}; pronađeno ${pairs.length}.`);
      else {
        const r = pearson(pairs), maxSkew = Math.max(...pairs.map(p => p.skewMs));
        result.summary = r === null ? 'Upareni tragovi nemaju potrebnu varijaciju za Pearsonov koeficijent; povezanost nije izračunata.' : `Pearsonov koeficijent iz ${pairs.length} stvarnih parova je ${pretty(r)}. Ovo je opažena povezanost, ne uzrok ni dijagnoza.`;
        result.observations = [observation('Broj parova', pairs.length), observation('Najveći vremenski razmak para', maxSkew, 'ms'), ...(r === null ? [] : [observation('Pearson r', r)])];
        const pairIds = unique(pairs.flatMap(p => p.ids));
        result.evidence = { sourceIds: unique(pairs.flatMap(p => p.sourceIds)).slice(0, 128), frameIds: pairIds.slice(0, 20), frameIdsTruncated: pairIds.length > 20, pairCount: pairs.length };
        result.limitations.push(pairWindowMs === 0 ? 'Upareni su samo kanali iz istog okvira; to ne potvrđuje fizičku sinhronizaciju senzora.' : `Korisnik je dozvolio vremensko uparivanje do ${pairWindowMs} ms. Svaki uzorak drugog kanala korišten je najviše jednom.`);
        if (missingContext.length) result.limitations.push('Režim i mjerni kontekst nisu potpuni; koeficijent se ne smije tumačiti kao funkcionalna ispravnost.');
      }
    } else if (selected.some(m => !m)) unavailable(`Nedostaje kanal: ${lens.channels.filter((_, i) => !selected[i]).join(', ')}.`);
    else {
      const m = selected[0], label = channelLabels.get(m.id).label;
      result.evidence.sampleCount = m.count;
      if (m.count < lens.minimumSamples) unavailable(`Za ${label} potrebno je najmanje ${lens.minimumSamples} uzoraka; dostupno ${m.count}.`);
      else if (lens.kind === 'stability') {
        result.summary = `${label}: medijan ${pretty(m.median)} ${m.unit}, raspon ${pretty(m.min)}–${pretty(m.max)} ${m.unit}. Nije zadana granica prihvatljivosti.`;
        result.observations = [observation('Medijan', m.median, m.unit), observation('Minimum', m.min, m.unit), observation('Maksimum', m.max, m.unit), observation('Medijana apsolutnog odstupanja (MAD)', m.mad, m.unit)];
        result.limitations.push('Raspon i MAD opisuju snimak; ne potvrđuju ponovljivost instrumenta, toleranciju ili ispravnost predmeta.');
      } else if (lens.kind === 'trend') {
        if (!(finite(m.durationSeconds) && m.durationSeconds > 0 && finite(m.slopePerSecond))) unavailable('Vremenski trend zahtijeva različite vremenske oznake i konačan nagib iz stvarnog snimanja.');
        else {
          result.summary = `${label}: linearni nagib ${pretty(m.slopePerSecond)} ${m.unit}/s tokom ${pretty(m.durationSeconds)} s. Ovo opisuje snimak, ne predviđa kvar.`;
          result.observations = [observation('Nagib linearnog trenda', m.slopePerSecond, `${m.unit}/s`), observation('Trajanje snimka', m.durationSeconds, 's')];
          result.limitations.push('Nagib zavisi od trajanja i režima snimanja; prolazna promjena nije automatski odstupanje od specifikacije.');
        }
      } else if (lens.kind === 'change') {
        const b = m.baseline;
        if (!b || typeof b !== 'object' || !Number.isInteger(b.count) || b.count < 5 || b.count > 50000 || !finite(b.median) || !finite(b.mad) || b.mad < 0 || typeof b.id !== 'string' || !b.id.trim()) unavailable('Potreban je sačuvan bazni snimak istog kanala s najmanje pet uzoraka i njegovom oznakom.');
        else {
          const delta = m.median - b.median, percentage = b.median === 0 || m.unit === '°C' ? null : 100 * delta / Math.abs(b.median);
          result.summary = `${label}: medijan osnove ${pretty(b.median)} ${m.unit}, sada ${pretty(m.median)} ${m.unit}; promjena ${pretty(delta)} ${m.unit}. Promjena nije dokaz uzroka ili uspjeha popravke.`;
          result.observations = [observation('Medijan baznog snimka', b.median, m.unit), observation('Medijan tekućeg snimka', m.median, m.unit), observation('Razlika medijana', delta, m.unit), ...(percentage !== null && finite(percentage) ? [observation('Relativna promjena prema apsolutnoj osnovi', percentage, '%')] : [])];
          result.evidence.baselineId = b.id.slice(0, 200); result.evidence.baselineSampleCount = b.count;
          if (percentage === null) result.limitations.push(m.unit === '°C' ? 'Relativna promjena nije prikazana za Celzijusovu skalu s proizvoljnom nulom.' : 'Relativna promjena nije definisana jer je medijan osnove nula.');
          if (b.deviation?.kind === 'source-set-changed') {
            result.status = 'not-comparable';
            result.summary += ' Skup izvora je promijenjen; statistička ocjena uporedivosti je odbijena.';
            result.limitations.push('Sačuvana je samo aritmetička razlika. Promjena instrumenta ili skupa izvora sprečava zaključak o promjeni istog sistema.');
          }
          result.limitations.push('Uporedivost predmeta, instrumenta, tačke i radnog režima mora potvrditi korisnik.');
        }
      } else if (lens.kind === 'reference') {
        const ref = context.limits?.[m.id];
        if (!ref || typeof ref !== 'object' || !finite(ref.min) || !finite(ref.max) || ref.min > ref.max || typeof ref.source !== 'string' || !ref.source.trim()) unavailable('Nema izričito zadane donje i gornje granice s izvorom dokumentacije. Profil ne izmišlja fabričke pragove.');
        else {
          const outside = m.min < ref.min || m.max > ref.max;
          result.status = outside ? 'outside-declared-reference' : 'within-declared-reference';
          result.summary = `Zabilježeni raspon ${pretty(m.min)}–${pretty(m.max)} ${m.unit} ${outside ? 'prelazi' : 'nalazi se unutar'} korisnički zadane granice ${pretty(ref.min)}–${pretty(ref.max)} ${m.unit}. Izvor: ${ref.source.slice(0, 500)}.`;
          result.observations = [observation('Zadana donja granica', ref.min, m.unit), observation('Zadana gornja granica', ref.max, m.unit), observation('Zabilježeni minimum', m.min, m.unit), observation('Zabilježeni maksimum', m.max, m.unit)];
          result.limitations.push('Softver nije provjerio valjanost korisničkog izvora. Poređenje nije potvrda sigurnosti, zakonske usklađenosti ili uzroka odstupanja.');
        }
      }
    }
    findings.push(result);
  }
  return {
    profileId: profile.id,
    status: missingData.length === findings.length ? 'insufficient-data' : missingData.length || findings.some(f => f.status === 'not-comparable') ? 'partial' : 'observed',
    findings, missingData,
    contextMissing: missingContext,
    notes: ['Odluke su izvedene iz proslijeđenih mjernih tragova i dokumentovanih korisničkih granica. Nije korišten AI model.', 'Dijagnostički profil ne komanduje uređaju, ne mijenja živo stanje i ne proglašava sistem sigurnim ili neprobojnim.']
  };
}
