import { attachControls } from './controls';
import { GAME_SPEED, Game } from './game';
import { attachTouch } from './input/touch/attach';
import { FixedStepLoop } from './loop';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const version = document.querySelector<HTMLMetaElement>('meta[name="game-version"]')?.content ?? '';
const game = new Game(canvas, version);
attachControls(game, window, document);
attachTouch(game, document);
new FixedStepLoop(
  { now: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback) },
  game,
  GAME_SPEED,
).start();
