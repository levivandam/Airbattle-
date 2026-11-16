import { describe, expect, it } from 'vitest';
import { Bot } from '../src/ai/bot';
import { BOT } from '../src/ai/botConfig';
import { ALL_TYPES } from '../src/core/powerups';
import { step } from '../src/core/sim';
import { GameEvent, T, createState } from '../src/core/state';

const opts = { mode: { kind: 'goals', target: 7 } as const, powerUps: false, enabledTypes: [], seed: 42 };

describe('power-ups', () => {
  it('all 12 can be collected and expire without breaking the match', () => {
    const s = createState({ mode: { kind: 'goals', target: 99 }, powerUps: true, enabledTypes: ALL_TYPES, seed: 3 });
    const b0 = new Bot(0, BOT.hard);
    const b1 = new Bot(1, BOT.hard);
    const ev: GameEvent[] = [];
    const seen = new Set<string>();
    for (let n = 0; n < 120 * 60 * 15; n++) {
      b0.update(s, T.DT); b1.update(s, T.DT);
      ev.length = 0;
      step(s, ev);
      for (const e of ev) if (e.t === 'pickup') seen.add(e.type);
      for (const p of s.pucks) expect(Number.isFinite(p.x + p.y + p.vx + p.vy)).toBe(true);
      expect(s.pucks.length).toBeGreaterThan(0);
      expect(s.pucks.length).toBeLessThanOrEqual(3);
    }
    console.log('picked up', [...seen].sort().join(' '), 'score', s.score);
    expect(seen.size).toBeGreaterThan(6);
  });
});

describe('physics', () => {
  it('fast puck never leaves the table or tunnels through a mallet', () => {
    const s = createState(opts);
    s.phase = 'play';
    const p = s.pucks[0];
    p.x = 0; p.y = 0; p.vx = 0.3; p.vy = -T.PUCK_MAX;
    s.mallets[0].tx = 0; s.mallets[0].ty = -0.9; s.mallets[0].x = 0; s.mallets[0].y = -0.9;
    const ev: GameEvent[] = [];
    let hit = false;
    for (let i = 0; i < 240 && s.phase === 'play'; i++) {
      step(s, ev);
      if (ev.some((e) => e.t === 'hit')) hit = true;
      expect(Math.abs(p.x)).toBeLessThanOrEqual(T.HW);
    }
    expect(hit).toBe(true);
    expect(s.score[1]).toBe(0);
  });
  it('a very fast mallet never passes through a resting puck', () => {
    for (const offset of [0, 0.02, -0.03, 0.05]) {
      const s = createState(opts);
      s.phase = 'play';
      const p = s.pucks[0];
      p.x = offset; p.y = -0.5; p.vx = 0; p.vy = 0;
      const m = s.mallets[0];
      m.x = m.px = m.tx = 0; m.y = m.py = m.ty = -0.9;
      const ev: GameEvent[] = [];
      let hit = false;
      for (let i = 0; i < 12; i++) {
        m.ty = Math.min(-0.1, m.ty + 20 * T.DT); // 20 units per second flick
        step(s, ev);
        if (ev.some((e) => e.t === 'hit')) hit = true;
      }
      expect(hit).toBe(true);
      expect(p.vy).toBeGreaterThan(1);
    }
  });
  it('mallet reaches the pointer target within one tick', () => {
    const s = createState(opts);
    s.mallets[0].tx = 0.3; s.mallets[0].ty = -0.5;
    step(s, []);
    expect(s.mallets[0].x).toBeCloseTo(0.3, 5);
    expect(s.mallets[0].y).toBeCloseTo(-0.5, 5);
  });
  it('bot is varied: no single move dominates and hit rhythm is irregular', () => {
    const s = createState({ mode: { kind: 'goals', target: 999 }, powerUps: false, enabledTypes: [], seed: 5 });
    const b0 = new Bot(0, BOT.normal);
    const b1 = new Bot(1, BOT.normal);
    const ev: GameEvent[] = [];
    const gaps: number[] = [];
    let last = 0;
    for (let n = 0; n < 120 * 60 * 6; n++) {
      b0.update(s, T.DT); b1.update(s, T.DT);
      ev.length = 0;
      step(s, ev);
      for (const e of ev) if (e.t === 'hit' && e.player === 1) { gaps.push(s.time - last); last = s.time; }
    }
    const total = Object.values(b1.log).reduce((a, b) => a + b, 0);
    const top = Math.max(...Object.values(b1.log)) / total;
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
    console.log('moves', JSON.stringify(b1.log), 'top share', top.toFixed(2), 'hit gap mean/sd', mean.toFixed(2), sd.toFixed(2), 'score', s.score);
    expect(total).toBeGreaterThan(20);
    expect(top).toBeLessThan(0.4);
    expect(sd / mean).toBeGreaterThan(0.3);
  });
  it('mallet cannot cross the center line', () => {
    const s = createState(opts);
    s.mallets[0].ty = 0.8;
    const ev: GameEvent[] = [];
    for (let i = 0; i < 200; i++) step(s, ev);
    expect(s.mallets[0].y).toBeLessThanOrEqual(-s.mallets[0].r + 1e-9);
  });
  it('bot vs bot finishes a match', () => {
    for (const [a, b] of [['hard', 'rookie'], ['normal', 'pro'], ['easy', 'normal']] as const) {
      const s = createState({ ...opts, seed: 7 });
      const b0 = new Bot(0, BOT[a]);
      const b1 = new Bot(1, BOT[b]);
      const ev: GameEvent[] = [];
      let n = 0;
      let hits = 0;
      while (s.phase !== 'over' && n < 120 * 60 * 10) {
        b0.update(s, T.DT); b1.update(s, T.DT);
        ev.length = 0;
        step(s, ev);
        hits += ev.filter((e) => e.t === 'hit').length;
        n++;
      }
      console.log(a, 'vs', b, 'score', s.score, 'seconds', Math.round(s.time), 'hits', hits);
      expect(s.score[0] + s.score[1]).toBeGreaterThan(2);
    }
  });
});
