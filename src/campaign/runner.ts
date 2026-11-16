// Runs one campaign level on top of the normal simulation: builds the arena, checks win / fail / stars.
import { GameEvent, GameState, Arena, Mark, makePuck } from '../core/state';
import { LevelDef, LevelResult, StarCond } from './types';

const mark = (kind: Mark['kind'], x: number, y: number, r: number, extra: Partial<Mark> = {}): Mark => ({
  kind, x, y, r, x2: x, y2: y, done: false, ox: x, oy: y, dx: 0, dy: 0, period: 1, ...extra,
});

export function buildArena(def: LevelDef): Arena {
  const marks: Mark[] = [];
  for (const t of def.targets ?? []) marks.push(mark('target', t.x, t.y, t.r ?? 0.09, { dx: t.dx ?? 0, dy: t.dy ?? 0, period: t.period ?? 1 }));
  for (const g of def.gates ?? []) marks.push(mark('gate', g.x1, g.y1, 0, { x2: g.x2, y2: g.y2 }));
  if (def.finish) marks.push(mark('finish', def.finish.x, def.finish.y, def.finish.r));
  return {
    id: def.id + ':' + Math.random().toString(36).slice(2, 7),
    custom: !!def.custom,
    solo: !def.bot,
    bounds: def.custom?.bounds ?? [-0.5, 0.5, -1, 1],
    zone: def.custom ? (def.custom.zone ?? def.custom.bounds) : null,
    walls: def.walls ?? [],
    bumpers: def.bumpers ?? [],
    movers: def.movers ?? [],
    marks,
  };
}

/** Put the state in its starting position for this level (call right after createState). */
export function setupState(s: GameState, def: LevelDef): void {
  s.pucks = [makePuck(s.nextId++, def.puck[0], def.puck[1])];
  if (!def.bot) {
    s.phase = 'play'; // practice levels start right away
    s.phaseTimer = 0;
  }
}

function crosses(ax: number, ay: number, bx: number, by: number, g: Mark): boolean {
  const d = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const d1 = d(g.x, g.y, g.x2, g.y2, ax, ay);
  const d2 = d(g.x, g.y, g.x2, g.y2, bx, by);
  const d3 = d(ax, ay, bx, by, g.x, g.y);
  const d4 = d(ax, ay, bx, by, g.x2, g.y2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export class LevelRun {
  shots = 0;
  time = 0;
  result: LevelResult | null = null;
  private lastShot = -1;
  private rest = 0;
  private endTimer = 0;
  private pending: { won: boolean; reason: string } | null = null;

  constructor(
    readonly def: LevelDef,
    private emit: (e: GameEvent) => void,
    private onEnd: (r: LevelResult) => void,
  ) {}

  private met(c: StarCond, conceded: number): boolean {
    return c.t === 'shots' ? this.shots <= c.max : c.t === 'time' ? this.time <= c.max : conceded <= c.max;
  }

  private finish(s: GameState, won: boolean, reason: string): void {
    if (this.pending) return;
    this.pending = { won, reason };
    this.endTimer = 1.3;
    if (s.phase !== 'over') {
      s.phase = 'over';
      s.phaseTimer = 0;
      s.winner = won ? 0 : 1;
    }
    this.emit({ t: won ? 'win' : 'fail' });
  }

  /** Called after every simulation tick. */
  tick(s: GameState, ev: GameEvent[], dt: number): void {
    const def = this.def;
    const A = s.arena;
    if (this.pending) {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this.result) {
        const conceded = s.score[1];
        let stars = 0;
        if (this.pending.won) stars = 1 + (this.met(def.stars[0], conceded) ? 1 + (this.met(def.stars[1], conceded) ? 1 : 0) : 0);
        this.result = { won: this.pending.won, stars, shots: this.shots, time: this.time, conceded, reason: this.pending.reason };
        this.onEnd(this.result);
      }
      return;
    }
    // permanent effects (boss twists)
    if (def.bot) {
      for (const [list, owner] of [[def.bot.effects, 1], [def.bot.playerEffects, 0]] as const) {
        for (const type of list ?? []) {
          const e = s.effects.find((x) => x.type === type && x.owner === owner);
          if (e) e.timeLeft = e.total = 9999;
          else s.effects.push({ type, owner, timeLeft: 9999, total: 9999, n: 0 });
        }
      }
    }
    for (const e of ev) {
      if (e.t === 'hit' && e.player === 0 && e.speed > 0.5 && this.time - this.lastShot > 0.3) {
        this.shots++;
        this.lastShot = this.time;
      }
      if (e.t === 'over') return this.finish(s, e.winner === 0, e.winner === 0 ? '' : def.bot ? 'The bot won' : 'Too many own goals');
      // solo levels on the standard table: always serve to the player
      if (e.t === 'serve' && !def.bot) s.pucks = [makePuck(s.nextId++, def.puck[0], def.puck[1])];
    }
    if (s.phase !== 'play') return;
    this.time += dt;
    if (def.bot || !A) return;

    const p = s.pucks[0];
    if (!p) return;
    // moving targets
    for (const m of A.marks) {
      if (m.kind === 'target' && (m.dx || m.dy)) {
        const k = Math.sin((2 * Math.PI * s.time) / m.period);
        m.x = m.ox + m.dx * k;
        m.y = m.oy + m.dy * k;
      }
    }
    // targets, gates, finish
    let open = 0;
    let gatesOpen = 0;
    for (const m of A.marks) {
      if (m.done) continue;
      if (m.kind === 'target') {
        if (Math.hypot(p.x - m.x, p.y - m.y) < p.r + m.r) {
          m.done = true;
          this.emit({ t: 'target', x: m.x, y: m.y });
        } else open++;
      } else if (m.kind === 'gate') {
        if (gatesOpen === 0 && crosses(p.px, p.py, p.x, p.y, m)) {
          m.done = true;
          this.emit({ t: 'gate', x: (m.x + m.x2) / 2, y: (m.y + m.y2) / 2 });
        } else gatesOpen++;
      } else if (m.kind === 'finish') {
        if (gatesOpen === 0 && Math.hypot(p.x - m.x, p.y - m.y) < m.r) {
          m.done = true;
          this.emit({ t: 'target', x: m.x, y: m.y });
        } else open++;
      }
    }
    const hasMarks = A.marks.length > 0;
    if (hasMarks && open === 0 && gatesOpen === 0) return this.finish(s, true, '');
    if (def.maxTime && this.time > def.maxTime) return this.finish(s, false, "Time's up");

    // puck at rest: out of shots, or out of reach
    const speed = Math.hypot(p.vx, p.vy);
    this.rest = speed < 0.07 ? this.rest + dt : 0;
    const B = A.bounds;
    const lost = p.x < B[0] - 0.3 || p.x > B[1] + 0.3 || p.y < B[2] - 0.3 || p.y > B[3] + 0.3;
    if (def.maxShots && this.shots >= def.maxShots && this.rest > 0.7) return this.finish(s, false, 'Out of shots');
    const Z = A.zone ?? [-0.5, 0.5, -1, 0];
    const unreachable = p.x < Z[0] || p.x > Z[1] || p.y < Z[2] || p.y > Z[3] - 0.02;
    if (lost || (unreachable && this.rest > 0.6)) {
      s.pucks = [makePuck(s.nextId++, def.puck[0], def.puck[1])];
      this.rest = 0;
      this.emit({ t: 'serve' });
    }
  }
}
