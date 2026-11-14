/* Original BL CLEA Tools stereo output check. No microphone, device discovery,
 * network, recording, or inferred hardware-health result is involved. */
export const AUDIO_CHECK_PROFILE = Object.freeze({
  id: 'clea.audio.stereo/1',
  frequencyHz: 440,
  gain: 0.035,
  minimumDurationMs: 100,
  maximumDurationMs: 1500,
  output: 'system-selected'
});

const aborted = () => {
  const error = new Error('Zvučni test je zaustavljen.');
  error.name = 'AbortError';
  return error;
};
const timestamp = now => new Date(now()).toISOString();

/** A short, user-initiated tone through the OS-selected audio output.
 * A fulfilled result proves only that the Web Audio graph completed. The user
 * must report audibility; this cannot identify the connected headphones. */
export class StereoCheck {
  constructor({ AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext, now = Date.now } = {}) {
    this.AudioContext = AudioContext;
    this.now = now;
    this.active = null;
    this.disposed = false;
  }

  get available() { return typeof this.AudioContext === 'function' && !this.disposed; }
  get running() { return this.active !== null; }

  play(channel, { signal, durationMs = 900 } = {}) {
    if (this.disposed) return Promise.reject(new Error('Zvučni test je zatvoren.'));
    if (!['left', 'right', 'both'].includes(channel)) return Promise.reject(new Error('Odaberite lijevi, desni ili oba kanala.'));
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < AUDIO_CHECK_PROFILE.minimumDurationMs || durationMs > AUDIO_CHECK_PROFILE.maximumDurationMs) {
      return Promise.reject(new Error('Zvučni test mora trajati između 100 i 1500 ms.'));
    }
    if (!this.available) return Promise.reject(new Error('Web Audio nije dostupan u ovom pregledniku.'));
    if (signal?.aborted) return Promise.reject(aborted());
    if (this.active) return Promise.reject(new Error('Prvo završite ili zaustavite prethodni zvučni test.'));

    return new Promise((resolve, reject) => {
      const job = { context: null, nodes: [], oscillator: null, timer: null, signal, onAbort: null, settled: false };
      this.active = job;
      const finish = (error, result) => {
        if (job.settled) return;
        job.settled = true;
        clearTimeout(job.timer);
        signal?.removeEventListener('abort', job.onAbort);
        if (job.oscillator) {
          job.oscillator.onended = null;
          try { job.oscillator.stop(); } catch { /* Already ended. */ }
        }
        for (const node of job.nodes) { try { node.disconnect(); } catch { /* Detached. */ } }
        if (job.context) {
          // Closing is best-effort after nodes have stopped and disconnected.
          try { Promise.resolve(job.context.close()).catch(() => {}); } catch { /* Unsupported close. */ }
        }
        if (this.active === job) this.active = null;
        if (error) reject(error); else resolve(result);
      };
      job.cancel = () => finish(aborted());
      job.onAbort = job.cancel;
      signal?.addEventListener('abort', job.onAbort, { once: true });
      if (signal?.aborted) { job.cancel(); return; }
      job.timer = setTimeout(() => finish(new Error('Preglednik nije pokrenuo zvučni test na vrijeme.')), 3000);

      try {
        const context = new this.AudioContext();
        job.context = context;
        // resume() is called synchronously from play() to retain the gesture.
        const resume = context.state === 'suspended' ? context.resume() : undefined;
        Promise.resolve(resume).then(() => {
          if (job.settled) return;
          try {
            if (context.state !== 'running') throw new Error('Preglednik nije dozvolio zvučni izlaz. Pokrenite ga ponovo dodirom.');
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const merger = context.createChannelMerger(2);
            job.oscillator = oscillator;
            job.nodes.push(oscillator, gain, merger);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(AUDIO_CHECK_PROFILE.frequencyHz, context.currentTime);
            const start = context.currentTime;
            const seconds = durationMs / 1000;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(AUDIO_CHECK_PROFILE.gain, start + 0.03);
            gain.gain.setValueAtTime(AUDIO_CHECK_PROFILE.gain, start + seconds - 0.05);
            gain.gain.linearRampToValueAtTime(0, start + seconds);
            oscillator.connect(gain);
            if (channel === 'left' || channel === 'both') gain.connect(merger, 0, 0);
            if (channel === 'right' || channel === 'both') gain.connect(merger, 0, 1);
            merger.connect(context.destination);
            const startedAt = timestamp(this.now);
            oscillator.onended = () => finish(null, {
              channel,
              durationMs,
              output: AUDIO_CHECK_PROFILE.output,
              startedAt,
              endedAt: timestamp(this.now)
            });
            clearTimeout(job.timer);
            job.timer = setTimeout(() => finish(new Error('Zvučni test nije potvrdio završetak; izlaz je zaustavljen.')), durationMs + 1000);
            oscillator.start(start);
            oscillator.stop(start + seconds);
          } catch (error) { finish(error); }
        }, error => finish(error));
      } catch (error) { finish(error); }
    });
  }

  stop() { this.active?.cancel(); }
  dispose() { this.disposed = true; this.stop(); }
}
