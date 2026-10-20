import { describe, expect, it } from 'vitest';
import { detectInputKind } from './kind';

const windowWith = (coarse: boolean) => ({ matchMedia: () => ({ matches: coarse }) }) as unknown as Window;

describe('입력 장치 알아내기', () => {
  it('손가락으로 조작하는 기기는 touch다', () => {
    expect(detectInputKind(windowWith(true))).toBe('touch');
  });

  it('그 밖의 기기는 keyboard다', () => {
    expect(detectInputKind(windowWith(false))).toBe('keyboard');
  });
});
