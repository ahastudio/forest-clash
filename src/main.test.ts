import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeCanvas } from './testing/canvas';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('시작', () => {
  it('캔버스와 버전을 찾아 게임을 시작하고 첫 화면을 그린다', async () => {
    const { g, of } = fakeCanvas();
    const canvas = { getContext: () => g };
    const frames: (() => void)[] = [];
    const listened: string[] = [];
    vi.stubGlobal('document', {
      getElementById: () => canvas,
      querySelector: () => ({ content: 'abc123' }),
      addEventListener: (type: string) => listened.push(`doc:${type}`),
    });
    vi.stubGlobal('window', { addEventListener: (type: string) => listened.push(`win:${type}`) });
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
    expect(listened).toEqual(['win:keydown', 'win:keyup', 'win:blur', 'doc:visibilitychange']);
    expect(frames).toHaveLength(1);
    expect(of('fillRect').length).toBeGreaterThan(0);
  });

  it('버전 정보가 없어도 시작한다', async () => {
    const { g } = fakeCanvas();
    vi.stubGlobal('document', {
      getElementById: () => ({ getContext: () => g }),
      querySelector: () => null,
      addEventListener: () => undefined,
    });
    vi.stubGlobal('window', { addEventListener: () => undefined });
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
