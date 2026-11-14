/* BL CLEA Tools — original workflow and calculation definitions, by Brzo i Lokalno.
 * All values come from the operator. Calculations do not certify an installation,
 * identify a vehicle fault or replace manufacturer procedures. No remote access.
 */

const text = (id, label, extra = {}) => ({ id, label, type: 'text', ...extra });
const memo = (id, label, extra = {}) => ({ id, label, type: 'textarea', ...extra });
const num = (id, label, unit, extra = {}) => ({ id, label, type: 'number', unit, min: 0, max: 1e9, ...extra });
const select = (id, label, options, extra = {}) => ({ id, label, type: 'select', options, ...extra });
const date = (id, label, extra = {}) => ({ id, label, type: 'date', ...extra });
const step = (id, title, description) => ({ id, title, description, evidenceRequired: true });
function item(label, value, unit = '') {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Rezultat nije konačan broj. Provjeri jedinice i veličine ulaza.');
  if (typeof value === 'number' && Math.abs(value) > 1e12) throw new Error('Rezultat je izvan podržanog raspona do 1 000 000 000 000. Provjeri jedinice i veličine ulaza.');
  return { label, value: typeof value === 'number' ? Number(value.toPrecision(12)) : value, unit };
}

function number(values, key, label, min = 0, max = 1e9, integer = false) {
  const raw = values?.[key];
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '') || (typeof raw !== 'string' && typeof raw !== 'number')) {
    throw new Error(`${label}: unesi broj.`);
  }
  if (typeof raw === 'string' && !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())) throw new Error(`${label}: neispravan broj.`);
  const v = typeof raw === 'number' ? raw : Number(raw.trim().replace(',', '.'));
  if (!Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
    throw new Error(`${label}: dozvoljen je ${integer ? 'cijeli ' : ''}broj od ${min} do ${max}.`);
  }
  return v;
}

function positive(values, key, label, max = 1e9) {
  const v = number(values, key, label, 0, max);
  if (v === 0) throw new Error(`${label}: mora biti veće od nule.`);
  return v;
}

function choice(values, key, label, options) {
  if (!options.includes(values?.[key])) throw new Error(`${label}: odaberi jednu od ponuđenih opcija.`);
  return values[key];
}

const fuel = {
  id: 'fuel', name: 'Potrošnja i trošak puta',
  description: 'Računaj iz stvarne pređene udaljenosti i natočenog goriva. Nije procjena kvara motora.',
  inputs: [num('distance', 'Pređena udaljenost', 'km', { required: true }), num('litres', 'Utrošeno gorivo', 'L', { required: true }), num('price', 'Cijena goriva', 'KM/L', { required: true })],
  calculate(v) {
    const d = positive(v, 'distance', 'Udaljenost'), l = number(v, 'litres', 'Gorivo'), p = number(v, 'price', 'Cijena');
    return { items: [item('Prosječna potrošnja', 100 * l / d, 'L/100 km'), item('Trošak puta', l * p, 'KM'), item('Trošak po kilometru', l * p / d, 'KM/km')], notes: ['Formula: 100 × utrošeni litri / pređeni kilometri. Uzimaj uporediv početni i završni nivo rezervoara.', 'Rezultat opisuje uneseni put; sam po sebi ne utvrđuje tehnički kvar.'] };
  }
};

const service = {
  id: 'service-interval', name: 'Sljedeći servis prema zadatom intervalu',
  description: 'Poveži zabilježeni servis i kilometražu s intervalom iz servisne dokumentacije.',
  inputs: [num('last', 'Kilometraža zadnjeg servisa', 'km', { required: true }), num('interval', 'Dokumentovani interval', 'km', { required: true }), num('current', 'Trenutna kilometraža', 'km', { required: true })],
  calculate(v) {
    const last = number(v, 'last', 'Zadnji servis'), interval = positive(v, 'interval', 'Interval'), current = number(v, 'current', 'Trenutna kilometraža');
    if (current < last) throw new Error('Trenutna kilometraža je manja od kilometraže servisa. Provjeri zapis ili zamjenu instrumenta.');
    const due = last + interval, remaining = due - current;
    return { items: [item('Sljedeća kilometraža servisa', due, 'km'), item(remaining >= 0 ? 'Preostalo prema intervalu' : 'Prekoračenje intervala', Math.abs(remaining), 'km')], notes: ['Interval unosi serviser iz uputstva proizvođača; alat ga ne pretpostavlja.', 'Vremenski rok, uslovi teške upotrebe i različiti servisni zahvati nisu obuhvaćeni ovim kilometarskim proračunom.'] };
  }
};

const voltageChange = {
  id: 'voltage-change', name: 'Poređenje dva naponska mjerenja',
  description: 'Kvantificiraj promjenu uz iste jedinice i zabilježene uslove mjerenja.',
  inputs: [num('reference', 'Referentno mjerenje', 'V', { required: true }), num('observed', 'Uporedno mjerenje', 'V', { required: true })],
  calculate(v) {
    const a = positive(v, 'reference', 'Referentno mjerenje'), b = number(v, 'observed', 'Uporedno mjerenje');
    return { items: [item('Razlika: uporedno − referentno', b - a, 'V'), item('Relativna promjena', 100 * (b - a) / a, '%')], notes: ['Različiti režimi rada, temperatura i mjerni instrument mogu uticati na poređenje.', 'Nema ugrađenog praga ispravnosti akumulatora ili alternatora. Koristi odgovarajuću servisnu specifikaciju.'] };
  }
};

