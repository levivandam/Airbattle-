// Campaign level format. Levels are plain data (see levels/*.ts).
import { BotParams, Level } from '../ai/botConfig';
import { Mover, PowerUpType, Seg } from '../core/state';

export type StarCond = { t: 'shots'; max: number } | { t: 'time'; max: number } | { t: 'conceded'; max: number };

export interface TargetDef {
  x: number;
  y: number;
  r?: number;
  dx?: number; // swing left/right (or up/down) around x, y
  dy?: number;
  period?: number;
}

export interface LevelDef {
  id: string; // e.g. 'w1-3'
  name: string;
  goal: string; // one line shown at the start
  kind: 'targets' | 'score' | 'course' | 'bot' | 'boss';
  /** own shape (closed arena). Omit for the standard table. */
  custom?: { bounds: [number, number, number, number]; zone?: [number, number, number, number] };
  walls?: Seg[];
  bumpers?: Array<{ x: number; y: number; r: number }>;
  movers?: Mover[];
  puck: [number, number];
  targets?: TargetDef[];
  gates?: Seg[]; // must be crossed in order
  finish?: { x: number; y: number; r: number };
  maxShots?: number; // fail when used up
  maxTime?: number; // fail when over (seconds)
  goalsToWin?: number; // score / bot / boss
  bot?: { level: Level; params?: Partial<BotParams>; effects?: PowerUpType[]; playerEffects?: PowerUpType[] };
  powerUps?: boolean;
  stars: [StarCond, StarCond]; // conditions for the 2nd and 3rd star
}

export interface WorldDef {
  id: number;
  name: string;
  blurb: string;
  levels: LevelDef[]; // last one is the boss
  bossStars: number; // stars needed (from this world's normal levels) to open the boss
  reward: { skin: string; label: string };
}

export interface LevelResult {
  won: boolean;
  stars: number;
  shots: number;
  time: number;
  conceded: number;
  reason: string;
}

export const starText = (c: StarCond): string =>
  c.t === 'shots' ? `${c.max} shots or fewer` : c.t === 'time' ? `Under ${c.max} seconds` : c.max === 0 ? 'Concede no goals' : `Concede at most ${c.max}`;
