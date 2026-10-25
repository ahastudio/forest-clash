import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import type { Script } from '../testing/duel';
import { drive, eventsOf, hold, setup, tap } from '../testing/duel';
import { MOVES, RAGE_MAX } from './index';

const A5_RANGE = (MOVES.a5.hitboxRange[1] ?? 0) - 8;
const SUPER_MOTION: Script = i =>
  i < 2 ? { d: 1 } : i < 4 ? { r: 1 } : i < 6 ? { d: 1 } : i < 8 ? { r: 1 } : i === 8 ? { r: 1, C: 1 } : {};

describe('분노 게이지가 차는 양', () => {
  it('약펀치를 맞히면 맞힌 쪽은 피해만큼, 맞은 쪽은 1.6배 찬다', () => {
    const duel = setup(A5_RANGE);
    drive(duel, 20, tap('A'));
    expect(eventsOf(duel, 'hit')).toHaveLength(1);
    expect(duel.L.rage).toBeCloseTo(MOVES.a5.damage, 5);
    expect(duel.R.rage).toBeCloseTo(MOVES.a5.damage * 1.6, 5);
  });

  it('약펀치를 막으면 막은 쪽은 1.5, 막힌 쪽은 2 찬다', () => {
    const duel = setup(A5_RANGE);
    drive(duel, 20, tap('A'), hold({ r: 1 }));
    expect(eventsOf(duel, 'block')).toHaveLength(1);
    expect(duel.R.rage).toBeCloseTo(1.5, 5);
    expect(duel.L.rage).toBeCloseTo(2, 5);
  });

  it('게이지는 100을 넘지 않는다', () => {
    const duel = setup(A5_RANGE);
    patch(duel.R, { rage: RAGE_MAX - 1 });
    drive(duel, 20, tap('A'));
    expect(duel.R.rage).toBe(RAGE_MAX);
  });
});

describe('분노 필살기의 막힘 피해', () => {
  it('체력이 1인 쪽이 막아도 체력은 1 밑으로 줄지 않는다', () => {
    const duel = setup(70);
    patch(duel.L, { rage: RAGE_MAX });
    patch(duel.R, { hp: 1 });
    drive(duel, 160, SUPER_MOTION, hold({ r: 1 }));
    expect(eventsOf(duel, 'block').length).toBeGreaterThanOrEqual(1);
    expect(duel.R.hp).toBe(1);
  });
});
