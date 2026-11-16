// Shared Web Audio context + volume buses. Everything is synthesized in code (no audio files).
import { onSettings, settings } from '../storage/settings';

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  noise!: AudioBuffer;
  private duckUntil = 0;

  constructor() {
    onSettings(() => this.applyVolumes());
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  /** Must be called from a user gesture (browser autoplay rule). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.03);
    this.sfx.gain.setTargetAtTime(settings.sfx * 0.9, t, 0.03);
    if (t >= this.duckUntil) this.music.gain.setTargetAtTime(settings.music * 0.5, t, 0.05);
  }

  /** Briefly lower the music (goal horn, jingles). */
  duck(seconds: number, amount = 0.35): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = settings.music * 0.5;
    this.duckUntil = t + seconds;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(base * amount, t, 0.04);
    this.music.gain.setTargetAtTime(base, t + seconds, 0.25);
  }

  noiseSource(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }
}