const power = {
  id: 'power', name: 'Snaga jednog strujnog kruga',
  description: 'DC: P = U × I. Jednofazni AC: aktivna snaga = U × I × faktor snage.',
  inputs: [select('mode', 'Režim proračuna', ['DC', 'Jednofazni AC'], { required: true }), num('voltage', 'Napon', 'V', { required: true }), num('current', 'Struja', 'A', { required: true }), num('pf', 'Faktor snage (za DC unesi 1)', '', { required: true, max: 1 })],
  calculate(v) {
    const mode = choice(v, 'mode', 'Režim', ['DC', 'Jednofazni AC']), u = number(v, 'voltage', 'Napon'), i = number(v, 'current', 'Struja');
    const pf = number(v, 'pf', 'Faktor snage', 0, 1);
    if (mode === 'DC' && pf !== 1) throw new Error('Za DC proračun faktor snage mora biti 1.');
    return { items: [item('Aktivna snaga', u * i * pf, 'W'), item('Aktivna snaga', u * i * pf / 1000, 'kW'), ...(mode === 'Jednofazni AC' ? [item('Prividna snaga', u * i, 'VA')] : [])], notes: ['AC proračun koristi efektivne vrijednosti i uneseni ukupni faktor snage. Nije trofazni proračun.', 'Rezultat ne potvrđuje dimenzioniranje provodnika, zaštite, uzemljenja ili sigurnost instalacije.'] };
  }
};

const ohm = {
  id: 'ohm', name: 'Ohmov zakon za otporno opterećenje',
  description: 'Iz poznatog napona i otpora izračunaj struju i disipaciju idealnog otpornika.',
  inputs: [num('voltage', 'Napon', 'V', { required: true }), num('resistance', 'Otpor', 'Ω', { required: true })],
  calculate(v) {
    const u = number(v, 'voltage', 'Napon'), r = positive(v, 'resistance', 'Otpor');
    return { items: [item('Struja', u / r, 'A'), item('Disipacija', u * u / r, 'W')], notes: ['Model: idealno otporno opterećenje, I = U/R, P = U²/R. Ne modelira nelinearna opterećenja niti impedansu AC kola.', 'Mjerenje otpora radi se prema postupku proizvođača instrumenta na odgovarajuće isključenom i osiguranom kolu.'] };
  }
};

const energy = {
  id: 'energy', name: 'Energija i procjena troška',
  description: 'Računaj potrošnju pri zadatoj aktivnoj snazi, vremenu i tarifi.',
  inputs: [num('watts', 'Aktivna snaga', 'W', { required: true }), num('hours', 'Vrijeme rada', 'h', { required: true }), num('tariff', 'Tarifa', 'KM/kWh', { required: true })],
  calculate(v) {
    const w = number(v, 'watts', 'Snaga'), h = number(v, 'hours', 'Vrijeme'), t = number(v, 'tariff', 'Tarifa');
    const kwh = w * h / 1000;
    return { items: [item('Energija', kwh, 'kWh'), item('Promjenjivi trošak energije', kwh * t, 'KM')], notes: ['Pretpostavlja stalnu aktivnu snagu tokom zadanog vremena. Ciklusi rada i promjene opterećenja nisu mjereni.', 'Fiksne naknade, porezi i više tarifa nisu uključeni. Unesi efektivnu tarifu za posmatrani period.'] };
  }
};

const wall = {
  id: 'net-wall', name: 'Neto površina zidova',
  description: 'Pravougaona prostorija: obim × visina, umanjen za stvarno izmjerene otvore.',
  inputs: [num('length', 'Dužina prostorije', 'm', { required: true }), num('width', 'Širina prostorije', 'm', { required: true }), num('height', 'Visina', 'm', { required: true }), num('openings', 'Ukupna površina otvora', 'm²', { required: true }), num('reserve', 'Dodatak za materijal', '%', { required: true, max: 100 })],
  calculate(v) {
    const l = positive(v, 'length', 'Dužina'), w = positive(v, 'width', 'Širina'), h = positive(v, 'height', 'Visina'), o = number(v, 'openings', 'Otvori'), reserve = number(v, 'reserve', 'Dodatak', 0, 100);
    const gross = 2 * (l + w) * h;
    if (o > gross) throw new Error('Površina otvora ne može biti veća od ukupne površine zidova.');
    const net = gross - o;
    return { items: [item('Bruto površina zidova', gross, 'm²'), item('Neto površina zidova', net, 'm²'), item('Količinska osnova s dodatkom', net * (1 + reserve / 100), 'm²')], notes: ['Model obuhvata četiri zida pravougaone prostorije, bez stropa, špaleta i neravnina.', 'Dodatak određuje korisnik; broj slojeva i deklarisana pokrivnost proizvoda određuju konačnu nabavku.'] };
  }
};

