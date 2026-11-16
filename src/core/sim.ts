// One fixed simulation step (T.DT). Controllers set mallet targets before calling step().
import { GOAL_PAUSE, scoreGoal, servePuck, tickClock, tickStuck } from './match';
import { collidePucks, driftScored, moveMallet, stepPuck } from './physics';
import { tickPowerUps } from './powerups';
import { GameEvent, GameState, T } from './state';

export function step(s: GameState, ev: GameEvent[]): void {
  const dt = T.DT;
  s.time += dt;
  moveMallet(s, 0, dt);
  moveMallet(s, 1, dt);

  switch (s.phase) {
    case 'countdown': {
      const before = Math.ceil(s.phaseTimer);
      s.phaseTimer -= dt;
      const after = Math.ceil(s.phaseTimer);
      if (s.phaseTimer <= 0) {
        s.phase = 'play';
        ev.push({ t: 'go' });
      } else if (after !== before || s.time <= dt * 1.5) {
        ev.push({ t: 'count', n: after });
      }
      for (const p of s.pucks) {
        p.px = p.x;
        p.py = p.y;
      }
      break;
    }
    case 'play': {
      for (const p of s.pucks) {
        const side = stepPuck(s, p, dt, ev);
        if (side !== -1) {
          scoreGoal(s, side, p, ev);
          return;
        }
      }
      if (s.pucks.length > 1) collidePucks(s.pucks);
      tickPowerUps(s, dt, ev);
      tickStuck(s, dt, ev);
      tickClock(s, dt, ev);
      break;
    }
    case 'goal': {
      for (const p of s.pucks) if (p.scored) driftScored(p, dt);
      tickPowerUps(s, dt, ev);
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) {
        servePuck(s, s.serveTo, ev);
        s.phase = 'play';
      }
      break;
    }
    case 'over': {
      for (const p of s.pucks) if (p.scored) driftScored(p, dt);
      s.phaseTimer += dt;
      break;
    }
  }
}

export { GOAL_PAUSE };
