/* Original CLEA investigation plot. Only supplied observations become points.
 * This supplementary canvas has no acquisition loop, animation or health score;
 * the workbench provides the corresponding accessible evidence in the DOM. */

const MAX_SAMPLES = 240;
const MAX_VALUES = 128;
const MODES = new Set(['LIVE', 'SHADOW', 'REPLAY']);
const TRANSPORTS = new Set(['ble', 'usb', 'hid', 'serial', 'gamepad', 'midi', 'browser', 'obd-ble', 'sensor-ble', 'file']);
const COLORS = Object.freeze({ background: '#081725', grid: '#234153', edge: '#315169', text: '#E9EDF1', muted: '#91ADBF', cyan: '#9ED7DE', gold: '#DCC08A' });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
// Data reads never execute user-provided accessors.
const own = (object, key) => object && Object.getOwnPropertyDescriptor(object, key)?.value;
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const unitText = value => typeof value === 'string' && value.length <= 48 && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(value);
const boundedText = (value, max = 80) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, max) : '';
const numeric = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12;

function millis(value) {
  // Numeric capture timestamps are milliseconds, never guessed as seconds.
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 8.64e15 ? value : null;
  if (typeof value !== 'string' || value.length > 40) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return null;
  const [year, month, day, hours, minutes, seconds, offsetHours, offsetMinutes] = parts.slice(1).map(part => Number(part || 0));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hours > 23 || minutes > 59 || seconds > 59 || offsetHours > 23 || offsetMinutes > 59) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : null;
}

function sampleInput(sample) {
  if (!plain(sample)) return null;
  let values = own(sample, 'values'), at = own(sample, 'at'), sourceId = own(sample, 'sourceId');
  if (!Array.isArray(values)) {
    // The same actual capture may be displayed before it is added to an investigation.
    values = own(sample, 'observations');
    if (Array.isArray(values)) {
      at = own(sample, 'observedAt');
      const transport = own(sample, 'transport');
      if (sourceId === undefined && TRANSPORTS.has(transport)) sourceId = 'snapshot:' + transport;
    } else {
      values = own(sample, 'channels');
      at = own(sample, 'capturedAt');
    }
  }
  if (!Array.isArray(values) || !identifier(sourceId)) return null;
  return { values, at, sourceId, phase: boundedText(own(sample, 'phase'), 40), testOnly: own(sample, 'testOnly') === true };
}

/** Build a detached, bounded model for one complete source/channel/unit tuple.
 * Explicit selectors must match; otherwise prefer gamepadAxis0, then the first
 * numeric tuple in the retained input. Per-value timestamps take precedence.
 * Time sorting never creates, interpolates or averages observations. */
export function buildInvestigationPlotModel(samples = [], options = {}) {
  options = plain(options) ? options : {};
  const mode = MODES.has(own(options, 'mode')) ? own(options, 'mode') : 'LIVE';
  const channelId = own(options, 'channelId'), sourceId = own(options, 'sourceId'), unit = own(options, 'unit');
  const selectorsValid = (channelId === undefined || identifier(channelId)) && (sourceId === undefined || identifier(sourceId)) && (unit === undefined || unitText(unit));
  const model = {
    mode, label: boundedText(own(options, 'label')), testOnly: own(options, 'testOnly') === true,
    channelId: null, sourceId: null, unit: null, points: [], count: 0,
    timeRange: null, valueRange: null, displayRange: null, last: null,
  };
  if (!Array.isArray(samples) || !selectorsValid) return model;
  const groups = new Map();
  for (let index = Math.max(0, samples.length - MAX_SAMPLES); index < samples.length; index++) {
    const sample = sampleInput(own(samples, String(index)));
    if (!sample || (sourceId !== undefined && sample.sourceId !== sourceId)) continue;
    const seen = new Set();
    for (let valueIndex = 0; valueIndex < Math.min(sample.values.length, MAX_VALUES); valueIndex++) {
      const value = own(sample.values, String(valueIndex));
      if (!plain(value)) continue;
      const id = own(value, 'id'), reading = own(value, 'value'), valueUnit = own(value, 'unit');
      if (!identifier(id) || !numeric(reading) || !unitText(valueUnit) || (channelId !== undefined && id !== channelId) || (unit !== undefined && valueUnit !== unit)) continue;
      const key = JSON.stringify([sample.sourceId, id, valueUnit]);
      if (seen.has(key)) continue;
      const valueAt = own(value, 'at'), capturedAt = own(value, 'capturedAt');
      const at = millis(valueAt !== undefined ? valueAt : capturedAt !== undefined ? capturedAt : sample.at);
      if (at === null) continue;
      seen.add(key);
      if (!groups.has(key)) groups.set(key, { channelId: id, sourceId: sample.sourceId, unit: valueUnit, points: [] });
      groups.get(key).points.push({ at, value: reading, phase: sample.phase, testOnly: sample.testOnly });
    }
  }
  const candidates = [...groups.values()];
  const selected = candidates.find(group => group.channelId === 'gamepadAxis0') || candidates[0];
  if (!selected) return model;
  const points = selected.points.sort((a, b) => a.at - b.at);
  const min = Math.min(...points.map(point => point.value)), max = Math.max(...points.map(point => point.value));
  // Padding only helps read the observed range. It is not a normal/health limit.
  const padding = min === max ? Math.max(Math.abs(min) * .05, .001) : Math.max((max - min) * .12, Math.max(Math.abs(min), Math.abs(max)) * Number.EPSILON * 4, Number.MIN_VALUE);
  return {
    ...model, label: model.label || selected.channelId, channelId: selected.channelId, sourceId: selected.sourceId, unit: selected.unit,
    points, count: points.length, testOnly: model.testOnly || points.some(point => point.testOnly),
    timeRange: { min: points[0].at, max: points.at(-1).at }, valueRange: { min, max },
    displayRange: { min: min - padding, max: max + padding }, last: { ...points.at(-1) },
  };
}

