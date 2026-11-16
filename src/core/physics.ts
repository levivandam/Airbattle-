// 2D table physics: circles vs walls / mallets / goal posts. No rendering imports.
import {
  goalHalf,
  hasShield,
  hitMul,
  isFrozen,
  isIcy,
  isReversed,
  malletMax,
  malletRadius,
  removeEffect,
} from './effects';
import { collideBumper, collideMover, collideSeg } from './arena';
import { GameEvent, GameState, Mallet, PlayerId, Puck, T } from './state';

const WALL_E = 0.9;
const MALLET_E = 0.62;
const DRAG = 0.5; // per second, very light (air table)
const HIT_SMOOTH = 0.35; // hit strength uses the mallet velocity averaged over ~3 ticks

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function moveMallet(s: GameState, p: PlayerId, dt: number): void {
  const m = s.mallets[p];
  const A = s.arena;
  if (A && A.solo && p === 1) {
    m.x = m.px = 0; // no opponent: park the mallet far away
    m.y = m.py = 99;
    m.vx = m.vy = 0;
    return;
  }
  m.px = m.x;
  m.py = m.y;
  const rTarget = malletRadius(s, p);
  m.r += (rTarget - m.r) * Math.min(1, dt * 12);

  if (isFrozen(s, p)) {
    m.vx = 0;
    m.vy = 0;
    return;
  }
  // where this mallet may go: own half of the table, or the level's zone
  const Z = A && A.zone && p === 0 ? A.zone : null;
  const x0 = (Z ? Z[0] : -T.HW) + m.r;
  const x1 = (Z ? Z[1] : T.HW) - m.r;
  const y0 = Z ? Z[2] + m.r : p === 0 ? -(T.HL - m.r) : m.r;
  const y1 = Z ? Z[3] - m.r : p === 0 ? -m.r : T.HL - m.r;
  let tx = isReversed(s, p) ? -m.tx : m.tx;
  tx = clamp(tx, x0, x1);
  const ty = clamp(m.ty, y0, y1);

  const max = malletMax(s, p);
  let nvx: number;
  let nvy: number;
  if (isIcy(s, p)) {
    // slippery: steer the velocity instead of the position
    const k = 1 - Math.exp(-dt * 3.2);
    const wantX = clamp((tx - m.x) * 6, -max, max);
    const wantY = clamp((ty - m.y) * 6, -max, max);
    nvx = m.vx + (wantX - m.vx) * k;
    nvy = m.vy + (wantY - m.vy) * k;
  } else {
    // 1:1 — go straight to the target this tick (no smoothing, no lag)
    nvx = (tx - m.x) / dt;
    nvy = (ty - m.y) / dt;
  }
  const sp = Math.hypot(nvx, nvy);
  if (sp > max) {
    nvx *= max / sp;
    nvy *= max / sp;
  }
  let nx = m.x + nvx * dt;
  let ny = m.y + nvy * dt;
  // stay on the table and on your own half
  const cx = clamp(nx, x0, x1);
  const cy = clamp(ny, y0, y1);
  if (cx !== nx) nvx = 0;
  if (cy !== ny) nvy = 0;
  nx = cx;
  ny = cy;
  if (isIcy(s, p)) {
    m.vx = nvx;
    m.vy = nvy;
  } else {
    // pointer events arrive in bursts; average so a flick gives a steady, strong hit
    m.vx += (nvx - m.vx) * HIT_SMOOTH;
    m.vy += (nvy - m.vy) * HIT_SMOOTH;
  }
  m.x = nx;
  m.y = ny;
}

function capSpeed(p: Puck, max: number): void {
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > max) {
    p.vx *= max / sp;
    p.vy *= max / sp;
  }
}

function collideMallet(s: GameState, p: Puck, m: Mallet, mx: number, my: number, who: PlayerId, ev: GameEvent[]): void {
  const dx = p.x - mx;
  const dy = p.y - my;
  const min = p.r + m.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 1e-6;
  const nx = dx / d;
  const ny = dy / d;
  p.x = mx + nx * min;
  p.y = my + ny * min;
  const rvx = p.vx - m.vx;
  const rvy = p.vy - m.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    p.vx -= (1 + MALLET_E) * vn * nx;
    p.vy -= (1 + MALLET_E) * vn * ny;
    const mul = hitMul(s, who);
    const impact = -vn;
    if (mul > 1 && impact > 0.4) {
      p.vx *= mul;
      p.vy *= mul;
      p.hot = 1.2;
    }
    const fast = s.effects.find((e) => e.type === 'fast');
    if (fast && impact > 0.4) fast.n = Math.min(fast.n + 1, 8);
    const boost = 1 + (fast ? fast.n * 0.05 : 0);
    capSpeed(p, T.PUCK_MAX * (p.hot > 0 ? 1.3 : 1) * boost);
    if (impact > 0.25) {
      const speed = Math.hypot(p.vx, p.vy);
      ev.push({ t: 'hit', player: who, speed, x: p.x, y: p.y });
      if (speed > s.stats.maxSpeed[who]) s.stats.maxSpeed[who] = speed;
    }
  }
  p.lastTouch = who;
}

