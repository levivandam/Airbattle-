// Power-up system: data-driven definitions + spawn / pickup / expiry on the pure game state.
// The physical consequences of active effects live in core/effects.ts (queried by physics).
import { GameEvent, GameState, PlayerId, PowerUpType, T, makePuck, rand } from '../state';

export interface PowerUpDef {
  type: PowerUpType;
  name: string;
  icon: string;
  color: number;
  duration: number; // seconds
  /** who feels it: the collector, the collector's opponent, or everyone */
  target: 'self' | 'opponent' | 'all';
  desc: string;
}

const def = (
  type: PowerUpType,
  name: string,
  icon: string,
  color: number,
  duration: number,
  target: PowerUpDef['target'],
  desc: string,
): PowerUpDef => ({ type, name, icon, color, duration, target, desc });

export const DEFS: Record<PowerUpType, PowerUpDef> = {
  power: def('power', 'Power Shot', '💥', 0xff7a1a, 8, 'self', 'Your hits launch the puck much harder'),
  big: def('big', 'Big Mallet', '🐘', 0x3fbf5f, 10, 'self', 'Your mallet grows'),
  multi: def('multi', 'Multi-Puck', '🎱', 0xb04fd8, 15, 'all', 'Two extra pucks until someone scores'),
  shield: def('shield', 'Shield', '🛡️', 0x35c6e8, 8, 'self', 'A barrier blocks one shot on your goal'),
  freeze: def('freeze', 'Freeze', '❄️', 0x8fd8ff, 1.2, 'opponent', 'Your opponent is frozen for a moment'),
  smallgoal: def('smallgoal', 'Small Goal', '🔒', 0xf2c230, 10, 'self', 'Your own goal shrinks'),
  speed: def('speed', 'Speed Boost', '⚡', 0xffe14a, 10, 'self', 'Your mallet moves faster'),
  ghost: def('ghost', 'Ghost Puck', '👻', 0xcfd3e6, 2.5, 'all', 'The puck turns almost invisible'),
  fast: def('fast', 'Fast Puck', '🚀', 0xff4f6d, 20, 'all', 'The puck speeds up with every hit'),
  shrink: def('shrink', 'Shrink', '🐜', 0xe85d9a, 8, 'opponent', "Your opponent's mallet shrinks"),
  reverse: def('reverse', 'Reverse', '🔄', 0x9a6bff, 4, 'opponent', "Your opponent's left and right are swapped"),
  ice: def('ice', 'Ice Rink', '🧊', 0x7fb8ff, 6, 'opponent', "Your opponent's mallet slides around"),
};

export const CORE_TYPES: PowerUpType[] = ['power', 'big', 'multi', 'shield', 'freeze', 'smallgoal'];
export const EXTRA_TYPES: PowerUpType[] = ['speed', 'ghost', 'fast', 'shrink', 'reverse', 'ice'];
export const ALL_TYPES: PowerUpType[] = [...CORE_TYPES, ...EXTRA_TYPES];

const TOKEN_LIFE = 14;
const SPAWN_MIN = 8;
const SPAWN_SPAN = 4;

export function activate(s: GameState, type: PowerUpType, owner: PlayerId, x: number, y: number, ev: GameEvent[]): void {
  const d = DEFS[type];
  s.stats.pickups[owner]++;
  ev.push({ t: 'pickup', type, player: owner, x, y });
  const existing = s.effects.find((e) => e.type === type && (e.owner === owner || d.target === 'all'));
  if (existing) {
    existing.timeLeft = d.duration; // refresh, never stack
    existing.owner = owner;
    return;
  }
  s.effects.push({ type, owner, timeLeft: d.duration, total: d.duration, n: 0 });
  if (type === 'multi') {
    for (const dir of [-1, 1]) {
      const p = makePuck(s.nextId++, dir * 0.12, 0, true);
      p.vx = dir * 0.9;
      p.vy = (rand(s) - 0.5) * 1.2;
      s.pucks.push(p);
    }
  }
}

function expire(s: GameState, type: PowerUpType): void {
  if (type === 'multi' && s.pucks.length > 1) {
    const keep = s.pucks.filter((p) => !p.extra);
    s.pucks = keep.length ? keep : [s.pucks[0]];
  }
}

export function tickPowerUps(s: GameState, dt: number, ev: GameEvent[]): void {
  // running effects
  if (s.effects.length) {
    let ended = false;
    for (const e of s.effects) {
      e.timeLeft -= dt;
      if (e.timeLeft <= 0) ended = true;
    }
    if (ended) {
      const done = s.effects.filter((e) => e.timeLeft <= 0);
      s.effects = s.effects.filter((e) => e.timeLeft > 0);
      for (const e of done) {
        expire(s, e.type);
        ev.push({ t: 'expire', type: e.type, player: e.owner });
      }
    }
  }
  if (!s.powerUps || s.enabledTypes.length === 0 || s.phase !== 'play') return;

  // token on the table
  if (s.token) {
    const tk = s.token;
    tk.age += dt;
    for (const p of s.pucks) {
      if (p.scored || p.lastTouch === -1) continue;
      const dx = p.x - tk.x;
      const dy = p.y - tk.y;
      const min = p.r + T.TOKEN_R;
      if (dx * dx + dy * dy < min * min) {
        s.token = null;
        s.nextToken = SPAWN_MIN + rand(s) * SPAWN_SPAN;
        activate(s, tk.type, p.lastTouch, tk.x, tk.y, ev);
        return;
      }
    }
    if (tk.age > TOKEN_LIFE) {
      s.token = null;
      s.nextToken = 3 + rand(s) * 3;
    }
    return;
  }
  s.nextToken -= dt;
  if (s.nextToken <= 0) {
    let types = s.enabledTypes;
    // no second Multi-Puck while one is running
    if (s.pucks.length > 1) types = types.filter((t) => t !== 'multi');
    const type = types[Math.floor(rand(s) * types.length)] ?? s.enabledTypes[0];
    s.tokenSide = -s.tokenSide;
    const x = (rand(s) - 0.5) * 0.66;
    const y = s.tokenSide * (0.14 + rand(s) * 0.5);
    s.token = { type, x, y, age: 0 };
    ev.push({ t: 'spawn', type, x, y });
  }
}
