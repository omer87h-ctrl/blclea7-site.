/* Original explicit cross-tool evidence transfer for BL CLEA Tools.
 * This copies a validated recording; it never asserts a new hardware reading.
 */
import { EvidenceEngine, CHANNELS, TOOL_CHANNELS, FRAME_FORMAT } from './evidence-engine.js';

const validator = new EvidenceEngine();
const ORIGIN_KEYS = new Set(['originTool', 'originSession', 'originFrameId', 'copiedFromSession', 'copiedFromFrameId']);
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value) && !BAD_KEYS.has(value);
const copy = value => JSON.parse(JSON.stringify(value));

function fail(message) { throw new Error(message); }
function verifiedSession(session, engine = validator) { return JSON.parse(engine.exportSession(session)); }
function toolChannels(toolId) {
  if (typeof toolId !== 'string' || !Object.hasOwn(TOOL_CHANNELS, toolId)) fail('Ciljni alat nije registrovan.');
  return new Set(TOOL_CHANNELS[toolId]);
}
function currentFrames(session) {
  return session.baseline ? session.frames.filter(frame => frame.ordinal > session.baseline.throughOrdinal) : session.frames;
}
function allFrames(session) {
  const seen = new Set();
  return [...session.frames, ...(session.baseline?.frames ?? [])].filter(frame => {
    if (seen.has(frame.id)) return false;
    seen.add(frame.id); return true;
  });
}
function origin(frame, session) {
  const context = frame.context;
  const recorded = validId(context?.originSession) && validId(context?.originFrameId) && typeof context?.originTool === 'string' && Object.hasOwn(TOOL_CHANNELS, context.originTool);
  return recorded ? { tool: context.originTool, session: context.originSession, frame: context.originFrameId } : { tool: session.toolId, session: session.id, frame: frame.id };
}
function originKey(identity) { return JSON.stringify([identity.session, identity.frame]); }
function contextFor(frame, source) {
  // The source was already structurally validated by EvidenceEngine. Keep at
  // most 27 original keys and reserve five explicit provenance keys. Never let
  // imported context override the origin assigned to this copy operation.
  const retained = Object.fromEntries(Object.entries(frame.context).filter(([key]) => !ORIGIN_KEYS.has(key)).slice(0, 27));
  const identity = origin(frame, source);
  return { ...copy(retained), originTool: identity.tool, originSession: identity.session, originFrameId: identity.frame, copiedFromSession: source.id, copiedFromFrameId: frame.id };
}

/**
 * Canonical channels actually present after the source baseline boundary and
 * registered for the chosen target. No inferred rename or device capability.
 * Returns [{id,label,unit,count}], sorted by canonical channel ID.
 */
export function transferableChannels(sourceSession, targetToolId) {
  const allowed = toolChannels(targetToolId), source = verifiedSession(sourceSession);
  const counts = new Map();
  for (const frame of currentFrames(source)) for (const channel of frame.channels) {
    if (allowed.has(channel.id)) counts.set(channel.id, (counts.get(channel.id) ?? 0) + 1);
  }
  return [...counts.keys()].sort().map(id => ({ ...CHANNELS[id], count: counts.get(id) }));
}

/**
 * Atomically returns an independent target session containing explicitly
 * selected current source channels. No source baseline, live storage, hardware
 * connection or external service is copied. Source timestamps are preserved.
 * skippedFrames counts retained source.frames not transferred, including old
 * baseline-window frames that are still present in that bounded source window.
 */
export function transferEvidence(sourceSession, targetSession, { channelIds } = {}, engine = new EvidenceEngine()) {
  const source = verifiedSession(sourceSession, engine), target = verifiedSession(targetSession, engine);
  if (source.id === target.id) fail('Izvorna i ciljna sesija moraju biti različite.');
  const allowed = toolChannels(target.toolId);
  if (!Array.isArray(channelIds) || channelIds.length < 1 || channelIds.length > 32 || channelIds.some(id => typeof id !== 'string') || new Set(channelIds).size !== channelIds.length) fail('Izričito odaberi 1–32 različita mjerna kanala.');
  const present = new Set(currentFrames(source).flatMap(frame => frame.channels.map(channel => channel.id)));
  for (const id of channelIds) {
    if (!Object.hasOwn(CHANNELS, id) || !allowed.has(id)) fail(`Kanal ${String(id).slice(0, 80)} nije registrovan za ciljni alat.`);
    if (!present.has(id)) fail(`Kanal ${id} nema tekuća očitanja u izvornoj sesiji.`);
  }
  const selected = new Set(channelIds);
  const candidates = currentFrames(source).map(frame => ({ frame, channels: frame.channels.filter(channel => selected.has(channel.id)) })).filter(entry => entry.channels.length);
  if (!candidates.length || candidates.length > 240) fail('Za prenos je potrebno 1–240 tekućih mjernih okvira.');

  // Include native target frames as well as recorded origins. This prevents a
  // round-trip A → B → A from turning the same observation into new evidence.
  const seenOrigins = new Set();
  for (const frame of allFrames(target)) {
    seenOrigins.add(originKey({ session: target.id, frame: frame.id }));
    seenOrigins.add(originKey(origin(frame, target)));
  }
  for (const { frame } of candidates) {
    const key = originKey(origin(frame, source));
    if (seenOrigins.has(key)) fail('Ovaj izvorni mjerni okvir je već prisutan u ciljnoj sesiji. Ponovljeni prenos je odbijen.');
    seenOrigins.add(key);
  }

  const targetFrames = allFrames(target);
  const usedIds = new Set([target.id, source.id, ...allFrames(source).flatMap(f => [f.id, f.sourceId]), ...targetFrames.flatMap(f => [f.id, f.sourceId])]);
  const freshId = () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const value = engine.createSession(target.toolId).id;
      if (!usedIds.has(value)) { usedIds.add(value); return value; }
    }
    fail('Nije moguće dobiti jedinstveni identifikator prenosa. Ništa nije preneseno.');
  };
  const sources = new Map();
  let result = target;
  // All operations operate on detached validated data. If any ingestion fails,
  // no partially modified session is returned and caller-owned data is intact.
  for (const { frame, channels } of candidates) {
    if (!sources.has(frame.sourceId)) sources.set(frame.sourceId, freshId());
    result = engine.ingest(result, {
      format: FRAME_FORMAT, id: freshId(), sourceId: sources.get(frame.sourceId), sourceKind: 'file',
      capturedAt: frame.capturedAt, channels: copy(channels), context: contextFor(frame, source)
    });
  }
  return { session: result, transferredFrames: candidates.length, skippedFrames: source.frames.length - candidates.length, channels: [...selected].sort(), sourceSessionId: source.id, sourceToolId: source.toolId };
}
