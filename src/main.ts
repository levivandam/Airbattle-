import './ui/style.css';
import { AudioEngine } from './audio/engine';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { Campaign } from './campaign/ui';
import { intensity } from './core/match';
import { Game } from './game';
import { PointerInput } from './input/pointer';
import { Online } from './net/online';
import { QuickMatch } from './net/quick';
import { ArenaView } from './render/arena';
import { Fx } from './render/fx';
import { PowerFx } from './render/powerfx';
import { View } from './render/view';
import { App } from './ui/app';
import { Hud } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = new View(canvas);
new ArenaView(view);
new PowerFx(view);
const input = new PointerInput(view);
const game = new Game(view, input);
const fx = new Fx(view, game);
const hud = new Hud();
const app = new App(game, view, hud);

// ---------- audio ----------
const audio = new AudioEngine();
const sfx = new Sfx(audio);
const music = new Music(audio);
let scene: 'lobby' | 'match' = 'lobby';

app.onUnlock = () => {
  audio.unlock();
  music.start();
};
app.onScene = (s) => {
  scene = s;
  fx.setColors(...view.malletColors());
};
// backup: unlock audio on the very first interaction, whatever it is
window.addEventListener('pointerdown', () => app.onUnlock(), { once: true });
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('button')) sfx.click();
});

game.onEvent((e, s) => {
  const attract = game.config.kind === 'attract';
  if (attract) return; // the lobby stays calm: no match sounds behind the menu
  switch (e.t) {
    case 'hit': sfx.hit(e.speed); break;
    case 'wall': sfx.wall(e.speed); break;
    case 'goal': sfx.goal(); break;
    case 'count': sfx.count(false); break;
    case 'go': sfx.count(true); break;
    case 'spawn': sfx.spawn(); break;
    case 'pickup': sfx.pickup(e.type); break;
    case 'expire': sfx.expire(); break;
    case 'block': sfx.block(); break;
    case 'matchpoint': setTimeout(() => sfx.matchPoint(), 1150); break;
    case 'golden': sfx.matchPoint(); break;
    case 'target': sfx.pickup('big'); break;
    case 'gate': sfx.spawn(); break;
    case 'win': sfx.win(); break;
    case 'fail': sfx.lose(); break;
    case 'over':
      if (game.config.kind === 'campaign') break;
      if (game.config.kind === 'local' || e.winner === game.local) sfx.win();
      else sfx.lose();
      break;
  }
  void s;
});
game.onFrame((s) => {
  const playing = scene === 'match' && game.config.kind !== 'attract' && s.phase !== 'over';
  music.setLevel(playing ? intensity(s) : 0);
});

new Campaign(app, game);

// ---------- online ----------
const online = new Online(app, game);
new QuickMatch(app, game, online);
app.afterTitle = () => {
  const code = Online.inviteCode();
  if (code.length !== 5) return false;
  history.replaceState(null, '', location.pathname + (location.search.includes('net=local') ? '?net=local' : ''));
  online.join(code);
  return true;
};

app.title();

// handy for debugging from the browser console
Object.assign(window as object, { game, app, music });
