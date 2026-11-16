// Game controller: owns the state, the fixed-step loop and the per-player controllers.
import { Bot } from './ai/bot';
import { BOT, Difficulty, adaptiveSkill, blendParams } from './ai/botConfig';
import { step } from './core/sim';
import { Arena, GameEvent, GameState, MatchMode, PlayerId, PowerUpType, T, createState } from './core/state';
import { SoloKeys } from './input/keyboard';
import { PointerInput } from './input/pointer';
import { View } from './render/view';

export type MatchKind = 'attract' | 'bot' | 'local' | 'host' | 'guest' | 'campaign';

export interface MatchConfig {
  kind: MatchKind;
  difficulty: Difficulty;
  mode: MatchMode;
  powerUps: boolean;
  enabledTypes: PowerUpType[];
  /** campaign: level geometry, and whether there is a bot opponent */
  arena?: Arena | null;
  withBot?: boolean;
  /** optional overrides for the bot (campaign bosses) */
  botParams?: Partial<import('./ai/botConfig').BotParams>;
}

/** Something that sets a mallet target every tick. */
export interface Controller {
  update(s: GameState, dt: number): void;
}

class HumanPointer implements Controller {
  constructor(
    private input: PointerInput,
    private me: PlayerId,
    private ticksLeft: () => number,
  ) {}
  update(s: GameState): void {
    const t = this.input.targets[this.me];
    const m = s.mallets[this.me];
    m.cap = T.MALLET_MAX;
    if (t) {
      // The pointer updates once per screen frame, the physics runs 2+ ticks per frame.
      // Spread the movement evenly over this frame's ticks: smooth motion and steady hit speed.
      const n = Math.max(1, this.ticksLeft());
      m.tx += (t.x - m.tx) / n;
      m.ty += (t.y - m.ty) / n;
    }
  }
}

export class Game {
  state!: GameState;
  config!: MatchConfig;
  controllers: Controller[] = [];
  paused = false;
  timeScale = 1;
  /** which player the person at this device is (camera + "you win") */
  local: PlayerId = 0;
  private acc = 0;
  /** ticks still to run in the current frame (used to spread pointer movement) */
  private left = 1;
  private readonly ticksLeft = () => this.left;
  private last = 0;
  private events: GameEvent[] = [];
  private listeners: Array<(e: GameEvent, s: GameState) => void> = [];
  private frameListeners: Array<(s: GameState, dt: number) => void> = [];
  /** optional override that produces the state instead of the local simulation (online guest) */
  external: ((dt: number) => void) | null = null;
  /** called after every simulated tick (online host sends snapshots) */
  afterTick: ((s: GameState, ev: GameEvent[]) => void) | null = null;
  private bot: Bot | null = null;
  readonly solo = new SoloKeys();

  constructor(
    readonly view: View,
    readonly input: PointerInput,
  ) {
    requestAnimationFrame((t) => this.frame(t));
  }

  onEvent(cb: (e: GameEvent, s: GameState) => void): void {
    this.listeners.push(cb);
  }
  onFrame(cb: (s: GameState, dt: number) => void): void {
    this.frameListeners.push(cb);
  }
  emit(e: GameEvent): void {
    for (const l of this.listeners) l(e, this.state);
  }

  start(config: MatchConfig, extra: Controller[] = []): void {
    this.config = config;
    this.state = createState({ mode: config.mode, powerUps: config.powerUps, enabledTypes: config.enabledTypes, arena: config.arena });
    this.paused = false;
    this.timeScale = 1;
    this.acc = 0;
    this.external = null;
    this.afterTick = null;
    this.bot = null;
    this.input.reset();
    this.input.mode = config.kind === 'local' ? 'split' : 'single';
    this.local = config.kind === 'guest' ? 1 : 0;
    this.input.local = this.local;
    this.input.enabled = config.kind !== 'attract';
    this.view.direct = config.kind === 'attract' ? [false, false] : config.kind === 'local' ? [true, true] : [this.local === 0, this.local === 1];
    switch (config.kind) {
      case 'attract':
        this.state.phase = 'play';
        this.controllers = [new Bot(0, BOT.normal), new Bot(1, BOT.normal)];
        break;
      case 'bot': {
        const params = { ...(config.difficulty === 'adaptive' ? blendParams(adaptiveSkill(0, 0)) : BOT[config.difficulty]) };
        if (config.botParams) Object.assign(params, config.botParams);
        this.bot = new Bot(1, params);
        this.controllers = [new HumanPointer(this.input, 0, this.ticksLeft), this.bot];
        break;
      }
      case 'campaign': {
        this.controllers = [new HumanPointer(this.input, 0, this.ticksLeft)];
        if (config.withBot) {
          const lvl = config.difficulty === 'adaptive' ? 'normal' : config.difficulty;
          this.bot = new Bot(1, { ...BOT[lvl], ...(config.botParams ?? {}) });
          this.controllers.push(this.bot);
        }
        break;
      }
      case 'local':
        this.controllers = [new HumanPointer(this.input, 0, this.ticksLeft), new HumanPointer(this.input, 1, this.ticksLeft), ...extra];
        break;
      case 'host':
        this.controllers = [new HumanPointer(this.input, 0, this.ticksLeft), ...extra];
        break;
      case 'guest':
        this.controllers = [new HumanPointer(this.input, 1, this.ticksLeft), ...extra];
        break;
    }
  }

  private tick(): void {
    const s = this.state;
    for (const c of this.controllers) c.update(s, T.DT);
    this.events.length = 0;
    step(s, this.events);
    if (this.afterTick) this.afterTick(s, this.events);
    for (const e of this.events) {
      if (e.t === 'goal' && this.bot && this.config.difficulty === 'adaptive') {
        this.bot.params = blendParams(adaptiveSkill(s.score[0], s.score[1]));
      }
      this.emit(e);
    }
    // attract mode loops forever
    if (this.config.kind === 'attract' && s.phase === 'over' && s.phaseTimer > 2) this.start(this.config);
  }

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const real = Math.min(0.1, (now - this.last) / 1000 || 0);
    this.last = now;
    if (!this.state) return;
    if (!this.paused) {
      const k = this.config.kind;
      if (k === 'bot' || k === 'host' || k === 'guest' || k === 'campaign') this.solo.update(this.state, this.local, this.input, real);
      if (this.external) {
        this.external(real);
      } else {
        this.acc += real * this.timeScale;
        let guard = 0;
        const n = Math.min(30, Math.floor(this.acc / T.DT));
        while (this.acc >= T.DT && guard++ < 30) {
          this.left = Math.max(1, n - guard + 1);
          this.tick();
          this.acc -= T.DT;
        }
        if (guard >= 30) this.acc = 0;
      }
    }
    const alpha = this.external ? 1 : this.acc / T.DT;
    this.view.sync(this.state, alpha, real);
    for (const f of this.frameListeners) f(this.state, real);
    this.view.render();
  }
}
