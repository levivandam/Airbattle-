// In-match HUD: scoreboard, clock, banners.
import { DEFS } from '../core/powerups';
import { GameEvent, GameState, PlayerId } from '../core/state';
import { hex } from '../storage/settings';
import { el, root } from './dom';

export interface HudOptions {
  names: [string, string]; // [left, right] = [local player, opponent]
  colors: [string, string];
  local: PlayerId;
  split: boolean; // two players on one touch screen: mirror banners for the top player
}

interface Board {
  node: HTMLElement;
  digits: [HTMLElement, HTMLElement];
  names: [HTMLElement, HTMLElement];
  clock: HTMLElement;
  view: PlayerId; // whose point of view (own score on the left)
}

function makeBoard(view: PlayerId, cls: string): Board {
  const node = el('div', 'board ' + cls);
  const digits: [HTMLElement, HTMLElement] = [el('div', 'digits', '0'), el('div', 'digits', '0')];
  const names: [HTMLElement, HTMLElement] = [el('div', 'name'), el('div', 'name')];
  const clock = el('div', 'clock');
  node.append(names[0], digits[0], el('div', 'sep', ':'), digits[1], names[1], clock);
  return { node, digits, names, clock, view };
}

export class Hud {
  readonly node = el('div', 'hud');
  private boards: Board[] = [];
  private banners: HTMLElement[] = [];
  readonly cornerRight = el('div', 'corner right');
  readonly cornerLeft = el('div', 'corner left');
  readonly fx = el('div', 'fx');
  private opts: HudOptions = { names: ['YOU', 'BOT'], colors: ['#d3352b', '#2a5bc7'], local: 0, split: false };
  private lastClock = '';
  private fxRows: [HTMLElement, HTMLElement] = [el('div', 'fxrow mine'), el('div', 'fxrow theirs')];
  private fxSig = '';
  private chips: Array<{ node: HTMLElement; i: number }> = [];

  constructor() {
    this.fx.append(this.fxRows[0], this.fxRows[1]);
    const b1 = el('div', 'banner');
    const b2 = el('div', 'banner rot');
    this.banners = [b1, b2];
    this.node.append(b1, b2, this.fx, this.cornerLeft, this.cornerRight);
    this.node.style.display = 'none';
    root().append(this.node);
  }

  show(o: HudOptions): void {
    this.opts = o;
    this.node.style.display = '';
    for (const b of this.boards) b.node.remove();
    this.boards = o.split ? [makeBoard(0, 'near'), makeBoard(1, 'far')] : [makeBoard(o.local, '')];
    this.lastClock = '';
    for (const b of this.boards) {
      // o.names / o.colors are given as [local player, opponent]
      const idx = (who: PlayerId) => (who === o.local ? 0 : 1);
      const them: PlayerId = b.view === 0 ? 1 : 0;
      const fill = (n: HTMLElement, who: PlayerId, dotFirst: boolean) => {
        const dot = el('span', 'dot');
        dot.style.setProperty('--c', o.colors[idx(who)]);
        const label = o.split ? (who === b.view ? 'YOU' : 'THEM') : o.names[idx(who)];
        if (dotFirst) n.append(dot, label);
        else n.append(label, dot);
      };
      fill(b.names[0], b.view, true);
      fill(b.names[1], them, false);
      this.node.prepend(b.node);
    }
    this.fxRows[1].classList.toggle('rot', o.split);
    this.fxSig = '?';
    this.banners[0].style.top = o.split ? '72%' : '50%';
    this.banners[1].style.top = '28%';
    this.banners[1].style.display = o.split ? '' : 'none';
    for (const b of this.banners) b.classList.remove('show');
  }

  hide(): void {
    this.node.style.display = 'none';
  }

  banner(text: string, cls = '', small = false): void {
    for (const b of this.banners) {
      b.className = 'banner ' + cls + (small ? ' small' : '') + (b === this.banners[1] ? ' rot' : '');
      b.textContent = text;
      void b.offsetWidth; // restart the animation
      b.classList.add('show');
    }
  }

  update(s: GameState): void {
    let c = '';
    if (s.golden) c = 'GOLDEN GOAL';
    else if (s.mode.kind === 'time') {
      const t = Math.ceil(s.timeLeft);
      c = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    } else c = 'FIRST TO ' + s.mode.target;
    this.updateFx(s);
    const clockChanged = c !== this.lastClock;
    this.lastClock = c;
    for (const b of this.boards) {
      const left = String(s.score[b.view]);
      const right = String(s.score[b.view === 0 ? 1 : 0]);
      if (b.digits[0].textContent !== left) b.digits[0].textContent = left;
      if (b.digits[1].textContent !== right) b.digits[1].textContent = right;
      if (clockChanged) {
        b.clock.textContent = c;
        b.clock.classList.toggle('hot', s.golden || (s.mode.kind === 'time' && s.timeLeft <= 30));
      }
    }
  }

  /** Active power-up chips with a countdown ring. */
  private updateFx(s: GameState): void {
    const mineId: PlayerId = this.opts.split ? 0 : this.opts.local;
    const sig = s.effects.map((e) => e.type + e.owner).join(',');
    if (sig !== this.fxSig) {
      this.fxSig = sig;
      this.fxRows[0].replaceChildren();
      this.fxRows[1].replaceChildren();
      this.chips = s.effects.map((e, i) => {
        const d = DEFS[e.type];
        const node = el('div', 'chip', '', { title: d.name });
        node.style.setProperty('--c', hex(d.color));
        node.append(el('span', '', d.icon));
        this.fxRows[e.owner === mineId ? 0 : 1].append(node);
        return { node, i };
      });
    }
    for (const c of this.chips) {
      const e = s.effects[c.i];
      if (e) c.node.style.setProperty('--p', String(Math.max(0, e.timeLeft / e.total)));
    }
  }

  onEvent(e: GameEvent, s: GameState): void {
    const l = this.opts.local;
    const colorOf = (p: PlayerId) => (p === l ? 'red' : 'blue');
    switch (e.t) {
      case 'count':
        this.banner(String(e.n), 'amber');
        break;
      case 'go':
        this.banner('GO!', 'amber');
        break;
      case 'goal':
        this.banner('GOAL!', colorOf(e.scorer));
        for (const b of this.boards) {
          b.node.classList.remove('bump');
          void b.node.offsetWidth;
          b.node.classList.add('bump');
        }
        break;
      case 'matchpoint':
        setTimeout(() => this.banner('MATCH POINT', 'amber', true), 1150);
        break;
      case 'pickup':
        this.banner(DEFS[e.type].name.toUpperCase() + '!', colorOf(e.player), true);
        break;
      case 'golden':
        this.banner('GOLDEN GOAL', 'amber', true);
        break;
    }
    void s;
  }
}

export function toast(text: string): void {
  const t = el('div', 'toast', text);
  root().append(t);
  setTimeout(() => t.remove(), 3300);
}
