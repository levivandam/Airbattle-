// Power-up system entry point. Phase 1 stub: effects only expire; spawning comes in Phase 4.
import { GameEvent, GameState } from '../state';

export function tickPowerUps(s: GameState, dt: number, ev: GameEvent[]): void {
  if (s.effects.length === 0) return;
  for (const e of s.effects) e.timeLeft -= dt;
  const done = s.effects.filter((e) => e.timeLeft <= 0);
  if (done.length) {
    s.effects = s.effects.filter((e) => e.timeLeft > 0);
    for (const e of done) ev.push({ t: 'expire', type: e.type, player: e.owner });
  }
}
