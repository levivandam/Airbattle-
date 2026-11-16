// Difficulty + personality tables for the bot. Tune numbers here only.
export type Difficulty = 'rookie' | 'easy' | 'normal' | 'hard' | 'pro' | 'adaptive';
export type Level = Exclude<Difficulty, 'adaptive'>;
export const LEVELS: Level[] = ['rookie', 'easy', 'normal', 'hard', 'pro'];

export type MoveId = 'straight' | 'bankL' | 'bankR' | 'double' | 'dink' | 'fake' | 'pounce' | 'deflect';
export const MOVES: MoveId[] = ['straight', 'bankL', 'bankR', 'double', 'dink', 'fake', 'pounce', 'deflect'];

export interface BotParams {
  reaction: [number, number]; // seconds between looks at the puck (random in range)
  speed: number; // normal mallet speed
  strike: number; // mallet speed when hitting
  accel: number; // how snappy the hand is (1/s)
  aimError: number; // sideways error on shots and saves
  bounces: number; // wall bounces it can predict
  aggression: number; // 0 = stays home, 1 = attacks everything
  mistake: number; // chance per action of a human mistake (misread, glancing hit, bad timing)
  powerSeek: number; // chance to aim at a power-up token
  patience: number; // chance to hold the puck and line up before shooting
  risk: number; // chance per look to leave the goal and press forward
  deflect: number; // chance to hit an incoming puck straight back without controlling it
  mood: number; // how strongly score swings change its play (0..1)
  adapt: number; // how much it leans toward the side the player scores from (0..1)
  moves: Record<Exclude<MoveId, 'deflect'>, number>; // shot repertoire weights
}

export const BOT: Record<Level, BotParams> = {
  // cautious and slow
  rookie: {
    reaction: [0.4, 0.8], speed: 1.0, strike: 1.5, accel: 5, aimError: 0.34, bounces: 0, aggression: 0.2, mistake: 0.3,
    powerSeek: 0, patience: 0.5, risk: 0.02, deflect: 0.05, mood: 0.4, adapt: 0,
    moves: { straight: 5, bankL: 0.5, bankR: 0.5, double: 0, dink: 3, fake: 0, pounce: 1 },
  },
  // playful but sloppy
  easy: {
    reaction: [0.28, 0.6], speed: 1.45, strike: 2.2, accel: 7, aimError: 0.26, bounces: 0, aggression: 0.35, mistake: 0.22,
    powerSeek: 0.15, patience: 0.4, risk: 0.05, deflect: 0.12, mood: 0.7, adapt: 0,
    moves: { straight: 4, bankL: 1.5, bankR: 1.5, double: 0.3, dink: 2, fake: 0.5, pounce: 1 },
  },
  // balanced
  normal: {
    reaction: [0.18, 0.4], speed: 2.0, strike: 3.2, accel: 9, aimError: 0.17, bounces: 1, aggression: 0.5, mistake: 0.13,
    powerSeek: 0.35, patience: 0.35, risk: 0.07, deflect: 0.22, mood: 0.7, adapt: 0.2,
    moves: { straight: 3, bankL: 2, bankR: 2, double: 0.6, dink: 1, fake: 1.2, pounce: 1.2 },
  },
  // aggressive bank-shot lover
  hard: {
    reaction: [0.11, 0.26], speed: 2.9, strike: 4.8, accel: 12, aimError: 0.1, bounces: 2, aggression: 0.8, mistake: 0.07,
    powerSeek: 0.55, patience: 0.2, risk: 0.11, deflect: 0.4, mood: 0.6, adapt: 0.6,
    moves: { straight: 2, bankL: 3, bankR: 3, double: 1.2, dink: 0.6, fake: 1.5, pounce: 0.8 },
  },
  // patient and tricky
  pro: {
    reaction: [0.07, 0.17], speed: 3.8, strike: 6.5, accel: 16, aimError: 0.055, bounces: 2, aggression: 0.7, mistake: 0.035,
    powerSeek: 0.65, patience: 0.45, risk: 0.08, deflect: 0.45, mood: 0.35, adapt: 1,
    moves: { straight: 2, bankL: 2.5, bankR: 2.5, double: 1.5, dink: 1, fake: 3, pounce: 2 },
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** skill 0 = Rookie … 1 = Pro (smooth blend between neighbouring levels). */
export function blendParams(skill: number): BotParams {
  const t = Math.max(0, Math.min(1, skill)) * (LEVELS.length - 1);
  const i = Math.min(LEVELS.length - 2, Math.floor(t));
  const k = t - i;
  const a = BOT[LEVELS[i]];
  const b = BOT[LEVELS[i + 1]];
  const mix = <K extends keyof BotParams>(key: K): number => lerp(a[key] as number, b[key] as number, k);
  const moves = { ...a.moves };
  for (const m in moves) moves[m as keyof typeof moves] = lerp(a.moves[m as keyof typeof moves], b.moves[m as keyof typeof moves], k);
  return {
    reaction: [lerp(a.reaction[0], b.reaction[0], k), lerp(a.reaction[1], b.reaction[1], k)],
    speed: mix('speed'), strike: mix('strike'), accel: mix('accel'), aimError: mix('aimError'),
    bounces: Math.round(mix('bounces')), aggression: mix('aggression'), mistake: mix('mistake'),
    powerSeek: mix('powerSeek'), patience: mix('patience'), risk: mix('risk'), deflect: mix('deflect'),
    mood: mix('mood'), adapt: mix('adapt'), moves,
  };
}

/** Adaptive: the bot gets stronger when the human leads and weaker when the human trails. */
export function adaptiveSkill(humanScore: number, botScore: number, base = 0.3): number {
  return Math.max(0, Math.min(1, base + 0.12 * (humanScore - botScore)));
}
