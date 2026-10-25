import { attachControls, attachMenuPointer } from './controls';
import { GAME_SPEED, Game } from './game';
import { detectInputKind } from './input/kind';
import { attachTouch } from './input/touch/attach';
import { FixedStepLoop } from './loop';
import { readOnlineConfig } from './online/config';
import { createSession } from './online/create';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const version = document.querySelector<HTMLMetaElement>('meta[name="game-version"]')?.content ?? '';
const game = new Game(canvas, version);
game.inputKind = detectInputKind(window);
game.online = createSession({
  config: readOnlineConfig(import.meta.env),
  doc: document,
  win: window,
  game,
});
attachControls(game, window, document);
attachMenuPointer(game, canvas);
attachTouch(game, document);
new FixedStepLoop(
  { now: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback) },
  game,
  GAME_SPEED,
).start();
