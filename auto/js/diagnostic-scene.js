/* Original CLEA signal-space renderer. Draws recorded measurements only.
 * Canvas is supplementary: the host supplies an equivalent accessible DOM view.
 */

const TOOLS = Object.freeze({
  auto: { title: 'DIAGNOSTICS AUTO', detail: 'Pogonski sistem', color: '#DCC08A' },
  electric: { title: 'ELECTRIC', detail: 'Mjerni krug', color: '#AFCCEB' },
  build: { title: 'BUILD', detail: 'Prostor i struktura', color: '#C1D4AF' },
  climate: { title: 'CLIMATE', detail: 'Tok i razmjena', color: '#9ADBD9' },
  workshop: { title: 'WORKSHOP', detail: 'Preciznost i obrada', color: '#D8B494' },
});
const MODES = new Set(['LIVE', 'REPLAY', 'SHADOW']);
const COLORS = Object.freeze({ gold: '#DCC08A', cyan: '#9ED7DE', ink: '#071523', muted: '#6C8A9E', text: '#E9EDF1' });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const text = (value, fallback = '') => typeof value === 'string' ? value.slice(0, 120) : fallback;
const number = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12;
const timestamp = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null;
const short = (value, max = 20) => value.length > max ? value.slice(0, max - 1) + '…' : value;
const fmt = value => Number.isFinite(value) ? new Intl.NumberFormat('bs-BA', { maximumFractionDigits: Math.abs(value) < 10 ? 3 : 1 }).format(value) : '—';

/** Rendering model: bounded detached values; no sample creation or interpolation. */
export function diagnosticSceneModel(input = {}) {
  const toolId = Object.hasOwn(TOOLS, input.toolId) ? input.toolId : 'auto';
  const mode = MODES.has(input.mode) ? input.mode : 'LIVE';
  const frames = Array.isArray(input.frames) ? input.frames.slice(-240).flatMap(frame => {
    if (!frame || typeof frame !== 'object' || !timestamp(frame.capturedAt) || !Array.isArray(frame.channels)) return [];
    const channels = frame.channels.slice(0, 32).flatMap(channel => channel && typeof channel.id === 'string' && number(channel.value) ? [{ id: text(channel.id), unit: text(channel.unit), value: channel.value }] : []);
    if (!channels.length) return [];
    return [{ id: text(frame.id), sourceId: text(frame.sourceId), capturedAt: frame.capturedAt, at: Date.parse(frame.capturedAt), channels }];
  }) : [];
  const names = new Map();
  if (Array.isArray(input.report?.metrics)) for (const metric of input.report.metrics.slice(0, 32)) {
    if (typeof metric?.id === 'string') names.set(metric.id, text(metric.label, metric.id));
  }
  const byChannel = new Map();
  for (const frame of frames) for (const channel of frame.channels) {
    const key = channel.id + '\u0000' + channel.unit;
    if (!byChannel.has(key)) byChannel.set(key, { id: channel.id, label: names.get(channel.id) || channel.id, unit: channel.unit, points: [] });
    byChannel.get(key).points.push({ at: frame.at, value: channel.value, sourceId: frame.sourceId });
  }
  const series = [...byChannel.values()].slice(0, 3).map(channel => {
    // Preserve observed order. The line connects recorded samples; no synthetic values.
    const all = channel.points;
    const points = all.length <= 80 ? all : Array.from({ length: 80 }, (_, i) => all[Math.floor(i * (all.length - 1) / 79)]);
    return { ...channel, points, count: all.length, last: all.at(-1).value, min: Math.min(...all.map(p => p.value)), max: Math.max(...all.map(p => p.value)) };
  });
  const inputSources = Array.isArray(input.sources) ? input.sources.slice(0, 32) : [];
  const sources = inputSources.flatMap(source => source && typeof source.id === 'string' ? [{
    id: text(source.id), label: text(source.label, source.id), connected: source.connected === true,
    reads: Number.isSafeInteger(source.reads) && source.reads >= 0 ? source.reads : null,
    errors: Number.isSafeInteger(source.errors) && source.errors >= 0 ? source.errors : null,
    lastDurationMs: number(source.lastDurationMs) && source.lastDurationMs >= 0 ? source.lastDurationMs : null,
  }] : []);
  // A recording's source can exist without a current hardware connection.
  for (const frame of frames) if (frame.sourceId && !sources.some(source => source.id === frame.sourceId)) sources.push({ id: frame.sourceId, label: frame.sourceId, connected: false, reads: null, errors: null, lastDurationMs: null });
  return { toolId, mode, frames, sources: sources.slice(0, 32), series, lastTimestamp: frames.at(-1)?.capturedAt || null, lastSourceId: frames.at(-1)?.sourceId || null, channelCount: byChannel.size };
}

