// Transport: PeerJS (WebRTC data channel via the free public PeerJS broker).
// `?net=local` swaps in a BroadcastChannel transport so two tabs of one browser can be tested without internet.
import type { DataConnection, Peer as PeerT } from 'peerjs';
import { Msg } from './protocol';

export interface Link {
  send(m: Msg): void;
  close(): void;
  onMsg: (m: Msg) => void;
  onClose: () => void;
}

export type NetError = 'broker' | 'not-found' | 'taken' | 'failed';

export interface Room {
  close(): void;
}

const PREFIX = 'airbattle-v1-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0, 1
export function makeCode(): string {
  let c = '';
  for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

const useLocal = () => new URLSearchParams(location.search).get('net') === 'local';

function wrap(conn: DataConnection): Link {
  const link: Link = {
    send: (m) => {
      if (conn.open) conn.send(m);
    },
    close: () => conn.close(),
    onMsg: () => {},
    onClose: () => {},
  };
  conn.on('data', (d) => link.onMsg(d as Msg));
  conn.on('close', () => link.onClose());
  conn.on('error', () => link.onClose());
  return link;
}

function mapError(type: string): NetError {
  if (type === 'peer-unavailable') return 'not-found';
  if (type === 'unavailable-id') return 'taken';
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed' || type === 'browser-incompatible') return 'broker';
  return 'failed';
}

async function newPeer(id?: string): Promise<PeerT> {
  const { Peer } = await import('peerjs'); // loaded only when someone goes online
  return id ? new Peer(id) : new Peer();
}

export function hostRoom(code: string, cb: { onReady(): void; onGuest(link: Link): void; onError(e: NetError): void }): Room {
  if (useLocal()) return localRoom(code, true, cb.onReady, cb.onGuest);
  let peer: PeerT | null = null;
  let closed = false;
  void newPeer(PREFIX + code).then((p) => {
    if (closed) return p.destroy();
    peer = p;
    p.on('open', () => cb.onReady());
    p.on('connection', (conn) => conn.on('open', () => cb.onGuest(wrap(conn))));
    p.on('error', (e) => cb.onError(mapError((e as { type: string }).type)));
    p.on('disconnected', () => {
      if (!closed && !p.destroyed) p.reconnect();
    });
  }, () => cb.onError('broker'));
  return {
    close: () => {
      closed = true;
      peer?.destroy();
    },
  };
}

export function joinRoom(code: string, cb: { onOpen(link: Link): void; onError(e: NetError): void }): Room {
  if (useLocal()) return localRoom(code, false, () => {}, cb.onOpen);
  let peer: PeerT | null = null;
  let closed = false;
  let opened = false;
  void newPeer().then((p) => {
    if (closed) return p.destroy();
    peer = p;
    p.on('open', () => {
      const conn = p.connect(PREFIX + code, { serialization: 'json', reliable: false });
      conn.on('open', () => {
        opened = true;
        cb.onOpen(wrap(conn));
      });
      // WebRTC can silently fail behind strict firewalls
      setTimeout(() => {
        if (!opened && !closed) cb.onError('failed');
      }, 12000);
    });
    p.on('error', (e) => {
      if (!opened) cb.onError(mapError((e as { type: string }).type));
    });
  }, () => cb.onError('broker'));
  return {
    close: () => {
      closed = true;
      peer?.destroy();
    },
  };
}

// ---- same-browser transport for testing ----
function localRoom(code: string, host: boolean, onReady: () => void, onLink: (l: Link) => void): Room {
  const ch = new BroadcastChannel(PREFIX + code);
  const me = host ? 'h' : 'g';
  let link: Link | null = null;
  const make = (): Link => ({
    send: (m) => {
      try {
        ch.postMessage({ from: me, m });
      } catch {
        /* channel already closed */
      }
    },
    close: () => {
      try {
        ch.postMessage({ from: me, close: true });
        ch.close();
      } catch {
        /* already closed */
      }
    },
    onMsg: () => {},
    onClose: () => {},
  });
  ch.onmessage = (ev) => {
    const d = ev.data as { from: string; m?: Msg; close?: boolean; knock?: boolean };
    if (d.from === me) return;
    if (!link) {
      link = make();
      onLink(link);
      if (host) ch.postMessage({ from: me, knock: true });
    }
    if (d.close) link.onClose();
    else if (d.m) link.onMsg(d.m);
  };
  // the guest keeps knocking until the host's room exists
  const knock = setInterval(() => {
    if (link || host) return clearInterval(knock);
    try {
      ch.postMessage({ from: me, knock: true });
    } catch {
      clearInterval(knock);
    }
  }, 300);
  if (host) setTimeout(onReady, 50);
  return {
    close: () => {
      clearInterval(knock);
      if (link) link.close();
      else ch.close();
    },
  };
}
