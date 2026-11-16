// In-match HUD: scoreboard, clock, banners.
import { GameEvent, GameState, PlayerId } from '../core/state';
import { el, root } from './dom';

export interface HudOptions {
  names: [string, string]; // [left, right] = [local player, opponent]
  colors: [string, string];
  local: PlayerId;
  split: boolean; // two players on one touch screen: mirror banners for the top player
}

export class Hud {
  readonly node = el('div', 'hud');
  private board = el('div', 'board');
  private digits: [HTMLElement, HTMLElement];
  private clock = el('div', 'clock');
  private banners: HTMLElement[] = [];
  readonly cornerRight = el('div', 'corner right');
  readonly cornerLeft = el('div', 'corner left');
  private opts: HudOptions = { names: ['YOU', 'BOT'], colors: ['#d3352b', '#2a5bc7'], local: 0, split: false };
  private lastClock = '';

  constructor() {
    const mk = (i: number) => {
      const name = el('div', 'name');
      name.dataset.i = String(i);
      return name;
    };
    const d0 = el('div', 'digits', '0');
    const d1 = el('div', 'digits', '0');
    this.digits = [d0, d1];
    this.board.append(mk(0), d0, el('div', 'sep', ':'), d1, mk(1), this.clock);
    const b1 = el('div', 'banner');
    const b2 = el('div', 'banner rot');
    this.banners = [b1, b2];
    this.node.append(this.board, b1, b2, this.cornerLeft, this.cornerRight);
    this.node.style.display = 'none';
    root().append(this.node);
  }

  show(o: HudOptions): void {
    this.opts = o;
    this.node.style.display = '';
    this.board.querySelectorAll<HTMLElement>('.name').forEach((n) => {
      const i = Number(n.dataset.i);
      n.replaceChildren();
      const dot = el('span', 'dot');
      dot.style.setProperty('--c', o.colors[i]);
      if (i === 0) n.append(dot, o.names[0]);
      else n.append(o.names[1], dot);
    });
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
    const l = this.opts.local;
    const left = String(s.score[l]);
    const right = String(s.score[l === 0 ? 1 : 0]);
    if (this.digits[0].textContent !== left) this.digits[0].textContent = left;
    if (this.digits[1].textContent !== right) this.digits[1].textContent = right;
    let c = '';
    if (s.golden) c = 'GOLDEN GOAL';
    else if (s.mode.kind === 'time') {
      const t = Math.ceil(s.timeLeft);
      c = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    } else c = 'FIRST TO ' + s.mode.target;
    if (c !== this.lastClock) {
      this.lastClock = c;
      this.clock.textContent = c;
      this.clock.classList.toggle('hot', s.golden || (s.mode.kind === 'time' && s.timeLeft <= 30));
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
        this.board.classList.remove('bump');
        void this.board.offsetWidth;
        this.board.classList.add('bump');
        break;
      case 'matchpoint':
        setTimeout(() => this.banner('MATCH POINT', 'amber', true), 1150);
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