export const investigationPlotModel = buildInvestigationPlotModel;

function numberLabel(value) {
  if (value === 0) return '0';
  const magnitude = Math.abs(value);
  return magnitude >= 1e6 || magnitude < .001 ? value.toExponential(2) : Number(value.toPrecision(5)).toString();
}
function timeLabel(value, span) {
  const iso = new Date(value).toISOString();
  if (span >= 86400000) return iso.slice(5, 10) + ' ' + iso.slice(11, 16);
  return iso.slice(11, span < 1000 ? 23 : 19);
}
function fit(value, width, size) {
  const limit = Math.max(1, Math.floor(width / (size * .57)));
  return value.length > limit ? value.slice(0, Math.max(0, limit - 1)) + '…' : value;
}
function text(ctx, value, x, y, { size = 10, color = COLORS.muted, align = 'left', width = 1000, weight = 400 } = {}) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(fit(String(value), width, size), x, y);
}
function line(ctx, points, color, width = 1) {
  if (!points.length) return;
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index++) ctx.lineTo(points[index][0], points[index][1]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function dot(ctx, x, y, radius, color) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}

export class InvestigationPlot {
  constructor(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('InvestigationPlot zahtijeva Canvas element.');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas prikaz nije podržan. Koristite tekstualni pregled dokaza.');
    this.canvas = canvas; this.ctx = ctx; this.destroyed = false; this.model = buildInvestigationPlotModel();
    canvas.setAttribute?.('aria-hidden', 'true'); canvas.setAttribute?.('role', 'presentation');
    this._resizeHandler = () => { if (!this.destroyed) { this._resize(); this._draw(); } };
    if (typeof globalThis.ResizeObserver === 'function') {
      this._observer = new globalThis.ResizeObserver(this._resizeHandler); this._observer.observe(canvas);
    } else globalThis.addEventListener?.('resize', this._resizeHandler);
    this._resize(); this._draw();
  }

  setSamples(samples = [], options = {}) {
    if (this.destroyed) return this.model;
    this.model = buildInvestigationPlotModel(samples, options);
    this._resize(); this._draw();
    return this.model;
  }

