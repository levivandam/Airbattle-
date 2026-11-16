// Bot controller, built to feel like a person: it looks (with a delay), decides (state machine with a
// shot repertoire and memory), and moves its hand (speed/acceleration limits, never perfectly still).
import { goalHalf } from '../core/effects';
import { GameState, PlayerId, Puck, T } from '../core/state';
import { BotParams, MOVES, MoveId } from './botConfig';

const rnd = (a: number) => (Math.random() * 2 - 1) * a;
const range = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

type State = 'idle' | 'defend' | 'lineup' | 'strike' | 'recover';

export class Bot {
  /** how often each move was used (for tests / tuning) */
  log: Record<MoveId, number> = Object.fromEntries(MOVES.map((m) => [m, 0])) as Record<MoveId, number>;
  private state: State = 'idle';
  private stateT = 0;
  private think = 0;
  // hand (in "my" coordinates: my goal is at y = +1)
  private x = 0;
  private y = 0.75;
  private vx = 0;
  private vy = 0;
  private ready = false;
  // current plan
  private move: MoveId = 'straight';
  private aimX = 0;
  private aimY = -1;
  private realAimX = 0; // for fakes
  private power = 1;
  private wait = 0;
  private glance = 0;
  private predX = 0;
  private deflectPlan = false;
  private recent: MoveId[] = [];
  // personality state
  private wanderX = 0;
  private wanderY = 0;
  private wanderT = 0;
  private press = 0; // seconds of "leave the goal and attack" left
  private reckless = 0; // seconds of tilt after conceding twice in a row
  private concededRun = 0;
  private lastScore: [number, number] = [0, 0];
  private lean = 0; // drift toward the side the opponent scores from

  constructor(
    public me: PlayerId,
    public params: BotParams,
  ) {}

  update(s: GameState, dt: number): void {
    const m = s.mallets[this.me];
    const P = this.params;
    const f = this.me === 1 ? 1 : -1; // flip so that "my goal" is at y = +1
    const opp: PlayerId = this.me === 1 ? 0 : 1;
    m.cap = T.MALLET_MAX;
    if (!this.ready) {
      this.ready = true;
      this.x = m.x;
      this.y = m.y * f;
      this.lastScore = [s.score[0], s.score[1]];
    }

    // ---- mood: react to goals ----
    if (s.score[opp] !== this.lastScore[opp]) {
      this.concededRun++;
      if (this.concededRun >= 2) this.reckless = 10 * P.mood;
      const px = s.pucks[0]?.x ?? 0;
      this.lean = clamp(this.lean * 0.6 + Math.sign(px) * 0.05 * P.adapt, -0.09, 0.09);
    }
    if (s.score[this.me] !== this.lastScore[this.me]) this.concededRun = 0;
    this.lastScore = [s.score[0], s.score[1]];
    this.reckless = Math.max(0, this.reckless - dt);
    this.press = Math.max(0, this.press - dt);
    const tilt = this.reckless > 0;
    const lead = s.score[this.me] - s.score[opp];
    const lazy = !tilt && lead >= 3 && P.mood > 0;
    const speedMul = tilt ? 1.12 : lazy ? 1 - 0.12 * P.mood : 1;
    const mistake = P.mistake * (tilt ? 1.8 : 1);

    // ---- which puck matters most ----
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

    // ---- idle drift: never a statue ----
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = range(0.5, 1.6);
      this.wanderX = rnd(0.09) + (Math.random() < mistake ? rnd(0.16) : 0);
      this.wanderY = rnd(0.05);
    }
    const gh = goalHalf(s, this.me);
    const homeY = this.press > 0 ? 0.32 : 0.8 - P.aggression * 0.12;
    let tx = clamp(this.lean + this.wanderX, -gh * 1.4, gh * 1.4);
    let ty = homeY + this.wanderY;
    let maxV = P.speed * 0.6;

