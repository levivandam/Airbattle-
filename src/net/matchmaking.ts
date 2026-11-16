// Quick match: a tiny waiting room in Firebase Realtime Database that pairs two players and hands them a
// room code. The actual game then runs over the normal room-code connection (net/online.ts).
// `?net=local` uses a BroadcastChannel waiting room instead, so two tabs can be tested without Firebase.
import { makeCode } from './peer';

export interface Found {
  code: string;
  host: boolean;
  nick: string; // opponent's nickname
}
export type LobbyError = 'auth-off' | 'rules' | 'offline';

export interface Lobby {
  /** Start waiting. onFound fires once; call enter() again to wait for another opponent. */
  enter(nick: string, onFound: (f: Found) => void, onError: (e: LobbyError) => void): void;
  leave(): void;
}

const STALE = 120000; // ignore queue entries older than 2 minutes

export const cleanNick = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
export const randomNick = () => 'Player' + Math.floor(1000 + Math.random() * 9000);

// ---------------- Firebase ----------------
class FirebaseLobby implements Lobby {
  private stop: Array<() => void> = [];
  private active = false;

  enter(nick: string, onFound: (f: Found) => void, onError: (e: LobbyError) => void): void {
    this.leave();
    this.active = true;
    void this.run(nick, onFound).catch((err: { code?: string; message?: string }) => {
      if (!this.active) return;
      const c = String(err?.code ?? err?.message ?? '');
      onError(c.includes('operation-not-allowed') || c.includes('admin-restricted') ? 'auth-off' : c.toLowerCase().includes('permission') ? 'rules' : 'offline');
      this.leave();
    });
  }

  private async run(nick: string, onFound: (f: Found) => void): Promise<void> {
    const [{ initializeApp, getApps }, auth, db, { firebaseConfig }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/database'),
      import('./firebaseConfig'),
    ]);
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const cred = await auth.signInAnonymously(auth.getAuth(app));
    if (!this.active) return;
    const uid = cred.user.uid;
    const database = db.getDatabase(app);
    const mine = db.ref(database, 'queue/' + uid);
    const inbox = db.ref(database, 'matches/' + uid);
    await db.remove(inbox);
    await db.onDisconnect(mine).remove();
    await db.set(mine, { nick, ts: db.serverTimestamp() });
    if (!this.active) {
      void db.remove(mine);
      return;
    }
    let done = false;
    const finish = (f: Found) => {
      if (done || !this.active) return;
      done = true;
      this.leave();
      onFound(f);
    };
    // someone else matched me
    const offInbox = db.onValue(inbox, (snap) => {
      const v = snap.val() as { code: string; nick: string } | null;
      if (v) {
        void db.remove(inbox);
        finish({ code: v.code, host: false, nick: v.nick });
      }
    });
    // or I match someone: only the lowest uid in the queue acts, so nobody gets matched twice
    let busy = false;
    const offQueue = db.onValue(db.ref(database, 'queue'), (snap) => {
      if (busy || done) return;
      const all = (snap.val() ?? {}) as Record<string, { nick: string; ts: number }>;
      const now = Date.now();
      const ids = Object.keys(all).filter((k) => now - (all[k].ts || now) < STALE).sort();
      if (ids.length < 2 || ids[0] !== uid) return;
      const other = ids.filter((k) => k !== uid).sort((a, b) => all[a].ts - all[b].ts)[0];
      busy = true;
      void db
        .runTransaction(db.ref(database, 'queue/' + other), (cur) => (cur === null ? undefined : null))
        .then(async (res) => {
          if (!res.committed) return;
          const code = makeCode();
          await db.set(db.ref(database, 'matches/' + other), { code, nick, ts: db.serverTimestamp() });
          finish({ code, host: true, nick: all[other].nick });
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    });
    this.stop.push(offInbox, offQueue, () => void db.remove(mine), () => void db.onDisconnect(mine).cancel());
  }

  leave(): void {
    this.active = false;
    for (const f of this.stop) f();
    this.stop = [];
  }
}

// ---------------- same-browser test lobby ----------------
class LocalLobby implements Lobby {
  private ch: BroadcastChannel | null = null;
  private timer = 0;

  enter(nick: string, onFound: (f: Found) => void): void {
    this.leave();
    const id = Math.random().toString(36).slice(2);
    const ch = new BroadcastChannel('airbattle-lobby');
    this.ch = ch;
    const hello = () => ch.postMessage({ t: 'wait', id, nick });
    ch.onmessage = (ev) => {
      const d = ev.data as { t: string; id: string; nick: string; to?: string; code?: string };
      if (d.t === 'wait' && id < d.id) {
        const code = makeCode();
        ch.postMessage({ t: 'match', to: d.id, id, nick, code });
        this.leave();
        onFound({ code, host: true, nick: d.nick });
      } else if (d.t === 'match' && d.to === id) {
        this.leave();
        onFound({ code: d.code!, host: false, nick: d.nick });
      }
    };
    hello();
    this.timer = window.setInterval(hello, 700);
  }

  leave(): void {
    clearInterval(this.timer);
    this.ch?.close();
    this.ch = null;
  }
}

export function createLobby(): Lobby {
  return new URLSearchParams(location.search).get('net') === 'local' ? new LocalLobby() : new FirebaseLobby();
}
