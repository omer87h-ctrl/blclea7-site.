/* Original CLEA Auto before/after workflow. No hardware is opened here. */
import { compareAutoReports } from './auto-comparison.js';
import { saveTextFile } from './native-files.js';
import { formatNumber } from './display.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const statuses = { available: 'Očitano', unavailable: 'Nije dostupno', unsupported: 'Nije podržano', failed: 'Neuspjelo očitavanje', 'not-run': 'Nije izvršeno', 'not-requested': 'Nije zatraženo' };
const categoryNames = { stored: 'Pohranjeni kodovi', pending: 'Kodovi na čekanju', permanent: 'Trajni kodovi' };
const capturedAt = report => report?.readings?.completedAt || report?.createdAt || '';
const monitorState = monitor => !monitor ? 'Nema podataka' : !monitor.supported ? 'Nije podržan' : monitor.completed ? 'Završeno' : 'Nije završeno';
const formatValue = (observation, unit) => observation.status === 'available' ? `${formatNumber(observation.value, 3)} ${unit}` : statuses[observation.status] || 'Nepoznat ishod';

export class AutoComparisonUI {
  constructor(el, { getReports = () => [], getReport = () => null, isBusy = () => false, onBusyChange = () => {} } = {}) {
    if (!el || typeof el.querySelector !== 'function' || [getReports, getReport, isBusy, onBusyChange].some(fn => typeof fn !== 'function')) throw Error('Neispravna konfiguracija poređenja nalaza.');
    this.el = el; this.getReports = getReports; this.getReport = getReport; this.isBusy = isBusy; this.onBusyChange = onBusyChange;
    this.active = false; this.busy = false; this.externalBusy = false; this.generation = 0; this.result = null; this.records = new Map(); this.inputSignature = null; this.currentId = null;
    this.click = event => { const button = event.target.closest('[data-auto-comparison-action]'); if (button && this.el.contains(button)) this.action(button.dataset.autoComparisonAction).catch(error => this.status(error.message, true)); };
    this.change = event => { if (event.target.matches('[data-auto-compare-before],[data-auto-compare-after],[data-auto-compare-same],[data-auto-compare-conditions]')) { if (event.target.matches('select')) { this.q('[data-auto-compare-same]').checked = false; this.q('[data-auto-compare-conditions]').checked = false; this.inputSignature = JSON.stringify([this.records.get(this.q('[data-auto-compare-before]').value) || null, this.records.get(this.q('[data-auto-compare-after]').value) || null]); } this.result = null; this.q('[data-auto-compare-output]').innerHTML = ''; this.controls(); this.status('Odaberite dva nalaza i potvrdite uslove prije poređenja.'); } };
    el.addEventListener('click', this.click); el.addEventListener('change', this.change);
    this.render();
  }
  q(selector) { return this.el.querySelector(selector); }
  render() {
    this.el.innerHTML = `<section class="vehicle-card auto-advanced auto-comparison"><p class="eyebrow">CLEA / PRIJE I POSLIJE</p><h2>Uporedite dva stvarna nalaza.</h2><p>Odaberite raniji i kasniji zapis. Razlike pokazuju šta je vozilo tada prijavilo; nisu potvrda popravke ili uzroka kvara.</p><div class="auto-comparison-selectors"><label class="field"><span>Raniji nalaz</span><select data-auto-compare-before></select></label><label class="field"><span>Kasniji nalaz</span><select data-auto-compare-after></select></label></div><label class="device-consent"><input type="checkbox" data-auto-compare-same><span>Potvrđujem da se ova dva nalaza odnose na isto vozilo.</span></label><label class="device-consent"><input type="checkbox" data-auto-compare-conditions><span>Provjerio/la sam da uslovi odgovaraju ovom poređenju. Naziv adaptera to ne potvrđuje.</span></label><div class="toolbar"><button class="button secondary" data-auto-comparison-action="compare">Uporedi nalaze</button><button class="button secondary" data-auto-comparison-action="export" disabled>Preuzmi poređenje</button></div><p data-auto-compare-status role="status" aria-live="polite">Za poređenje su potrebna dva završena nalaza.</p><div data-auto-compare-output></div></section>`;
  }
  activate() { this.active = true; this.el.hidden = false; this.refresh(); }
  deactivate() { this.active = false; ++this.generation; this.controller?.abort(); this.controller = null; this.setBusy(false); this.el.hidden = true; }
  setExternalBusy(value) { this.externalBusy = !!value; this.controls(); }
  setBusy(value) { if (this.busy === !!value) return; this.busy = !!value; this.onBusyChange(this.busy); this.controls(); }
  status(message, error = false) {
    const element = this.q('[data-auto-compare-status]'); element.textContent = message; element.classList.toggle('error', error);
    if (typeof CustomEvent === 'function') this.el.dispatchEvent(new CustomEvent('clea-auto-comparison-status', { bubbles: true, detail: { message, error } }));
  }
  controls() {
    const blocked = !this.active || this.busy || this.externalBusy || this.isBusy();
    for (const element of this.el.querySelectorAll('select,input,button')) element.disabled = blocked;
    this.q('[data-auto-comparison-action="compare"]').disabled = blocked || this.records.size < 2;
    this.q('[data-auto-comparison-action="export"]').disabled = blocked || !this.result;
  }
  refresh() {
    const existingBefore = this.q('[data-auto-compare-before]').value, existingAfter = this.q('[data-auto-compare-after]').value;
    let reports, current;
    try { reports = this.getReports(); current = this.getReport(); if (!Array.isArray(reports) || reports.length > 20) throw Error('Neispravna lokalna lista nalaza.'); }
    catch (error) { this.status(error.message, true); this.controls(); return; }
    const records = new Map();
    for (const report of [...reports, ...(current ? [current] : [])]) if (report && typeof report.id === 'string') records.set(report.id, report);
    this.records = records;
    const ordered = [...records.values()].sort((left, right) => capturedAt(left).localeCompare(capturedAt(right)));
    const followCurrent = !existingAfter || existingAfter === this.currentId;
    const after = followCurrent && current?.id && records.has(current.id) ? current.id : records.has(existingAfter) ? existingAfter : current?.id && records.has(current.id) ? current.id : ordered.at(-1)?.id || '';
    this.currentId = current?.id || null;
    const earlier = ordered.filter(report => report.id !== after && capturedAt(report) < capturedAt(records.get(after)));
    const before = records.has(existingBefore) ? existingBefore : earlier.at(-1)?.id || ordered.find(report => report.id !== after)?.id || '';
    const options = '<option value="">Odaberite nalaz</option>' + ordered.map(report => `<option value="${esc(report.id)}">${esc(capturedAt(report))} · ${esc(report.device?.name || 'Nalaz')} · ${report.origin === 'imported' ? 'uvezen' : 'zapis'}</option>`).join('');
    for (const [selector, value] of [['before', before], ['after', after]]) { const select = this.q('[data-auto-compare-' + selector + ']'); select.innerHTML = options; select.value = value; }
    const signature = JSON.stringify([records.get(before) || null, records.get(after) || null]);
    if (this.inputSignature !== signature) {
      this.inputSignature = signature; this.result = null; this.q('[data-auto-compare-output]').innerHTML = '';
      this.q('[data-auto-compare-same]').checked = false; this.q('[data-auto-compare-conditions]').checked = false;
      if (!this.busy) this.status(records.size < 2 ? 'Sačuvajte raniji nalaz i otvorite ili sačuvajte kasniji. Uvoz i poređenje ne pokreću vezu.' : 'Potvrdite isto vozilo i odgovarajuće uslove za odabrana dva zapisa.');
    }
    this.controls();
  }
  selected() {
    const before = this.records.get(this.q('[data-auto-compare-before]').value), after = this.records.get(this.q('[data-auto-compare-after]').value);
    if (!before || !after) throw Error('Odaberite dva završena nalaza.');
    return [before, after];
  }
  show(result) {
    const changeRows = result.measurements.map(row => `<tr><th scope="row">${esc(row.label)}<small>${esc(row.command)}</small></th><td>${esc(formatValue(row.before, row.unit))}</td><td>${esc(formatValue(row.after, row.unit))}</td><td>${row.comparable ? row.kind === 'category' ? row.changed ? 'Status se promijenio' : 'Isti status' : `${row.delta > 0 ? '+' : ''}${esc(formatNumber(row.delta, 3))} ${esc(row.unit)}` : 'Nije uporedivo'}</td></tr>`).join('');
    const codes = Object.entries(result.dtcs).map(([category, item]) => `<article class="vehicle-finding"><h4>${esc(categoryNames[category])}</h4><p>Ranije: ${esc(statuses[item.before.status] || item.before.status)}${item.before.status === 'available' ? ' · ' + esc(item.before.codes.join(', ') || 'bez prijavljenih kodova') : ''}</p><p>Kasnije: ${esc(statuses[item.after.status] || item.after.status)}${item.after.status === 'available' ? ' · ' + esc(item.after.codes.join(', ') || 'bez prijavljenih kodova') : ''}</p>${item.comparable ? `<p>Dodatno prijavljeni: ${esc(item.added.join(', ') || 'nijedan')}. Zadržani: ${esc(item.retained.join(', ') || 'nijedan')}.</p><p>Nisu prijavljeni u kasnijem odgovoru: ${esc(item.noLongerReported.join(', ') || 'nijedan')}. To nije potvrda popravke ili brisanja.</p>` : '<p>Promjena kodova nije ocijenjena jer oba odgovora nisu dostupna.</p>'}</article>`).join('');
    const readiness = result.monitor.comparable ? `<ul>${result.monitor.monitors.map(monitor => `<li>${esc(monitor.label)}: ${esc(monitorState(monitor.before))} → ${esc(monitorState(monitor.after))}</li>`).join('')}</ul>` : '<p>Statusi provjera nisu uporedivi: nedostaje odgovor ili se razlikuje prijavljena vrsta paljenja.</p>';
    this.q('[data-auto-compare-output]').innerHTML = `<p class="eyebrow">${result.testOnly ? 'OZNAČENI TESTNI PODACI / ' : ''}ZABILJEŽENE RAZLIKE</p><p>${esc(result.before.capture.completedAt)} → ${esc(result.after.capture.completedAt)}</p>${result.warnings.length ? `<ul class="auto-comparison-warnings">${result.warnings.map(message => `<li>${esc(message)}</li>`).join('')}</ul>` : ''}${changeRows ? `<div class="auto-comparison-table-wrap" tabindex="0" role="region" aria-label="Poređenje stvarnih mjernih vrijednosti"><table class="auto-comparison-table"><thead><tr><th scope="col">Parametar</th><th scope="col">Ranije</th><th scope="col">Kasnije</th><th scope="col">Zabilježena promjena</th></tr></thead><tbody>${changeRows}</tbody></table></div>` : '<p>Nema dostupnih numeričkih očitanja za poređenje.</p>'}<details><summary>Ishod svakog zatraženog parametra</summary><ul>${result.requests.map(request => `<li>${esc(request.command)}: ${esc(statuses[request.before.status])} → ${esc(statuses[request.after.status])}</li>`).join('')}</ul></details><h3>Kodovi po kategorijama</h3>${codes}<h3>Ugrađene provjere</h3>${readiness}${result.monitor.mil ? `<p>Prijavljena lampica motora: ${result.monitor.mil.before ? 'uključena' : 'isključena'} → ${result.monitor.mil.after ? 'uključena' : 'isključena'}. Promjena lampice sama nije dijagnoza.</p>` : '<p>Promjena lampice motora nije potvrđena.</p>'}<p class="help">${esc(result.limitations[0])}</p><details><summary>Izvorni trag poređenja</summary><pre>${esc(JSON.stringify(result, null, 2))}</pre></details>`;
  }
  async action(action) {
    if (!this.active || this.busy || this.externalBusy || this.isBusy()) return;
    if (action === 'compare') {
      this.result = null; this.q('[data-auto-compare-output]').innerHTML = '';
      const [before, after] = this.selected();
      try {
        const result = compareAutoReports(before, after, { sameVehicleConfirmed: this.q('[data-auto-compare-same]').checked, comparableConditionsConfirmed: this.q('[data-auto-compare-conditions]').checked });
        this.result = result; this.show(result); this.status('Poređenje je pripremljeno iz sačuvanih izvornih odgovora. Vozilo nije povezivano.');
      } finally { this.controls(); }
      return;
    }
    if (action !== 'export' || !this.result) return;
    const controller = this.controller = new AbortController(), generation = ++this.generation, text = JSON.stringify(this.result, null, 2);
    this.setBusy(true);
    try {
      const saved = await saveTextFile('clea-auto-poredjenje.json', text, 'application/json', { signal: controller.signal });
      if (this.active && generation === this.generation && !controller.signal.aborted) this.status(saved.native ? 'Android je potvrdio izvoz poređenja u odabranu datoteku.' : 'Preuzimanje poređenja je pokrenuto. Provjerite preuzimanja preglednika.');
    } catch (error) { if (this.active && generation === this.generation) this.status(error.message || 'Izvoz poređenja nije potvrđen.', true); }
    finally { if (generation === this.generation) { this.controller = null; this.setBusy(false); } }
  }
  destroy() { this.deactivate(); this.el.removeEventListener('click', this.click); this.el.removeEventListener('change', this.change); }
}