  clear() { return this.setSamples([], { mode: this.model.mode }); }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._observer?.disconnect();
    if (!this._observer) globalThis.removeEventListener?.('resize', this._resizeHandler);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.model = buildInvestigationPlotModel();
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect?.() || {};
    this.width = clamp(Number(rect.width) || this.canvas.clientWidth || 640, 128, 2000);
    this.height = clamp(Number(rect.height) || this.canvas.clientHeight || 300, 180, 600);
    const dpr = clamp(Number(globalThis.devicePixelRatio) || 1, 1, 2);
    const width = Math.round(this.width * dpr), height = Math.round(this.height * dpr);
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _draw() {
    const ctx = this.ctx, w = this.width, h = this.height, model = this.model;
    const mobile = w < 480;
    ctx.clearRect(0, 0, w, h); ctx.save();
    ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = COLORS.edge; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, w - 1, h - 1);
    text(ctx, 'CLEA / SIGNAL', 18, 22, { size: 9, width: w - 110, weight: 600 });
    ctx.fillStyle = '#142D40'; ctx.fillRect(w - 83, 11, 67, 23);
    text(ctx, model.mode, w - 49, 23, { size: 9, align: 'center', color: model.mode === 'LIVE' ? COLORS.cyan : COLORS.gold, weight: 600 });
    text(ctx, model.label || 'Zabilježeni signal', 18, 49, { size: mobile ? 12 : 14, color: COLORS.gold, width: w - 36, weight: 500 });
    text(ctx, model.sourceId ? `${model.testOnly ? 'TESTNI PODACI · ' : ''}${model.sourceId} · ${model.channelId} [${model.unit || 'bez jedinice'}]` : 'Bez zabilježenog numeričkog izvora', 18, 70, { size: 9, width: w - 36 });

    const left = mobile ? 54 : 66, right = w - 22, top = 94, bottom = h - 62;
    if (!model.count) {
      text(ctx, 'Čeka stvarna očitanja', w / 2, Math.max(111, h / 2), { size: mobile ? 12 : 15, color: COLORS.text, align: 'center', width: w - 40 });
      text(ctx, 'U odabranom prikazu nema očitanja.', w / 2, Math.max(136, h / 2 + 26), { size: 9, align: 'center', width: w - 40 });
      ctx.restore(); return;
    }
    const range = model.displayRange, times = model.timeRange, valueSpan = range.max - range.min, timeSpan = times.max - times.min;
    const x = at => timeSpan === 0 ? (left + right) / 2 : left + ((at - times.min) / timeSpan) * (right - left);
    const y = value => bottom - ((value - range.min) / valueSpan) * (bottom - top);
    for (let index = 0; index <= 4; index++) {
      const yy = top + (bottom - top) * index / 4;
      line(ctx, [[left, yy], [right, yy]], COLORS.grid, .75);
      text(ctx, numberLabel(range.max - valueSpan * index / 4), left - 9, yy, { size: 8, align: 'right', width: left - 16 });
    }
    const ticks = timeSpan === 0 ? [times.min] : mobile ? [times.min, times.max] : [times.min, times.min + timeSpan / 2, times.max];
    for (const at of ticks) {
      const xx = x(at);
      line(ctx, [[xx, top], [xx, bottom]], COLORS.grid, .75);
      text(ctx, timeLabel(at, timeSpan), xx, bottom + 17, { size: 8, align: at === times.min && timeSpan ? 'left' : at === times.max && timeSpan ? 'right' : 'center', width: (right - left) / (ticks.length === 3 ? 3 : 2) });
    }
    // Straight segments join the actual coordinates; no synthetic samples exist.
    const coordinates = model.points.map(point => [x(point.at), y(point.value)]);
    ctx.save(); ctx.beginPath(); ctx.rect(left - 4, top - 4, right - left + 8, bottom - top + 8); ctx.clip();
    let segment=[];let lastPhase=null;for(let i=0;i<coordinates.length;i++){const phase=model.points[i].phase;if(lastPhase!==null&&phase!==lastPhase){if(segment.length>1)line(ctx,segment,COLORS.cyan,1.8);segment=[];}segment.push(coordinates[i]);lastPhase=phase;}if(segment.length>1)line(ctx,segment,COLORS.cyan,1.8);
    for (const point of coordinates) dot(ctx, point[0], point[1], model.count > 80 ? 1.4 : 2, COLORS.cyan);
    const last = coordinates.at(-1); dot(ctx, last[0], last[1], 3.5, COLORS.gold);
    ctx.restore();
    const observed = `${numberLabel(model.valueRange.min)} – ${numberLabel(model.valueRange.max)} ${model.unit}`;
    text(ctx, 'Vrijeme (UTC) · opseg prikaza prati očitanja', left, bottom + 32, { size: 7, width: right - left });
    text(ctx, observed, 18, h - 17, { size: 9, color: COLORS.gold, width: w * .62 });
    text(ctx, `${model.count} očitanja`, w - 18, h - 17, { size: 9, align: 'right', width: w * .3 });
    ctx.restore();
  }
}
