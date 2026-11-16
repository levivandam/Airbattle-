import { describe, expect, it } from 'vitest';
import { WORLDS } from '../src/campaign/levels';
import { LevelRun, buildArena } from '../src/campaign/runner';
import { LevelDef } from '../src/campaign/types';
import { step } from '../src/core/sim';
import { GameEvent, createState, makePuck } from '../src/core/state';

/** Fire the puck from many spots / angles in the player's zone; report which marks can be reached and whether a goal can be scored. */
export function probe(def: LevelDef) {
  const arena = buildArena(def);
  const zone = arena.zone ?? [-0.5, 0.5, -1, 0];
  const reached = new Set<number>();
  let goal = false;
  const ev: GameEvent[] = [];
  for (let gx = 0; gx < 5; gx++) for (let gy = 0; gy < 4; gy++) {
    const sx = zone[0] + 0.08 + ((zone[1] - zone[0] - 0.16) * gx) / 4;
    const sy = zone[2] + 0.1 + ((zone[3] - zone[2] - 0.2) * gy) / 3;
    for (let a = 0; a < 48; a++) {
      const s = createState({ mode: { kind: 'goals', target: 99 }, powerUps: false, enabledTypes: [], seed: 1, arena });
      s.phase = 'play';
      s.mallets[0].x = s.mallets[0].tx = 0; s.mallets[0].y = s.mallets[0].ty = zone[2] - 5; // out of the way
      const p = makePuck(1, sx, sy);
      const ang = (a / 48) * Math.PI * 2;
      p.vx = Math.cos(ang) * 4; p.vy = Math.sin(ang) * 4;
      s.pucks = [p];
      for (let n = 0; n < 120 * 3; n++) {
        ev.length = 0;
        s.mallets[0].y = s.mallets[0].ty = -50; s.mallets[0].py = -50;
        step(s, ev);
        if (s.score[0] > 0) { goal = true; break; }
        if (s.phase !== 'play') break;
        const q = s.pucks[0];
        arena.marks.forEach((m, i) => {
          const hit = m.kind === 'gate' ? Math.hypot(q.x - (m.x + m.x2) / 2, q.y - (m.y + m.y2) / 2) < 0.1 : Math.hypot(q.x - m.x, q.y - m.y) < q.r + m.r;
          if (hit) reached.add(i);
        });
      }
    }
  }
  return { reached: reached.size, marks: arena.marks.length, goal };
}

/** Multi-shot search for courses: can the puck be brought through all gates to the finish in a few hits? */
function solveCourse(def: LevelDef): { solved: boolean; shots: number } {
  type Node = { x: number; y: number; time: number; done: boolean[]; shots: number };
  const base = buildArena(def);
  let beam: Node[] = [{ x: def.puck[0], y: def.puck[1], time: 0, done: base.marks.map(() => false), shots: 0 }];
  const ev: GameEvent[] = [];
  for (let depth = 0; depth < 12; depth++) {
    const next: Array<Node & { score: number }> = [];
    for (const node of beam) {
      for (let a = 0; a < 40; a++) for (const sp of [1.6, 3, 4.6]) {
        const arena = structuredClone(base);
        arena.marks.forEach((m, i) => (m.done = node.done[i]));
        const s = createState({ mode: { kind: 'goals', target: 99 }, powerUps: false, enabledTypes: [], seed: 1, arena });
        s.phase = 'play';
        s.time = node.time;
        const run = new LevelRun({ ...def, maxTime: undefined, maxShots: undefined }, () => {}, () => {});
        const p = makePuck(1, node.x, node.y);
        const ang = (a / 40) * Math.PI * 2;
        p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
        s.pucks = [p];
        for (let n = 0; n < 120 * 6; n++) {
          s.mallets[0].x = s.mallets[0].tx = 50; s.mallets[0].y = s.mallets[0].ty = 50; s.mallets[0].px = 50; s.mallets[0].py = 50;
          ev.length = 0;
          step(s, ev);
          s.mallets[0].x = 50; s.mallets[0].y = 50;
          run.tick(s, ev, 1 / 120);
          if (arena.marks.every((m) => m.done)) return { solved: true, shots: node.shots + 1 };
          const q = s.pucks[0];
          if (Math.hypot(q.vx, q.vy) < 0.05) break;
        }
        const q = s.pucks[0];
        const done = arena.marks.map((m) => m.done);
        const nextMark = arena.marks.find((m) => !m.done)!;
        const tx = nextMark.kind === 'gate' ? (nextMark.x + nextMark.x2) / 2 : nextMark.x;
        const ty = nextMark.kind === 'gate' ? (nextMark.y + nextMark.y2) / 2 : nextMark.y;
        next.push({ x: q.x, y: q.y, time: s.time, done, shots: node.shots + 1, score: done.filter(Boolean).length * 10 - Math.hypot(q.x - tx, q.y - ty) });
      }
    }
    next.sort((u, v) => v.score - u.score);
    beam = next.slice(0, 4);
  }
  return { solved: false, shots: 99 };
}

describe('campaign levels are solvable', () => {
  for (const w of WORLDS) for (const def of w.levels) {
    if (def.bot) continue;
    it(def.id + ' ' + def.name, { timeout: 120000 }, () => {
      if (def.gates || def.finish) {
        const c = solveCourse(def);
        console.log(def.id, JSON.stringify(c));
        expect(c.solved).toBe(true);
        return;
      }
      const r = probe(def);
      console.log(def.id, JSON.stringify(r));
      if (def.kind === 'score') expect(r.goal).toBe(true);
      else expect(r.reached).toBe(r.marks);
    });
  }
});