function line(ctx, points, stroke, width = 1, dash = []) {
  if (!points.length) return;
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
}
function path(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath(); ctx.moveTo(...points[0]); for (const p of points.slice(1)) ctx.lineTo(...p); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function circle(ctx, x, y, r, fill, stroke, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function box(ctx, x, y, w, h, r, fill, stroke, width = 1) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function label(ctx, value, x, y, { size = 10, color = COLORS.muted, align = 'left', weight = 400 } = {}) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y);
}
function cube(ctx, x, y, w, h, depth, color) {
  path(ctx, [[x, y], [x + w, y + w * .3], [x + w, y + h + w * .3], [x, y + h]], '#1D3B50', color);
  path(ctx, [[x + w, y + w * .3], [x + w + depth, y + w * .3 - depth * .55], [x + w + depth, y + h + w * .3 - depth * .55], [x + w, y + h + w * .3]], '#122C42', color);
  path(ctx, [[x, y], [x + depth, y - depth * .55], [x + w + depth, y + w * .3 - depth * .55], [x + w, y + w * .3]], '#355365', color);
}

function profession(ctx, toolId, x, y, scale, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // The profession geometry is fixed original blueprint art, never telemetry.
  if (toolId === 'auto') {
    cube(ctx, -45, -22, 68, 37, 25, color);
    cube(ctx, -23, -45, 38, 20, 21, color);
    line(ctx, [[-51, -12], [-65, -12], [-65, 12], [-42, 18]], color, 2);
    line(ctx, [[39, -12], [55, -20], [55, -37], [43, -37]], color, 2);
    line(ctx, [[-14, -45], [-14, -59], [18, -49], [18, -35]], color, 1.5);
    for (let i = 0; i < 4; i++) line(ctx, [[-38 + i * 14, -14 + i * 4.2], [-38 + i * 14, 9 + i * 4.2]], '#85AEBF', 1);
    circle(ctx, -48, 31, 11, '#0C1D2D', color, 1.5); circle(ctx, -48, 31, 5, '#3A5667', color);
    circle(ctx, 47, 17, 9, '#0C1D2D', color, 1.5); circle(ctx, 47, 17, 3, '#3A5667', color);
    line(ctx, [[-7, 23], [-7, 43], [25, 52], [44, 40]], color, 1.5);
  } else if (toolId === 'electric') {
    cube(ctx, -39, -52, 60, 88, 19, color);
    for (let i = 0; i < 3; i++) box(ctx, -30, -40 + i * 22, 39, 12, 2, '#10283D', '#5E819B');
    for (let i = 0; i < 3; i++) { circle(ctx, -22, -34 + i * 22, 2, color); line(ctx, [[-15, -34 + i * 22], [1, -29 + i * 22]], color, 1.2); }
    line(ctx, [[-39, -16], [-65, -24], [-65, 37], [-27, 49], [-27, 30]], color, 1.5);
    line(ctx, [[40, -21], [62, -29], [62, 15], [27, 36]], '#7FBBC4', 1.5);
    circle(ctx, 62, -29, 3, '#0C1D2D', color); circle(ctx, -65, 37, 3, '#0C1D2D', color);
    path(ctx, [[-7, -64], [-18, -48], [-8, -45], [-12, -33], [3, -49], [-6, -51]], color);
  } else if (toolId === 'build') {
    path(ctx, [[-72, 26], [0, -15], [76, 13], [4, 55]], '#10283B', '#446780');
    cube(ctx, -42, -41, 32, 68, 25, color); cube(ctx, 9, -20, 29, 62, 22, color);
    for (let i = 0; i < 3; i++) { line(ctx, [[-36, -29 + i * 16], [-17, -23 + i * 16]], '#97AFB8', 4); line(ctx, [[16, -9 + i * 15], [31, -4 + i * 15]], '#97AFB8', 3); }
    line(ctx, [[-63, -38], [-63, 30], [-51, 23]], color, 1); line(ctx, [[-67, -34], [-59, -40]], color); line(ctx, [[-67, 33], [-59, 27]], color);
    line(ctx, [[-35, 46], [4, 61], [55, 32]], '#6A9CA8', 1, [3, 3]);
  } else if (toolId === 'climate') {
    cube(ctx, -49, -35, 75, 64, 26, color);
    circle(ctx, -15, 4, 23, '#11283A', color, 1.5);
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(-15, 4); ctx.rotate(i * Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-16, -7, -14, -25, -4, -18); ctx.bezierCurveTo(3, -13, 5, -6, 0, 0); ctx.fillStyle = '#547E91'; ctx.fill(); ctx.restore(); }
    circle(ctx, -15, 4, 4, color);
    for (let i = 0; i < 4; i++) line(ctx, [[33, -1 + i * 9], [47, -9 + i * 9]], '#6F9BA9', 1.5);
    line(ctx, [[-55, -5], [-68, -10], [-68, 35], [-46, 44]], color, 2);
    line(ctx, [[49, 20], [64, 13], [64, 37], [32, 53]], '#6FC2CD', 2);
    circle(ctx, -68, 17, 5, '#0E2638', color);
  } else {
    path(ctx, [[-64, -14], [-6, -45], [61, -20], [4, 14]], '#6D624C', color);
    path(ctx, [[-64, -14], [4, 14], [61, -20], [61, -12], [4, 22], [-64, -6]], '#394951', color);
    line(ctx, [[-52, -7], [-52, 32], [-3, 52], [-3, 19]], '#7BA1B1', 4);
    line(ctx, [[49, -5], [49, 34], [-3, 52]], '#7BA1B1', 4);
    path(ctx, [[-42, -16], [0, -39], [12, -34], [-30, -11]], '#B69D73', color);
    line(ctx, [[-26, -15], [13, -36]], '#685E4D', 1);
    path(ctx, [[8, -5], [35, -20], [50, -14], [23, 1]], '#203E52', '#79A3B2');
    line(ctx, [[24, -14], [41, -45]], '#99BBC6', 5); line(ctx, [[34, -49], [49, -43]], color, 7);
  }
  ctx.restore();
}

