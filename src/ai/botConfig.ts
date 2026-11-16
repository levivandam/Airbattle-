// Difficulty parameter tables for the bot. Tune numbers here only.
export type Difficulty = 'easy' | 'normal' | 'hard' | 'adaptive';

export interface BotParams {
  reaction: number; // seconds between decisions (slower = worse)
  speed: number; // max mallet speed
  aimError: number; // random sideways error on shots and saves
  bounces: number; // how many wall bounces it can predict
  aggression: number; // 0 = stays home, 1 = attacks everything
  bank: number; // chance to try a bank shot off a side wall
  mistake: number; // chance per decision to badly misjudge the puck
  powerSeek: number; // chance to aim at a power-up token
}

export const BOT: Record<Exclude<Difficulty, 'adaptive'>, BotParams> = {
  easy: { reaction: 0.35, speed: 1.5, aimError: 0.3, bounces: 0, aggression: 0.25, bank: 0, mistake: 0.22, powerSeek: 0 },
  normal: { reaction: 0.2, speed: 2.4, aimError: 0.15, bounces: 1, aggression: 0.55, bank: 0.2, mistake: 0.1, powerSeek: 0.35 },
  hard: { reaction: 0.09, speed: 3.6, aimError: 0.06, bounces: 2, aggression: 0.9, bank: 0.4, mistake: 0.03, powerSeek: 0.6 },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** skill 0 = Easy, 1 = Hard. */
export function blendParams(skill: number): BotParams {
  const a = BOT.easy;
  const b = BOT.hard;
  const t = Math.max(0, Math.min(1, skill));
  return {
    reaction: lerp(a.reaction, b.reaction, t),
    speed: lerp(a.speed, b.speed, t),
    aimError: lerp(a.aimError, b.aimError, t),
    bounces: Math.round(lerp(a.bounces, b.bounces, t)),
    aggression: lerp(a.aggression, b.aggression, t),
    bank: lerp(a.bank, b.bank, t),
    mistake: lerp(a.mistake, b.mistake, t),
    powerSeek: lerp(a.powerSeek, b.powerSeek, t),
  };
}

/** Adaptive: the bot gets stronger when the human leads and weaker when the human trails. */
export function adaptiveSkill(humanScore: number, botScore: number, base = 0.45): number {
  return Math.max(0.05, Math.min(1, base + 0.14 * (humanScore - botScore)));
}
