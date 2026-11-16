// Online play with room codes. Host = player 0 and runs the simulation; guest = player 1.
// Host -> guest: full state snapshots at 30 Hz + game events. Guest -> host: mallet target.
// The guest renders ~100 ms in the past (interpolation) and predicts its own mallet locally.
import { moveMallet } from '../core/physics';
import { GameEvent, GameState, Mallet, T } from '../core/state';
import { Controller, Game } from '../game';
import { MALLET_COLORS, matchMode, settings } from '../storage/settings';
import { App } from '../ui/app';
import { button, el } from '../ui/dom';
import { toast } from '../ui/hud';
import { Link, NetError, Room, cleanCode, hostRoom, joinRoom, makeCode } from './peer';
import { GuestMsg, HostMsg, Msg, NetConfig, PROTOCOL } from './protocol';

const DELAY = 100; // ms of interpolation buffer on the guest
const SNAP_EVERY = 4; // ticks (120 Hz / 4 = 30 Hz)

interface Snap {
  at: number;
  s: GameState;
  pucks: Map<number, [number, number]>;
  m0: [number, number];
  m1: [number, number];
}

const ERRORS: Record<NetError, string> = {
  broker: 'Could not reach the matchmaking server. Check your internet connection and try again.',
  'not-found': 'No room with that code. Check the code with your friend.',
  taken: 'That room code is already in use.',
  failed: 'Could not connect to the other player. Some networks (school, work, mobile data) block direct connections. Try another network.',
};

export class Online {
  private room: Room | null = null;
  private link: Link | null = null;
  private role: 'host' | 'guest' | null = null;
  private otherColor = -1;
  private inMatch = false;
  private lastRecv = 0;
  private pingEl = el('span', 'ping');
  // host side
  private evLog: Array<[number, GameEvent]> = [];
  private evId = 0;
  private seq = 0;
  private tickN = 0;
  private remote = { x: 0, y: 0.7, has: false, pt: 0, acked: 0 };
  // guest side
  private snaps: Snap[] = [];
  private lastSeq = 0;
  private lastEv = 0;
  private lastHt = 0;
  private mine: Mallet | null = null;
  private acc = 0;
  private lastSent = 0;
  // quick match (matchmaking): rooms are opened and started automatically
  private auto = false;
  private autoTimer = 0;
  nick = '';
  /** adds a 'Quick match' button to the online menu when set */
  quickMenu: (() => void) | null = null;

  constructor(
    private app: App,
    private game: Game,
  ) {
    app.onlineMenu = () => this.menu();
    app.onLeaveMatch = () => this.leave();
    app.onRematch = () => this.rematch();
    app.hud.cornerLeft.append(this.pingEl);
    window.setInterval(() => {
      if (this.role && this.inMatch && performance.now() - this.lastRecv > 6000) this.lost();
    }, 1000);
    window.addEventListener('pagehide', () => this.link?.send({ t: 'bye' }));
  }

  /** Room code from an invite link (?room=ABCDE), if any. */
  static inviteCode(): string {
    return cleanCode(new URLSearchParams(location.search).get('room') ?? '');
  }

  // ---------- screens ----------
  menu(): void {
    this.leave();
    const s = el('div', 'screen clear');
    const p = el('div', 'panel stack');
    p.append(
      el('h2', '', 'Online'),
      el('p', 'hint', 'Find a random opponent, or play a friend: one of you creates a room and shares the code.'),
      ...(this.quickMenu ? [button('Quick match', 'primary', () => this.quickMenu!())] : []),
      button('Create room', this.quickMenu ? '' : 'primary', () => this.create()),
      button('Join room', 'blue', () => this.join('')),
      button('Back', 'ghost', () => this.app.menu()),
    );
    s.append(p);
    this.app.custom(s);
  }

