import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../../game';
import { Keyboard } from '../keyboard';
import { attachTouch } from './attach';

type Handler = (event: unknown) => void;

const STICK_AREA = { left: 0, top: 0, width: 100 };

function fakeElement(area = STICK_AREA) {
  const handlers = new Map<string, Handler>();
  const captured = new Set<number>();
  const attributes = new Set<string>();
  return {
    style: { transform: '' },
    attributes,
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    getBoundingClientRect: () => ({ ...area, height: area.width }),
    setAttribute: (name: string) => attributes.add(name),
    removeAttribute: (name: string) => attributes.delete(name),
    fire: (type: string, event: unknown = {}) => handlers.get(type)?.(event),
  };
}

type FakeElement = ReturnType<typeof fakeElement>;

function setup() {
  const docHandlers = new Map<string, Handler>();
  const elements: Record<string, FakeElement> = {
    '[data-touch]': fakeElement(),
    '[data-stick]': fakeElement(),
    '[data-knob]': fakeElement(),
    '[data-pause]': fakeElement(),
    '[data-button="A"]': fakeElement(),
    '[data-button="B"]': fakeElement(),
    '[data-button="C"]': fakeElement(),
    '[data-button="D"]': fakeElement(),
  };
  const doc = {
    querySelector: (selector: string) => elements[selector] ?? null,
    addEventListener: (type: string, handler: Handler) => docHandlers.set(type, handler),
  };
  const game = {
    keyboard: new Keyboard(),
    sound: { init: vi.fn() },
    paused: false,
    togglePause() {
      this.paused = !this.paused;
    },
  };
  attachTouch(game as unknown as Game, doc as unknown as Document);
  return { elements, game, docHandlers };
}

const pointer = (clientX: number, clientY: number, pointerId = 1) => ({ clientX, clientY, pointerId });

describe('화면 조작 연결', () => {
  it('조이스틱에 손가락을 대면 소리 장치를 열고 아직 아무 방향도 누르지 않는다', () => {
    const { elements, game } = setup();
    elements['[data-stick]']?.fire('pointerdown', pointer(50, 50));
    expect(game.sound.init).toHaveBeenCalled();
    expect(game.keyboard.read(0)).toMatchObject({ l: false, r: false, u: false, d: false });
  });

  it('처음 닿은 곳이 가운데이므로 어디에 대도 위로 밀면 점프 방향이 눌린다', () => {
    const { elements, game } = setup();
    const stick = elements['[data-stick]'];
    stick?.fire('pointerdown', pointer(90, 90));
    stick?.fire('pointermove', pointer(90, 50));
    expect(game.keyboard.read(0)).toMatchObject({ u: true, l: false, r: false, d: false });
    expect(elements['[data-knob]']?.style.transform).toBe('translate(0%, -60%)');
  });

  it('누른 채 움직이면 방향이 바뀌고, 누르지 않은 움직임은 무시한다', () => {
    const { elements, game } = setup();
    const stick = elements['[data-stick]'];
    stick?.fire('pointermove', pointer(0, 50));
    expect(game.keyboard.read(0).l).toBe(false);
    stick?.fire('pointerdown', pointer(50, 50));
    stick?.fire('pointermove', pointer(90, 50));
    expect(game.keyboard.read(0)).toMatchObject({ r: true, u: false });
  });

  it('끝까지 밀어도 기준점이 따라와서 반대로 밀면 바로 방향이 바뀐다', () => {
    const { elements, game } = setup();
    const stick = elements['[data-stick]'];
    stick?.fire('pointerdown', pointer(50, 50));
    stick?.fire('pointermove', pointer(250, 50));
    expect(game.keyboard.read(0)).toMatchObject({ r: true, l: false });
    stick?.fire('pointermove', pointer(190, 50));
    expect(game.keyboard.read(0)).toMatchObject({ l: true, r: false });
  });

  it('손가락을 떼거나 취소되면 모든 방향을 놓고 손잡이가 가운데로 돌아온다', () => {
    const { elements, game } = setup();
    const stick = elements['[data-stick]'];
    for (const end of ['pointerup', 'pointercancel']) {
      stick?.fire('pointerdown', pointer(50, 50));
      stick?.fire('pointermove', pointer(10, 90));
      expect(game.keyboard.read(0)).toMatchObject({ l: true, d: true });
      stick?.fire(end);
      expect(game.keyboard.read(0)).toMatchObject({ l: false, d: false });
      expect(elements['[data-knob]']?.style.transform).toBe('translate(0%, 0%)');
    }
  });

  it('버튼 네 개가 1P의 약펀치·약킥·강펀치·강킥에 대응하고 누른 표시를 켜고 끈다', () => {
    const { elements, game } = setup();
    for (const name of ['A', 'B', 'C', 'D'] as const) {
      const button = elements[`[data-button="${name}"]`];
      button?.fire('pointerdown', pointer(0, 0));
      expect(game.keyboard.read(0)[name]).toBe(true);
      expect(button?.attributes.has('data-pressed')).toBe(true);
      button?.fire('pointerup');
      expect(game.keyboard.read(0)[name]).toBe(false);
      expect(button?.attributes.has('data-pressed')).toBe(false);
    }
    expect(game.sound.init).toHaveBeenCalledTimes(4);
  });

  it('손가락이 취소돼도 버튼을 놓는다', () => {
    const { elements, game } = setup();
    const button = elements['[data-button="A"]'];
    button?.fire('pointerdown', pointer(0, 0));
    button?.fire('pointercancel');
    expect(game.keyboard.read(0).A).toBe(false);
  });

  it('일시정지 버튼은 일시정지를 켜고 끈다', () => {
    const { elements, game } = setup();
    elements['[data-pause]']?.fire('pointerdown');
    expect(game.paused).toBe(true);
    elements['[data-pause]']?.fire('pointerdown');
    expect(game.paused).toBe(false);
  });

  it('길게 눌러도 메뉴가 뜨지 않고, 조작 영역을 끌어도 화면이 밀리지 않는다', () => {
    const { elements } = setup();
    for (const type of ['contextmenu', 'touchstart', 'touchmove']) {
      const event = { preventDefault: vi.fn() };
      elements['[data-touch]']?.fire(type, event);
      expect(event.preventDefault).toHaveBeenCalled();
    }
  });

  it('두 손가락으로 조작해도 브라우저가 확대하지 않게 한다', () => {
    const { docHandlers } = setup();
    const event = { preventDefault: vi.fn() };
    docHandlers.get('gesturestart')?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('조작 요소가 없으면 어떤 요소인지 알리며 실패한다', () => {
    const doc = { querySelector: () => null, addEventListener: vi.fn() };
    expect(() => attachTouch({} as Game, doc as unknown as Document)).toThrow('[data-stick]');
  });
});