export class DiagnosticScene {
  constructor(canvas, { reducedMotion = false } = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('DiagnosticScene zahtijeva Canvas element.');
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas prikaz nije podržan. Koristi tekstualni pregled mjerenja.');
    this.model = diagnosticSceneModel(); this.destroyed = false; this.raf = null; this._pulseAt = null; this._lastPaint = 0; this._onScreen = true;
    this._media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this._forcedReduced = reducedMotion === true; this._reduced = this._forcedReduced || this._media?.matches === true;
    canvas.setAttribute?.('aria-hidden', 'true'); canvas.setAttribute?.('role', 'presentation');
    this._resizeHandler = () => { this._resize(); this._paint(); };
    this._visibilityHandler = () => { if (globalThis.document?.hidden) this._stop(); else this._paint(); };
    this._motionHandler = event => { this._reduced = this._forcedReduced || event.matches; if (this._reduced) this._stop(); this._paint(); };
    globalThis.document?.addEventListener('visibilitychange', this._visibilityHandler);
    if (this._media?.addEventListener) this._media.addEventListener('change', this._motionHandler);
    else this._media?.addListener?.(this._motionHandler);
    if (typeof globalThis.ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(this._resizeHandler); this._resizeObserver.observe(canvas);
    } else globalThis.addEventListener?.('resize', this._resizeHandler);
    if (typeof globalThis.IntersectionObserver === 'function') {
      this._intersection = new IntersectionObserver(entries => {
        const entry = entries.find(item => item.target === canvas);
        if (!entry) return;
        this._onScreen = entry.isIntersecting;
        if (!this._onScreen) this._stop(); else this._paint();
      }, { threshold: 0.01 });
      this._intersection.observe(canvas);
    }
    this._resize(); this._paint();
  }