const slab = {
  id: 'slab-volume', name: 'Zapremina ravnog sloja',
  description: 'Količinski obračun pravougaone ploče, estriha ili nasipa s uniformnom debljinom.',
  inputs: [num('length', 'Dužina', 'm', { required: true }), num('width', 'Širina', 'm', { required: true }), num('thickness', 'Debljina', 'cm', { required: true }), num('reserve', 'Dodatak za količinu', '%', { required: true, max: 100 })],
  calculate(v) {
    const l = positive(v, 'length', 'Dužina'), w = positive(v, 'width', 'Širina'), t = positive(v, 'thickness', 'Debljina'), r = number(v, 'reserve', 'Dodatak', 0, 100), volume = l * w * t / 100;
    return { items: [item('Površina', l * w, 'm²'), item('Geometrijska zapremina', volume, 'm³'), item('Zapremina s dodatkom', volume * (1 + r / 100), 'm³')], notes: ['Debljina je unesena u centimetrima i pretvara se u metre. Pretpostavlja ravnu podlogu i jednaku debljinu.', 'Nije statički proračun niti specifikacija armature, nosivosti, smjese ili zbijanja.'] };
  }
};

const tile = {
  id: 'tile-quantity', name: 'Količina obloge prema površini',
  description: 'Iz neto površine i dimenzija komada izračunaj količinsku osnovu i pakovanja.',
  inputs: [num('area', 'Neto površina', 'm²', { required: true }), num('tileLength', 'Dužina komada', 'cm', { required: true }), num('tileWidth', 'Širina komada', 'cm', { required: true }), num('reserve', 'Dodatak za rezanje', '%', { required: true, max: 100 }), num('pack', 'Komada u pakovanju', 'kom', { required: true, max: 100000 })],
  calculate(v) {
    const a = number(v, 'area', 'Površina'), l = positive(v, 'tileLength', 'Dužina komada'), w = positive(v, 'tileWidth', 'Širina komada'), r = number(v, 'reserve', 'Dodatak', 0, 100), pack = number(v, 'pack', 'Komada u pakovanju', 1, 100000, true);
    const target = a * (1 + r / 100), pieces = Math.ceil(target / (l * w / 10000)), packs = Math.ceil(pieces / pack);
    if (!Number.isSafeInteger(pieces) || !Number.isSafeInteger(packs * pack)) throw new Error('Količina prelazi siguran cjelobrojni raspon. Provjeri jedinice i dimenzije komada.');
    return { items: [item('Ciljna površina s dodatkom', target, 'm²'), item('Minimalno komada prema površini', pieces, 'kom'), item('Cijela pakovanja', packs, 'pak'), item('Komada u cijelim pakovanjima', packs * pack, 'kom')], notes: ['Zaokruživanje: prvo na cijeli komad, zatim na cijelo pakovanje. Površina komada ne uključuje fuge.', 'Ovo nije raspored polaganja ili rezanja; geometrija prostorije, uzorak i škart mogu zahtijevati više materijala.'] };
  }
};

const water = {
  id: 'water-transfer', name: 'Toplinski prijenos kroz vodu',
  description: 'Procijeni prijenos topline iz izmjerenog zapreminskog protoka i razlike temperatura čiste vode.',
  inputs: [num('flow', 'Protok vode', 'L/min', { required: true }), num('inlet', 'Ulazna temperatura', '°C', { required: true, min: 0, max: 100 }), num('outlet', 'Izlazna temperatura', '°C', { required: true, min: 0, max: 100 })],
  calculate(v) {
    const flow = number(v, 'flow', 'Protok'), ti = number(v, 'inlet', 'Ulazna temperatura', 0, 100), to = number(v, 'outlet', 'Izlazna temperatura', 0, 100), dt = to - ti;
    const kw = flow / 60 * 4.186 * dt;
    return { items: [item('Promjena temperature vode', dt, '°C'), item('Toplina koju voda prima (+) / predaje (−)', kw, 'kW'), item('Apsolutna toplinska snaga', Math.abs(kw), 'kW')], notes: ['Aproksimacija: čista tečna voda, gustina 1 kg/L i specifična toplota 4,186 kJ/(kg·K).', 'Glikol, promjena faze, gubici i zavisnost osobina od temperature nisu modelirani. Ovo nije mjerenje rashladnog sredstva niti potvrda učinka opreme.'] };
  }
};

