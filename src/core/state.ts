// Pure game state. Plain serializable data only (used for online snapshots).
// Coordinates: x across the table (-0.5..0.5), y along it (-1..1).
// Player 0 defends the goal at y = -1 (bottom), player 1 the goal at y = +1 (top).

export type PlayerId = 0 | 1;

export const T = {
  HW: 0.5, // half width
  HL: 1.0, // half length
  GOAL_HALF: 0.17,
  PUCK_R: 0.038,
  MALLET_R: 0.062,
  PUCK_MAX: 4.0,
  MALLET_MAX: 5.0,
  DT: 1 / 120,
  SHIELD_INSET: 0.13,
  TOKEN_R: 0.07,
} as const;

export type PowerUpType =
  | 'power'
  | 'big'
  | 'multi'
  | 'shield'
  | 'freeze'
  | 'smallgoal'
  | 'speed'
  | 'ghost'
  | 'fast'
  | 'shrink'
  | 'reverse'
  | 'ice';

export interface Puck {
  id: number;
  x: number;
  y: number;
  px: number; // previous position (render interpolation)
  py: number;
  vx: number;
  vy: number;
  r: number;
  lastTouch: -1 | PlayerId;
  extra: boolean; // spawned by Multi-Puck
  hot: number; // seconds of "power shot" trail left
  scored: boolean; // inside a goal, waiting for removal
}

export interface Mallet {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  tx: number; // target set by the controller (human, bot or network)
  ty: number;
  cap: number; // max speed the controller allows (bots are slower)
}

export interface ActiveEffect {
  type: PowerUpType;
  owner: PlayerId; // the player who collected it
  timeLeft: number;
  total: number;
  n: number; // free counter (e.g. Fast Puck hit count)
}

export interface Token {
  type: PowerUpType;
  x: number;
  y: number;
  age: number;
}

export type MatchMode = { kind: 'goals'; target: number } | { kind: 'time'; seconds: number };

export type Phase = 'countdown' | 'play' | 'goal' | 'over';

export interface GameState {
  time: number;
  phase: Phase;
  phaseTimer: number;
  pucks: Puck[];
  mallets: [Mallet, Mallet];
  score: [number, number];
  mode: MatchMode;
  timeLeft: number; // time mode only
  golden: boolean;
  winner: -1 | PlayerId;
  lastScorer: -1 | PlayerId;
  serveTo: PlayerId;
  stuck: number;
  powerUps: boolean;
  enabledTypes: PowerUpType[];
  token: Token | null;
  nextToken: number;
  tokenSide: number;
  effects: ActiveEffect[];
  seed: number;
  nextId: number;
  stats: { maxSpeed: [number, number]; pickups: [number, number] };
}

export type GameEvent =
  | { t: 'hit'; player: PlayerId; speed: number; x: number; y: number }
  | { t: 'wall'; speed: number; x: number; y: number }
  | { t: 'goal'; scorer: PlayerId; x: number; y: number; final: boolean }
  | { t: 'count'; n: number }
  | { t: 'go' }
  | { t: 'matchpoint'; player: PlayerId }
  | { t: 'golden' }
  | { t: 'over'; winner: PlayerId }
  | { t: 'serve' }
  | { t: 'spawn'; type: PowerUpType; x: number; y: number }
  | { t: 'pickup'; type: PowerUpType; player: PlayerId; x: number; y: number }
  | { t: 'expire'; type: PowerUpType; player: PlayerId }
  | { t: 'block'; x: number; y: number };

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

export function makePuck(id: number, x: number, y: number, extra = false): Puck {
  return { id, x, y, px: x, py: y, vx: 0, vy: 0, r: T.PUCK_R, lastTouch: -1, extra, hot: 0, scored: false };
}

function makeMallet(p: PlayerId): Mallet {
  const y = p === 0 ? -0.7 : 0.7;
  return { x: 0, y, px: 0, py: y, vx: 0, vy: 0, r: T.MALLET_R, tx: 0, ty: y, cap: T.MALLET_MAX };
}

export interface MatchOptions {
  mode: MatchMode;
  powerUps: boolean;
  enabledTypes: PowerUpType[];
  seed?: number;
}

export function createState(o: MatchOptions): GameState {
  const seed = o.seed ?? (Math.random() * 0x7fffffff) | 0;
  const serveTo: PlayerId = seed % 2 === 0 ? 0 : 1;
  return {
    time: 0,
    phase: 'countdown',
    phaseTimer: 3,
    pucks: [makePuck(1, 0, serveTo === 0 ? -0.35 : 0.35)],
    mallets: [makeMallet(0), makeMallet(1)],
    score: [0, 0],
    mode: o.mode,
    timeLeft: o.mode.kind === 'time' ? o.mode.seconds : 0,
    golden: false,
    winner: -1,
    lastScorer: -1,
    serveTo,
    stuck: 0,
    powerUps: o.powerUps,
    enabledTypes: o.enabledTypes,
    token: null,
    nextToken: 7,
    tokenSide: 1,
    effects: [],
    seed,
    nextId: 2,
    stats: { maxSpeed: [0, 0], pickups: [0, 0] },
  };
}

// Deterministic RNG living in the state (mulberry32).
export function rand(s: GameState): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
