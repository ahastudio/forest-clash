import { describe, expect, it } from 'vitest';
import type { Pad } from '../engine';
import { decodePad, encodePad } from './bits';

const idle: Pad = { l: false, r: false, u: false, d: false, A: false, B: false, C: false, D: false };

describe('입력 비트', () => {
  it('아무것도 누르지 않으면 0이다', () => {
    expect(encodePad(idle)).toBe(0);
  });

  it('왼쪽, 오른쪽, 위, 아래, A, B, C, D 순서로 한 비트씩 차지한다', () => {
    const controls = ['l', 'r', 'u', 'd', 'A', 'B', 'C', 'D'] as const;
    controls.forEach((control, index) => {
      expect(encodePad({ ...idle, [control]: true })).toBe(1 << index);
    });
  });

  it('묶었다 풀면 같은 입력이 된다', () => {
    const pad: Pad = { ...idle, r: true, d: true, C: true };
    expect(decodePad(encodePad(pad))).toEqual({ l: 0, r: 1, u: 0, d: 1, A: 0, B: 0, C: 1, D: 0 });
  });
});