    if (puck && s.phase === 'play') {
      const px = puck.x;
      const py = puck.y * f;
      const pvx = puck.vx;
      const pvy = puck.vy * f;
      const speed = Math.hypot(pvx, pvy);
      const calmLimit = 0.8 + P.aggression * 1.2;
      const attackLine = this.press > 0 ? 0.02 : 0.85 - P.aggression * 0.8;
      const inHalf = py > 0.02;
      this.stateT += dt;

      // ---- look + decide (irregular rhythm) ----
      this.think -= dt;
      if (this.think <= 0) {
        this.think = range(P.reaction[0], P.reaction[1]) * (tilt ? 0.8 : lazy ? 1.3 : 1);
        const behind = lead < 0 || (s.mode.kind === 'time' && s.timeLeft < 30 && lead <= 0);
        if (this.state === 'idle' || this.state === 'defend') {
          if (inHalf && pvy < calmLimit && (speed < 0.6 || py > attackLine)) {
            this.planShot(s, px, py, f, mistake, tilt);
          } else if (pvy > 0.15) {
            if (this.state !== 'defend') {
              this.deflectPlan = Math.random() < P.deflect * (tilt ? 1.5 : 1);
              this.setState('defend');
            }
            const line = this.press > 0 ? 0.35 : 0.72 - P.aggression * 0.2;
            const misread = Math.random() < mistake ? rnd(0.25) : 0;
            this.predX = this.predict(px, py, pvx, pvy, line) + rnd(P.aimError) * 0.4 + misread;
          } else {
            this.setState('idle');
            // take a risk: leave the goal and press (more often when behind or tilted)
            if (this.press <= 0 && Math.random() < P.risk * (behind ? 2.2 : 1) * (tilt ? 2 : 1)) this.press = range(2, 4.5);
          }
        } else if (this.state === 'lineup') {
          if (!inHalf || pvy > calmLimit + 0.6) this.setState(pvy > 0.15 ? 'defend' : 'idle');
        }
      }

      // ---- act ----
      const gap = puck.r + m.r + 0.03;
      if (this.state === 'defend') {
        const line = this.press > 0 ? 0.35 : 0.72 - P.aggression * 0.2;
        tx = this.predX;
        ty = line;
        maxV = P.speed;
        if (py > ty) {
          tx = px;
          ty = Math.min(0.93, py + 0.1); // it got past me: fall back
        }
        if (pvy <= 0.1 && inHalf && speed < 0.6) this.think = Math.min(this.think, 0.05);
        if (this.deflectPlan && inHalf && Math.hypot(px - this.x, py - this.y) < 0.28 && py < this.y) {
          // first-time shot: hit it straight back without taking possession
          this.move = 'deflect';
          this.aimX = rnd(0.3);
          this.aimY = -1;
          this.realAimX = this.aimX;
          this.power = range(0.7, 1);
          this.glance = Math.random() < mistake ? rnd(0.05) : 0;
          this.log.deflect++;
          this.setState('strike');
        }
      } else if (this.state === 'lineup') {
        let dx = this.aimX - px;
        let dy = this.aimY - py;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d;
        dy /= d;
        const relX = this.x - px;
        const relY = this.y - py;
        const along = relX * dx + relY * dy; // < 0 means behind the puck
        const side = relX * -dy + relY * dx;
        maxV = P.speed;
        const back = gap + 0.05 + (this.stateT < this.wait ? 0.03 : 0);
        const wiggle = this.stateT < this.wait ? Math.sin(this.stateT * 6) * 0.035 : 0; // lining it up
        if (along > -0.01) {
          const sg = side >= 0 ? 1 : -1; // in front of the puck: go around, never through
          tx = px - dx * gap + -dy * sg * (gap + 0.03);
          ty = py - dy * gap + dx * sg * (gap + 0.03);
        } else {
          tx = px - dx * back + -dy * wiggle;
          ty = py - dy * back + dx * wiggle;
        }
        const set = along < -puck.r && Math.abs(side) < 0.05;
        if (this.stateT >= this.wait && (set || this.stateT > this.wait + 2.2)) {
          this.aimX = this.realAimX; // a fake switches to its real target now
          this.log[this.move]++;
          this.recent.push(this.move);
          if (this.recent.length > 3) this.recent.shift();
          this.setState('strike');
        }
      } else if (this.state === 'strike') {
        let dx = this.aimX - px;
        let dy = this.aimY - py;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d;
        dy /= d;
        tx = px + dx * 0.3 + -dy * this.glance;
        ty = py + dy * 0.3 + dx * this.glance;
        maxV = P.strike * this.power;
        const hit = puck.lastTouch === this.me && pvy < -0.2 && this.stateT > 0.05;
        if (hit || this.stateT > 0.7 || !inHalf) {
          this.wait = range(0.2, 0.55) * (lazy ? 1.5 : 1);
          this.setState('recover');
        }
      } else if (this.state === 'recover') {
        maxV = P.speed * 0.8;
        if (this.stateT > this.wait) this.setState('idle');
      } else {
        // idle: shadow the puck a little
        tx = clamp(px * 0.45 + this.lean + this.wanderX, -gh * 1.4, gh * 1.4);
        maxV = P.speed * 0.7;
      }
    } else {
      this.setState('idle');
    }

