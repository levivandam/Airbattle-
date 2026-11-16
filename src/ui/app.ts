// Screen flow: title, menus, setup, pause, results. Starts matches on the Game.
import { Difficulty } from '../ai/botConfig';
import { PlayerId, PowerUpType } from '../core/state';
import { ALL_TYPES } from '../core/powerups';
import { Controller, Game, MatchConfig, MatchKind } from '../game';
import { KeyboardController } from '../input/keyboard';
import { PointerInput } from '../input/pointer';
import { View } from '../render/view';
import { MALLET_COLORS, Settings, hex, matchMode, onSettings, settings, updateSettings } from '../storage/settings';
import { resetStats, saveStats, speedLabel, stats } from '../storage/stats';
import { button, el, root } from './dom';
import { Hud, toast } from './hud';

const DIFFS: Difficulty[] = ['rookie', 'easy', 'normal', 'hard', 'pro', 'adaptive'];

export class App {
  private screen: HTMLElement | null = null;
  private pauseBtn: HTMLButtonElement;
  private muteBtn: HTMLButtonElement;
  private resultTimer = 0;
  private lowFps = 0;
  private autoLow = false;
  /** set by the online module: extra menu entries and match hooks */
  onlineMenu: (() => void) | null = null;
  onLeaveMatch: (() => void) | null = null;
  onRematch: (() => boolean) | null = null;
  /** fired on every screen change: 'lobby' or 'match' (music) */
  onScene: (scene: 'lobby' | 'match') => void = () => {};
  onUnlock: () => void = () => {};
  /** return true to skip the main menu after the title screen (invite links) */
  afterTitle: (() => boolean) | null = null;
  names: [string, string] = ['YOU', 'BOT'];

