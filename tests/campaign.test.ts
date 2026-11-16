import { describe, expect, it } from 'vitest';
import { WORLDS } from '../src/campaign/levels';
import { buildArena } from '../src/campaign/runner';
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

describe('campaign levels are solvable', () => {
  for (const w of WORLDS) for (const def of w.levels) {
    if (def.bot) continue;
    it(def.id + ' ' + def.name, () => {
      const r = probe(def);
      console.log(def.id, JSON.stringify(r));
      if (def.kind === 'score') expect(r.goal).toBe(true);
      else expect(r.reached).toBe(r.marks);
    });
  }
});
