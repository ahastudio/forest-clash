import { describe, expect, it, vi } from 'vitest';
import { attachControls } from './controls';
import type { Game } from './game';

type Listener = (event: never) => void;

function setup() {
  const listeners = new Map<string, Listener>();
  const doc = { hidden: false, addEventListener: (type: string, fn: Listener) => listeners.set(`doc:${type}`, fn) };
  const win = { addEventListener: (type: string, fn: Listener) => listeners.set(`win:${type}`, fn) };
  const game = {
    paused: false,
    showBoxes: false,
    sound: { init: vi.fn(), toggle: vi.fn() },
    togglePause() {
      this.paused = !this.paused;
    },
    keyboard: { press: vi.fn(), release: vi.fn(), releaseAll: vi.fn() },
    pauseIfFighting: vi.fn(),
  };
  attachControls(game as unknown as Game, win as unknown as Window, doc as unknown as Document);
  const key = (code: string) => {
    const event = { code, preventDefault: vi.fn() };
    (listeners.get('win:keydown') as (e: unknown) => void)(event);
    return event;
  };
  return { game, doc, listeners, key };
}

describe('조작 연결', () => {
  it('키를 누르면 소리 장치를 열고 입력으로 받는다', () => {
    const { game, key } = setup();
    const event = key('KeyI');
    expect(game.sound.init).toHaveBeenCalled();
    expect(game.keyboard.press).toHaveBeenCalledWith('KeyI');
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('Space는 일시정지를 켜고 끄며 화면이 스크롤되지 않게 한다', () => {
    const { game, key } = setup();
    const event = key('Space');
    expect(game.paused).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    key('Space');
    expect(game.paused).toBe(false);
  });

  it('M은 소리를, H는 판정 상자 표시를 켜고 끈다', () => {
    const { game, key } = setup();
    key('KeyM');
    expect(game.sound.toggle).toHaveBeenCalledTimes(1);
    key('KeyH');
    expect(game.showBoxes).toBe(true);
    key('KeyH');
    expect(game.showBoxes).toBe(false);
  });

  it('방향키는 화면이 스크롤되지 않게 한다', () => {
    const { key } = setup();
    expect(key('ArrowUp').preventDefault).toHaveBeenCalled();
  });

  it('키를 놓으면 입력에서 뺀다', () => {
    const { game, listeners } = setup();
    (listeners.get('win:keyup') as (e: unknown) => void)({ code: 'KeyI' });
    expect(game.keyboard.release).toHaveBeenCalledWith('KeyI');
  });

  it('창을 벗어나면 모든 키를 놓고 대전 중이면 일시정지한다', () => {
    const { game, listeners } = setup();
    (listeners.get('win:blur') as () => void)();
    expect(game.keyboard.releaseAll).toHaveBeenCalled();
    expect(game.pauseIfFighting).toHaveBeenCalled();
  });

  it('탭이 가려질 때만 일시정지를 시도한다', () => {
    const { game, doc, listeners } = setup();
    (listeners.get('doc:visibilitychange') as () => void)();
    expect(game.pauseIfFighting).not.toHaveBeenCalled();
    doc.hidden = true;
    (listeners.get('doc:visibilitychange') as () => void)();
    expect(game.pauseIfFighting).toHaveBeenCalledTimes(1);
  });
});
