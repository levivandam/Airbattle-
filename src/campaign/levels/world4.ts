// World 4 — Bot Gauntlet: matches with a twist.
import { WorldDef } from '../types';

export const WORLD4: WorldDef = {
  id: 4,
  name: 'Bot Gauntlet',
  blurb: 'Every match bends the rules.',
  bossStars: 8,
  needStars: 9,
  reward: { skin: 'champion', label: 'Black chrome mallet + Champion table', table: 'gold' },
  levels: [
    {
      id: 'w4-1', name: 'Tiny Target', goal: "The bot's goal is tiny: first to 3", kind: 'bot',
      puck: [0, -0.35], goalsToWin: 3, bot: { level: 'easy', effects: ['smallgoal'] },
      stars: [{ t: 'conceded', max: 1 }, { t: 'conceded', max: 0 }],
    },
    {
      id: 'w4-2', name: 'Power Play', goal: 'Power-ups are on: first to 5', kind: 'bot',
      puck: [0, -0.35], goalsToWin: 5, powerUps: true, bot: { level: 'normal' },
      stars: [{ t: 'conceded', max: 3 }, { t: 'conceded', max: 1 }],
    },
    {
      id: 'w4-3', name: 'Ice Cold', goal: 'Your half is slippery: first to 3', kind: 'bot',
      puck: [0, -0.35], goalsToWin: 3, bot: { level: 'easy', effects: ['ice'] },
      stars: [{ t: 'conceded', max: 1 }, { t: 'conceded', max: 0 }],
    },
    {
      id: 'w4-4', name: 'One Minute', goal: 'Win a 60-second match against a hard bot', kind: 'bot',
      puck: [0, -0.35], seconds: 60, bot: { level: 'hard' },
      stars: [{ t: 'conceded', max: 1 }, { t: 'conceded', max: 0 }],
    },
    {
      id: 'w4-5', name: 'Big Trouble', goal: 'The bot is big and fast: first to 4', kind: 'bot',
      puck: [0, -0.35], goalsToWin: 4, bot: { level: 'normal', effects: ['big', 'speed'] },
      stars: [{ t: 'conceded', max: 2 }, { t: 'conceded', max: 0 }],
    },
    {
      id: 'w4-6', name: 'BOSS: The Champion', goal: 'The best bot, with power-ups: first to 5', kind: 'boss',
      puck: [0, -0.35], goalsToWin: 5, powerUps: true,
      bot: { level: 'pro', params: { powerSeek: 0.9, patience: 0.5 } },
      stars: [{ t: 'conceded', max: 3 }, { t: 'conceded', max: 1 }],
    },
  ],
};
