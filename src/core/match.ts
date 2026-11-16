// Match rules: scoring, modes, golden goal, match point, serve, stuck puck.
import { GameEvent, GameState, PlayerId, Puck, makePuck, other } from './state';

export const GOAL_PAUSE = 1.7;

export function isMatchPoint(s: GameState, p: PlayerId): boolean {
  if (s.phase === 'over') return false;
  if (s.golden) return true;
  return s.mode.kind === 'goals' && s.score[p] === s.mode.target - 1;
}

/** Music intensity: 1 = normal match, 2 = tension, 3 = climax. */
export function intensity(s: GameState): 1 | 2 | 3 {
  const mp0 = isMatchPoint(s, 0);
  const mp1 = isMatchPoint(s, 1);
  const timed = s.mode.kind === 'time' && !s.golden;
  if (s.golden || (mp0 && mp1) || (timed && s.timeLeft <= 30)) return 3;
  if (mp0 || mp1 || (timed && s.timeLeft <= 60)) return 2;
  return 1;
}

export function servePuck(s: GameState, to: PlayerId, ev: GameEvent[]): void {
  s.pucks = [makePuck(s.nextId++, 0, to === 0 ? -0.35 : 0.35)];
  s.stuck = 0;
  ev.push({ t: 'serve' });
}

function finish(s: GameState, winner: PlayerId, ev: GameEvent[]): void {
  s.phase = 'over';
  s.phaseTimer = 0;
  s.winner = winner;
  s.effects = [];
  s.token = null;
  ev.push({ t: 'over', winner });
}

/** A puck entered the goal defended by `side`. */
export function scoreGoal(s: GameState, side: PlayerId, puck: Puck, ev: GameEvent[]): void {
  const scorer = other(side);
  const hadMp = [isMatchPoint(s, 0), isMatchPoint(s, 1)];
  s.score[scorer]++;
  s.lastScorer = scorer;
  s.serveTo = side;
  puck.scored = true;
  // Extra pucks vanish after the first goal; the scoring puck drifts into the pocket.
  s.pucks = s.pucks.filter((p) => p === puck);
  s.effects = s.effects.filter((e) => e.type !== 'multi' && e.type !== 'fast' && e.type !== 'ghost');
  const won = s.golden || (s.mode.kind === 'goals' && s.score[scorer] >= s.mode.target);
  ev.push({ t: 'goal', scorer, x: puck.x, y: puck.y, final: won });
  if (won) {
    finish(s, scorer, ev);
    return;
  }
  s.phase = 'goal';
  s.phaseTimer = GOAL_PAUSE;
  for (const p of [0, 1] as PlayerId[]) {
    if (!hadMp[p] && isMatchPoint(s, p)) ev.push({ t: 'matchpoint', player: p });
  }
}

/** Countdown of the match clock (time mode). */
export function tickClock(s: GameState, dt: number, ev: GameEvent[]): void {
  if (s.mode.kind !== 'time' || s.golden) return;
  s.timeLeft -= dt;
  if (s.timeLeft > 0) return;
  s.timeLeft = 0;
  if (s.score[0] === s.score[1]) {
    s.golden = true;
    ev.push({ t: 'golden' });
  } else {
    finish(s, s.score[0] > s.score[1] ? 0 : 1, ev);
  }
}

/** If the only puck lies nearly still for 5 s, re-serve it on that half. */
export function tickStuck(s: GameState, dt: number, ev: GameEvent[]): void {
  if (s.pucks.length !== 1 || (s.arena && s.arena.solo)) {
    s.stuck = 0;
    return;
  }
  const p = s.pucks[0];
  if (Math.hypot(p.vx, p.vy) < 0.06) {
    s.stuck += dt;
    if (s.stuck > 5) servePuck(s, p.y < 0 ? 0 : 1, ev);
  } else {
    s.stuck = 0;
  }
}
