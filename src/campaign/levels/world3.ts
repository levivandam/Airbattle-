// World 3 — Puck Course: bigger tracks. Steer the puck through the gates to the finish.
import { boxWalls } from '../../core/arena';
import { Seg } from '../../core/state';
import { WorldDef } from '../types';
import { slide, spin } from './world2';

const wall = (x1: number, y1: number, x2: number, y2: number): Seg => ({ x1, y1, x2, y2 });
const B1: [number, number, number, number] = [-0.5, 0.5, -1, 1.7];
const B2: [number, number, number, number] = [-0.5, 1.4, -1, 1];
const B3: [number, number, number, number] = [-0.5, 0.5, -1, 2.2];
const B5: [number, number, number, number] = [-1, 1, -1, 1.4];

export const WORLD3: WorldDef = {
  id: 3,
  name: 'Puck Course',
  blurb: 'Long tracks. Few hits, good angles.',
  bossStars: 8,
  needStars: 9,
  reward: { skin: 'ice', label: 'Ice mallet + Ice table', table: 'ice' },
  levels: [
    {
      id: 'w3-1', name: 'The Corridor', goal: 'Guide the puck through the gates to the green finish', kind: 'course',
      custom: { bounds: B1 },
      walls: [...boxWalls(...B1), wall(-0.5, 0, 0.1, 0), wall(0.5, 0.7, -0.1, 0.7)],
      puck: [0, -0.6],
      gates: [wall(0.1, 0, 0.5, 0), wall(-0.5, 0.7, -0.1, 0.7)],
      finish: { x: 0, y: 1.4, r: 0.14 },
      stars: [{ t: 'shots', max: 6 }, { t: 'shots', max: 3 }],
    },
    {
      id: 'w3-2', name: 'Round the Corner', goal: 'Up, around the corner and down to the finish', kind: 'course',
      custom: { bounds: B2 },
      walls: [...boxWalls(...B2), wall(0.5, -1, 0.5, 0.35)],
      puck: [0, -0.6],
      gates: [wall(0.5, 0.35, 0.5, 1)],
      finish: { x: 0.95, y: -0.65, r: 0.15 },
      stars: [{ t: 'shots', max: 5 }, { t: 'shots', max: 2 }],
    },
    {
      id: 'w3-3', name: 'Zigzag', goal: 'Three turns. Use the walls', kind: 'course',
      custom: { bounds: B3 },
      walls: [...boxWalls(...B3), wall(-0.5, -0.1, 0.15, -0.1), wall(0.5, 0.6, -0.15, 0.6), wall(-0.5, 1.3, 0.15, 1.3)],
      puck: [0, -0.6],
      gates: [wall(0.15, -0.1, 0.5, -0.1), wall(-0.5, 0.6, -0.15, 0.6), wall(0.15, 1.3, 0.5, 1.3)],
      finish: { x: -0.2, y: 1.9, r: 0.14 },
      maxTime: 90,
      stars: [{ t: 'shots', max: 8 }, { t: 'shots', max: 4 }],
    },
    {
      id: 'w3-4', name: 'Moving Parts', goal: 'Get past the sliding doors and the spinner', kind: 'course',
      custom: { bounds: B1 },
      walls: boxWalls(...B1),
      movers: [slide(-0.25, 0, 0.25, 0, 0.45, 3.5), spin(0, 0.65, 0.6, 1.4), slide(0.25, 1.15, -0.25, 1.15, 0.45, 3)],
      puck: [0, -0.6],
      gates: [wall(-0.5, 0.32, 0.5, 0.32), wall(-0.5, 0.95, 0.5, 0.95)],
      finish: { x: 0, y: 1.48, r: 0.14 },
      maxTime: 90,
      stars: [{ t: 'time', max: 30 }, { t: 'time', max: 12 }],
    },
    {
      id: 'w3-5', name: 'The Loop', goal: 'All the way around the block', kind: 'course',
      custom: { bounds: B5 },
      walls: [...boxWalls(...B5), ...boxWalls(-0.45, 0.45, -0.3, 0.75), wall(0, -1, 0, -0.3)],
      puck: [-0.5, -0.65],
      gates: [wall(-1, 0.2, -0.45, 0.2), wall(0, 0.75, 0, 1.4), wall(0.45, 0.2, 1, 0.2)],
      finish: { x: 0.5, y: -0.65, r: 0.16 },
      maxTime: 120,
      stars: [{ t: 'shots', max: 9 }, { t: 'shots', max: 5 }],
    },
    {
      id: 'w3-6', name: 'BOSS: Speed Demon', goal: 'Beat the Speed Demon: finish the course in 30 seconds', kind: 'boss',
      custom: { bounds: B3 },
      walls: [...boxWalls(...B3), wall(-0.5, -0.1, 0.15, -0.1), wall(0.5, 0.6, -0.15, 0.6)],
      movers: [spin(0, 1.25, 0.55, 1.8), slide(-0.3, 1.7, 0.3, 1.7, 0.3, 2.6)],
      puck: [0, -0.6],
      gates: [wall(0.15, -0.1, 0.5, -0.1), wall(-0.5, 0.6, -0.15, 0.6), wall(-0.5, 1.5, 0.5, 1.5)],
      finish: { x: 0, y: 2.0, r: 0.14 },
      maxTime: 30,
      stars: [{ t: 'time', max: 20 }, { t: 'time', max: 12 }],
    },
  ],
};
