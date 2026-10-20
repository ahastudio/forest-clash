import { describe, expect, it, vi } from 'vitest';
import { fakeSprites } from '../testing/canvas';
import { allPoseNames, hasMiddlePose, Sprites } from './sprites';

describe('그림', () => {
  it('자세 이름은 기본 자세와 기술 그림을 모두 포함한다', () => {
    const names = allPoseNames();
    expect(names).toContain('idle');
    expect(names).toContain('jab-m');
    expect(names).toContain('cjab-a');
    expect(names).not.toContain('cjab-m');
    expect(new Set(names).size).toBe(names.length);
  });

  it('중간 자세가 있는 기술을 가른다', () => {
    expect(hasMiddlePose('jab')).toBe(true);
    expect(hasMiddlePose('cjab')).toBe(false);
  });

  it('배경, 로고, 두 캐릭터의 모든 자세를 불러오기 시작한다', () => {
    const { images } = fakeSprites(false);
    expect(images.length).toBe(2 + 2 * allPoseNames().length);
    expect(images[0]?.src).toBe('bg.webp');
    expect(images[1]?.src).toBe('logo.webp');
    expect(images[2]?.src).toBe('characters/cat/idle.svg');
  });

  it('다 불러오기 전에는 null이고 불러온 뒤에는 그림을 돌려준다', () => {
    const loading = fakeSprites(false).sprites;
    expect(loading.background()).toBeNull();
    expect(loading.logo()).toBeNull();
    expect(loading.pose('cat', 'idle')).toBeNull();
    const ready = fakeSprites(true).sprites;
    expect(ready.background()).not.toBeNull();
    expect(ready.logo()).not.toBeNull();
    expect(ready.pose('sprout', 'idle')).not.toBeNull();
  });

  it('없는 자세는 null이다', () => {
    expect(fakeSprites(true).sprites.pose('cat', 'nothing')).toBeNull();
  });

  it('그림을 불러오면 미리 해독하고, 해독이 실패해도 멈추지 않는다', async () => {
    const decode = vi.fn(() => Promise.reject(new Error('해독 실패')));
    const sprites = new Sprites(
      () => ({ src: '', complete: false, naturalWidth: 0, decode }) as unknown as HTMLImageElement,
    );
    await Promise.resolve();
    expect(decode).toHaveBeenCalled();
    expect(sprites.logo()).toBeNull();
  });

  it('그림 만드는 방법을 주지 않으면 브라우저의 Image를 쓴다', () => {
    class StubImage {
      src = '';
      complete = false;
      naturalWidth = 0;
    }
    const original = globalThis.Image;
    globalThis.Image = StubImage as unknown as typeof Image;
    try {
      expect(new Sprites().background()).toBeNull();
    } finally {
      globalThis.Image = original;
    }
  });
});
