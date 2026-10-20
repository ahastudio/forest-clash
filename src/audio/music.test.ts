import { describe, expect, it } from 'vitest';
import { hasHiHat, musicStep, STEP_SECONDS } from './music';

describe('배경음악', () => {
  it('한 칸은 8분음표 길이다', () => {
    expect(STEP_SECONDS).toBeCloseTo(60 / 138 / 2);
  });

  it('선율이 있는 칸은 베이스와 선율이 함께 울린다', () => {
    const voices = musicStep(0);
    expect(voices).toHaveLength(2);
    expect(voices[0]).toMatchObject({ kind: 'tone', wave: 'triangle' });
    expect(voices[1]).toMatchObject({ kind: 'tone', wave: 'square' });
  });

  it('선율이 쉬는 칸은 베이스만 울린다', () => {
    expect(musicStep(1)).toHaveLength(1);
  });

  it('곡은 반복되고, 짝수 칸마다 하이햇이 있다', () => {
    expect(musicStep(32)).toEqual(musicStep(0));
    expect(hasHiHat(2)).toBe(true);
    expect(hasHiHat(3)).toBe(false);
  });

  it('베이스 음높이는 악보의 음에서 나온다', () => {
    const bass = musicStep(0)[0];
    expect(bass && 'from' in bass ? bass.from : 0).toBeCloseTo(65.41, 1);
  });
});
