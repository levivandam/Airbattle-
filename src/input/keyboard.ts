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
