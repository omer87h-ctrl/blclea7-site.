/* Original CLEA Auto saved-frame workflow. A stored ECU frame is historical
 * evidence; its acquisition time is never presented as the original event time. */
import { OBD_PROFILES } from './diagnostics.js';
import { getDeviceAccess } from './device-access.js';
import { hasNativeOBD } from './native-obd.js';
import { hasNativeFiles, openNativeText, saveTextFile } from './native-files.js';
import { scanAutoFreezeFrame, validateAutoFreezeFrame, parseAutoFreezeFrameFile } from './auto-freeze-frame.js';
import { formatNumber } from './display.js';

const VAULT_FORMAT = 'blclea.auto-freeze-vault/1';
const VAULT_KEY = 'blclea.tools.auto.freeze.v1';
const RECORD_BYTES = 1048576, VAULT_BYTES = 2 * RECORD_BYTES, MAX_RECORDS = 20;
const copy = value => JSON.parse(JSON.stringify(value));
const size = value => new TextEncoder().encode(value).length;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const states = { available:'Očitano', unavailable:'Nije dostupno', unsupported:'Nije prijavljeno kao podržano', failed:'Očitavanje nije uspjelo', 'not-run':'Nije izvršeno' };
const ensure = (condition, message, code = 'AUTO_FREEZE_VAULT') => { if (!condition) throw Object.assign(new Error(message), { code }); };
function parseEnvelope(raw) {
  ensure(typeof raw === 'string' && size(raw) <= VAULT_BYTES, 'Freeze-frame biblioteka premašuje 2 MiB.');
  let envelope; try { envelope = JSON.parse(raw); } catch { throw new Error('Freeze-frame biblioteka nije ispravan JSON.'); }
  ensure(envelope && Object.getPrototypeOf(envelope) === Object.prototype && Object.keys(envelope).length === 2 &&
    Object.hasOwn(envelope, 'format') && Object.hasOwn(envelope, 'records') && envelope.format === VAULT_FORMAT,
  'Nepodržan format freeze-frame biblioteke.');
  return envelope.records;
}

/** Explicit local persistence. Invalid imports never mutate memory or storage;
 * storage failures retain a recoverable memory copy without overwriting old data.
 * The stale check is read/compare/write, not an atomic cross-tab transaction. */