    // ---- hand motion: accelerate toward the target, like an arm would ----
    maxV *= speedMul;
    const xl = T.HW - m.r;
    tx = clamp(tx, -xl, xl);
    ty = clamp(ty, m.r, T.HL - m.r);
    let wx = (tx - this.x) * 10;
    let wy = (ty - this.y) * 10;
    const w = Math.hypot(wx, wy);
    if (w > maxV) {
      wx *= maxV / w;
      wy *= maxV / w;
    }
    const a = Math.min(1, P.accel * dt);
    this.vx += (wx - this.vx) * a;
    this.vy += (wy - this.vy) * a;
    this.x = clamp(this.x + this.vx * dt, -xl, xl);
    this.y = clamp(this.y + this.vy * dt, m.r, T.HL - m.r);
    m.tx = this.x;
    m.ty = this.y * f;
  }

  private setState(st: State): void {
    if (this.state !== st) {
      this.state = st;
      this.stateT = 0;
    }
  }

  /** Pick a move from the repertoire (avoiding recent repeats) and set up the shot. */
  private planShot(s: GameState, px: number, py: number, f: number, mistake: number, tilt: boolean): void {
    const P = this.params;
    let total = 0;
    const weights = (Object.keys(P.moves) as Array<keyof BotParams['moves']>).map((k) => {
      let w = P.moves[k];
      if (this.recent.includes(k)) w *= 0.25; // don't repeat yourself
      if (tilt && (k === 'dink' || k === 'pounce')) w *= 0.3; // no patience when tilted
      total += w;
      return [k, w] as const;
    });
    let r = Math.random() * total;
    let move: MoveId = 'straight';
    for (const [k, w] of weights) {
      r -= w;
      if (r <= 0) {
        move = k;
        break;
      }
    }
    const err = rnd(P.aimError) * 0.5;
    const sideSign = Math.random() < 0.5 ? -1 : 1;
    this.move = move;
    this.aimY = -1;
    this.power = tilt ? 1 : range(0.7, 1);
    this.wait = Math.random() < P.patience && !tilt ? range(0.3, 1.1) : 0;
    this.glance = Math.random() < mistake ? rnd(0.06) : 0;
    switch (move) {
      case 'straight':
        this.aimX = err;
        break;
      case 'bankL':
        this.aimX = -2 * T.HW + err;
        break;
      case 'bankR':
        this.aimX = 2 * T.HW + err;
        break;
      case 'double':
        this.aimX = sideSign * 4 * T.HW + err;
        break;
      case 'dink':
        this.aimX = sideSign * 0.12 + err;
        this.power = range(0.3, 0.45);
        break;
      case 'pounce':
        this.aimX = err;
        this.wait = range(0.6, 1.5);
        this.power = 1;
        break;
      case 'fake':
        this.aimX = sideSign * 2 * T.HW; // shows a bank shot…
        this.wait = Math.max(this.wait, range(0.35, 0.8));
        break;
    }
    this.realAimX = move === 'fake' ? -sideSign * 0.1 + err : this.aimX; // …then goes the other way
    if (s.token && Math.random() < P.powerSeek && s.token.y * f < py) {
      this.aimX = this.realAimX = s.token.x;
      this.aimY = s.token.y * f;
    }
    void px;
    this.setState('lineup');
  }

  /** x where the puck crosses y = line (my-side coordinates), with limited bounce prediction. */
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
    return clamp(x, -lim, lim);
  }
}
