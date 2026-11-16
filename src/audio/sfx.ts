// Synthesized sound effects.
import { ALL_TYPES } from '../core/powerups';
import { PowerUpType } from '../core/state';
import { AudioEngine } from './engine';

export class Sfx {
  private lastHit = 0;
  constructor(private a: AudioEngine) {}

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; to?: number; at?: number; attack?: number } = {},
  ): void {
    const ctx = this.a.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.a.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', at = 0, attack = 0.003): void {
    const ctx = this.a.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = this.a.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.a.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  hit(speed: number): void {
    const now = this.a.now;
    if (now - this.lastHit < 0.03) return;
    this.lastHit = now;
    const v = Math.min(1, speed / 4);
    this.noise(0.05 + v * 0.04, 1800 + v * 1400, 1.2, 0.12 + v * 0.5);
    this.tone(190 + v * 90, 0.09, { type: 'triangle', gain: 0.1 + v * 0.4, to: 90 });
  }

  wall(speed: number): void {
    const v = Math.min(1, speed / 4);
    this.noise(0.04, 2600, 2, 0.05 + v * 0.3);
    this.tone(420, 0.05, { type: 'square', gain: 0.02 + v * 0.07, to: 240 });
  }

  goal(): void {
    // arena horn + crowd swell
    for (const f of [233, 311, 466]) this.tone(f, 1.1, { type: 'sawtooth', gain: 0.16, attack: 0.03 });
    this.noise(1.9, 1100, 0.6, 0.3, 'bandpass', 0.15, 0.5);
    this.a.duck(1.6);
  }

  count(final: boolean): void {
    this.tone(final ? 988 : 660, final ? 0.45 : 0.16, { type: 'square', gain: 0.14 });
  }

  click(): void {
    this.tone(880, 0.05, { type: 'triangle', gain: 0.12, to: 660 });
  }

  spawn(): void {
    this.tone(1320, 0.12, { type: 'sine', gain: 0.12 });
    this.tone(1760, 0.18, { type: 'sine', gain: 0.12, at: 0.08 });
  }

  pickup(type: PowerUpType): void {
    // each power-up gets its own little three-note motif
    const i = ALL_TYPES.indexOf(type);
    const base = 392 * Math.pow(2, (i % 6) / 12);
    const steps = i < 6 ? [0, 4, 7] : [0, 3, 10];
    steps.forEach((s, k) => this.tone(base * Math.pow(2, s / 12), 0.16, { type: i % 2 ? 'square' : 'sawtooth', gain: 0.13, at: k * 0.07 }));
    if (type === 'freeze' || type === 'ice') this.noise(0.5, 6000, 3, 0.2, 'highpass');
    if (type === 'power') this.noise(0.3, 300, 0.8, 0.4, 'lowpass');
  }

  expire(): void {
    this.tone(520, 0.14, { type: 'triangle', gain: 0.1, to: 300 });
  }

  block(): void {
    this.tone(880, 0.35, { type: 'square', gain: 0.13, to: 820 });
    this.tone(1320, 0.3, { type: 'triangle', gain: 0.12 });
    this.noise(0.12, 3000, 1, 0.3);
  }

  matchPoint(): void {
    [523, 659, 784].forEach((f, k) => this.tone(f, 0.22, { type: 'sawtooth', gain: 0.12, at: k * 0.11 }));
  }

  win(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, k) => this.tone(f, k === 5 ? 0.7 : 0.2, { type: 'square', gain: 0.13, at: 0.5 + k * 0.14 }));
    this.a.duck(2.2, 0.2);
  }

  lose(): void {
    [392, 370, 330, 262].forEach((f, k) => this.tone(f, k === 3 ? 0.8 : 0.3, { type: 'triangle', gain: 0.18, at: 0.5 + k * 0.24 }));
    this.a.duck(2.2, 0.2);
  }
}