export class FreezeFrameVault {
  constructor({ storage, key = VAULT_KEY } = {}) {
    ensure(typeof key === 'string' && /^[A-Za-z0-9_.:/-]{1,160}$/.test(key) && !['__proto__','constructor','prototype'].includes(key), 'Neispravan ključ freeze-frame biblioteke.');
    this.key = key; this.records = []; this.raw = null; this.available = true; this.blockWrites = false; this.reason = 'ready';
    this.message = 'Freeze-frame zapisi se čuvaju lokalno samo kada to odaberete.';
    if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
    this.storage = storage;
    try {
      if (!storage || typeof storage.getItem !== 'function') { this.unavailable('Lokalno spremište nije dostupno. Zapisi ostaju u memoriji; preuzmite kopiju prije zatvaranja.', 'missing-storage'); return; }
      this.raw = storage.getItem(this.key);
      if (this.raw !== null) this.records = this.validateRecords(parseEnvelope(this.raw));
    } catch {
      this.records = []; this.unavailable('Ranija freeze-frame biblioteka nije dostupna ili nije valjana. Nije prepisana. Novi zapisi ostaju u memoriji i mogu se izvesti.', 'load-failed'); return;
    }
    let writable = false; try { writable = typeof storage.setItem === 'function'; } catch { /* Read-only provider. */ }
    if (!writable) this.unavailable('Biblioteka je samo za čitanje. Izmjene ostaju u memoriji i mogu se izvesti.', 'read-only');
  }
  unavailable(message, reason) { this.available = false; this.blockWrites = true; this.message = message; this.reason = reason; }
  getPersistenceStatus() { return { available:this.available, message:this.message, reason:this.reason }; }
  validateRecords(records) {
    ensure(Array.isArray(records) && Object.getPrototypeOf(records) === Array.prototype && records.length <= MAX_RECORDS &&
      Reflect.ownKeys(records).length === records.length + 1, 'Biblioteka može sadržavati najviše 20 potpunih freeze-frame zapisa.');
    const descriptors = Object.getOwnPropertyDescriptors(records);
    for (let i = 0; i < records.length; i++) ensure(descriptors[i] && Object.hasOwn(descriptors[i], 'value') && descriptors[i].enumerable, 'Freeze-frame biblioteka ne smije imati praznine ili izvršne pristupnike.');
    ensure(Reflect.ownKeys(records).every(key => typeof key === 'string' && (key === 'length' || /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < records.length)), 'Freeze-frame biblioteka sadrži dodatna polja.');
    const ids = new Set();
    return records.map(record => { const valid = validateAutoFreezeFrame(record); ensure(!ids.has(valid.id), 'Oznaka freeze-frame zapisa se ponavlja.'); ids.add(valid.id); return valid; });
  }
  list() { return copy(this.records); }
  persist(records) {
    const next = this.validateRecords(records), serialized = JSON.stringify({ format:VAULT_FORMAT, records:next });
    ensure(size(serialized) <= VAULT_BYTES, 'Freeze-frame biblioteka premašuje 2 MiB. Izvezite i uklonite starije zapise.');
    if (!this.blockWrites) {
      try {
        ensure(this.storage.getItem(this.key) === this.raw, 'Biblioteka je promijenjena u drugoj kartici. Nova kopija ostaje u memoriji; izvezite je prije ponovnog učitavanja.', 'AUTO_FREEZE_STALE');
        this.storage.setItem(this.key, serialized); this.raw = serialized; this.message = 'Freeze-frame biblioteka je sačuvana na ovom uređaju.';
      } catch (error) { this.unavailable(error?.code === 'AUTO_FREEZE_STALE' ? error.message : 'Spremanje nije uspjelo. Izmjene su samo u memoriji; izvezite ih prije zatvaranja.', error?.code === 'AUTO_FREEZE_STALE' ? 'stale-storage' : 'write-failed'); }
    } else this.message = 'Izmjene su samo u memoriji. Postojeći lokalni sadržaj nije prepisan; preuzmite zapis prije zatvaranja.';
    this.records = next;
  }
  save(input) { const record = validateAutoFreezeFrame(input); this.persist([record, ...this.records.filter(r => r.id !== record.id)]); return copy(record); }
  remove(id) {
    ensure(typeof id === 'string' && id.length <= 160, 'Neispravna oznaka freeze-frame zapisa.');
    if (!this.records.some(r => r.id === id)) return false;
    this.persist(this.records.filter(r => r.id !== id)); return true;
  }
  import(raw) {
    ensure(typeof raw === 'string' && size(raw) <= RECORD_BYTES, 'Freeze-frame datoteka premašuje 1 MiB.');
    const original = parseAutoFreezeFrameFile(raw, { imported:false });
    const record = parseAutoFreezeFrameFile(raw, { imported:true });
    ensure(record.id !== original.id && !this.records.some(r => r.id === record.id), 'Uvoz mora dobiti novu nezavisnu oznaku.');
    return this.save(record);
  }
  export(id) { const record = this.records.find(r => r.id === id); ensure(record, 'Freeze-frame zapis nije pronađen.'); return JSON.stringify(validateAutoFreezeFrame(record)); }
}

