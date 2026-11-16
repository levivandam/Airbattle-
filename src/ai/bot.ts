// Bot controller: reads the game state, sets its mallet target. Works for either side.
import { goalHalf } from '../core/effects';
import { GameState, PlayerId, Puck, T } from '../core/state';
import { BotParams } from './botConfig';

const rnd = (a: number) => (Math.random() * 2 - 1) * a;

export class Bot {
  private timer = 0;
  private aimX = 0;
  private aimY = -1;
  private predX = 0;
  private err = 0;

  constructor(
    public me: PlayerId,
    public params: BotParams,
  ) {}

  update(s: GameState, dt: number): void {
    const m = s.mallets[this.me];
    const P = this.params;
    m.cap = P.speed;
    const f = this.me === 1 ? 1 : -1; // flip so that "my goal" is at y = +1
    const mx = m.x;
    const my = m.y * f;

    // pick the most dangerous puck
    let puck: Puck | null = null;
    let best = -Infinity;
    for (const p of s.pucks) {
      if (p.scored) continue;
      const danger = p.y * f + Math.max(0, p.vy * f) * 0.4;
      if (danger > best) {
        best = danger;
        puck = p;
      }
    }
    if (!puck || s.phase !== 'play') {
      m.tx = 0;
      m.ty = 0.75 * f;
      return;
    }
    const px = puck.x;
    const py = puck.y * f;
    const vx = puck.vx;
    const vy = puck.vy * f;
    const speed = Math.hypot(vx, vy);

    this.timer -= dt;
    const decide = this.timer <= 0;
    if (decide) {
      this.timer = P.reaction * (0.7 + Math.random() * 0.6);
      this.err = rnd(P.aimError) + (Math.random() < P.mistake ? rnd(0.3) : 0);
      // where do I want to shoot?
      this.aimX = this.err * 0.5;
      this.aimY = -1;
      if (Math.random() < P.bank) this.aimX = (px > 0 ? -1 : 1) * 2 * T.HW + this.err * 0.5;
      if (s.token && Math.random() < P.powerSeek && s.token.y * f < py) {
        this.aimX = s.token.x;
        this.aimY = s.token.y * f;
      }
      this.predX = this.predict(px, py, vx, vy, 0.72 - P.aggression * 0.2) + this.err * 0.4;
    }

    const attackLine = 0.85 - P.aggression * 0.8;
    const inMyHalf = py > 0.01;
    const calm = vy < 0.9 + P.aggression * 1.2;
    let tx: number;
    let ty: number;
    if (inMyHalf && calm && (speed < 0.6 || py > attackLine)) {
      // attack: get behind the puck, then drive through it toward the aim point
      let dx = this.aimX - px;
      let dy = this.aimY - py;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const gap = puck.r + m.r + 0.025;
      const relX = mx - px;
      const relY = my - py;
      const along = relX * dx + relY * dy; // < 0 means behind the puck
      const side = relX * -dy + relY * dx; // lateral offset from the shot line
      if (along < -puck.r && Math.abs(side) < 0.035) {
        tx = px + dx * 0.3;
        ty = py + dy * 0.3;
      } else if (along > -0.01) {
        // in front of the puck: go around it, never through it
        const sg = side >= 0 ? 1 : -1;
        tx = px - dx * gap + -dy * sg * (gap + 0.03);
        ty = py - dy * gap + dx * sg * (gap + 0.03);
      } else {
        tx = px - dx * gap;
        ty = py - dy * gap;
      }
    } else if (vy > 0.15) {
      // defend: move to where the puck will arrive
      tx = this.predX;
      ty = 0.72 - P.aggression * 0.2;
      if (py > ty) ty = Math.min(0.92, py + 0.1); // puck already past me: fall back
    } else {
      const gh = goalHalf(s, this.me);
      tx = Math.max(-gh, Math.min(gh, px * 0.5));
      ty = 0.78;
    }
    m.tx = tx;
    m.ty = ty * f;
  }

  /** x position where the puck crosses y = line (my-side coordinates), with limited bounce prediction. */
  private predict(px: number, py: number, vx: number, vy: number, line: number): number {
    if (vy <= 0.05 || py >= line) return px;
    const t = (line - py) / vy;
    let x = px + vx * t;
    const lim = T.HW - T.PUCK_R;
    let bounces = 0;
    while ((x > lim || x < -lim) && bounces < this.params.bounces) {
      x = x > lim ? 2 * lim - x : -2 * lim - x;
      bounces++;
    }
    return Math.max(-lim, Math.min(lim, x));
  }
}