  constructor(
    readonly game: Game,
    readonly view: View,
    readonly hud: Hud,
  ) {
    this.pauseBtn = el('button', 'icon-btn', 'II', { 'aria-label': 'Pause' });
    this.pauseBtn.addEventListener('click', () => this.pause());
    this.muteBtn = el('button', 'icon-btn', '', { 'aria-label': 'Mute sound' });
    this.muteBtn.addEventListener('click', () => updateSettings({ muted: !settings.muted }));
    hud.cornerRight.append(this.muteBtn, this.pauseBtn);
    const syncMute = () => {
      this.muteBtn.textContent = settings.muted ? '🔇' : '🔊';
    };
    onSettings(syncMute);
    syncMute();

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.inMatch()) {
        if (this.game.paused) this.resume();
        else if (!this.screen) this.pause();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.inMatch() && !this.screen && this.canPause()) this.pause();
    });

    game.onEvent((e, s) => {
      if (game.config.kind === 'attract') return;
      hud.onEvent(e, s);
      if (e.t === 'over') {
        this.record(e.winner);
        clearTimeout(this.resultTimer);
        this.resultTimer = window.setTimeout(() => this.results(e.winner), 2600);
      }
    });
    game.onFrame((s, dt) => {
      hud.update(s);
      this.watchFps(dt);
    });
    onSettings(() => this.applyGraphics());
    this.applyGraphics();
  }

  // ---------- helpers ----------
  private inMatch(): boolean {
    return this.game.config && this.game.config.kind !== 'attract';
  }
  private canPause(): boolean {
    const k = this.game.config.kind;
    return k === 'bot' || k === 'local';
  }

  private show(node: HTMLElement): void {
    this.screen?.remove();
    this.screen = node;
    root().append(node);
    const first = node.querySelector<HTMLElement>('button.primary') ?? node.querySelector<HTMLElement>('button');
    first?.focus({ preventScroll: true });
  }
  private clear(): void {
    this.screen?.remove();
    this.screen = null;
  }

  private applyGraphics(): void {
    const g = settings.graphics;
    const low = g === 'low' || (g === 'auto' && (this.autoLow || (PointerInput.touchSeen && window.devicePixelRatio > 2)));
    const q = low ? 'low' : 'high';
    if (this.view.quality !== q) this.view.setQuality(q);
  }

  private watchFps(dt: number): void {
    if (settings.graphics !== 'auto' || this.autoLow || this.view.quality === 'low' || dt <= 0) return;
    if (document.hidden) return;
    if (1 / dt < 40) this.lowFps += dt;
    else this.lowFps = Math.max(0, this.lowFps - dt * 2);
    if (this.lowFps > 3) {
      this.autoLow = true;
      this.applyGraphics();
      toast('Graphics set to Low for smoother play');
    }
  }

  private attract(): void {
    this.hud.hide();
    this.view.setCamera(false, 15);
    this.game.start({ kind: 'attract', difficulty: 'normal', mode: { kind: 'goals', target: 7 }, powerUps: true, enabledTypes: ALL_TYPES });
    this.onScene('lobby');
  }

  // ---------- screens ----------
  title(): void {
    this.attract();
    const s = el('div', 'screen clear clickable');
    const logo = el('h1', 'logo');
    logo.append('AIR', el('span', '', 'BATTLE'));
    s.append(logo, el('div', 'tag', 'Arcade air hockey'), el('div', 'tag blink', PointerInput.touchSeen ? 'Tap to start' : 'Click to start'));
    const go = () => {
      this.onUnlock();
      if (this.afterTitle && this.afterTitle()) return;
      this.menu();
    };
    s.addEventListener('click', go);
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        window.removeEventListener('keydown', key);
        if (this.screen === s) go();
      }
    };
    window.addEventListener('keydown', key);
    this.show(s);
  }

  menu(): void {
    clearTimeout(this.resultTimer);
    if (this.inMatch() || !this.game.config) this.attract();
    const s = el('div', 'screen clear');
    const logo = el('h1', 'logo');
    logo.append('AIR', el('span', '', 'BATTLE'));
    const p = el('div', 'panel stack');
    p.append(
      button('Play vs Bot', 'primary', () => this.setup('bot')),
      button('Local 2 Players', 'blue', () => this.setup('local')),
    );
    if (this.onlineMenu) p.append(button('Online', '', () => this.onlineMenu!()));
    const row = el('div', 'row');
    row.append(button('Settings', 'ghost small', () => this.settingsScreen()), button('Stats', 'ghost small', () => this.statsScreen()));
    p.append(row);
    s.append(logo, el('div', 'tag', 'Arcade air hockey'), p);
    this.show(s);
  }

  /** Buttons to pick the match mode + power-ups; reused by bot, local and online setup. */
  matchOptions(): HTMLElement {
    const box = el('div', 'stack');
    const modes = el('div', 'row four');
    const opts: Array<[string, Partial<Settings>]> = [
      ['7 goals', { matchKind: 'goals' }],
      ['2 min', { matchKind: 'time', minutes: 2 }],
      ['3 min', { matchKind: 'time', minutes: 3 }],
      ['5 min', { matchKind: 'time', minutes: 5 }],
    ];
    const isOn = (p: Partial<Settings>) => p.matchKind === settings.matchKind && (p.matchKind === 'goals' || p.minutes === settings.minutes);
    const btns = opts.map(([label, patch]) =>
      button(label, 'small ghost', () => {
        updateSettings(patch);
        paint();
      }),
    );
    modes.append(...btns);
    const pu = button('', 'small ghost', () => {
      updateSettings({ powerUps: !settings.powerUps });
      paint();
    });
    const paint = () => {
      btns.forEach((b, i) => {
        const on = isOn(opts[i][1]);
        b.classList.toggle('on', on);
        b.classList.toggle('ghost', !on);
        b.setAttribute('aria-pressed', String(on));
      });
      pu.textContent = 'Power-ups: ' + (settings.powerUps ? 'ON' : 'OFF');
      pu.classList.toggle('on', settings.powerUps);
      pu.classList.toggle('ghost', !settings.powerUps);
    };
    paint();
    box.append(el('h3', '', 'Match'), modes, pu);
    return box;
  }

  setup(kind: 'bot' | 'local'): void {
    const s = el('div', 'screen clear');
    const p = el('div', 'panel stack');
    p.append(el('h2', '', kind === 'bot' ? 'Play vs Bot' : 'Local 2 Players'));
    if (kind === 'bot') {
      const row = el('div', 'row');
      const btns = DIFFS.map((d) =>
        button(d[0].toUpperCase() + d.slice(1), 'small ghost', () => {
          updateSettings({ difficulty: d });
          paint();
        }),
      );
      const note = el('p', 'hint');
      const paint = () => {
        btns.forEach((b, i) => {
          const on = DIFFS[i] === settings.difficulty;
          b.classList.toggle('on', on);
          b.classList.toggle('ghost', !on);
          b.setAttribute('aria-pressed', String(on));
        });
        note.textContent = {
          rookie: 'Slow and careful. Perfect for a first game.',
          easy: 'Playful but sloppy.',
          normal: 'A fair fight.',
          hard: 'Aggressive and loves bank shots.',
          pro: 'Patient, tricky and very fast.',
          adaptive: 'Gets tougher when you lead, eases off when you trail.',
        }[settings.difficulty];
      };
      paint();
      row.append(...btns);
      p.append(el('h3', '', 'Difficulty'), row, note);
      if (!PointerInput.touchSeen) p.append(el('p', 'hint', 'Steer with the mouse, or with W A S D / arrow keys (Shift or Space = dash).'));
    } else {
      p.append(
        el(
          'p',
          'hint',
          PointerInput.touchSeen
            ? 'Lay the device flat. Each player drags on their own half.'
            : 'Player 1 (red, bottom): mouse. Player 2 (blue, top): ' + (settings.p2keys === 'wasd' ? 'W A S D' : 'arrow keys') + '. On a tablet or phone, each player drags on their own half.',
        ),
      );
    }
    p.append(this.matchOptions());
    const row = el('div', 'row');
    row.append(button('Back', 'ghost', () => this.menu()), button('Play', 'primary', () => this.startMatch(kind)));
    p.append(row);
    s.append(p);
    this.show(s);
  }

  /** Mallet colours for [player 0, player 1], avoiding two identical mallets. */
  colors(localIs: PlayerId = 0, otherColor = -1): [number, number] {
    const mine = MALLET_COLORS[settings.color];
    let theirs = otherColor >= 0 ? otherColor : mine === MALLET_COLORS[1] ? MALLET_COLORS[0] : MALLET_COLORS[1];
    if (theirs === mine) theirs = mine === MALLET_COLORS[1] ? MALLET_COLORS[0] : MALLET_COLORS[1];
    return localIs === 0 ? [mine, theirs] : [theirs, mine];
  }

  startMatch(kind: MatchKind, extra: Controller[] = [], opts: Partial<MatchConfig> = {}, otherColor = -1): void {
    clearTimeout(this.resultTimer);
    this.clear();
    const touch = PointerInput.touchSeen;
    const config: MatchConfig = {
      kind,
      difficulty: settings.difficulty,
      mode: matchMode(),
      powerUps: settings.powerUps,
      enabledTypes: enabledTypes(),
      ...opts,
    };
    const local: PlayerId = kind === 'guest' ? 1 : 0;
    const controllers = kind === 'local' ? [new KeyboardController(1), ...extra] : extra;
    this.view.setCamera(local === 1, kind === 'local' ? (touch ? 0 : 9) : 15);
    this.game.start(config, controllers);
    const cols = this.colors(local, otherColor);
    this.view.setColors(0, cols[0], kind === 'local' ? 0xf4f0e6 : local === 0 ? MALLET_COLORS[settings.accent] : 0xf4f0e6);
    this.view.setColors(1, cols[1], local === 1 ? MALLET_COLORS[settings.accent] : 0xf4f0e6);
    this.names = kind === 'bot' ? ['YOU', 'BOT'] : kind === 'local' ? ['P1', 'P2'] : ['YOU', 'RIVAL'];
    this.hud.show({
      names: this.names,
      colors: [hex(cols[local]), hex(cols[local === 0 ? 1 : 0])],
      local,
      split: kind === 'local' && touch,
    });
    this.pauseBtn.textContent = this.canPause() ? 'II' : '✕';
    this.pauseBtn.setAttribute('aria-label', this.canPause() ? 'Pause' : 'Leave match');
    this.onScene('match');
  }

  pause(): void {
    if (!this.inMatch() || this.screen) return;
    const online = !this.canPause();
    if (!online) this.game.paused = true;
    const s = el('div', 'screen');
    const p = el('div', 'panel stack');
    p.append(el('h2', '', online ? 'Leave match?' : 'Paused'));
    p.append(button(online ? 'Keep playing' : 'Resume', 'primary', () => this.resume()));
    if (!online) p.append(button('Restart', '', () => this.startMatch(this.game.config.kind)));
    p.append(
      button(online ? 'Leave' : 'Main menu', 'ghost', () => {
        this.onLeaveMatch?.();
        this.menu();
      }),
    );
    s.append(p);
    this.show(s);
  }

  resume(): void {
    this.game.paused = false;
    this.clear();
  }

  private record(winner: PlayerId): void {
    const k = this.game.config.kind;
    const s = this.game.state;
    const me = this.game.local;
    stats.matches++;
    stats.goals += k === 'local' ? s.score[0] + s.score[1] : s.score[me];
    stats.fastest = Math.max(stats.fastest, k === 'local' ? Math.max(...s.stats.maxSpeed) : s.stats.maxSpeed[me]);
    if (k === 'bot') {
      const d = this.game.config.difficulty;
      if (winner === 0) {
        stats.wins[d]++;
        stats.streak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      } else {
        stats.losses[d]++;
        stats.streak = 0;
      }
    } else if (k === 'local') stats.localMatches++;
    else {
      stats.onlineMatches++;
      if (winner === me) stats.onlineWins++;
    }
    saveStats();
  }

  results(winner: PlayerId): void {
    const k = this.game.config.kind;
    const st = this.game.state;
    const me = this.game.local;
    const s = el('div', 'screen');
    const won = winner === me;
    const title = k === 'local' ? (winner === 0 ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS') : won ? 'YOU WIN!' : 'YOU LOSE';
    s.append(el('h1', 'result ' + (k === 'local' || won ? 'win' : 'lose'), title));
    s.append(el('div', 'final', st.score[me] + ' : ' + st.score[me === 0 ? 1 : 0]));
    const p = el('div', 'panel stack');
    const line = (a: string, b: string) => {
      const d = el('div', 'stat');
      d.append(el('span', '', a), el('b', '', b));
      return d;
    };
    const box = el('div');
    box.append(line('Hardest shot', speedLabel(Math.max(...st.stats.maxSpeed))));
    if (st.powerUps) box.append(line('Power-ups collected', st.stats.pickups[me] + ' : ' + st.stats.pickups[me === 0 ? 1 : 0]));
    if (k === 'bot' && stats.streak > 1) box.append(line('Win streak', String(stats.streak)));
    p.append(box);
    const row = el('div', 'row');
    row.append(
      button('Menu', 'ghost', () => {
        this.onLeaveMatch?.();
        this.menu();
      }),
      button('Rematch', 'primary', () => {
        if (this.onRematch && this.onRematch()) return;
        this.startMatch(k);
      }),
    );
    p.append(row);
    s.append(p);
    this.show(s);
  }

  settingsScreen(): void {
    const s = el('div', 'screen clear');
    const p = el('div', 'panel');
    p.append(el('h2', '', 'Settings'));

    const slider = (label: string, key: 'music' | 'sfx') => {
      const f = el('label', 'field');
      const i = el('input', '', '', { type: 'range', min: '0', max: '1', step: '0.05' });
      i.value = String(settings[key]);
      i.addEventListener('input', () => updateSettings({ [key]: Number(i.value) }));
      f.append(label, i);
      return f;
    };
    const cycle = <K extends keyof Settings>(label: string, key: K, values: Array<[Settings[K], string]>) => {
      const f = el('div', 'field');
      const b = button('', 'small ghost', () => {
        const i = values.findIndex((v) => v[0] === settings[key]);
        updateSettings({ [key]: values[(i + 1) % values.length][0] } as Partial<Settings>);
        paint();
      });
      b.style.flex = '0 0 150px';
      const paint = () => {
        b.textContent = values.find((v) => v[0] === settings[key])?.[1] ?? '';
      };
      paint();
      f.append(label, b);
      return f;
    };
    p.append(el('h3', '', 'Sound'), slider('Music', 'music'), slider('Effects', 'sfx'));
    p.append(
      el('h3', '', 'Game'),
      cycle('Graphics', 'graphics', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']]),
      cycle('Screen shake', 'shake', [[true, 'On'], [false, 'Off']]),
      cycle('Aim line', 'aimLine', [[true, 'On'], [false, 'Off']]),
      cycle('Power-ups', 'powerUps', [[true, 'On'], [false, 'Off']]),
      cycle('Player 2 keys', 'p2keys', [['wasd', 'W A S D'], ['arrows', 'Arrows']]),
    );
    const sw = (key: 'color' | 'accent', title: string) => {
      const wrap = el('div', 'swatches');
      const paint = () => {
        wrap.replaceChildren(
          ...MALLET_COLORS.map((c, i) => {
            const b = el('button', 'swatch' + (settings[key] === i ? ' sel' : ''), '', { 'aria-label': title + ' ' + (i + 1), type: 'button' });
            b.style.setProperty('--c', hex(c));
            b.addEventListener('click', () => {
              updateSettings({ [key]: i });
              paint();
            });
            return b;
          }),
        );
      };
      paint();
      return wrap;
    };
    p.append(el('h3', '', 'Your mallet'), sw('color', 'Mallet colour'), el('h3', '', 'Ring colour'), sw('accent', 'Ring colour'));
    const back = button('Back', 'primary', () => this.menu());
    back.style.cssText = 'width:100%;margin-top:16px';
    p.append(back);
    s.append(p);
    this.show(s);
    back.focus({ preventScroll: true });
    // live preview on the attract-mode mallet
    const preview = () => this.view.setColors(0, MALLET_COLORS[settings.color], MALLET_COLORS[settings.accent]);
    p.addEventListener('click', preview);
    preview();
  }

  statsScreen(): void {
    const s = el('div', 'screen clear');
    const p = el('div', 'panel');
    p.append(el('h2', '', 'Stats'));
    const line = (a: string, b: string) => {
      const d = el('div', 'stat');
      d.append(el('span', '', a), el('b', '', b));
      return d;
    };
    for (const d of DIFFS) p.append(line('vs ' + d[0].toUpperCase() + d.slice(1) + ' bot', stats.wins[d] + ' W  ·  ' + stats.losses[d] + ' L'));
    p.append(
      line('Win streak (best)', stats.streak + ' (' + stats.bestStreak + ')'),
      line('Goals scored', String(stats.goals)),
      line('Fastest shot', speedLabel(stats.fastest)),
      line('Matches played', String(stats.matches)),
      line('Local / online matches', stats.localMatches + ' / ' + stats.onlineMatches),
    );
    const row = el('div', 'row');
    row.style.marginTop = '16px';
    let armed = false;
    const reset = button('Reset', 'ghost', () => {
      if (!armed) {
        armed = true;
        reset.textContent = 'Really reset?';
        return;
      }
      resetStats();
      this.statsScreen();
    });
    row.append(reset, button('Back', 'primary', () => this.menu()));
    p.append(row);
    s.append(p);
    this.show(s);
  }

  /** Generic message screen (used by online: connecting, errors, disconnects). */
  message(title: string, text: string, actions: Array<[string, string, () => void]>): HTMLElement {
    const s = el('div', 'screen');
    const p = el('div', 'panel stack');
    p.append(el('h2', '', title));
    if (text) p.append(el('p', 'hint', text));
    const row = el('div', 'row');
    for (const [label, cls, fn] of actions) row.append(button(label, cls, fn));
    p.append(row);
    s.append(p);
    this.show(s);
    return p;
  }

  custom(node: HTMLElement): void {
    this.show(node);
  }
  close(): void {
    this.clear();
  }
}

export function enabledTypes(): PowerUpType[] {
  return ALL_TYPES;
}