function collidePost(p: Puck, qx: number, qy: number, ev: GameEvent[]): void {
  const dx = p.x - qx;
  const dy = p.y - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= p.r * p.r) return;
  const d = Math.sqrt(d2) || 1e-6;
  const nx = dx / d;
  const ny = dy / d;
  p.x = qx + nx * p.r;
  p.y = qy + ny * p.r;
  const vn = p.vx * nx + p.vy * ny;
  if (vn < 0) {
    p.vx -= (1 + WALL_E) * vn * nx;
    p.vy -= (1 + WALL_E) * vn * ny;
    if (vn < -0.3) ev.push({ t: 'wall', speed: -vn, x: p.x, y: p.y });
  }
}

/** Advance one puck. Returns the side (0/1) whose goal it entered, or -1. */
export function stepPuck(s: GameState, p: Puck, dt: number, ev: GameEvent[]): -1 | PlayerId {
  p.px = p.x;
  p.py = p.y;
  if (p.hot > 0) p.hot -= dt;
  const damp = Math.exp(-DRAG * dt);
  p.vx *= damp;
  p.vy *= damp;

  // swept collision: sub-step so that neither the puck nor a fast mallet moves more than half a puck radius at once
  let reach = Math.hypot(p.vx, p.vy) * dt;
  for (const m of s.mallets) reach = Math.max(reach, Math.hypot(m.x - m.px, m.y - m.py));
  const SUB = Math.max(2, Math.min(24, Math.ceil(reach / (p.r * 0.5))));
  const h = dt / SUB;
  for (let k = 1; k <= SUB; k++) {
    p.x += p.vx * h;
    p.y += p.vy * h;
    const f = k / SUB;
    for (let i = 0 as PlayerId; i < 2; i = (i + 1) as PlayerId) {
      const m = s.mallets[i];
      collideMallet(s, p, m, m.px + (m.x - m.px) * f, m.py + (m.y - m.py) * f, i, ev);
    }
    const A = s.arena;
    if (A) {
      const tm = s.time - dt + h * k;
      for (const w of A.walls) collideSeg(p, w, ev);
      for (const b of A.bumpers) collideBumper(p, b, ev);
      for (const mv of A.movers) collideMover(p, mv, tm, ev);
      if (A.custom) continue; // own shape: no standard walls or goals
    }
    // side walls
    const xl = T.HW - p.r;
    if (p.x > xl) {
      p.x = xl;
      if (p.vx > 0) {
        if (p.vx > 0.3) ev.push({ t: 'wall', speed: p.vx, x: T.HW, y: p.y });
        p.vx = -p.vx * WALL_E;
      }
    } else if (p.x < -xl) {
      p.x = -xl;
      if (p.vx < 0) {
        if (p.vx < -0.3) ev.push({ t: 'wall', speed: -p.vx, x: -T.HW, y: p.y });
        p.vx = -p.vx * WALL_E;
      }
    }
    // end walls, goals and shields
    const sgn = p.y < 0 ? -1 : 1;
    const side: PlayerId = sgn < 0 ? 0 : 1;
    const ay = Math.abs(p.y);
    const gh = goalHalf(s, side);
    if (hasShield(s, side) && p.vy * sgn > 0) {
      const line = T.HL - T.SHIELD_INSET;
      if (ay + p.r > line && ay < line + 0.02 && Math.abs(p.x) < gh + 0.05 + p.r) {
        p.y = sgn * (line - p.r);
        p.vy = -p.vy * WALL_E;
        removeEffect(s, 'shield', side);
        ev.push({ t: 'block', x: p.x, y: sgn * line });
        ev.push({ t: 'expire', type: 'shield', player: side });
        continue;
      }
    }
    if (ay > T.HL - p.r) {
      if (Math.abs(p.x) < gh) {
        collidePost(p, gh, sgn * T.HL, ev);
        collidePost(p, -gh, sgn * T.HL, ev);
        if (Math.abs(p.y) > T.HL + p.r * 0.6) return side;
      } else {
        p.y = sgn * (T.HL - p.r);
        if (p.vy * sgn > 0) {
          if (Math.abs(p.vy) > 0.3) ev.push({ t: 'wall', speed: Math.abs(p.vy), x: p.x, y: sgn * T.HL });
          p.vy = -p.vy * WALL_E;
        }
      }
    }
  }
  // A mallet may have squeezed the puck into a wall: push the mallet back instead.
  for (let i = 0; i < 2; i++) {
    const m = s.mallets[i];
    const dx = m.x - p.x;
    const dy = m.y - p.y;
    const min = p.r + m.r;
    const d = Math.hypot(dx, dy);
    if (d < min - 1e-4 && d > 1e-6) {
      m.x = p.x + (dx / d) * min;
      m.y = p.y + (dy / d) * min;
    }
  }
  return -1;
}

/** Elastic equal-mass collisions between pucks (Multi-Puck). */
export function collidePucks(pucks: Puck[]): void {
  for (let i = 0; i < pucks.length; i++) {
    for (let j = i + 1; j < pucks.length; j++) {
      const a = pucks[i];
      const b = pucks[j];
      if (a.scored || b.scored) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      const d = Math.hypot(dx, dy);
      if (d >= min || d < 1e-6) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        a.vx += vn * nx;
        a.vy += vn * ny;
        b.vx -= vn * nx;
        b.vy -= vn * ny;
      }
    }
  }
}

/** Puck drifting inside the goal pocket after scoring (visual only). */
export function driftScored(p: Puck, dt: number): void {
  p.px = p.x;
  p.py = p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const lim = T.HL + 0.1;
  if (Math.abs(p.y) > lim) {
    p.y = Math.sign(p.y) * lim;
    p.vx = 0;
    p.vy = 0;
  }
  p.vx *= 0.94;
  p.vy *= 0.94;
}
