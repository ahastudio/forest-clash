import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sound } from './audio/sound';
import { TitleDemo } from './demo';
import { MAX_HP } from './engine';
import { patch } from './patch';
import { Effects } from './render/effects';

afterEach(() => vi.restoreAllMocks());

/** 같은 순서로 같은 값을 내는 난수: 시험이 언제나 같은 결과가 나오게 한다. */
function seededRandom(): () => number {
  let state = 12345;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function setup() {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom());
  const effects = new Effects();
  return { demo: new TitleDemo(effects, new Sound()), effects };
}

const run = (demo: TitleDemo, frames: number): void => {
  for (let i = 0; i < frames; i++) {
    demo.step();
  }
};

describe('타이틀 배경 대전', () => {
  it('컴퓨터끼리의 대전으로 시작한다', () => {
    const { demo } = setup();
    expect(demo.engine.mode).toBe('cpu');
    expect(demo.engine.phase).toBe('intro');
  });

  it('시작 안내가 지나면 싸우기 시작해 캐릭터가 움직이고 서로 맞는다', () => {
    const { demo, effects } = setup();
    const startX = demo.engine.fighters.map(fighter => fighter.x);
    run(demo, 3000);
    expect(demo.engine.fighters.map(fighter => fighter.x)).not.toEqual(startX);
    expect(effects.bursts.length + effects.particles.length).toBeGreaterThan(0);
  });

  it('체력이 낮아지면 다시 채워서 K.O.가 나지 않는다', () => {
    const { demo } = setup();
    run(demo, 200);
    patch(demo.engine.fighters[0], { hp: 5 });
    demo.step();
    expect(demo.engine.fighters[0].hp).toBe(MAX_HP);
  });

  it('체력이 충분하면 그대로 둔다', () => {
    const { demo } = setup();
    run(demo, 200);
    patch(demo.engine.fighters[1], { hp: MAX_HP - 10 });
    demo.step();
    expect(demo.engine.fighters[1].hp).toBe(MAX_HP - 10);
  });

  it('판이 끝나면 새 판을 시작해 계속 싸운다', () => {
    const { demo } = setup();
    run(demo, 200);
    patch(demo.engine, { phase: 'over', matchWinner: 0 });
    demo.step();
    expect(demo.engine.phase).toBe('intro');
    expect(demo.engine.wins).toEqual([0, 0]);
  });
});
