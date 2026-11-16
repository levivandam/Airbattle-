import { LevelDef, WorldDef } from '../types';
import { WORLD1 } from './world1';

export const WORLDS: WorldDef[] = [WORLD1];
/** worlds that are planned but not built yet (shown as "coming soon") */
export const COMING: string[] = ['Obstacle Alley', 'Puck Course', 'Bot Gauntlet'];

export function findLevel(id: string): { world: WorldDef; index: number; def: LevelDef } | null {
  for (const world of WORLDS) {
    const index = world.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { world, index, def: world.levels[index] };
  }
  return null;
}
