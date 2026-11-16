// Campaign screens: world map, level start, result with stars.
import { ALL_TYPES } from '../core/powerups';
import { T } from '../core/state';
import { Game } from '../game';
import { App } from '../ui/app';
import { button, el } from '../ui/dom';
import { toast } from '../ui/hud';
import { COMING, WORLDS } from './levels';
import { isUnlocked, saveResult, starsOf, worldStars } from './progress';
import { LevelRun, buildArena, setupState } from './runner';
import { LevelResult, WorldDef, starText } from './types';

const stars = (n: number, of = 3) => '★'.repeat(n) + '☆'.repeat(of - n);
const clock = (t: number) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

export class Campaign {
  private run: LevelRun | null = null;
  private world: WorldDef = WORLDS[0];
  private index = 0;

  constructor(
    private app: App,
    private game: Game,
  ) {
    app.campaignMenu = () => this.map();
    app.onRestart = () => {
      if (game.config.kind !== 'campaign') return false;
      this.play(this.world, this.index);
      return true;
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && game.config?.kind === 'campaign' && !(e.target instanceof HTMLInputElement)) this.play(this.world, this.index);
    });
    game.onFrame(() => this.info());
  }

  map(): void {
    const s = el('div', 'screen clear');
    const p = el('div', 'panel wide');
    p.append(el('h2', '', 'Campaign'));
    for (const w of WORLDS) {
      const head = el('div', 'world-head');
      head.append(el('span', '', `World ${w.id} · ${w.name}`), el('b', '', `★ ${worldStars(w)}/${w.levels.length * 3}`));
      const row = el('div', 'nodes');
      w.levels.forEach((l, i) => {
        const open = isUnlocked(w, i);
        const boss = i === w.levels.length - 1;
        const b = el('button', 'node' + (boss ? ' boss' : '') + (open ? '' : ' locked'), '', { type: 'button', 'aria-label': l.name + (open ? '' : ' (locked)') });
        b.append(el('span', 'num', boss ? '♛' : String(i + 1)), el('span', 'st', open ? stars(starsOf(l.id)) : '🔒'));
        if (open) b.addEventListener('click', () => this.play(w, i));
        else b.addEventListener('click', () => toast(boss ? `Earn ${w.bossStars} stars in this world to face the boss` : 'Finish the previous level first'));
        row.append(b);
      });
      p.append(head, row, el('p', 'hint left', `${w.blurb} Beat the boss to unlock: ${w.reward.label}.`));
    }
    for (const name of COMING) {
      const head = el('div', 'world-head dim');
      head.append(el('span', '', name), el('b', '', 'Coming soon'));
      p.append(head);
    }
    const back = button('Back', 'primary', () => this.app.menu());
    back.style.cssText = 'width:100%;margin-top:16px';
    p.append(back);
    s.append(p);
    this.app.custom(s);
  }

  play(world: WorldDef, index: number): void {
    const def = world.levels[index];
    this.world = world;
    this.index = index;
    const arena = buildArena(def);
    this.app.close();
    this.app.view.setCamera(false, def.custom ? 12 : 15, arena.bounds);
    this.game.start({
      kind: 'campaign',
      difficulty: def.bot?.level ?? 'easy',
      mode: { kind: 'goals', target: def.goalsToWin ?? 99 },
      powerUps: !!def.powerUps,
      enabledTypes: ALL_TYPES,
      arena,
      withBot: !!def.bot,
      botParams: def.bot?.params,
    });
    setupState(this.game.state, def);
    const run = new LevelRun(def, (e) => this.game.emit(e), (r) => this.end(r));
    this.run = run;
    this.game.afterTick = (s, ev) => run.tick(s, ev, T.DT);
    this.app.beginHud('campaign', 0, -1, [' YOU', def.kind === 'boss' ? 'BOSS' : 'BOT'], !def.bot);
    toast(def.goal);
  }

  private info(): void {
    const run = this.run;
    if (!run || this.game.config.kind !== 'campaign' || run.def.bot) return;
    const def = run.def;
    const A = this.game.state.arena;
    const parts = [def.name];
    if (A) {
      const targets = A.marks.filter((m) => m.kind === 'target');
      const gates = A.marks.filter((m) => m.kind === 'gate');
      if (targets.length) parts.push(`Targets ${targets.filter((m) => m.done).length}/${targets.length}`);
      if (gates.length) parts.push(`Gates ${gates.filter((m) => m.done).length}/${gates.length}`);
    }
    if (def.kind === 'score') parts.push(`Goals ${this.game.state.score[0]}/${def.goalsToWin}`);
    parts.push(def.maxShots ? `Shots ${run.shots}/${def.maxShots}` : `Shots ${run.shots}`);
    parts.push(def.maxTime ? clock(Math.max(0, def.maxTime - run.time)) : clock(run.time));
    this.app.hud.setInfo(parts.join('  ·  '));
  }

  private end(r: LevelResult): void {
    const w = this.world;
    const def = w.levels[this.index];
    const unlocked = r.won ? saveResult(w, this.index, r.stars) : null;
    const s = el('div', 'screen');
    s.append(el('h1', 'result ' + (r.won ? 'win' : 'lose'), r.won ? 'LEVEL COMPLETE' : 'TRY AGAIN'));
    s.append(el('div', 'bigstars', stars(r.stars)));
    const p = el('div', 'panel stack');
    const line = (a: string, b: string) => {
      const d = el('div', 'stat');
      d.append(el('span', '', a), el('b', '', b));
      return d;
    };
    const box = el('div');
    if (!r.won && r.reason) box.append(line(r.reason, ''));
    box.append(line('★ Complete the level', r.won ? '✓' : '–'));
    box.append(line('★★ ' + starText(def.stars[0]), r.stars >= 2 ? '✓' : '–'));
    box.append(line('★★★ ' + starText(def.stars[1]), r.stars >= 3 ? '✓' : '–'));
    if (def.bot) box.append(line('Score', `${this.game.state.score[0]} : ${this.game.state.score[1]}`));
    else box.append(line('Shots · time', `${r.shots} · ${clock(r.time)}`));
    if (unlocked) box.append(line('Unlocked!', unlocked + ' (see Settings)'));
    p.append(box);
    const row = el('div', 'row');
    row.append(button('Map', 'ghost', () => this.map()), button('Retry', r.won ? '' : 'primary', () => this.play(w, this.index)));
    const next = this.index + 1;
    if (r.won && next < w.levels.length) {
      if (isUnlocked(w, next)) row.append(button('Next', 'primary', () => this.play(w, next)));
      else p.append(el('p', 'hint', `Earn ${w.bossStars} stars in this world to face the boss (you have ${worldStars(w, false)}).`));
    }
    p.append(row);
    s.append(p);
    this.app.custom(s);
  }
}
