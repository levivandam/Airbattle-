import { LevelDef, WorldDef } from '../types';
import { WORLD1 } from './world1';
import { WORLD2 } from './world2';
import { WORLD3 } from './world3';
import { WORLD4 } from './world4';

export const WORLDS: WorldDef[] = [WORLD1, WORLD2, WORLD3, WORLD4];
/** worlds that are planned but not built yet (shown as "coming soon") */
export const COMING: string[] = [];

export function findLevel(id: string): { world: WorldDef; index: number; def: LevelDef } | null {
  for (const world of WORLDS) {
    const index = world.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { world, index, def: world.levels[index] };
  }
  return null;
}
