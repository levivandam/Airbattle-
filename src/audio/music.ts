// Procedural adaptive music. Four intensity levels built from layers; level changes on bar boundaries.
//   0 = lobby (calm lo-fi), 1 = match groove, 2 = tension (match point / last 60 s), 3 = climax (last 30 s, golden goal)
// All notes are generated in code, so there are no copyright concerns.
import { AudioEngine } from './engine';

export type Level = 0 | 1 | 2 | 3;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const BPM = [80, 116, 126, 138];

interface Chord {
  bass: number;
  notes: number[];
}
// lobby: Fmaj7 – Em7 – Dm7 – Cmaj7 ; match: Am – F – C – G
const LOBBY: Chord[] = [
  { bass: 41, notes: [57, 60, 64, 67] },
  { bass: 40, notes: [55, 59, 62, 67] },
  { bass: 38, notes: [53, 57, 60, 65] },
  { bass: 36, notes: [52, 55, 59, 64] },
];
const MATCH: Chord[] = [
  { bass: 45, notes: [57, 60, 64] },
  { bass: 41, notes: [57, 60, 65] },
  { bass: 36, notes: [55, 60, 64] },
  { bass: 43, notes: [55, 59, 62] },
];
// melodies: 8 slots per bar (eighth notes), 0 = rest
const LOBBY_MEL = [
  [72, 0, 0, 69, 0, 67, 0, 0],
  [71, 0, 67, 0, 0, 0, 64, 0],
  [69, 0, 0, 65, 0, 67, 69, 0],
  [67, 0, 0, 0, 64, 0, 0, 0],
];
const LEAD = [
  [76, 0, 76, 79, 81, 0, 79, 76],
  [77, 0, 77, 81, 84, 0, 81, 77],
  [79, 0, 76, 79, 84, 83, 79, 76],
  [74, 0, 79, 83, 86, 0, 83, 79],
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

export class Music {
  private target: Level = 0;
  private level: Level = 0;
  private step = 0;
  private bar = 0;
  private next = 0;
  private started = false;
  private bus!: GainNode;
  private wet!: GainNode;

  constructor(private a: AudioEngine) {}

  setLevel(l: Level): void {
    this.target = l;
  }

  start(): void {
    const ctx = this.a.ctx;
    if (!ctx || this.started) return;
    this.started = true;
    this.bus = ctx.createGain();
    this.bus.connect(this.a.music);
    // simple echo for plucks and leads
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.33;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.35;
    this.wet.connect(delay);
    delay.connect(tone).connect(fb).connect(delay);
    tone.connect(this.a.music);
    this.next = ctx.currentTime + 0.12;
    window.setInterval(() => this.pump(), 25);
  }

  private pump(): void {
    const ctx = this.a.ctx!;
    if (ctx.state !== 'running') return;
    if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05; // tab was asleep
    while (this.next < ctx.currentTime + 0.16) {
      if (this.step === 0 && this.target !== this.level) {
        const up = this.target > this.level;
        this.level = this.target;
        if (up && this.level >= 1) this.crash(this.next);
      }
      this.schedule(this.next);
      this.next += 60 / BPM[this.level] / 4;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }

  // ---------- instruments ----------
  private env(t: number, dur: number, peak: number, attack = 0.005): GainNode {
    const g = this.a.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  private kick(t: number, vol: number): void {
    const ctx = this.a.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = this.env(t, 0.26, vol, 0.002);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.3);
  }

  private noiseHit(t: number, dur: number, freq: number, type: BiquadFilterType, vol: number, q = 0.8): void {
    const ctx = this.a.ctx!;
    const src = this.a.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.env(t, dur, vol, 0.002);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number, vol: number): void {
    this.noiseHit(t, 0.16, 1900, 'bandpass', vol, 0.7);
    const ctx = this.a.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const g = this.env(t, 0.1, vol * 0.6, 0.002);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.12);
  }

  private crash(t: number): void {
    this.noiseHit(t, 1.4, 6500, 'highpass', 0.22);
  }

  private voice(t: number, midi: number, dur: number, type: OscillatorType, vol: number, cutoff: number, echo = false, attack = 0.006): void {
    const ctx = this.a.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = mtof(midi);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.45), t + dur);
    const g = this.env(t, dur, vol, attack);
    o.connect(f).connect(g);
    g.connect(this.bus);
    if (echo) g.connect(this.wet);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private pad(t: number, chord: Chord, dur: number, vol: number, cutoff: number): void {
    for (const n of chord.notes) {
      this.voice(t, n, dur, 'triangle', vol, cutoff, false, dur * 0.25);
      this.voice(t, n + 0.08, dur, 'sawtooth', vol * 0.25, cutoff * 0.7, false, dur * 0.3);
    }
  }

  // ---------- pattern ----------
  private schedule(t: number): void {
    const L = this.level;
    const s = this.step;
    const spb = 60 / BPM[L];
    const bar = this.bar % 4;

    if (L === 0) {
      const c = LOBBY[bar];
      if (s === 0) {
        this.pad(t, c, spb * 4.2, 0.085, 1400);
        this.voice(t, c.bass, spb * 1.8, 'sine', 0.3, 500);
      }
      if (s === 10) this.voice(t, c.bass + 12, spb * 0.9, 'sine', 0.16, 500);
      if (s === 0 || s === 10) this.kick(t, 0.28);
      if (s === 4 || s === 12) this.noiseHit(t, 0.07, 3200, 'bandpass', 0.07, 1.5);
      if (s % 2 === 0 && s !== 4 && s !== 12) this.noiseHit(t, 0.03, 8000, 'highpass', 0.025);
      if (s % 2 === 0) {
        const n = LOBBY_MEL[bar][s / 2];
        if (n) this.voice(t, n, spb * 0.9, 'triangle', 0.13, 1800, true);
      }
      return;
    }

    const c = MATCH[bar];
    // drums
    if (s % 4 === 0) this.kick(t, L === 1 ? 0.5 : 0.62);
    if (L === 3 && s === 14 && bar % 2 === 1) this.kick(t, 0.45);
    if (s === 4 || s === 12) {
      if (L === 1) this.noiseHit(t, 0.08, 2600, 'bandpass', 0.12, 1.2);
      else this.snare(t, L === 2 ? 0.26 : 0.32);
    }
    if (L === 3 && bar === 3 && s >= 12) this.snare(t, 0.14 + (s - 12) * 0.05); // fill into the next loop
    if (L === 1) {
      if (s % 4 === 2) this.noiseHit(t, 0.04, 8000, 'highpass', 0.07);
    } else if (L === 2) {
      if (s % 2 === 0) this.noiseHit(t, 0.04, 8500, 'highpass', s % 4 === 2 ? 0.09 : 0.05);
      else this.noiseHit(t, 0.025, 9000, 'highpass', 0.025);
    } else {
      this.noiseHit(t, s === 14 ? 0.16 : 0.035, 9000, 'highpass', s % 4 === 2 ? 0.1 : s % 2 === 0 ? 0.06 : 0.04);
    }
    // bass
    const cut = [0, 520, 900, 1500][L];
    if (L < 3) {
      if (s % 2 === 0) this.voice(t, c.bass + (s === 6 || s === 14 ? 12 : 0), spb * 0.45, 'sawtooth', 0.2, cut);
    } else {
      this.voice(t, c.bass + (s % 4 === 2 ? 12 : 0), spb * 0.22, 'sawtooth', 0.19, cut);
    }
    // pad
    if (s === 0) this.pad(t, c, spb * 4, L === 1 ? 0.045 : 0.06, 900 + L * 400);
    // arpeggio
    const arpEvery = L === 1 ? 2 : 1;
    if (s % arpEvery === 0) {
      const idx = ARP[(s / arpEvery) % 8];
      const oct = L === 3 ? 24 : 12;
      this.voice(t, c.notes[idx] + oct, spb * (L === 1 ? 0.4 : 0.22), 'square', L === 1 ? 0.05 : 0.045, 1600 + L * 700, true);
    }
    // lead
    if (s % 2 === 0 && (L === 3 || (L === 2 && bar % 2 === 0 && s < 8))) {
      const n = LEAD[bar][s / 2];
      if (n) this.voice(t, n, spb * 0.48, 'sawtooth', L === 3 ? 0.085 : 0.06, 3200, true, 0.01);
    }
  }
}
