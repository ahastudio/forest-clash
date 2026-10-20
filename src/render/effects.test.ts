import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeCanvas } from '../testing/canvas';
import { Effects } from './effects';

afterEach(() => vi.restoreAllMocks());

const fixedRandom = (value = 0.5) => vi.spyOn(Math, 'random').mockReturnValue(value);

describe('효과', () => {
  it('먼지는 개수만큼 생기고 부드럽게 사라진다', () => {
    fixedRandom();
    const effects = new Effects();
    effects.dust({ x: 100, y: 400 }, 4);
    expect(effects.particles).toHaveLength(4);
    expect(effects.particles[0]).toMatchObject({ x: 100, y: 398, life: 22, soft: true });
  });

  it('타격 불꽃은 고리와 방사선, 흰 알갱이 다섯과 색 별 넷이다', () => {
    fixedRandom();
    const effects = new Effects();
    effects.impact({ x: 10, y: 20 }, 12, '#f00');
    expect(effects.bursts.map(b => b.kind)).toEqual(['ring', 'lines']);
    expect(effects.bursts[0]?.big).toBe(true);
    expect(effects.particles).toHaveLength(9);
    expect(effects.particles.filter(p => p.star)).toHaveLength(4);
  });

  it('색을 주지 않으면 기본 주황 별이고, 약한 타격의 고리는 작다', () => {
    fixedRandom();
    const effects = new Effects();
    effects.impact({ x: 0, y: 0 }, 4);
    expect(effects.bursts[0]?.big).toBe(false);
    expect(effects.particles.at(-1)?.color).toBe('#ffa526');
  });

  it('색종이는 80개 이상이면 더 늘리지 않는다', () => {
    fixedRandom();
    const effects = new Effects();
    for (let i = 0; i < 40; i++) {
      effects.confetti();
    }
    expect(effects.particles).toHaveLength(81);
    expect(effects.particles[0]?.color).toBe('#ff6b8b');
  });

  it('알갱이는 단계마다 다르게 움직이고 수명이 다하면 사라진다', () => {
    fixedRandom();
    const effects = new Effects();
    effects.particles.push({ x: 0, y: 0, velocityX: 2, velocityY: 1, life: 2, color: '#fff' });
    effects.advanceTitle();
    expect(effects.particles[0]).toMatchObject({ x: 0, life: 2 });
    effects.advanceBattle();
    expect(effects.particles[0]).toMatchObject({ x: 2, y: 1, velocityY: 1.25, life: 1 });
    effects.advanceResult();
    expect(effects.particles).toHaveLength(0);
  });

  it('그릴 때 고리와 방사선은 수명이 줄고 다하면 사라진다', () => {
    fixedRandom();
    const effects = new Effects();
    const { g } = fakeCanvas();
    effects.ring({ x: 5, y: 6 }, { life: 2, big: false });
    effects.draw(g, { paused: false });
    expect(effects.bursts[0]?.life).toBe(1);
    effects.draw(g, { paused: true });
    expect(effects.bursts[0]?.life).toBe(1);
    effects.draw(g, { paused: false });
    expect(effects.bursts).toHaveLength(0);
  });

  it('알갱이를 그린다: 별은 테두리까지, 부드러운 먼지는 더 옅게', () => {
    fixedRandom();
    const effects = new Effects();
    const { g, of, calls } = fakeCanvas();
    effects.particles.push(
      { x: 1, y: 2, velocityX: 0, velocityY: 0, life: 12, color: '#abc', star: true },
      { x: 3, y: 4, velocityX: 0, velocityY: 0, life: 15, color: '#def', soft: true, size: 6 },
      { x: 5, y: 6, velocityX: 0, velocityY: 0, life: 20, color: '#123' },
    );
    effects.draw(g, { paused: false });
    expect(of('rotate')).toHaveLength(1);
    expect(of('arc')).toHaveLength(2);
    expect(of('arc')[0]?.[2]).toBe(6);
    expect(of('arc')[1]?.[2]).toBe(4);
    expect(calls.at(-1)).toEqual(['set globalAlpha', 1]);
  });

  it('고리와 방사선을 그린다', () => {
    fixedRandom();
    const effects = new Effects();
    const { g, of } = fakeCanvas();
    effects.ring({ x: 0, y: 0 }, { life: 14, big: true, color: '#ff0' });
    effects.impact({ x: 0, y: 0 }, 3);
    effects.draw(g, { paused: false });
    expect(of('arc').length).toBeGreaterThanOrEqual(4);
    expect(of('moveTo')).toHaveLength(8);
  });
});
