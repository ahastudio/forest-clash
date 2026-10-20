import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import { WALL_L, WALL_R } from './constants';
import type { makeFighter } from './fighter';
import { keepInStage } from './stage';
import { newWorld } from './world';

function stage(a: Partial<ReturnType<typeof makeFighter>>, b: Partial<ReturnType<typeof makeFighter>>) {
  const world = newWorld();
  patch(world.fighters[0], a);
  patch(world.fighters[1], b);
  keepInStage(world);
  return world.fighters;
}

describe('무대', () => {
  it('벽 밖으로 나간 캐릭터를 벽 안으로 되돌린다', () => {
    expect(stage({ x: WALL_R + 50 }, { x: 700 })[0].x).toBe(WALL_R);
    expect(stage({ x: 600 }, { x: WALL_L - 50 })[1].x).toBe(WALL_L);
  });

  it('겹친 두 몸은 반씩 밀려난다', () => {
    const [right, left] = stage({ x: 600 }, { x: 590 });
    expect(left.x).toBeLessThan(590);
    expect(right.x).toBeGreaterThan(600);
    expect(Math.abs(right.x - left.x)).toBeCloseTo(52);
  });

  it('왼쪽 벽에 붙은 쪽은 움직이지 않고 상대가 대신 밀려난다', () => {
    const [far, wall] = stage({ x: WALL_L + 10 }, { x: WALL_L });
    expect(wall.x).toBe(WALL_L);
    expect(far.x).toBeCloseTo(WALL_L + 52);
  });

  it('오른쪽 벽에 붙은 쪽도 움직이지 않는다', () => {
    const [wall, near] = stage({ x: WALL_R }, { x: WALL_R - 10 });
    expect(wall.x).toBe(WALL_R);
    expect(near.x).toBeCloseTo(WALL_R - 52);
  });

  it('왼쪽 벽에 붙은 쪽은 움직이지 않고 겹친 만큼 오른쪽이 밀려난다', () => {
    const [a, b] = stage({ x: WALL_L }, { x: WALL_L + 10 });
    expect(a.x).toBe(WALL_L);
    expect(b.x).toBeCloseTo(WALL_L + 52);
  });

  it('공중에 있거나 쓰러져 있으면 서로 밀어내지 않는다', () => {
    const [a, b] = stage({ x: 600, altitude: 40 }, { x: 600 });
    expect(a.x).toBe(600);
    expect(b.x).toBe(600);
    const [c, d] = stage({ x: 600, state: 'down' }, { x: 600 });
    expect(c.x).toBe(600);
    expect(d.x).toBe(600);
    const [e, f] = stage({ x: 600 }, { x: 600, state: 'thrown' });
    expect(e.x).toBe(600);
    expect(f.x).toBe(600);
  });

  it('최대 간격을 넘어 벌어지면 더 빠르게 멀어지는 쪽이 끌려온다', () => {
    const [a, b] = stage({ x: 800, velocityX: 5 }, { x: 330, velocityX: 0 });
    expect(a.x).toBe(770);
    expect(b.x).toBe(330);
    const [c, d] = stage({ x: 800, velocityX: 0 }, { x: 330, velocityX: -5 });
    expect(c.x).toBe(800);
    expect(d.x).toBe(360);
  });
});