const air = {
  id: 'air-transfer', name: 'Osjetni prijenos topline kroz zrak',
  description: 'Procjena osjetne komponente iz protoka zraka i dvije temperature; bez latentne topline.',
  inputs: [num('flow', 'Zapreminski protok zraka', 'm³/h', { required: true }), num('inlet', 'Ulazna temperatura', '°C', { required: true, min: -50, max: 100 }), num('outlet', 'Izlazna temperatura', '°C', { required: true, min: -50, max: 100 })],
  calculate(v) {
    const flow = number(v, 'flow', 'Protok'), ti = number(v, 'inlet', 'Ulazna temperatura', -50, 100), to = number(v, 'outlet', 'Izlazna temperatura', -50, 100), dt = to - ti;
    return { items: [item('Promjena temperature', dt, '°C'), item('Osjetna toplina koju zrak prima (+) / predaje (−)', flow / 3600 * 1.2 * 1.005 * dt, 'kW')], notes: ['Aproksimacija: gustina zraka 1,2 kg/m³ i specifična toplota 1,005 kJ/(kg·K). Nadmorska visina i stanje zraka utiču na vrijednosti.', 'Vlažnost, kondenzacija i latentna toplina nisu uključene. Rezultat se ne smije predstaviti kao ukupni kapacitet uređaja.'] };
  }
};

const ventilation = {
  id: 'ventilation', name: 'Protok iz zadanog broja izmjena',
  description: 'Pretvori projektom zadat broj izmjena zraka u zapreminski protok za pravougaonu prostoriju.',
  inputs: [num('length', 'Dužina prostorije', 'm', { required: true }), num('width', 'Širina prostorije', 'm', { required: true }), num('height', 'Visina prostorije', 'm', { required: true }), num('ach', 'Zadani broj izmjena', '1/h', { required: true, max: 10000 })],
  calculate(v) {
    const l = positive(v, 'length', 'Dužina'), w = positive(v, 'width', 'Širina'), h = positive(v, 'height', 'Visina'), ach = number(v, 'ach', 'Broj izmjena', 0, 10000), volume = l * w * h;
    return { items: [item('Zapremina prostorije', volume, 'm³'), item('Protok pri zadanom broju izmjena', volume * ach, 'm³/h'), item('Isti protok', volume * ach / 3.6, 'L/s')], notes: ['Broj izmjena unosi korisnik iz odgovarajućeg projekta ili zahtjeva. Alat ne propisuje minimalnu ventilaciju.', 'Nisu provjereni broj osoba, kvalitet zraka, pad pritiska, buka, dimovod ili protivpožarni uslovi.'] };
  }
};

const panel = {
  id: 'panel-grid', name: 'Raspored jednakih pravougaonih komada',
  description: 'Izračunaj dva pravilna mrežna rasporeda na jednoj ploči i odaberi onaj s više komada.',
  inputs: [num('stockLength', 'Dužina sirove ploče', 'mm', { required: true, max: 100000 }), num('stockWidth', 'Širina sirove ploče', 'mm', { required: true, max: 100000 }), num('partLength', 'Dužina komada', 'mm', { required: true, max: 100000 }), num('partWidth', 'Širina komada', 'mm', { required: true, max: 100000 }), num('kerf', 'Širina reza / razmak između komada', 'mm', { required: true, max: 100 }), num('trim', 'Rubni dodatak sa svake strane', 'mm', { required: true, max: 10000 }), select('rotate', 'Dozvoljeno okretanje komada', ['Da', 'Ne — smjer materijala je obavezan'], { required: true })],
  calculate(v) {
    const sl = positive(v, 'stockLength', 'Dužina ploče', 100000), sw = positive(v, 'stockWidth', 'Širina ploče', 100000), pl = positive(v, 'partLength', 'Dužina komada', 100000), pw = positive(v, 'partWidth', 'Širina komada', 100000), k = number(v, 'kerf', 'Širina reza', 0, 100), t = number(v, 'trim', 'Rubni dodatak', 0, 10000), rotation = choice(v, 'rotate', 'Okretanje', ['Da', 'Ne — smjer materijala je obavezan']);
    const l = sl - 2 * t, w = sw - 2 * t;
    if (l <= 0 || w <= 0) throw new Error('Rubni dodatak ne ostavlja pozitivnu korisnu površinu ploče.');
    const a = { across: Math.floor((l + k) / (pl + k)), down: Math.floor((w + k) / (pw + k)), rotated: false };
    const b = { across: Math.floor((l + k) / (pw + k)), down: Math.floor((w + k) / (pl + k)), rotated: true };
    const best = rotation === 'Da' && b.across * b.down > a.across * a.down ? b : a;
    const count = best.across * best.down;
    if (count > 100000) throw new Error('Raspored prelazi 100.000 komada po ploči. Provjeri dimenzije.');
    const occupied = count * pl * pw;
    return { items: [item('Odabrani raspored', best.rotated ? 'Okrenut za 90°' : 'Bez okretanja'), item('Kolone', best.across, 'kom'), item('Redovi', best.down, 'kom'), item('Komada po ploči', count, 'kom'), item('Površina gotovih komada / sirova ploča', 100 * occupied / (sl * sw), '%'), item('Površina izvan gotovih komada', (sl * sw - occupied) / 1e6, 'm²')], notes: ['Originalni, ograničeni algoritam poredi samo dva jednolična mrežna rasporeda. Ne tvrdi da nalazi globalno optimalan raspored mješovitih dijelova.', 'Razmak se računa između komada, a rubni dodatak na sve četiri strane. Preostala površina uključuje rezove i rubove; nije sav taj materijal ponovo upotrebljiv.', 'Ovo je geometrijski raspored, bez redoslijeda poteza pile, stezanja, sigurnosnih zona ili NC/G-code izvoza. Konačan plan potvrđuje operater.'] };
  }
};

