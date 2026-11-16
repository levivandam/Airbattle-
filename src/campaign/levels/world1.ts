// World 1 — Training Hall: aiming, targets, first bank shots.
import { boxWalls } from '../../core/arena';
import { WorldDef } from '../types';

const TABLE: [number, number, number, number] = [-0.5, 0.5, -1, 1];
const HALF: [number, number, number, number] = [-0.5, 0.5, -1, 0];

export const WORLD1: WorldDef = {
  id: 1,
  name: 'Training Hall',
  blurb: 'Learn to aim.',
  bossStars: 8,
  needStars: 0,
  reward: { skin: 'gold', label: 'Gold mallet' },
  levels: [
    {
      id: 'w1-1',
      name: 'First Shots',
      goal: 'Hit all 3 targets with the puck',
      kind: 'targets',
      custom: { bounds: TABLE, zone: HALF },
      walls: boxWalls(...TABLE),
      puck: [0, -0.4],
      targets: [{ x: 0, y: 0.55 }, { x: -0.3, y: 0.3 }, { x: 0.3, y: 0.78 }],
      stars: [{ t: 'shots', max: 6 }, { t: 'shots', max: 3 }],
    },
    {
      id: 'w1-2',
      name: 'Off the Wall',
      goal: 'Use the side walls to reach the targets',
      kind: 'targets',
      custom: { bounds: TABLE, zone: HALF },
      walls: [...boxWalls(...TABLE), { x1: -0.5, y1: 0.18, x2: 0.12, y2: 0.18 }, { x1: 0.5, y1: 0.55, x2: -0.05, y2: 0.55 }],
      puck: [0, -0.45],
      targets: [{ x: -0.3, y: 0.38 }, { x: 0.3, y: 0.8 }, { x: -0.32, y: 0.82 }],
      maxShots: 12,
      stars: [{ t: 'shots', max: 7 }, { t: 'shots', max: 4 }],
    },
    {
      id: 'w1-3',
      name: 'Moving Targets',
      goal: 'Hit the moving targets before time runs out',
      kind: 'targets',
      custom: { bounds: TABLE, zone: HALF },
      walls: boxWalls(...TABLE),
      puck: [0, -0.4],
      targets: [
        { x: 0, y: 0.3, dx: 0.3, period: 4 },
        { x: 0, y: 0.56, dx: -0.3, period: 3 },
        { x: 0, y: 0.82, dx: 0.3, period: 2.4 },
      ],
      maxTime: 60,
      stars: [{ t: 'time', max: 30 }, { t: 'time', max: 14 }],
    },
    {
      id: 'w1-4',
      name: 'Sharpshooter',
      goal: 'Score 3 goals past the blocker',
      kind: 'score',
      walls: [{ x1: -0.13, y1: 0.68, x2: 0.13, y2: 0.68 }],
      puck: [0, -0.4],
      goalsToWin: 3,
      maxTime: 90,
      stars: [{ t: 'time', max: 40 }, { t: 'time', max: 20 }],
    },
    {
      id: 'w1-5',
      name: 'Warm-up Match',
      goal: 'Beat the rookie: first to 3',
      kind: 'bot',
      puck: [0, -0.35],
      goalsToWin: 3,
      bot: { level: 'rookie' },
      stars: [{ t: 'conceded', max: 1 }, { t: 'conceded', max: 0 }],
    },
    {
      id: 'w1-6',
      name: 'BOSS: The Wall',
      goal: 'His mallet is huge. Find the gaps: first to 3',
      kind: 'boss',
      puck: [0, -0.35],
      goalsToWin: 3,
      bot: {
        level: 'easy',
        effects: ['big'],
        params: { aggression: 0.12, speed: 1.7, strike: 2.0, risk: 0, deflect: 0.5, patience: 0.6, reaction: [0.2, 0.4], bounces: 1, mistake: 0.14 },
      },
      stars: [{ t: 'conceded', max: 1 }, { t: 'conceded', max: 0 }],
    },
  ],
};
