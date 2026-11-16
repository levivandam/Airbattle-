// Campaign progress (stars, unlocked skins) saved in the browser.
import { loadJSON, saveJSON } from '../storage/settings';
import { WorldDef } from './types';

interface Progress {
  stars: Record<string, number>;
  skins: string[];
}
const KEY = 'airbattle.campaign.v1';
export const progress: Progress = loadJSON<Progress>(KEY, { stars: {}, skins: [] });

export const starsOf = (id: string) => progress.stars[id] ?? 0;

export function worldStars(w: WorldDef, includeBoss = true): number {
  const list = includeBoss ? w.levels : w.levels.slice(0, -1);
  return list.reduce((n, l) => n + starsOf(l.id), 0);
}

export function isUnlocked(w: WorldDef, index: number): boolean {
  if (index === 0) return true;
  if (starsOf(w.levels[index - 1].id) < 1) return false;
  const boss = index === w.levels.length - 1;
  return !boss || worldStars(w, false) >= w.bossStars;
}

/** Store a result. Returns the skin that was newly unlocked, if any. */
export function saveResult(w: WorldDef, index: number, stars: number): string | null {
  const id = w.levels[index].id;
  if (stars > starsOf(id)) progress.stars[id] = stars;
  let unlocked: string | null = null;
  if (index === w.levels.length - 1 && stars > 0 && !progress.skins.includes(w.reward.skin)) {
    progress.skins.push(w.reward.skin);
    unlocked = w.reward.label;
  }
  saveJSON(KEY, progress);
  return unlocked;
}