const batch = {
  id: 'batch-cost', name: 'Trošak serije i cijena po komadu',
  description: 'Poveži materijal, pripremu i rad sa stvarnim brojem komada; marža je od prodajne cijene.',
  inputs: [num('quantity', 'Broj komada u seriji', 'kom', { required: true, max: 100000 }), num('material', 'Materijal po komadu', 'KM/kom', { required: true }), num('minutes', 'Rad po komadu', 'min/kom', { required: true }), num('setup', 'Priprema serije', 'min', { required: true }), num('rate', 'Interni trošak rada', 'KM/h', { required: true }), num('overhead', 'Dodatni trošak serije', 'KM', { required: true }), num('margin', 'Ciljana marža u prodajnoj cijeni', '%', { required: true, max: 99.99 })],
  calculate(v) {
    const q = number(v, 'quantity', 'Broj komada', 1, 100000, true), m = number(v, 'material', 'Materijal'), minutes = number(v, 'minutes', 'Rad'), setup = number(v, 'setup', 'Priprema'), rate = number(v, 'rate', 'Trošak rada'), overhead = number(v, 'overhead', 'Dodatni trošak'), margin = number(v, 'margin', 'Marža', 0, 99.99);
    const hours = (q * minutes + setup) / 60, cost = q * m + hours * rate + overhead, unit = cost / q, price = unit / (1 - margin / 100);
    return { items: [item('Planirano radno vrijeme serije', hours, 'h'), item('Ukupni interni trošak', cost, 'KM'), item('Trošak po komadu', unit, 'KM/kom'), item('Cijena po komadu pri zadanoj marži', price, 'KM/kom'), item('Ukupna cijena serije', price * q, 'KM')], notes: ['Marža: (prodajna cijena − trošak) / prodajna cijena. Nije isto što i postotni dodatak na trošak.', 'Bez poreza, prodajnih naknada i neunesenog škarta. Model koristi uneseno vrijeme; ne garantuje trajanje proizvodnje ili zaradu.'] };
  }
};

const linear = {
  id: 'linear-material', name: 'Dužinski materijal i masa',
  description: 'Obračunaj ukupnu dužinu i masu serije iz deklarisane mase po metru.',
  inputs: [num('length', 'Dužina jednog komada', 'mm', { required: true }), num('quantity', 'Broj komada', 'kom', { required: true, max: 100000 }), num('massPerMetre', 'Deklarisana masa po metru', 'kg/m', { required: true }), num('reserve', 'Dodatak za materijal', '%', { required: true, max: 100 })],
  calculate(v) {
    const l = positive(v, 'length', 'Dužina komada'), q = number(v, 'quantity', 'Broj komada', 1, 100000, true), mass = number(v, 'massPerMetre', 'Masa po metru'), reserve = number(v, 'reserve', 'Dodatak', 0, 100), metres = l * q / 1000;
    return { items: [item('Neto dužina svih komada', metres, 'm'), item('Masa gotovih komada', metres * mass, 'kg'), item('Količinska dužina s dodatkom', metres * (1 + reserve / 100), 'm')], notes: ['Masa po metru preuzima se iz dokumentacije konkretnog profila ili mjerenja. Gustina i geometrija nisu pretpostavljene.', 'Dodatak je količinska rezerva, ne optimizacija rezanja iz standardnih šipki. Završna obrada i širina reza trebaju zaseban plan.'] };
  }
};

