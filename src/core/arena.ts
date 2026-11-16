// Campaign geometry: static walls, bumpers and moving bars. Pure math, shared by physics and rendering.
import { GameEvent, Mover, Puck, Seg, T } from './state';

export const WALL_W = 0.018; // half thickness of walls and bars
const WALL_E = 0.88;

export interface Pose {
  cx: number;
  cy: number;
  ang: number;
  vx: number;
  vy: number;
  w: number;
}

export function moverPose(m: Mover, t: number): Pose {
  if (m.type === 'spin') return { cx: m.x, cy: m.y, ang: m.angle + m.spin * (t + m.phase), vx: 0, vy: 0, w: m.spin };
  const a = (2 * Math.PI * (t + m.phase)) / m.period;
  const k = (1 - Math.cos(a)) / 2;
  const dk = (Math.PI / m.period) * Math.sin(a);
  return {
    cx: m.x + (m.bx - m.x) * k,
    cy: m.y + (m.by - m.y) * k,
    ang: m.angle,
    vx: (m.bx - m.x) * dk,
    vy: (m.by - m.y) * dk,
    w: 0,
  };
}

/** Collide a puck with a (possibly moving) thick segment. */
function collideCapsule(
  p: Puck, x1: number, y1: number, x2: number, y2: number,
  cx: number, cy: number, svx: number, svy: number, w: number, ev: GameEvent[],
): void {
  const ex = x2 - x1;
  const ey = y2 - y1;
  const len2 = ex * ex + ey * ey || 1e-9;
  let k = ((p.x - x1) * ex + (p.y - y1) * ey) / len2;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  const qx = x1 + ex * k;
  const qy = y1 + ey * k;
  let nx = p.x - qx;
  let ny = p.y - qy;
  const min = p.r + WALL_W;
  const d2 = nx * nx + ny * ny;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d;
  ny /= d;
  p.x = qx + nx * min;
  p.y = qy + ny * min;
  // velocity of the surface at the contact point (moving / spinning bars push the puck)
  const sx = svx - w * (qy - cy);
  const sy = svy + w * (qx - cx);
  const vn = (p.vx - sx) * nx + (p.vy - sy) * ny;
  if (vn < 0) {
    p.vx -= (1 + WALL_E) * vn * nx;
    p.vy -= (1 + WALL_E) * vn * ny;
    if (vn < -0.3) ev.push({ t: 'wall', speed: -vn, x: qx, y: qy });
  }
}

export function collideSeg(p: Puck, s: Seg, ev: GameEvent[]): void {
  collideCapsule(p, s.x1, s.y1, s.x2, s.y2, 0, 0, 0, 0, 0, ev);
}

export function collideMover(p: Puck, m: Mover, t: number, ev: GameEvent[]): void {
  const o = moverPose(m, t);
  const hx = (Math.cos(o.ang) * m.len) / 2;
  const hy = (Math.sin(o.ang) * m.len) / 2;
  collideCapsule(p, o.cx - hx, o.cy - hy, o.cx + hx, o.cy + hy, o.cx, o.cy, o.vx, o.vy, o.w, ev);
}

/** Round bumper: bounces the puck away with a little extra kick. */
export function collideBumper(p: Puck, b: { x: number; y: number; r: number }, ev: GameEvent[]): void {
  let nx = p.x - b.x;
  let ny = p.y - b.y;
  const min = p.r + b.r;
  const d2 = nx * nx + ny * ny;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d;
  ny /= d;
  p.x = b.x + nx * min;
  p.y = b.y + ny * min;
  const vn = p.vx * nx + p.vy * ny;
  if (vn < 0) {
    p.vx -= 2 * vn * nx;
    p.vy -= 2 * vn * ny;
    p.vx += nx * 0.7;
    p.vy += ny * 0.7;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > T.PUCK_MAX) {
      p.vx *= T.PUCK_MAX / sp;
      p.vy *= T.PUCK_MAX / sp;
    }
    ev.push({ t: 'wall', speed: Math.max(1.5, -vn), x: b.x + nx * b.r, y: b.y + ny * b.r });
  }
}

export const boxWalls = (minX: number, maxX: number, minY: number, maxY: number): Seg[] => [
  { x1: minX, y1: minY, x2: maxX, y2: minY },
  { x1: maxX, y1: minY, x2: maxX, y2: maxY },
  { x1: maxX, y1: maxY, x2: minX, y2: maxY },
  { x1: minX, y1: maxY, x2: minX, y2: minY },
];
