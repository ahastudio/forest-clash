import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeCanvas } from './testing/canvas';

/** 화면 조작 요소(조이스틱, 버튼)를 대신하는 가짜 요소. 이벤트를 받기만 한다. */
const touchElement = { addEventListener: () => undefined };

/** 버전 표시(meta)는 version으로 돌려주고, 그 밖의 요소는 화면 조작 요소로 돌려준다. */
const findElement = (version: string | null) => (selector: string) =>
  selector.startsWith('meta') ? (version === null ? null : { content: version }) : touchElement;

/** 터치 기기가 아닌 화면을 대신하는 가짜 matchMedia. */
const matchMedia = () => ({ matches: false });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('시작', () => {
  it('캔버스와 버전을 찾아 게임을 시작하고 첫 화면을 그린다', async () => {
    const { g, of } = fakeCanvas();
    const canvas = {
      getContext: () => g,
      style: {},
      addEventListener: (type: string) => listened.push(`canvas:${type}`),
    };
    const frames: (() => void)[] = [];
    const listened: string[] = [];
    vi.stubGlobal('document', {
      getElementById: () => canvas,
      querySelector: findElement('abc123'),
      addEventListener: (type: string) => listened.push(`doc:${type}`),
    });
    vi.stubGlobal('window', { addEventListener: (type: string) => listened.push(`win:${type}`), matchMedia });
    vi.stubGlobal('performance', { now: () => 0 });
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback));
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        complete = false;
        naturalWidth = 0;
      },
    );
    await import('./main');
    expect(listened).toEqual([
      'win:keydown',
      'win:keyup',
      'win:blur',
      'doc:visibilitychange',
      'canvas:pointermove',
      'canvas:pointerdown',
      'doc:gesturestart',
    ]);
    expect(frames).toHaveLength(1);
    expect(of('fillRect').length).toBeGreaterThan(0);
  });

  it('버전 정보가 없어도 시작한다', async () => {
    const { g } = fakeCanvas();
    vi.stubGlobal('document', {
      getElementById: () => ({ getContext: () => g, style: {}, addEventListener: () => undefined }),
      querySelector: findElement(null),
      addEventListener: () => undefined,
    });
    vi.stubGlobal('window', { addEventListener: () => undefined, matchMedia });
    vi.stubGlobal('performance', { now: () => 0 });
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        complete = false;
        naturalWidth = 0;
      },
    );
    await expect(import('./main')).resolves.toBeDefined();
  });
});