export const TOOLS = [
  {
    id: 'auto', name: 'CLEA Diagnostics Auto', shortName: 'Auto', icon: 'auto', color: '#58b6ff',
    tagline: 'Od simptoma do dokumentovane servisne odluke.',
    audience: 'Za automehaničare, servisere i vlasnike vozila.',
    description: 'Poveži vozilo, simptome, OBD očitanja, mjerenja i servisnu historiju u jedan predmet. Dokazi ostaju uz svaku odluku i izvještaj.',
    fields: [text('client', 'Klijent / interni naziv'), text('vehicle', 'Marka, model i izvedba', { required: true }), text('registration', 'Interna oznaka vozila'), text('vin', 'VIN / broj šasije', { help: 'Opcionalno. Unesi samo ako je potrebno za radni predmet.' }), num('year', 'Godina vozila', '', { min: 1886, max: 2200 }), num('mileage', 'Trenutna kilometraža', 'km'), select('fuelType', 'Pogon', ['Benzin', 'Dizel', 'Hibrid', 'Električni', 'LPG / CNG', 'Drugo / nepoznato']), memo('symptoms', 'Prijavljeni simptomi i uslovi pojave', { required: true }), memo('serviceHistory', 'Poznata servisna historija'), memo('reference', 'Servisna dokumentacija / referenca postupka'), memo('decision', 'Zaključak servisera i sljedeća radnja')],
    steps: [step('intake', 'Zabilježi razlog dolaska', 'Unesi vozilo, prijavljeni simptom, kada se javlja i poznatu servisnu historiju. Označi samo opaženo, bez pretpostavljenog kvara.'), step('prepare', 'Pripremi pregled i odaberi postupak', 'Zabilježi dokumentaciju proizvođača, uslove pregleda i potrebnu stručnu osposobljenost. Ne pokreći motor u zatvorenom neventiliranom prostoru.'), step('read', 'Prikupi početne dokaze', 'Sačuvaj očitane kodove i dostupna mjerenja uz uslove rada. OBD kod nije dokaz da određeni dio treba zamijeniti. Ovaj alat ne briše kodove.'), step('compare', 'Uporedi dokaze i provjeri hipotezu', 'Poveži simptom sa servisnim postupkom, mjerenjem i njegovom referencom. Zabilježi šta jeste i šta nije provjereno.'), step('intervention', 'Dokumentuj stvarno izvedeni zahvat', 'Navedi izvedene radnje, ugrađene dijelove i odgovornog servisera. Softver ne potvrđuje fizičko izvršenje.'), step('verify', 'Zabilježi provjeru nakon zahvata', 'Pod istim uslovima zabilježi novo mjerenje i preostale simptome. Probnu vožnju organizuj odvojeno, bez rukovanja ovim alatom tokom vožnje.'), step('handover', 'Predaj servisni izvještaj', 'Pregledaj nalaz, ograničenja provjere, materijale i trošak. Predaj izvještaj samo nakon vlastite stručne provjere.')],
    measurements: [num('batteryVoltageV', 'Napon akumulatora u mirovanju — ručno mjerenje', 'V', { max: 1000 }), num('runningVoltageV', 'Napon uz upaljen motor — ručno mjerenje', 'V', { max: 1000 }), num('moduleVoltageV', 'Napon upravljačkog modula — OBD', 'V', { max: 1000 }), num('rpm', 'Broj okretaja', 'rpm', { max: 30000 }), num('coolantC', 'Temperatura rashladne tečnosti', '°C', { min: -60, max: 250 }), num('intakeC', 'Temperatura usisnog zraka', '°C', { min: -60, max: 250 }), num('manifoldKpa', 'Apsolutni usisni pritisak', 'kPa', { max: 1000 }), num('airflowGps', 'Maseni protok zraka', 'g/s', { max: 10000 }), num('speedKph', 'Brzina vozila — zabilježeno OBD očitanje', 'km/h', { max: 1000 }), num('throttlePct', 'Položaj leptira — OBD', '%', { max: 100 }), num('engineLoadPct', 'Izračunato opterećenje motora — OBD', '%', { max: 100 }), memo('conditions', 'Uslovi mjerenja / instrument')],
    calculators: [fuel, service, voltageChange]
  },
  {
    id: 'electric', name: 'CLEA Electric', shortName: 'Electric', icon: 'electric', color: '#edc66c',
    tagline: 'Mjerenje, trag postupka i jasan zapis intervencije.',
    audience: 'Za kvalifikovane električare i tehničare održavanja.',
    description: 'Organizuj pregled po krugu i uređaju, unesi izmjerene vrijednosti, provjeri proračune i napravi izvještaj s referencama i otvorenim pitanjima.',
    fields: [text('client', 'Klijent / objekat'), text('circuit', 'Oznaka kruga / uređaja', { required: true }), select('system', 'Sistem', ['DC', 'Jednofazni AC', 'Trofazni AC', 'Drugo / nepoznato']), text('drawing', 'Shema / revizija dokumentacije'), text('instrument', 'Instrument i provjera instrumenta'), text('operator', 'Odgovorni kvalifikovani izvršilac'), memo('symptoms', 'Razlog pregleda', { required: true }), memo('isolation', 'Zapis izolacije i osiguranja prema važećem postupku'), memo('reference', 'Referentni postupak i kriteriji prihvatanja'), memo('decision', 'Nalaz izvršioca / ograničenja pregleda')],
    steps: [step('scope', 'Odredi krug i obim pregleda', 'Navedi oznaku kruga, napajanje, shemu, prijavljeni problem i odgovornog stručnog izvršioca.'), step('isolate', 'Zabilježi sigurno stanje prema postupku', 'Izvršilac bilježi identifikaciju izvora, isključenje, osiguranje i provjeru odsustva napona prema odgovarajućem postupku. Označavanje u softveru nije potvrda odsustva napona.'), step('inspect', 'Dokumentuj vizuelni pregled', 'Zabilježi stvarno viđeno stanje, oznake i oštećenja. Ako postupak ili nadležnost nisu jasni, prekini fizičku intervenciju.'), step('measure', 'Unesi mjerenja s kontekstom', 'Zapiši jedinicu, instrument, uslove mjerenja i referencu. Ne izvodi rad pod naponom na osnovu uputa ovog softvera.'), step('compare', 'Uporedi s dokumentovanim kriterijem', 'Poveži nalaz s važećom dokumentacijom. Proračuni su pomoćni i ne proglašavaju instalaciju sigurnom ili usklađenom.'), step('close', 'Zatvori nalog s odgovornošću', 'Zabilježi stvarnu intervenciju, provjeru nakon radova, preostala pitanja i potpis/identitet odgovornog izvršioca u svom postupku.')],
    measurements: [num('voltage', 'Izmjereni napon', 'V', { max: 100000 }), num('current', 'Izmjerena struja', 'A', { max: 100000 }), num('resistance', 'Izmjereni otpor', 'Ω'), num('insulation', 'Izmjereni izolacijski otpor', 'MΩ'), num('frequency', 'Frekvencija', 'Hz', { max: 1000000 }), num('powerFactor', 'Izmjereni faktor snage', '', { max: 1 }), memo('conditions', 'Uslovi, tačke mjerenja i mjerna nesigurnost')],
    calculators: [power, ohm, energy]
  },
  {
    id: 'build', name: 'CLEA Build', shortName: 'Build', icon: 'build', color: '#7ad4bc',
    tagline: 'Od izmjere do materijala i plana rada.',
    audience: 'Za izvođače, voditelje radova i samostalne majstore.',
    description: 'Drži obim radova, izmjere, količine, zavisnosti i ponudu zajedno. Jasno odvoji proračunatu količinu od stručnog odobrenja konstrukcije.',
    fields: [text('client', 'Klijent / gradilište'), text('location', 'Prostor / dio objekta', { required: true }), text('drawing', 'Nacrt / revizija / datum'), text('operator', 'Odgovorni izvođač'), memo('scope', 'Dogovoreni obim radova', { required: true }), memo('access', 'Pristup, radno vrijeme i zaštita prostora'), memo('specification', 'Specifikacija materijala i podloge'), memo('dependencies', 'Prethodni radovi i zavisnosti'), date('targetDate', 'Planirani rok'), memo('decision', 'Dogovorene izmjene i zapis primopredaje')],
    steps: [step('survey', 'Izmjeri i potvrdi obim', 'Poveži svaku mjeru s prostorom ili nacrtom. Zabilježi šta je uključeno, a šta izuzeto iz ponude.'), step('conditions', 'Provjeri uslove i zavisnosti', 'Zapiši pristup, stanje podloge, zaštitu prostora i radove koji prethode. Statičke, električne i druge regulisane odluke prepuštaju se nadležnim stručnjacima.'), step('takeoff', 'Izračunaj količine i objasni dodatak', 'Unesi stvarne dimenzije i svoj dodatak za materijal. Poveži količinu s konkretnom specifikacijom proizvoda.'), step('quote', 'Pripremi materijal i cijenu', 'Odvoji materijal, uslugu, količinu i cijenu. Provjeri rok nabavke i odobrenje izmjena prije radova.'), step('execute', 'Evidentiraj izvedene radove', 'Zabilježi stvarnu potrošnju, promjene na terenu i datum. Oznaka koraka je zapis korisnika, ne automatska inspekcija.'), step('handover', 'Predaj rad i dokumentaciju', 'Uporedi dogovoreni i izvedeni obim, zabilježi otvorene stavke i izdaj pregledan izvještaj.')],
    measurements: [num('length', 'Izmjerena dužina', 'm'), num('width', 'Izmjerena širina', 'm'), num('height', 'Izmjerena visina', 'm'), num('area', 'Potvrđena neto površina', 'm²'), num('thickness', 'Izmjerena debljina sloja', 'cm'), memo('conditions', 'Prostor, nacrt i napomena uz izmjeru')],
    calculators: [wall, slab, tile]
  },
  {
    id: 'climate', name: 'CLEA Climate', shortName: 'Climate', icon: 'climate', color: '#7ac7ed',
    tagline: 'Servis sa zabilježenim protokom, temperaturom i razlogom.',
    audience: 'Za HVAC servisere i tehničare vodnih sistema.',
    description: 'Vodi pregled klima, ventilacionih i vodnih sistema kroz mjerne tačke, radne uslove, dokumentovanu intervenciju i uporediv završni zapis.',
    fields: [text('client', 'Klijent / objekat'), text('asset', 'Uređaj, model i interna oznaka', { required: true }), select('system', 'Vrsta sistema', ['Klimatizacija', 'Ventilacija', 'Grijanje vodom', 'Vodovodni sistem', 'Drugo']), text('serial', 'Serijski broj / servisna oznaka'), text('operator', 'Odgovorni serviser'), memo('symptoms', 'Prijavljeni problem i režim rada', { required: true }), memo('reference', 'Servisno uputstvo i kriteriji proizvođača'), memo('intervention', 'Stvarni zahvat i dijelovi'), memo('decision', 'Nalaz, granice provjere i preporuka')],
    steps: [step('identify', 'Identifikuj sistem i problem', 'Zabilježi opremu, režim rada, simptome i dokumentaciju. Odvoji zračni i vodni krug od rashladnog sredstva.'), step('prepare', 'Pripremi stručni servisni postupak', 'Zabilježi izolaciju, uslove rada i odgovornog osposobljenog servisera. Ovaj alat ne daje postupak otvaranja rashladnog kruga ili rada na opasnim pritiscima.'), step('baseline', 'Sačuvaj početna mjerenja', 'Unesi temperature, protoke i označene mjerne tačke. Poredi mjerenja samo u zabilježenim i uporedivim uslovima.'), step('analysis', 'Provjeri bilans i referencu', 'Proračuni vode i osjetne topline zraka koriste vidljive pretpostavke. Ne predstavljaju automatsku dijagnozu, ukupni rashladni učinak ili dimenzioniranje uređaja.'), step('service', 'Zapiši izvedeni zahvat', 'Navedi stvarne radnje, materijale, dijelove i eventualno upućivanje drugom stručnjaku. Ne bilježi neizvedene radove kao završene.'), step('compare', 'Ponovi mjeru i predaj nalaz', 'Zabilježi završna mjerenja uz iste uslove, preostale simptome i ograničenja. Predaj izvještaj s vlastitim stručnim zaključkom.')],
    measurements: [num('inletTemp', 'Ulazna temperatura', '°C', { min: -50, max: 150 }), num('outletTemp', 'Izlazna temperatura', '°C', { min: -50, max: 150 }), num('ambientTemp', 'Temperatura okoline', '°C', { min: -50, max: 100 }), num('airFlow', 'Protok zraka', 'm³/h'), num('waterFlow', 'Protok vode', 'L/min'), num('humidity', 'Relativna vlažnost', '%', { max: 100 }), num('waterPressure', 'Izmjereni pritisak vode', 'bar', { max: 1000 }), memo('conditions', 'Tačke mjerenja, instrument i režim opreme')],
    calculators: [water, air, ventilation]
  },
  {
    id: 'workshop', name: 'CLEA Workshop', shortName: 'Workshop', icon: 'workshop', color: '#bdacf0',
    tagline: 'Nalog, mjera i proizvodnja u istom radnom tragu.',
    audience: 'Za stolarske, metalne i male proizvodne radionice.',
    description: 'Organizuj proizvodni nalog, mjere, materijal, raspored jednakih komada i kalkulaciju serije. Sačuvaj kontrolne tačke i stvarne promjene.',
    fields: [text('client', 'Klijent / interni naručilac'), text('product', 'Proizvod / naziv naloga', { required: true }), text('drawing', 'Radionički nacrt i revizija'), text('material', 'Materijal i specifikacija'), select('grain', 'Smjer materijala', ['Obavezan', 'Slobodan', 'Nije primjenjivo']), num('quantity', 'Tražena količina', 'kom', { min: 1, max: 100000 }), memo('scope', 'Zahtjevi, tolerancije i obrada', { required: true }), memo('route', 'Redoslijed operacija i resursi'), date('targetDate', 'Planirana predaja'), memo('decision', 'Zapis kontrole i odluka odgovornog izvršioca')],
    steps: [step('order', 'Potvrdi nalog i nacrt', 'Zabilježi proizvod, reviziju, broj komada, materijal, tolerancije i dogovor s naručiocem.'), step('measure', 'Provjeri ulazni materijal i mjere', 'Unesi stvarne dimenzije i smjer materijala. Potvrdi da je nacrt mjerodavan prije pripreme.'), step('plan', 'Pripremi raspored i kalkulaciju', 'Mrežni proračun obuhvata jednake pravougaonike i vidljive dodatke. Konačni rezni plan, redoslijed i sigurnosne zone provjerava operater.'), step('produce', 'Evidentiraj operacije', 'Bilježi izvedene radnje i promjene. Softver ne šalje komande stroju i nije sigurnosni sistem mašine.'), step('quality', 'Zapiši kontrolu proizvoda', 'Poveži izmjerene dimenzije, referentne tolerancije, količinu prihvaćenih komada i preostala odstupanja.'), step('handover', 'Predaj proizvod i zapis naloga', 'Pregledaj materijal, stvarni utrošak, cijenu i stanje narudžbe. Predaj izvještaj uz svoj stručni zaključak.')],
    measurements: [num('stockLength', 'Izmjerena dužina sirovine', 'mm'), num('stockWidth', 'Izmjerena širina sirovine', 'mm'), num('thickness', 'Izmjerena debljina', 'mm'), num('partLength', 'Dužina gotovog komada', 'mm'), num('partWidth', 'Širina gotovog komada', 'mm'), num('accepted', 'Prihvaćeni komadi', 'kom', { max: 100000 }), num('rejected', 'Odvojeni komadi', 'kom', { max: 100000 }), memo('conditions', 'Instrument, tolerancija i zapis kontrole')],
    calculators: [panel, batch, linear]
  }
];

function deepFreeze(value) {
  for (const item of Object.values(value)) if (item && typeof item === 'object' && !Object.isFrozen(item)) deepFreeze(item);
  return Object.freeze(value);
}
deepFreeze(TOOLS);

export function getTool(id) { return TOOLS.find(tool => tool.id === id); }