  private create(code = makeCode()): void {
    this.leave();
    this.role = 'host';
    const s = el('div', 'screen clear');
    const p = el('div', 'panel stack');
    const status = el('p', 'hint', 'Opening room…');
    const link = location.origin + location.pathname + '?room=' + code;
    const start = button('Start match', 'primary', () => this.startHost());
    start.disabled = true;
    const copy = button('Copy invite link', '', async () => {
      try {
        if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'AirBattle', text: 'Play air hockey against me!', url: link });
        else {
          await navigator.clipboard.writeText(link);
          toast('Invite link copied');
        }
      } catch {
        toast('Share this code: ' + code);
      }
    });
    const row = el('div', 'row');
    row.append(button('Back', 'ghost', () => this.menu()), start);
    p.append(el('h2', '', 'Your room'), el('div', 'code', code), copy, status, this.app.matchOptions(), row);
    s.append(p);
    this.app.custom(s);

    this.room = hostRoom(code, {
      onReady: () => {
        status.textContent = 'Share the code or the link. Waiting for your opponent…';
      },
      onGuest: (l) => {
        if (this.link) {
          l.send({ t: 'bye' }); // room is full
          return;
        }
        this.attach(l);
        l.send({ t: 'hello', v: PROTOCOL, color: MALLET_COLORS[settings.color] });
        status.textContent = 'Opponent connected! Pick the match settings and start.';
        start.disabled = false;
        start.focus();
      },
      onError: (e) => {
        if (e === 'taken') this.create();
        else status.textContent = ERRORS[e];
      },
    });
  }

  join(prefill: string): void {
    this.leave();
    this.role = 'guest';
    const s = el('div', 'screen clear');
    const p = el('div', 'panel stack');
    const input = el('input', 'code', '', { maxlength: '5', placeholder: 'CODE', 'aria-label': 'Room code', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
    input.value = prefill;
    const status = el('p', 'hint', 'Type the 5-character code your friend sent you.');
    const go = button('Join', 'primary', () => connect());
    const connect = () => {
      const code = cleanCode(input.value);
      if (code.length < 5) {
        status.textContent = 'The code has 5 characters.';
        return;
      }
      this.room?.close();
      go.disabled = true;
      status.textContent = 'Connecting…';
      this.room = joinRoom(code, {
        onOpen: (l) => {
          this.attach(l);
          l.send({ t: 'hi', v: PROTOCOL, color: MALLET_COLORS[settings.color] });
          status.textContent = 'Connected! Waiting for the host to start the match…';
        },
        onError: (e) => {
          status.textContent = ERRORS[e];
          go.disabled = false;
        },
      });
    };
    input.addEventListener('input', () => (input.value = cleanCode(input.value)));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') connect();
    });
    const row = el('div', 'row');
    row.append(button('Back', 'ghost', () => this.menu()), go);
    p.append(el('h2', '', 'Join room'), input, status, row);
    s.append(p);
    this.app.custom(s);
    if (prefill.length === 5) connect();
    else input.focus();
  }

  // ---------- quick match ----------
  /** Open a room for a matched opponent and start as soon as they arrive. */
  hostQuick(code: string, onFail: () => void): void {
    this.leave();
    this.role = 'host';
    this.auto = true;
    this.room = hostRoom(code, {
      onReady: () => {},
      onGuest: (l) => {
        if (this.link) return l.send({ t: 'bye' });
        this.attach(l);
        l.send({ t: 'hello', v: PROTOCOL, color: MALLET_COLORS[settings.color], nick: this.nick });
      },
      onError: () => fail(),
    });
    const fail = () => {
      if (this.role !== 'host' || this.inMatch) return;
      this.leave();
      onFail();
    };
    this.autoTimer = window.setTimeout(fail, 25000);
  }

  /** Join a matched opponent's room (it may take a moment before the room exists). */
  joinQuick(code: string, onFail: () => void): void {
    this.leave();
    this.role = 'guest';
    this.auto = true;
    let tries = 0;
    const attempt = () => {
      this.room?.close();
      this.room = joinRoom(code, {
        onOpen: (l) => {
          this.attach(l);
          l.send({ t: 'hi', v: PROTOCOL, color: MALLET_COLORS[settings.color], nick: this.nick });
        },
        onError: (e) => {
          if (this.role !== 'guest' || this.inMatch || this.link) return;
          if (e === 'not-found' && ++tries < 10) this.autoTimer = window.setTimeout(attempt, 1500);
          else {
            this.leave();
            onFail();
          }
        },
      });
    };
    attempt();
  }

  // ---------- connection ----------
  private attach(l: Link): void {
    this.link = l;
    this.lastRecv = performance.now();
    l.onMsg = (m) => {
      this.lastRecv = performance.now();
      if (this.role === 'host') this.hostMsg(m as GuestMsg);
      else this.guestMsg(m as HostMsg);
    };
    l.onClose = () => this.lost();
  }

  private send(m: Msg): void {
    this.link?.send(m);
  }

  leave(): void {
    if (this.link) {
      this.send({ t: 'bye' });
      const l = this.link;
      this.link = null;
      l.onClose = () => {};
      setTimeout(() => l.close(), 100);
    }
    this.room?.close();
    this.room = null;
    clearTimeout(this.autoTimer);
    this.auto = false;
    this.role = null;
    this.inMatch = false;
    this.lastEv = 0;
    this.remote.acked = 0;
    this.otherColor = -1;
    this.pingEl.textContent = '';
    this.game.afterTick = null;
    this.game.external = null;
  }

  private lost(): void {
    if (!this.role || !this.link) return;
    const wasPlaying = this.inMatch;
    this.leave();
    if (wasPlaying) this.game.paused = true;
    this.app.message('Opponent left', wasPlaying ? 'The connection to your opponent was lost.' : 'Your opponent left the room.', [
      ['Menu', 'primary', () => this.app.menu()],
    ]);
  }

  private rematch(): boolean {
    if (!this.role || !this.link) return false;
    if (this.role === 'host') this.startHost();
    else {
      this.send({ t: 'rematch' });
      this.app.message('Rematch', 'Asked the host for a rematch. Waiting…', [
        ['Menu', 'ghost', () => { this.leave(); this.app.menu(); }],
      ]);
    }
    return true;
  }

  // ---------- host ----------
  private startHost(): void {
    if (!this.link) return;
    clearTimeout(this.autoTimer);
    const config: NetConfig = this.auto ? { mode: { kind: 'goals', target: 7 }, powerUps: true } : { mode: matchMode(), powerUps: settings.powerUps };
    this.send({ t: 'start', config, color: MALLET_COLORS[settings.color] });
    this.evLog = [];
    this.tickN = 0;
    this.remote.has = false;
    const remote: Controller = {
      update: (s) => {
        const m = s.mallets[1];
        m.cap = T.MALLET_MAX;
        if (this.remote.has) {
          m.tx = this.remote.x;
          m.ty = this.remote.y;
        }
      },
    };
    this.app.startMatch('host', [remote], config, this.otherColor);
    this.inMatch = true;
    this.lastRecv = performance.now();
    this.game.afterTick = (s, ev) => this.hostTick(s, ev);
  }

  private hostTick(s: GameState, ev: GameEvent[]): void {
    for (const e of ev) this.evLog.push([++this.evId, e]);
    if (++this.tickN % SNAP_EVERY !== 0) return;
    this.evLog = this.evLog.filter((x) => x[0] > this.remote.acked).slice(-60);
    this.send({ t: 'snap', q: ++this.seq, s, e: this.evLog, ht: performance.now(), pe: this.remote.pt });
  }

  private hostMsg(m: GuestMsg): void {
    switch (m.t) {
      case 'hi':
        this.otherColor = m.color;
        this.app.rivalName = m.nick ?? '';
        if (this.auto && !this.inMatch) this.startHost();
        break;
      case 'in':
        this.remote.x = m.x;
        this.remote.y = m.y;
        this.remote.has = true;
        this.remote.pt = m.pt;
        this.remote.acked = m.ae;
        if (m.he) this.showPing(performance.now() - m.he);
        break;
      case 'rematch':
        toast('Your opponent wants a rematch');
        break;
      case 'bye':
        this.lost();
        break;
    }
  }

  // ---------- guest ----------
  private guestMsg(m: HostMsg): void {
    switch (m.t) {
      case 'hello':
        this.otherColor = m.color;
        this.app.rivalName = m.nick ?? '';
        break;
      case 'start':
        clearTimeout(this.autoTimer);
        this.otherColor = m.color;
        this.snaps = [];
        this.lastSeq = 0;
        this.mine = null;
        this.acc = 0;
        this.app.startMatch('guest', [], m.config, this.otherColor);
        this.inMatch = true;
        this.game.external = (dt) => this.guestFrame(dt);
        break;
      case 'snap': {
        if (m.q <= this.lastSeq) return; // late packet
        this.lastSeq = m.q;
        this.lastHt = m.ht;
        const s = m.s;
        this.snaps.push({
          at: performance.now(),
          s,
          pucks: new Map(s.pucks.map((p) => [p.id, [p.x, p.y]])),
          m0: [s.mallets[0].x, s.mallets[0].y],
          m1: [s.mallets[1].x, s.mallets[1].y],
        });
        if (this.snaps.length > 30) this.snaps.shift();
        for (const [id, e] of m.e) {
          if (id <= this.lastEv) continue;
          this.lastEv = id;
          window.setTimeout(() => {
            if (this.inMatch) this.game.emit(e);
          }, DELAY);
        }
        if (m.pe) this.showPing(performance.now() - m.pe);
        break;
      }
      case 'bye':
        this.lost();
        break;
    }
  }

  private showPing(ms: number): void {
    this.pingEl.textContent = Math.max(1, Math.round(ms)) + ' ms';
  }

  private guestFrame(dt: number): void {
    const now = performance.now();
    const target = this.game.input.targets[1];
    if (this.snaps.length) {
      // find the two snapshots around (now - DELAY)
      const rt = now - DELAY;
      let i = this.snaps.length - 1;
      while (i > 0 && this.snaps[i].at > rt) i--;
      const a = this.snaps[i];
      const b = this.snaps[Math.min(i + 1, this.snaps.length - 1)];
      const k = b === a ? 1 : Math.max(0, Math.min(1, (rt - a.at) / (b.at - a.at)));
      const st = b.s;
      for (const p of st.pucks) {
        const pb = b.pucks.get(p.id)!;
        const pa = a.pucks.get(p.id) ?? pb;
        const jump = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > 0.5;
        p.x = p.px = jump ? pb[0] : pa[0] + (pb[0] - pa[0]) * k;
        p.y = p.py = jump ? pb[1] : pa[1] + (pb[1] - pa[1]) * k;
      }
      const m0 = st.mallets[0];
      m0.x = m0.px = a.m0[0] + (b.m0[0] - a.m0[0]) * k;
      m0.y = m0.py = a.m0[1] + (b.m0[1] - a.m0[1]) * k;

      // my own mallet: simulate locally so it reacts instantly
      if (!this.mine) this.mine = { ...st.mallets[1] };
      const mine = this.mine;
      st.mallets[1] = mine;
      mine.cap = T.MALLET_MAX;
      if (target) {
        mine.tx = target.x;
        mine.ty = target.y;
      }
      this.acc += dt;
      let guard = 0;
      while (this.acc >= T.DT && guard++ < 30) {
        moveMallet(st, 1, T.DT);
        this.acc -= T.DT;
      }
      if (guard >= 30) this.acc = 0;
      // stay close to where the host thinks I am (e.g. after being pushed back or frozen)
      const latest = this.snaps[this.snaps.length - 1];
      const ex = latest.m1[0] - mine.x;
      const ey = latest.m1[1] - mine.y;
      if (Math.hypot(ex, ey) > 0.22) {
        mine.x += ex * 0.2;
        mine.y += ey * 0.2;
      }
      mine.px = mine.x;
      mine.py = mine.y;
      this.game.state = st;
    }
    if (now - this.lastSent > 15) {
      this.lastSent = now;
      const aim = target ?? { x: this.mine?.x ?? 0, y: this.mine?.y ?? 0.7 };
      // `ae` tells the host which events arrived so it can stop resending them
      this.send({ t: 'in', x: aim.x, y: aim.y, pt: now, he: this.lastHt, ae: this.lastEv });
    }
  }
}
