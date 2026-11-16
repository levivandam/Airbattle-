import './ui/style.css';
import { Game } from './game';
import { PointerInput } from './input/pointer';
import { View } from './render/view';
import { Hud } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = new View(canvas);
const input = new PointerInput(view);
const game = new Game(view, input);
const hud = new Hud();

game.onEvent((e, s) => hud.onEvent(e, s));
game.onFrame((s) => hud.update(s));

// Phase 1: jump straight into a match against the bot.
function play() {
  game.start({ kind: 'bot', difficulty: 'normal', mode: { kind: 'goals', target: 7 }, powerUps: false, enabledTypes: [] });
  hud.show({ names: ['YOU', 'BOT'], colors: ['#d3352b', '#2a5bc7'], local: 0, split: false });
}
game.onEvent((e) => {
  if (e.t === 'over') setTimeout(play, 3000);
});
play();

// handy for debugging from the browser console
(window as unknown as { game: Game }).game = game;