export class AutoFreezeWorkbench {
  constructor(el, { createBridge, onBusyChange = () => {}, canStart = () => true, vault } = {}) {
    ensure(el && typeof el.querySelector === 'function' && typeof createBridge === 'function', 'Freeze-frame radni prostor zahtijeva element i tvornicu veze.');
    this.el = el; this.createBridge = createBridge; this.onBusyChange = onBusyChange; this.canStart = canStart;
    this.vault = vault || new FreezeFrameVault(); this.active = false; this.hardwareBusy = false; this.fileBusy = false;
    this.externalBusy = false; this.notifiedBusy = false; this.generation = 0; this.fileGeneration = 0;
    this.result = null; this.bridge = null; this.confirmDelete = null;
    this.click = event => { const button = event.target.closest('[data-auto-freeze-action]'); if (button && this.el.contains(button)) this.action(button.dataset.autoFreezeAction, button).catch(error => this.status(error.message, true)); };
    this.change = event => { if (event.target.matches('[data-auto-freeze-file]')) this.importFile(event.target).catch(error => this.status(error.message, true)); else this.controls(); };
    this.visibility = () => { if (globalThis.document?.hidden && this.hardwareBusy) this.stop('Pregled je zaustavljen jer aplikacija nije u prvom planu. Prethodni zapis je očuvan.'); };
    el.classList.add('auto-advanced', 'auto-freeze-panel'); el.addEventListener('click', this.click); el.addEventListener('change', this.change);
    globalThis.document?.addEventListener('visibilitychange', this.visibility);
  }
  get busy() { return this.hardwareBusy || this.fileBusy; }
  q(selector) { return this.el.querySelector(selector); }
  notify() { const next = this.busy; if (next !== this.notifiedBusy) { this.notifiedBusy = next; this.onBusyChange(next); } }
  activate() { this.active = true; if (!this.rendered) this.render(); this.refresh(); }
  deactivate() { this.active = false; this.stop(); this.cancelFiles(); }
  setExternalBusy(value) { this.externalBusy = !!value; this.controls(); }
  refresh() { if (!this.rendered) return; this.renderHistory(); this.controls(); }
  access(profile) {
    if (profile === 'native') return { canRequest:hasNativeOBD(), reason:hasNativeOBD() ? 'Odabrat ćete ranije upareni Android Bluetooth Classic adapter.' : 'Android Classic/SPP priključak nije dostupan u ovom prikazu.' };
    return getDeviceAccess(['serial','spp'].includes(profile) ? 'serial' : 'ble');
  }
  render() {
    this.rendered = true;
    this.el.innerHTML = `<header><p class="eyebrow">CLEA AUTO / SAČUVANI ECU TRENUTAK</p><h2>Freeze-frame: šta je ECU zabilježio?</h2><p>Očitajte podržani okvir 0 koji je ECU sačuvao uz prijavljeni kod. Ovo su historijski podaci, odvojeni od trenutnih očitanja. Vrijeme nastanka događaja nije poznato.</p></header><div class="auto-advanced-grid"><section class="auto-advanced-card"><h3>Povezivanje i pregled</h3><label class="field"><span>Profil adaptera</span><select data-auto-freeze-profile>${hasNativeOBD() ? '<option value="native" selected>Android · Bluetooth Classic SPP</option>' : ''}${OBD_PROFILES.map(profile => `<option value="${esc(profile.id)}">${esc(profile.name)}</option>`).join('')}<option value="serial">ELM · USB / serijski port</option><option value="spp">ELM · Bluetooth Classic SPP / desktop</option></select></label><p class="help" data-auto-freeze-access></p><label class="device-consent"><input type="checkbox" data-auto-freeze-stationary><span>Vozilo je parkirano i ovaj pregled obavljam u sigurnim uslovima. Podaci vozila se ne brišu.</span></label><div class="toolbar"><button class="button primary" data-auto-freeze-action="scan">Poveži i očitaj freeze-frame</button><button class="button secondary" data-auto-freeze-action="stop" disabled>Zaustavi</button></div><p class="auto-advanced-status" data-auto-freeze-status role="status" aria-live="polite">Pregled još nije pokrenut. Odaberite profil adaptera.</p><p class="help">Mode 02 ima vlastitu prijavljenu podršku. Dostupnost trenutnog Mode 01 očitanja ne dokazuje da ECU čuva isti podatak u freeze-frame okviru.</p></section><section class="auto-advanced-card"><h3>Moji freeze-frame zapisi</h3><p class="help" data-auto-freeze-storage></p><div class="toolbar"><button class="button secondary" data-auto-freeze-action="import">Uvezi zapis</button></div><div class="auto-advanced-history" data-auto-freeze-history></div><input type="file" data-auto-freeze-file accept=".json,application/json" hidden></section></div><section class="auto-advanced-card auto-advanced-result"><h3>Sačuvani okvir i njegovi izvori</h3><div data-auto-freeze-result><p>Nema otvorenog freeze-frame zapisa. Prazan prikaz nije potvrda ispravnosti vozila.</p></div><div class="toolbar"><button class="button secondary" data-auto-freeze-action="save" disabled>Sačuvaj zapis lokalno</button><button class="button secondary" data-auto-freeze-action="export" disabled>Preuzmi zapis</button><button class="button secondary" data-auto-freeze-action="delete" disabled>Izbriši iz historije</button></div></section>`;
  }
  status(message, error = false) { const node = this.q('[data-auto-freeze-status]'); if (node) { node.textContent = String(message || 'Nema potvrđenog rezultata.'); node.classList.toggle('error', !!error); } }
  controls() {
    if (!this.rendered) return;
    const access = this.access(this.q('[data-auto-freeze-profile]').value), blocked = this.busy || this.externalBusy || !this.active;
    this.q('[data-auto-freeze-access]').textContent = access.reason;
    this.q('[data-auto-freeze-profile]').disabled = blocked; this.q('[data-auto-freeze-stationary]').disabled = blocked;
    this.q('[data-auto-freeze-action="scan"]').disabled = blocked || !access.canRequest || !this.q('[data-auto-freeze-stationary]').checked;
    this.q('[data-auto-freeze-action="stop"]').disabled = !this.hardwareBusy;
    this.q('[data-auto-freeze-action="import"]').disabled = blocked;
    for (const action of ['save','export']) this.q(`[data-auto-freeze-action="${action}"]`).disabled = blocked || !this.result;
    const remove = this.q('[data-auto-freeze-action="delete"]');
    remove.disabled = blocked || !this.result || !this.vault.list().some(record => record.id === this.result.id);
    remove.textContent = this.result && this.confirmDelete === this.result.id ? 'Potvrdi brisanje iz historije' : 'Izbriši iz historije';
    for (const node of this.el.querySelectorAll('[data-auto-freeze-action="load"]')) node.disabled = blocked;
  }
  stop(message = 'Freeze-frame pregled je zaustavljen. Prethodni završeni zapis nije prepisan.') {
    const wasBusy = this.hardwareBusy; ++this.generation; this.abort?.abort(); this.abort = null; clearTimeout(this.timer);
    const bridge = this.bridge; this.bridge = null; try { bridge?.disconnect(); } catch { /* Closing is best effort, late results remain rejected. */ }
    this.hardwareBusy = false; if (wasBusy) this.status(message); this.controls(); this.notify();
  }
  async scan() {
    if (!this.active || this.busy || this.externalBusy || !this.canStart() || !this.q('[data-auto-freeze-stationary]').checked) return;
    const profile = this.q('[data-auto-freeze-profile]').value, access = this.access(profile); if (!access.canRequest) throw new Error(access.reason);
    const generation = ++this.generation, controller = this.abort = new AbortController(); let acceptingStatus = true;
    this.hardwareBusy = true; this.notify(); this.controls(); this.status('Odaberite adapter za stvarno očitanje sačuvanog ECU okvira.');
    const current = () => this.active && generation === this.generation && !controller.signal.aborted;
    let bridge;
    const expire = message => { if (current()) this.stop(message); };
    try {
      bridge = this.bridge = this.createBridge({ profile, onStatus:state => { if (acceptingStatus && current()) this.status(state.message || 'Provjera veze…'); } });
      this.timer = setTimeout(() => expire('Izbor ili povezivanje nisu završeni na vrijeme. Prethodni freeze-frame zapis je očuvan.'), 90000);
      const device = await bridge.connect(); if (!current()) return;
      clearTimeout(this.timer); this.timer = setTimeout(() => expire('Freeze-frame pregled je prekoračio dozvoljeno vrijeme. Prethodni zapis je očuvan.'), 65000);
      this.status('Čitam vlastitu Mode 02 podršku, uzrok okvira i samo potvrđene dostupne kanale.');
      const record = await scanAutoFreezeFrame(bridge, { signal:controller.signal, device, timeoutMs:60000 });
      if (!current()) return;
      this.result = validateAutoFreezeFrame(record); this.confirmDelete = null; this.renderResult();
      this.status(record.status === 'available' ? 'Sačuvani ECU okvir je očitan. Pregledajte izvore; za trajno čuvanje odaberite Sačuvaj ili Preuzmi.' : record.status === 'unavailable' ? 'ECU nije potvrdio dostupan freeze-frame u ovom pregledu. Pregledajte stvarne odgovore i nedostajuće podatke.' : 'Freeze-frame pregled nije dao potvrđen kompletan rezultat. Zabilježeni su stvarni ishodi i greške.', record.status === 'failed');
    } catch (error) { if (current()) this.status(error.message || 'Freeze-frame nije očitan.', true); }
    finally {
      acceptingStatus = false; try { bridge?.disconnect(); } catch { /* Evidence is already independent. */ }
      if (generation === this.generation) { clearTimeout(this.timer); this.abort = null; this.bridge = null; this.hardwareBusy = false; this.q('[data-auto-freeze-stationary]').checked = false; this.controls(); this.notify(); }
    }
  }
  renderResult() {
    if (!this.result) return;
    const record = this.result, cause = record.cause;
    this.q('[data-auto-freeze-result]').innerHTML = `<p class="eyebrow">${record.origin === 'imported' ? 'UVEZENI HISTORIJSKI ZAPIS' : 'ZAPIS SAČUVANOG ECU OKVIRA'}${record.testOnly ? ' · OZNAČENI TESTNI PODACI' : ''}</p><p><strong>${esc(record.device.name)}</strong> · ${esc(record.device.profile)}</p><p>Status: <strong>${esc(states[record.status] || record.status)}</strong>. Okvir: ${esc(record.frame)}. Vrijeme nastanka ECU događaja: <strong>nije dostupno</strong>.</p><p class="help">Odgovori su pročitani od ${esc(record.startedAt)} do ${esc(record.finishedAt)}. Ovi datumi opisuju čitanje zapisa, a ne trenutak nastanka kvara ili sadašnje radno stanje.</p><article class="auto-advanced-card"><h4>Kod povezan sa sačuvanim okvirom</h4><p>${cause.status === 'available' ? cause.code ? `<strong>${esc(cause.code)}</strong> · Kod koji ECU veže za ovaj okvir; sam ne potvrđuje pokvaren dio.` : 'ECU je prijavio 0000: raspoloživ sačuvani okvir nije potvrđen.' : `${esc(states[cause.status] || cause.status)} · ${esc(cause.reason || 'Nema potvrđenog odgovora za uzrok okvira.')}`}</p></article><div class="auto-advanced-metrics">${record.measurements.map(row => `<article class="auto-advanced-metric"><small>${esc(row.label)}</small><strong>${esc(formatNumber(row.value,3))} <small>${esc(row.unit)}</small></strong><small>Sačuvana vrijednost · ${esc(row.command)}</small><small>Pročitano ${esc(row.capturedAt)}</small></article>`).join('')}</div>${record.measurements.length ? '' : '<p>Nema potvrđenih numeričkih podataka sačuvanog okvira. Ne koriste se zamjenske vrijednosti iz trenutnog pregleda.</p>'}<details><summary>Podrška Mode 02 i svaki zatraženi parametar</summary><p>${esc(states[record.discovery.status] || record.discovery.status)} · ${record.discovery.complete ? 'prijavljene mape su obrađene' : 'mape nisu potpuno potvrđene'}.</p><div class="auto-advanced-table-wrap"><table class="auto-advanced-table"><thead><tr><th scope="col">Zahtjev</th><th scope="col">Ishod</th><th scope="col">Detalj</th></tr></thead><tbody>${record.readings.map(row => `<tr><td>${esc(row.command)}</td><td>${esc(states[row.status] || row.status)}</td><td>${esc(row.reason || (row.status === 'available' ? 'Valjan odgovor sačuvanog okvira 0.' : 'Nema potvrđenog očitanja.'))}</td></tr>`).join('')}</tbody></table></div></details><details><summary>Cijeli zapis i izvorni ECU odgovori</summary><pre>${esc(JSON.stringify(record,null,2))}</pre></details>`;
    this.controls();
  }
  renderHistory() {
    this.q('[data-auto-freeze-storage]').textContent = this.vault.getPersistenceStatus().message;
    this.q('[data-auto-freeze-history]').innerHTML = this.vault.list().map(record => `<button class="auto-advanced-history-row" data-auto-freeze-action="load" data-auto-freeze-id="${esc(record.id)}"><strong>${record.cause.code ? esc(record.cause.code) : 'Freeze-frame pregled'} · ${esc(states[record.status] || record.status)}</strong><span>${esc(record.device.name)} · pročitano ${esc(record.finishedAt)}</span><small>${record.origin === 'imported' ? 'Uvezen zapis' : 'Lokalni zapis'}${record.testOnly ? ' · TESTNI PODACI' : ''}</small></button>`).join('') || '<p>Još nema sačuvanih freeze-frame zapisa.</p>';
  }
  cancelFiles() { ++this.fileGeneration; this.fileController?.abort(); this.fileController = null; this.fileBusy = false; this.controls(); this.notify(); }
  async fileOperation(task) {
    if (!this.active || this.busy || this.externalBusy || !this.canStart()) return;
    const generation = ++this.fileGeneration, controller = this.fileController = new AbortController(); this.fileBusy = true; this.controls(); this.notify();
    const current = () => this.active && generation === this.fileGeneration && !controller.signal.aborted;
    try { await task({ signal:controller.signal, current }); }
    catch (error) { if (current()) this.status(error.message || 'Datoteka nije potvrđena.', true); }
    finally { if (generation === this.fileGeneration) { this.fileController = null; this.fileBusy = false; this.controls(); this.notify(); } }
  }
  applyImported(text) {
    const record = this.vault.import(text); this.result = record; this.confirmDelete = null; this.renderResult(); this.renderHistory(); this.controls();
    const status = this.vault.getPersistenceStatus(); this.status('Uvezen je provjeren raniji freeze-frame zapis. Uređaj nije povezan. ' + status.message, !status.available);
  }
  async importFile(input) {
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    return this.fileOperation(async ({ current }) => { if (file.size > RECORD_BYTES) throw new Error('Freeze-frame datoteka premašuje 1 MiB.'); const text = await file.text(); if (current()) this.applyImported(text); });
  }
  async importNative() { return this.fileOperation(async ({ signal, current }) => { const file = await openNativeText('json', { signal }); if (current()) this.applyImported(file.text); }); }
  async action(action, button) {
    if (action === 'stop') return this.stop();
    if (action === 'scan') return this.scan();
    if (!this.active || this.busy || this.externalBusy || !this.canStart()) return;
    if (action === 'import') { if (hasNativeFiles()) return this.importNative(); this.q('[data-auto-freeze-file]').click(); return; }
    if (action === 'load') {
      const record = this.vault.list().find(item => item.id === button.dataset.autoFreezeId); if (!record) throw new Error('Freeze-frame zapis nije pronađen.');
      this.result = validateAutoFreezeFrame(record); this.confirmDelete = null; this.renderResult(); this.status('Otvoren je raniji sačuvani freeze-frame zapis. Aktivna veza nije pokrenuta.'); return;
    }
    if (!this.result) return;
    if (action === 'save') {
      this.vault.save(this.result); this.refresh(); const status = this.vault.getPersistenceStatus(); this.status(status.message, !status.available); return;
    }
    if (action === 'export') {
      const record = validateAutoFreezeFrame(this.result);
      return this.fileOperation(async ({ signal, current }) => { const result = await saveTextFile('clea-auto-freeze-frame.json', JSON.stringify(record,null,2), 'application/json', { signal }); if (current()) this.status(result.native ? 'Android je potvrdio izvoz u odabranu datoteku.' : 'Preuzimanje freeze-frame zapisa je pokrenuto. Provjerite datoteku u preuzimanjima preglednika.'); });
    }
    if (action === 'delete') {
      if (this.confirmDelete !== this.result.id) { this.confirmDelete = this.result.id; this.controls(); this.status('Ponovnim pritiskom uklanjate ovaj zapis iz lokalne historije. Izvezene kopije ostaju kod vas.'); return; }
      this.vault.remove(this.result.id); this.result = null; this.confirmDelete = null; this.q('[data-auto-freeze-result]').innerHTML = '<p>Zapis je uklonjen iz radnog prikaza.</p>'; this.refresh(); const status = this.vault.getPersistenceStatus(); this.status(status.available ? 'Freeze-frame zapis je uklonjen iz lokalne historije.' : 'Brisanje iz trajnog spremišta nije potvrđeno. ' + status.message, !status.available);
    }
  }
  destroy() { this.deactivate(); this.el.removeEventListener('click', this.click); this.el.removeEventListener('change', this.change); globalThis.document?.removeEventListener('visibilitychange', this.visibility); }
}
