import { describe, expect, it } from 'vitest';
import { fakeCanvas } from '../testing/canvas';
import { drawPause } from './pause';

describe('일시정지 화면', () => {
  it('조작 배치와 안내, 버전을 보인다', () => {
    const { g, texts } = fakeCanvas();
    drawPause(g, 'abc123');
    const all = texts();
    expect(all).toContain('일시정지');
    expect(all).toContain('1P (오른쪽 캐릭터)');
    expect(all).toContain('←');
    expect(all).toContain('G');
    expect(all).toContain('약');
    expect(all).toContain('펀치');
    expect(all).toContain('이동');
    expect(all).toContain('버전 abc123');
    expect(all.join('')).toContain('판정 상자');
  });
});
