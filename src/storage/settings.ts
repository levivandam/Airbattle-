// Persistent settings (localStorage, safe if storage is unavailable).
import { Difficulty } from '../ai/botConfig';
import { MatchMode } from '../core/state';

export interface Settings {
  matchKind: 'goals' | 'time';
  minutes: 2 | 3 | 5;
  powerUps: boolean;
  difficulty: Difficulty;
  graphics: 'auto' | 'high' | 'low';
  music: number; // 0..1
  sfx: number;
  muted: boolean;
  shake: boolean;
  aimLine: boolean;
  p2keys: 'wasd' | 'arrows';
  color: number; // index into MALLET_COLORS
  accent: number;
  nick: string; // nickname shown to quick-match opponents
  table: string; // table theme: 'classic' or an unlocked one
  skin: string; // '' or an unlocked campaign skin (e.g. 'gold')
}

export const MALLET_COLORS = [0xd3352b, 0x2a5bc7, 0x2f9d5a, 0xf08a24, 0x8b3fb0, 0xe85d9a, 0x1fa3a3, 0xf2c230, 0x26232b, 0xf4f0e6];
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

const KEY = 'airbattle.settings.v1';
const defaults: Settings = {
  matchKind: 'goals',
  minutes: 3,
  powerUps: true,
  difficulty: 'easy',
  graphics: 'auto',
  music: 0.6,
  sfx: 0.8,
  muted: false,
  shake: true,
  aimLine: true,
  p2keys: 'wasd',
  color: 0,
  accent: 9,
  nick: '',
  table: 'classic',
  skin: '',
};

export const SKINS: Record<string, { color: number; label: string }> = {
  gold: { color: 0xd9a520, label: 'Gold' },
  neon: { color: 0x1fd6e0, label: 'Neon' },
  ice: { color: 0xbfe8ff, label: 'Ice' },
  champion: { color: 0x34303f, label: 'Black chrome' },
};

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. — settings just won't persist */
  }
}

export const settings: Settings = loadJSON(KEY, defaults);
const listeners: Array<(s: Settings) => void> = [];

export function onSettings(cb: (s: Settings) => void): void {
  listeners.push(cb);
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  saveJSON(KEY, settings);
  for (const l of listeners) l(settings);
}

export function matchMode(s: Settings = settings): MatchMode {
  return s.matchKind === 'goals' ? { kind: 'goals', target: 7 } : { kind: 'time', seconds: s.minutes * 60 };
}