  setData(data = {}) {
    if (this.destroyed) return;
    const next = diagnosticSceneModel(data), changed = next.lastTimestamp && next.lastTimestamp !== this.model.lastTimestamp;
    this.model = next;
    this._stop();
    if (changed && !this._reduced && this._onScreen && !globalThis.document?.hidden && typeof globalThis.requestAnimationFrame === 'function') {
      this._pulseAt = null; this._lastPaint = 0;
      this.raf = requestAnimationFrame(time => this._tick(time));
    }
    this._paint();
  }

  _resize() {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect?.() || {};
    this.width = clamp(Number(rect.width) || this.canvas.clientWidth || 640, 240, 1600);
    this.height = clamp(Number(rect.height) || this.canvas.clientHeight || 360, 280, 760);
    const dpr = clamp(Number(globalThis.devicePixelRatio) || 1, 1, 2);
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _stop() {
    if (this.raf !== null) globalThis.cancelAnimationFrame?.(this.raf);
    this.raf = null; this._pulseAt = null;
  }

  _tick(time) {
    this.raf = null;
    if (this.destroyed || this._reduced || !this._onScreen || globalThis.document?.hidden) { this._stop(); return; }
    if (this._pulseAt === null) this._pulseAt = time;
    const elapsed = time - this._pulseAt;
    if (elapsed >= 1500) { this._stop(); this._paint(); return; }
    if (time - this._lastPaint >= 1000 / 30) { this._paint(elapsed / 1500); this._lastPaint = time; }
    this.raf = requestAnimationFrame(next => this._tick(next));
  }

  _paint(pulse = null) {
    if (this.destroyed || !this.ctx || !this._onScreen || globalThis.document?.hidden) return;
    const ctx = this.ctx, w = this.width, h = this.height, model = this.model, theme = TOOLS[model.toolId], mobile = w < 560;
    ctx.clearRect(0, 0, w, h); ctx.save(); ctx.lineCap = 'round';
    box(ctx, .5, .5, w - 1, h - 1, 18, '#081725', '#274157');
    ctx.save(); box(ctx, 1, 1, w - 2, h - 2, 18); ctx.clip();
    const glow = ctx.createRadialGradient(w * .5, h * .4, 10, w * .5, h * .4, w * .46);
    glow.addColorStop(0, '#193B52'); glow.addColorStop(1, '#081725'); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) line(ctx, [[x, 48], [x, h - 23]], '#234153', .5);
    for (let y = 64; y < h - 23; y += 28) line(ctx, [[0, y], [w, y]], '#234153', .5);
    ctx.restore();
    label(ctx, 'CLEA / ' + theme.title, 19, 24, { size: mobile ? 8 : 9, color: '#AEC2CC', weight: 600 });
    const modeWidth = model.mode === 'SHADOW' ? 72 : 63;
    box(ctx, w - modeWidth - 16, 12, modeWidth, 23, 11, '#10293B', '#4F6879');
    circle(ctx, w - modeWidth - 4, 23.5, 2.5, model.mode === 'LIVE' ? '#91C5CB' : theme.color);
    label(ctx, model.mode, w - modeWidth + 5, 24, { size: 8, color: COLORS.text, weight: 600 });
    const graphBottom = model.series.length ? h - 100 : h - 44;
    const cy = 65 + (graphBottom - 65) * .52, cx = w * .5;
    const scale = mobile ? .74 : .95;
    // Static profession blueprint, with measured activity represented separately.
    if (pulse !== null) {
      ctx.save(); ctx.shadowColor = theme.color; ctx.shadowBlur = Math.sin(Math.PI * pulse) * 9;
      profession(ctx, model.toolId, cx, cy - 13, scale, theme.color); ctx.restore();
    } else profession(ctx, model.toolId, cx, cy - 13, scale, model.frames.length ? theme.color : '#6C8597');
    label(ctx, theme.detail, cx, cy + 51 * scale, { size: 9, color: '#A6BDC9', align: 'center' });
    const hubY = Math.min(graphBottom - 14, cy + 79 * scale);
    ctx.beginPath(); ctx.ellipse(cx, hubY, mobile ? 58 : 73, 16, 0, 0, Math.PI * 2); ctx.fillStyle = '#0E2638'; ctx.fill(); ctx.strokeStyle = '#5B8395'; ctx.lineWidth = .8; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, hubY, mobile ? 49 : 63, 12, 0, 0, Math.PI * 2); ctx.strokeStyle = theme.color; ctx.globalAlpha = .65; ctx.stroke(); ctx.globalAlpha = 1;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; circle(ctx, cx + Math.cos(a) * (mobile ? 54 : 68), hubY + Math.sin(a) * 14, 2, '#18384B', theme.color, .7); }
    label(ctx, 'CLEA 7 / SHARED CORE', cx, hubY, { size: mobile ? 6 : 7, color: '#C5CFD4', align: 'center', weight: 600 });
    const maxSources = mobile ? 2 : 4, sourceNodes = model.sources.slice(0, maxSources);
    sourceNodes.forEach((source, i) => {
      const right = i % 2 === 1, row = Math.floor(i / 2);
      const sx = right ? w - (mobile ? 46 : 67) : mobile ? 46 : 67;
      const sy = 89 + row * Math.max(55, (graphBottom - 110) * .58);
      const hasFrame = model.frames.some(frame => frame.sourceId === source.id), stroke = source.connected ? '#7EB5C0' : hasFrame ? '#9E8C69' : '#476376';
      const endX = cx + (right ? 65 : -65) * (mobile ? .7 : 1), endY = hubY - 3;
      const middleX = sx + (right ? -28 : 28), middleY = sy + 29;
      line(ctx, [[sx, sy + 13], [middleX, middleY], [endX, endY]], stroke, 1, source.connected ? [] : [3, 4]);
      if (pulse !== null && source.id === model.lastSourceId && hasFrame) {
        // One finite transport pulse for the last genuinely supplied frame.
        const firstLength = Math.hypot(middleX - sx, middleY - sy - 13), secondLength = Math.hypot(endX - middleX, endY - middleY), travelled = clamp(pulse, 0, 1) * (firstLength + secondLength);
        const firstLeg = travelled <= firstLength, part = firstLeg ? travelled / (firstLength || 1) : (travelled - firstLength) / (secondLength || 1);
        const px = firstLeg ? sx + (middleX - sx) * part : middleX + (endX - middleX) * part;
        const py = firstLeg ? sy + 13 + (middleY - sy - 13) * part : middleY + (endY - middleY) * part;
        ctx.save(); ctx.shadowColor = '#AEE5DD'; ctx.shadowBlur = 11; circle(ctx, px, py, 3, '#D9EEE5'); ctx.restore();
      }
      box(ctx, sx - (mobile ? 31 : 43), sy - 14, mobile ? 62 : 86, 28, 7, '#0C2335', stroke);
      circle(ctx, sx - (mobile ? 20 : 31), sy, 2.5, source.connected ? '#A5D5CE' : null, stroke);
      label(ctx, short(source.label, mobile ? 7 : 12), sx + 4, sy, { size: 8, color: '#CBD7DD', align: 'center' });
      label(ctx, source.connected ? 'POVEZAN' : hasFrame ? 'ZAPIS IZVORA' : 'NIJE POVEZAN', sx, sy + 25, { size: 6.5, color: stroke, align: 'center', weight: 600 });
      if (!mobile && (source.reads !== null || source.errors !== null)) label(ctx, `${source.reads ?? '—'} čitanja · ${source.errors ?? '—'} grešaka`, sx, sy + 38, { size: 7, color: '#7894A6', align: 'center' });
      if (!mobile && source.lastDurationMs !== null) label(ctx, `${fmt(source.lastDurationMs)} ms / posljednje očitanje`, sx, sy + 49, { size: 6, color: '#698A9F', align: 'center' });
    });
    if (!model.frames.length) {
      box(ctx, cx - Math.min(112, w * .33), graphBottom - 20, Math.min(224, w * .66), 30, 15, '#0B2031', '#38556B');
      label(ctx, 'Čeka stvarni izvor', cx, graphBottom - 5, { size: 11, color: '#BACBD4', align: 'center' });
    } else if (model.sources.length > maxSources) label(ctx, `+ ${model.sources.length - maxSources} izvora u zapisu`, cx, 49, { size: 8, color: COLORS.muted, align: 'center' });
    if (model.series.length) this._sparklines(ctx, w, h, model, mobile);
    const recordTime = model.lastTimestamp ? new Date(model.lastTimestamp).toISOString().slice(0, 19).replace('T', ' ') : null;
    label(ctx, recordTime ? `ZAPIS ${recordTime} UTC` : 'BEZ MJERNIH PODATAKA', 17, h - 13, { size: 6.5, color: '#7692A5', weight: 500 });
    label(ctx, model.frames.length ? `${model.frames.length} okvira · ${model.channelCount} kanala` : 'Nema generisanih očitanja', w - 17, h - 13, { size: 6.5, color: '#7692A5', align: 'right' });
    ctx.restore();
  }

  _sparklines(ctx, w, h, model, mobile) {
    const channels = model.series.slice(0, mobile ? 2 : 3), margin = 14, gap = 8, width = (w - margin * 2 - gap * (channels.length - 1)) / channels.length, top = h - 99;
    channels.forEach((channel, index) => {
      const x = margin + index * (width + gap), y = top;
      box(ctx, x, y, width, 70, 7, '#0C2233', '#2B485D');
      label(ctx, short(channel.label, mobile ? 12 : 21), x + 10, y + 13, { size: 7.5, color: '#9FB8C6' });
      label(ctx, `${fmt(channel.last)} ${channel.unit}`, x + 10, y + 29, { size: mobile ? 12 : 14, color: '#E2E9EC', weight: 600 });
      const min = channel.min, max = channel.max, range = max - min;
      const chartX = x + 10, chartY = y + 43, chartW = width - 20, chartH = 15;
      const first = channel.points[0].at, last = channel.points.at(-1).at, monotonic = channel.points.every((point, i, array) => i === 0 || point.at >= array[i - 1].at);
      const coords = channel.points.map((point, i) => [chartX + (last > first && monotonic ? (point.at - first) / (last - first) : channel.points.length > 1 ? i / (channel.points.length - 1) : .5) * chartW, chartY + (range ? (max - point.value) / range : .5) * chartH]);
      if (coords.length > 1) line(ctx, coords, TOOLS[model.toolId].color, 1.2);
      const latest = coords.at(-1); circle(ctx, latest[0], latest[1], 1.8, '#C5E1DC');
      label(ctx, `${channel.count} ${channel.count === 1 ? 'uzorak' : 'uzoraka'}`, x + width - 9, y + 13, { size: 6, color: '#698A9F', align: 'right' });
      label(ctx, `min ${fmt(channel.min)}`, x + 10, y + 64, { size: 5.8, color: '#6E8DA0' });
      label(ctx, `max ${fmt(channel.max)}`, x + width - 9, y + 64, { size: 5.8, color: '#6E8DA0', align: 'right' });
    });
  }

  destroy() {
    if (this.destroyed) return;
    this._stop(); this.destroyed = true; this._resizeObserver?.disconnect(); this._intersection?.disconnect();
    globalThis.document?.removeEventListener('visibilitychange', this._visibilityHandler);
    globalThis.removeEventListener?.('resize', this._resizeHandler);
    if (this._media?.removeEventListener) this._media.removeEventListener('change', this._motionHandler);
    else this._media?.removeListener?.(this._motionHandler);
    this.model = diagnosticSceneModel();
  }
}
