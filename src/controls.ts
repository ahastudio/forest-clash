import type { Game } from './game';

/** 보조 키: 일시정지(Space), 소리 켜고 끄기(M), 판정 상자 표시(H). */
const HELPER_KEYS: Record<string, (game: Game) => void> = {
  Space: game => game.togglePause(),
  KeyM: game => game.sound.toggle(),
  KeyH: game => {
    game.showBoxes = !game.showBoxes;
  },
};

/** 브라우저가 화면을 스크롤하거나 하지 않도록 기본 동작을 막아야 하는 키인가. */
const blocksDefault = (code: string): boolean => code === 'Space' || code.startsWith('Arrow');

/** 키를 눌렀을 때: 소리 장치를 열고, 보조 키를 처리하고, 입력으로 받는다. */
function onKeyDown(game: Game, event: KeyboardEvent): void {
  game.sound.init();
  HELPER_KEYS[event.code]?.(game);
  game.keyboard.press(event.code);
  if (blocksDefault(event.code)) {
    event.preventDefault();
  }
}

/** 창을 벗어나면 눌린 키를 모두 놓고, 대전 중이었으면 일시정지한다. */
function onLeave(game: Game): void {
  game.keyboard.releaseAll();
  game.pauseIfFighting();
}

/** 키보드와 창 이벤트를 게임에 연결한다. */
export function attachControls(game: Game, win: Window, doc: Document): void {
  win.addEventListener('keydown', event => onKeyDown(game, event));
  win.addEventListener('keyup', event => game.keyboard.release(event.code));
  win.addEventListener('blur', () => onLeave(game));
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) {
      game.pauseIfFighting();
    }
  });
}
