// Player statistics stored in the browser.
import { Difficulty } from '../ai/botConfig';
import { loadJSON, saveJSON } from './settings';

export interface Stats {
  wins: Record<Difficulty, number>;
  losses: Record<Difficulty, number>;
  streak: number;
  bestStreak: number;
  goals: number;
  fastest: number; // table units per second
  matches: number;
  localMatches: number;
  onlineMatches: number;
  onlineWins: number;
}

const KEY = 'airbattle.stats.v1';
const zero = (): Record<Difficulty, number> => ({ easy: 0, normal: 0, hard: 0, adaptive: 0 });
const fresh = (): Stats => ({
  wins: zero(), losses: zero(), streak: 0, bestStreak: 0, goals: 0, fastest: 0,
  matches: 0, localMatches: 0, onlineMatches: 0, onlineWins: 0,
});

export let stats: Stats = loadJSON(KEY, fresh());
stats.wins = { ...zero(), ...stats.wins };
stats.losses = { ...zero(), ...stats.losses };

export function saveStats(): void {
  saveJSON(KEY, stats);
}

export function resetStats(): void {
  stats = fresh();
  saveStats();
}

/** Shown to players: table units/s -> a friendlier "km/h"-style number. */
export const speedLabel = (v: number) => Math.round(v * 9) + ' km/h';
