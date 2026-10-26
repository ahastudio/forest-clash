import type { Game } from '../../game';
import { BUTTON_NAMES, ButtonControl } from './button-control';
import { StickControl } from './stick-control';
import { TouchPad } from './touch-pad';

function query(doc: Document, selector: string): HTMLElement {
  const element = doc.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`화면 조작 요소를 찾을 수 없습니다: ${selector}`);
  }
  return element;
}

// 일시정지 버튼. 모바일에는 Space 키가 없어서 일시정지를 풀 방법이 필요하다.
function bindPause(game: Game, element: HTMLElement): void {
  element.addEventListener('pointerdown', () => {
    game.sound.init();
    game.togglePause();
  });
}

// 공격 버튼 네 개를 찾아 연결한다.
function attachButtons(game: Game, pad: TouchPad, doc: Document): void {
  for (const name of BUTTON_NAMES) {
    new ButtonControl(game, pad, { name, element: query(doc, `[data-button="${name}"]`) }).attach();
  }
}

// 두 손가락을 함께 쓰면 브라우저가 화면을 확대하려 한다. 확대 동작(gesturestart)과 조작 영역의 터치 기본 동작, 길게 누르는 메뉴를 막는다.
// 터치 기본 동작은 손가락을 끌면 화면이 밀리거나 빠르게 두 번 누르면 확대되는 것이다.
function blockBrowserGestures(doc: Document, root: HTMLElement): void {
  const cancel = (event: Event): void => event.preventDefault();
  doc.addEventListener('gesturestart', cancel);
  for (const type of ['touchstart', 'touchmove', 'contextmenu']) {
    root.addEventListener(type, cancel, { passive: false });
  }
}

/**
 * 화면에 놓인 조이스틱, 버튼 네 개, 일시정지 버튼을 게임의 1P 입력에 연결한다.
 */
export function attachTouch(game: Game, doc: Document): void {
  const pad = new TouchPad(game.keyboard);
  new StickControl(game, { pad, stick: query(doc, '[data-stick]'), knob: query(doc, '[data-knob]') }).attach();
  attachButtons(game, pad, doc);
  bindPause(game, query(doc, '[data-pause]'));
  blockBrowserGestures(doc, query(doc, '[data-touch]'));
}
