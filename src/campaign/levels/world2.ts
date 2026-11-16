// World 2 — Obstacle Alley: bumpers, sliding doors, spinning bars.
import { boxWalls } from '../../core/arena';
import { Mover } from '../../core/state';
import { WorldDef } from '../types';

const TABLE: [number, number, number, number] = [-0.5, 0.5, -1, 1];
const HALF: [number, number, number, number] = [-0.5, 0.5, -1, 0];
export const spin = (x: number, y: number, len: number, speed: number, angle = 0): Mover => ({ type: 'spin', x, y, len, angle, spin: speed, bx: x, by: y, period: 1, phase: 0 });
export const slide = (x: number, y: number, bx: number, by: number, len: number, period: number, angle = 0, phase = 0): Mover => ({ type: 'slide', x, y, len, angle, spin: 0, bx, by, period, phase });

export const WORLD2: WorldDef = {
  id: 2,
  name: 'Obstacle Alley',
  blurb: 'Bumpers, doors and spinners get in your way.',
  bossStars: 8,
  needStars: 9,
  reward: { skin: 'neon', label: 'Neon mallet + Neon table', table: 'neon' },
  levels: [
    {
      id: 'w2-1', name: 'Bumper Field', goal: 'Score 3 goals through the bumpers', kind: 'score',
      bumpers: [{ x: -0.2, y: 0.45, r: 0.06 }, { x: 0.2, y: 0.45, r: 0.06 }, { x: 0, y: 0.72, r: 0.06 }],
      puck: [0, -0.4], goalsToWin: 3, maxTime: 90,
      stars: [{ t: 'time', max: 40 }, { t: 'time', max: 20 }],
    },
    {
      id: 'w2-2', name: 'Sliding Door', goal: 'Time your shot: score 3 past the sliding door', kind: 'score',
      movers: [slide(-0.28, 0.8, 0.28, 0.8, 0.3, 3.2)],
      puck: [0, -0.4], goalsToWin: 3, maxTime: 90,
      stars: [{ t: 'time', max: 35 }, { t: 'time', max: 18 }],
    },
    {
      id: 'w2-3', name: 'The Spinner', goal: 'Hit all targets past the spinning bar', kind: 'targets',
      custom: { bounds: TABLE, zone: HALF }, walls: boxWalls(...TABLE),
      movers: [spin(0, 0.38, 0.62, 1.6)],
      puck: [0, -0.45],
      targets: [{ x: -0.3, y: 0.78 }, { x: 0.3, y: 0.78 }, { x: 0, y: 0.86 }],
      maxShots: 14,
      stars: [{ t: 'shots', max: 8 }, { t: 'shots', max: 4 }],
    },
    {
      id: 'w2-4', name: 'Pinball', goal: 'Hit 4 targets in the bumper maze', kind: 'targets',
      custom: { bounds: TABLE, zone: HALF }, walls: boxWalls(...TABLE),
      bumpers: [{ x: -0.25, y: 0.3, r: 0.07 }, { x: 0.25, y: 0.3, r: 0.07 }, { x: 0, y: 0.55, r: 0.07 }, { x: -0.3, y: 0.75, r: 0.05 }, { x: 0.3, y: 0.75, r: 0.05 }],
      puck: [0, -0.45],
      targets: [{ x: 0, y: 0.3, r: 0.07 }, { x: -0.38, y: 0.52, r: 0.07 }, { x: 0.38, y: 0.52, r: 0.07 }, { x: 0, y: 0.86, r: 0.08 }],
      maxTime: 75,
      stars: [{ t: 'time', max: 35 }, { t: 'time', max: 15 }],
    },
    {
      id: 'w2-5', name: 'Crowded Table', goal: 'Beat the bot on a table full of obstacles: first to 3', kind: 'bot',
      bumpers: [{ x: -0.32, y: 0, r: 0.06 }, { x: 0.32, y: 0, r: 0.06 }],
      movers: [spin(0, 0, 0.3, 1.2)],
      puck: [0, -0.35], goalsToWin: 3, bot: { level: 'easy' },
      stars: [{ t: 'conceded', max: 1 }, { t: 'conceded', max: 0 }],
    },
    {
      id: 'w2-6', name: 'BOSS: Bumper King', goal: 'His bars sweep through your half: first to 4', kind: 'boss',
      bumpers: [{ x: -0.3, y: 0.55, r: 0.06 }, { x: 0.3, y: 0.55, r: 0.06 }],
      movers: [slide(-0.3, -0.3, 0.3, -0.3, 0.22, 4), slide(0.3, -0.62, -0.3, -0.62, 0.22, 5.2)],
      puck: [0, -0.45], goalsToWin: 4,
      bot: { level: 'normal', params: { aggression: 0.6, risk: 0.1 } },
      stars: [{ t: 'conceded', max: 2 }, { t: 'conceded', max: 0 }],
    },
  ],
};
