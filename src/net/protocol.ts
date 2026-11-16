// Messages exchanged between host (authoritative, player 0) and guest (player 1).
import { GameEvent, GameState, MatchMode } from '../core/state';

export const PROTOCOL = 1;

export interface NetConfig {
  mode: MatchMode;
  powerUps: boolean;
}

export type HostMsg =
  | { t: 'hello'; v: number; color: number; nick?: string }
  | { t: 'start'; config: NetConfig; color: number }
  | { t: 'snap'; q: number; s: GameState; e: Array<[number, GameEvent]>; ht: number; pe: number }
  | { t: 'bye' };

export type GuestMsg =
  | { t: 'hi'; v: number; color: number; nick?: string }
  | { t: 'in'; x: number; y: number; pt: number; he: number; ae: number }
  | { t: 'rematch' }
  | { t: 'bye' };

export type Msg = HostMsg | GuestMsg;
