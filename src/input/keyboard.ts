// Keyboard control for a mallet (local player 2 on a laptop), with inertia so it feels fair.
import { GameState, PlayerId, T } from '../core/state';
import { settings } from '../storage/settings';

const down = new Set<string>();
window.addEventListener('keydown', (e) => down.add(e.code));
window.addEventListener('keyup', (e) => down.delete(e.code));
window.addEventListener('blur', () => down.clear());

const LAYOUT = {
  wasd: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  arrows: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
};

export class KeyboardController {
  private vx = 0;
  private vy = 0;
  private x = 0;
  private y = 0;
  private active = false;
  constructor(private me: PlayerId) {}

  update(s: GameState, dt: number): void {
    const k = LAYOUT[settings.p2keys];
    const ix = (down.has(k.right) ? 1 : 0) - (down.has(k.left) ? 1 : 0);
    const iy = (down.has(k.up) ? 1 : 0) - (down.has(k.down) ? 1 : 0);
    const m = s.mallets[this.me];
    if (!this.active) {
      if (!ix && !iy) return;
      this.active = true;
      this.x = m.x;
      this.y = m.y;
    }
    const MAX = 2.9;
    const ACC = 22;
    const len = Math.hypot(ix, iy) || 1;
    const wx = (ix / len) * MAX;
    const wy = (iy / len) * MAX;
    const a = Math.min(1, (ACC * dt) / MAX);
    this.vx += (wx - this.vx) * a * (ix ? 1 : 1.6);
    this.vy += (wy - this.vy) * a * (iy ? 1 : 1.6);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // keep the virtual target on the player's own half so it never "winds up" off the table
    const xl = T.HW - m.r;
    if (this.x > xl) { this.x = xl; this.vx = 0; }
    if (this.x < -xl) { this.x = -xl; this.vx = 0; }
    const lo = this.me === 0 ? -(T.HL - m.r) : m.r;
    const hi = this.me === 0 ? -m.r : T.HL - m.r;
    if (this.y > hi) { this.y = hi; this.vy = 0; }
    if (this.y < lo) { this.y = lo; this.vy = 0; }
    m.cap = T.MALLET_MAX;
    m.tx = this.x;
    m.ty = this.y;
  }
}

// ---------- solo keyboard play (W A S D or arrows, Shift/Space = dash) ----------
const SOLO = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  dash: ['ShiftLeft', 'ShiftRight', 'Space'],
};
const any = (codes: string[]) => codes.some((c) => down.has(c));
window.addEventListener('keydown', (e) => {
  // keep the page from scrolling while steering
  if ((e.code.startsWith('Arrow') || e.code === 'Space') && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) e.preventDefault();
});

export interface SoloTargets {
  targets: [{ x: number; y: number } | null, { x: number; y: number } | null];
  source: 'pointer' | 'keys';
}

/** Lets a single player steer with the keyboard. Whichever input was used last (mouse or keys) is in control. */
export class SoloKeys {
  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private dash = 0;
  /** 0 = dash ready … 1 = just used */
  cooldown = 0;
  private dashHeld = false;
  private held = 0; // how long a direction has been held: tap = slow and precise, hold = faster
  static readonly SPEED = 3.0;
  static readonly SLOW = 1.1;
  static readonly RAMP = 0.45; // seconds from slow to full speed
  static readonly DASH_MUL = 2.2;
  static readonly DASH_TIME = 0.15;
  static readonly DASH_COOLDOWN = 0.6;

  update(s: GameState, me: PlayerId, input: SoloTargets, dt: number): void {
    const flip = me === 1 ? -1 : 1; // the guest's camera is rotated 180°
    const ix = ((any(SOLO.right) ? 1 : 0) - (any(SOLO.left) ? 1 : 0)) * flip;
    const iy = ((any(SOLO.up) ? 1 : 0) - (any(SOLO.down) ? 1 : 0)) * flip;
    const m = s.mallets[me];
    if (input.source !== 'keys') {
      if (!ix && !iy) return;
      input.source = 'keys';
      this.x = m.x;
      this.y = m.y;
      this.vx = this.vy = 0;
    }
    this.cooldown = Math.max(0, this.cooldown - dt / SoloKeys.DASH_COOLDOWN);
    const wantDash = any(SOLO.dash);
    if (wantDash && !this.dashHeld && this.cooldown <= 0 && (ix || iy)) {
      this.dash = SoloKeys.DASH_TIME;
      this.cooldown = 1;
    }
    this.dashHeld = wantDash;
    this.dash = Math.max(0, this.dash - dt);
    this.held = ix || iy ? this.held + dt : 0;
    const ramp = SoloKeys.SLOW + (SoloKeys.SPEED - SoloKeys.SLOW) * Math.min(1, this.held / SoloKeys.RAMP);
    const max = this.dash > 0 ? SoloKeys.SPEED * SoloKeys.DASH_MUL : ramp;
    const len = Math.hypot(ix, iy) || 1;
    // near-instant start and stop
    const k = Math.min(1, dt * (ix || iy ? 40 : 28));
    this.vx += ((ix / len) * max - this.vx) * k;
    this.vy += ((iy / len) * max - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const Z = s.arena && s.arena.zone && me === 0 ? s.arena.zone : null;
    const xlo = (Z ? Z[0] : -T.HW) + m.r;
    const xhi = (Z ? Z[1] : T.HW) - m.r;
    const lo = Z ? Z[2] + m.r : me === 0 ? -(T.HL - m.r) : m.r;
    const hi = Z ? Z[3] - m.r : me === 0 ? -m.r : T.HL - m.r;
    if (this.x > xhi) { this.x = xhi; this.vx = 0; }
    if (this.x < xlo) { this.x = xlo; this.vx = 0; }
    if (this.y > hi) { this.y = hi; this.vy = 0; }
    if (this.y < lo) { this.y = lo; this.vy = 0; }
    input.targets[me] = { x: this.x, y: this.y };
  }
}
