// Queries that turn active power-up effects into physics parameters.
import { GameState, PlayerId, PowerUpType, T, other } from './state';

export function has(s: GameState, type: PowerUpType, owner: PlayerId): boolean {
  for (const e of s.effects) if (e.type === type && e.owner === owner) return true;
  return false;
}

export function hasAny(s: GameState, type: PowerUpType): boolean {
  for (const e of s.effects) if (e.type === type) return true;
  return false;
}

export function malletRadius(s: GameState, p: PlayerId): number {
  let r: number = T.MALLET_R;
  if (has(s, 'big', p)) r *= 1.5;
  if (has(s, 'shrink', other(p))) r *= 0.65;
  return r;
}

/** Half-width of the goal defended by `side`. */
export function goalHalf(s: GameState, side: PlayerId): number {
  return has(s, 'smallgoal', side) ? T.GOAL_HALF * 0.6 : T.GOAL_HALF;
}

export const hitMul = (s: GameState, p: PlayerId) => (has(s, 'power', p) ? 1.6 : 1);
export const malletMax = (s: GameState, p: PlayerId) => s.mallets[p].cap * (has(s, 'speed', p) ? 1.4 : 1);
export const isFrozen = (s: GameState, p: PlayerId) => has(s, 'freeze', other(p));
export const isReversed = (s: GameState, p: PlayerId) => has(s, 'reverse', other(p));
export const isIcy = (s: GameState, p: PlayerId) => has(s, 'ice', other(p));
export const hasShield = (s: GameState, side: PlayerId) => has(s, 'shield', side);

export function removeEffect(s: GameState, type: PowerUpType, owner: PlayerId): void {
  s.effects = s.effects.filter((e) => !(e.type === type && e.owner === owner));
}
