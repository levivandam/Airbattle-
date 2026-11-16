import './ui/style.css';
import { Game } from './game';
import { PointerInput } from './input/pointer';
import { View } from './render/view';
import { App } from './ui/app';
import { Hud } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = new View(canvas);
const input = new PointerInput(view);
const game = new Game(view, input);
const hud = new Hud();
const app = new App(game, view, hud);

app.title();

// handy for debugging from the browser console
Object.assign(window as object, { game, app });
