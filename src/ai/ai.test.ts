import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEngine } from '../engine';
import { patch } from '../patch';
import { applyDecision, combo, firstOf, hold, holdThenWait } from './decision';
import { answerAttack, holdGuard, stayStill } from './defense';
import { difficultyFor } from './difficulty';
import { create, roundLevel } from './index';
import { newMind } from './mind';
import { antiAir, coolDown, engage, superMove } from './offense';
import { emptyPad, go, padOf } from './pad';
import { rolls, situation } from './testing';

afterEach(() => vi.restoreAllMocks());

describe('입력 도우미', () => {
  it('아무것도 누르지 않은 입력과 누를 것만 적은 입력을 만든다', () => {
    expect(emptyPad()).toEqual({ l: 0, r: 0, u: 0, d: 0, A: 0, B: 0, C: 0, D: 0 });
    expect(padOf({ A: 1 }).A).toBe(1);
    expect(padOf({ A: 1 }).B).toBe(0);
    expect(go('l')).toEqual({ l: 1 });
    expect(go('r')).toEqual({ r: 1 });
  });
});

describe('난이도', () => {
  it('단계가 오를수록 반응이 빠르고 덜 놓친다', () => {
    expect(difficultyFor(0).missOther).toBeGreaterThan(difficultyFor(3).missOther);
    expect(difficultyFor(0).reaction[0]).toBeGreaterThan(difficultyFor(3).reaction[0]);
  });

  it('범위를 벗어나면 보통이다', () => {
    expect(difficultyFor(9)).toBe(difficultyFor(2));
    expect(difficultyFor(-1)).toBe(difficultyFor(2));
  });
});

describe('판단 결과', () => {
  it('누를 것, 쉬는 시간, 이어서 낼 입력으로 나뉜다', () => {
    expect(hold({ A: 1 })).toEqual({ press: { A: 1 } });
    expect(holdThenWait({ A: 1 }, 12)).toEqual({ press: { A: 1 }, wait: 12 });
    expect(combo([{ d: 1 }, { A: 1 }], 30).press).toEqual({ d: 1 });
    expect(combo([], 30).press).toEqual({});
  });

  it('쉬는 시간에는 난이도 배율이 곱해진다', () => {
    const mind = newMind();
    applyDecision(holdThenWait({}, 10), mind, difficultyFor(0));
    expect(mind.wait).toBe(20);
  });

  it('이어서 낼 입력은 기억해 두고 첫 입력만 지금 낸다', () => {
    const mind = newMind();
    const pad = applyDecision(combo([{ d: 1 }, { A: 1 }, { r: 1 }], 0), mind, difficultyFor(2));
    expect(pad.d).toBe(1);
    expect(mind.queue).toHaveLength(2);
    expect(mind.queue[0]?.A).toBe(1);
  });

  it('쉬는 시간이 없는 판단은 쉬는 시간을 건드리지 않는다', () => {
    const mind = newMind();
    mind.wait = 7;
    applyDecision(hold({ A: 1 }), mind, difficultyFor(2));
    expect(mind.wait).toBe(7);
  });

  it('처음으로 판단을 내리는 방법이 이기고, 아무도 내리지 못하면 가만히 있는다', () => {
    const context = situation();
    expect(firstOf([() => null, () => hold({ A: 1 }), () => hold({ B: 1 })], context).press).toEqual({ A: 1 });
    expect(firstOf([() => null], context).press).toEqual({});
  });
});

describe('방어', () => {
  it('막는 중이 아니면 방어를 유지하지 않는다', () => {
    expect(holdGuard(situation())).toBeNull();
  });

  it('막는 동안 뒤를 누르고, 앉아서 막았으면 계속 앉는다', () => {
    expect(holdGuard(situation({ me: { state: 'blockstun', stunFrames: 10 } }))?.press).toEqual({ l: 1 });
    expect(holdGuard(situation({ me: { state: 'blockstun', stunFrames: 10, guardingCrouched: true } }))?.press).toEqual(
      {
        l: 1,
        d: 1,
      },
    );
  });

  it('상대 후딜이 보이면 방어를 풀고 약펀치로 반격한다', () => {
    const counter = situation({
      me: { state: 'blockstun', stunFrames: 1 },
      foe: { state: 'attack', moveId: 'd5', elapsed: 20 },
      dist: 90,
    });
    expect(holdGuard(counter)?.press).toEqual({ A: 1 });
    const early = situation({
      me: { state: 'blockstun', stunFrames: 1 },
      foe: { state: 'attack', moveId: 'd5', elapsed: 5 },
      dist: 90,
    });
    expect(holdGuard(early)?.press).toEqual({ l: 1 });
    const far = situation({
      me: { state: 'blockstun', stunFrames: 1 },
      foe: { state: 'attack', moveId: 'd5', elapsed: 20 },
      dist: 200,
    });
    expect(holdGuard(far)?.press).toEqual({ l: 1 });
  });

  it('행동할 수 없는 상태에서는 아무것도 누르지 않는다', () => {
    expect(stayStill(situation({ me: { state: 'attack' } }))?.press).toEqual({});
    expect(stayStill(situation({ me: { state: 'walk' } }))).toBeNull();
  });

  it('상대가 공격 중이 아니거나 멀면 대응하지 않는다', () => {
    expect(answerAttack(situation())).toBeNull();
    expect(answerAttack(situation({ foe: { state: 'attack', moveId: 'a5', elapsed: 1 }, dist: 200 }))).toBeNull();
  });

  it('새 기술을 보면 반응 지연을 새로 뽑는다', () => {
    rolls(0.5, 0.99);
    const context = situation({ foe: { state: 'attack', moveId: 'c5', elapsed: 1 }, dist: 150 });
    answerAttack(context);
    expect(context.mind.lastMove).toBe('c5');
    expect(context.mind.reaction).toBe(12);
    answerAttack(context);
    expect(context.mind.reaction).toBe(12);
  });

  it('헛친 기술의 후딜에 반격한다', () => {
    rolls(0.1, 0.1);
    const context = situation({ foe: { state: 'attack', moveId: 'a5', elapsed: 8 }, dist: 100 });
    const decision = answerAttack(context);
    expect(decision?.press).toEqual({ A: 1 });
    expect(decision?.wait).toBe(14);
  });

  it('발동이 느린 기술은 약펀치로 끊는다', () => {
    rolls(0.5, 0.01);
    const context = situation({ foe: { state: 'attack', moveId: 'd5', elapsed: 2 }, dist: 100, level: 3 });
    const decision = answerAttack(context);
    expect(decision?.press).toEqual({ A: 1 });
    expect(decision?.wait).toBe(12);
  });

  it('기술이 닿기 전에 막는다. 하단은 앉아서 막는다', () => {
    rolls(0.5, 0.99);
    const mid = situation({ foe: { state: 'attack', moveId: 'c5', elapsed: 8 }, dist: 100 });
    expect(answerAttack(mid)?.press).toEqual({ l: 1 });
    rolls(0.5, 0.99);
    const low = situation({ foe: { state: 'attack', moveId: 'd2', elapsed: 10 }, dist: 100 });
    expect(answerAttack(low)?.press).toEqual({ l: 1, d: 1 });
  });

  it('막는 시기가 아니거나 놓치면 대응하지 않는다', () => {
    rolls(0.5);
    const early = situation({ foe: { state: 'attack', moveId: 'c5', elapsed: 1 }, dist: 100 });
    expect(answerAttack(early)).toBeNull();
    rolls(0.5, 0.0);
    const missed = situation({ foe: { state: 'attack', moveId: 'c5', elapsed: 8 }, dist: 100 });
    expect(answerAttack(missed)).toBeNull();
  });
});

describe('공격', () => {
  it('날아 드는 상대는 대공 어퍼 입력으로 받는다', () => {
    rolls(0);
    const decision = antiAir(situation({ foe: { altitude: 80, velocityY: -4 }, dist: 80 }));
    expect(decision?.press).toEqual({ r: 1 });
    expect(decision?.sequence).toHaveLength(5);
    expect(decision?.wait).toBe(40);
  });

  it('상대가 낮거나 올라가는 중이거나 멀거나 쉬는 중이면 받지 않는다', () => {
    expect(antiAir(situation({ foe: { altitude: 10, velocityY: -4 }, dist: 80 }))).toBeNull();
    expect(antiAir(situation({ foe: { altitude: 80, velocityY: 4 }, dist: 80 }))).toBeNull();
    expect(antiAir(situation({ foe: { altitude: 80, velocityY: -4 }, dist: 200 }))).toBeNull();
    expect(antiAir(situation({ foe: { altitude: 80, velocityY: -4 }, dist: 80, wait: 5 }))).toBeNull();
  });

  it('운이 따르지 않으면 대공 어퍼를 내지 않는다', () => {
    rolls(0.99);
    expect(antiAir(situation({ foe: { altitude: 80, velocityY: -4 }, dist: 80 }))).toBeNull();
  });

  it('쉬는 동안은 움직이지 않고, 너무 멀면 다가온다', () => {
    expect(coolDown(situation({ wait: 5, dist: 100 }))?.press).toEqual({});
    expect(coolDown(situation({ wait: 5, dist: 200 }))?.press).toEqual({ r: 1 });
    expect(coolDown(situation())).toBeNull();
  });

  it('분노 게이지가 가득이고 가까우면 필살기 입력을 낸다', () => {
    rolls(0);
    const decision = superMove(situation({ me: { rage: 100 }, dist: 80 }));
    expect(decision?.sequence).toHaveLength(8);
    expect(decision?.wait).toBe(60);
  });

  it('게이지가 모자라거나 멀거나 운이 나쁘면 필살기를 내지 않는다', () => {
    expect(superMove(situation({ me: { rage: 50 }, dist: 80 }))).toBeNull();
    expect(superMove(situation({ me: { rage: 100 }, dist: 150 }))).toBeNull();
    rolls(0.99);
    expect(superMove(situation({ me: { rage: 100 }, dist: 80 }))).toBeNull();
  });
});

describe('접근과 공격 고르기', () => {
  it('아주 멀면 앞으로 걷고 가끔 앞 두 번으로 달려 붙는다', () => {
    rolls(0.5);
    expect(engage(situation({ dist: 300 }))?.press).toEqual({ r: 1 });
    rolls(0.01);
    const rush = engage(situation({ dist: 300 }));
    expect(rush?.sequence).toHaveLength(12);
    expect(rush?.wait).toBe(20);
  });

  it('조금 멀면 다가오고 가끔 낮은 점프로 파고든다', () => {
    rolls(0.5);
    expect(engage(situation({ dist: 150 }))?.press).toEqual({ r: 1 });
    rolls(0.005);
    const hop = engage(situation({ dist: 150 }));
    expect(hop?.press).toEqual({ r: 1, u: 1 });
    expect(hop?.wait).toBe(40);
    rolls(0.005);
    expect(engage(situation({ dist: 200 }))?.press).toEqual({ r: 1 });
  });

  const normalRows: [number, object, number | undefined][] = [
    [0.01, { A: 1 }, 12],
    [0.1, { B: 1 }, 16],
    [0.14, { d: 1, A: 1 }, 12],
    [0.17, { d: 1, B: 1 }, 14],
    [0.2, { C: 1 }, 26],
    [0.23, { D: 1 }, 28],
    [0.25, { l: 1 }, undefined],
    [0.5, {}, undefined],
  ];
  it.each(normalRows)('사거리 안에서 롤 %s이면 보통 공격을 고른다', (roll, press, wait) => {
    rolls(roll * 0.8 + 0.001);
    const decision = engage(situation({ dist: 80 }));
    expect(decision?.press).toEqual(press);
    expect(decision?.wait).toBe(wait);
  });

  it('아주 가까우면 앞으로 붙으며 강펀치(잡기)를 쓴다', () => {
    rolls(0.01);
    const decision = engage(situation({ dist: 60 }));
    expect(decision?.press).toEqual({ r: 1, C: 1 });
  });

  it('막고 있는 상대는 읽은 자세에 맞춰 압박한다', () => {
    const standing = {
      state: 'idle' as const,
      input: { l: false, r: true, u: false, d: false, A: false, B: false, C: false, D: false },
    };
    rolls(0.01, 0.1);
    expect(engage(situation({ foe: standing, dist: 60, level: 3 }))?.press).toEqual({ r: 1, C: 1 });
    rolls(0.15, 0.1);
    expect(engage(situation({ foe: standing, dist: 80, level: 3 }))?.press).toEqual({ d: 1, B: 1 });
    rolls(0.27, 0.1);
    expect(engage(situation({ foe: standing, dist: 80, level: 3 }))?.press).toEqual({ d: 1, A: 1 });
    rolls(0.33, 0.1);
    expect(engage(situation({ foe: standing, dist: 80, level: 3 }))?.press).toEqual({ A: 1 });
    rolls(0.38, 0.1);
    expect(engage(situation({ foe: standing, dist: 80, level: 3 }))?.press).toEqual({ B: 1 });
    rolls(0.5, 0.1);
    expect(engage(situation({ foe: standing, dist: 80, level: 3 }))?.press).toEqual({ r: 1 });
    rolls(0.62, 0.1);
    expect(engage(situation({ foe: standing, dist: 80, level: 3 }))?.press).toEqual({ l: 1 });
    rolls(0.9, 0.1);
    expect(engage(situation({ foe: standing, dist: 80, level: 3 }))?.press).toEqual({});
  });

  it('앉아서 막는 상대에게는 앞+강킥으로 상단을 노린다', () => {
    const crouching = {
      state: 'idle' as const,
      input: { l: false, r: true, u: false, d: true, A: false, B: false, C: false, D: false },
    };
    rolls(0.2, 0.1);
    expect(engage(situation({ foe: crouching, dist: 80, level: 3 }))?.press).toEqual({ r: 1, D: 1 });
  });

  it('상대가 왼쪽에 있으면 왼쪽을 향한 방어 자세를 읽는다', () => {
    const left = { x: 420, input: { l: true, r: false, u: false, d: false, A: false, B: false, C: false, D: false } };
    rolls(0.15, 0.1);
    expect(engage(situation({ foe: left, dist: 80, level: 3 }))?.press).toEqual({ d: 1, B: 1 });
  });

  it('막기 경직 중인 상대도 막고 있는 것으로 본다', () => {
    rolls(0.3, 0.1);
    const decision = engage(situation({ foe: { state: 'blockstun' }, dist: 80, level: 3 }));
    expect(decision?.press).toEqual({ A: 1 });
  });

  it('난이도가 낮아 압박 확률에 걸리지 않으면 보통 공격을 고른다', () => {
    const standing = {
      state: 'idle' as const,
      input: { l: false, r: true, u: false, d: false, A: false, B: false, C: false, D: false },
    };
    rolls(0.01, 0.99);
    expect(engage(situation({ foe: standing, dist: 80, level: 2 }))?.press).toEqual({ A: 1 });
  });
});

describe('컴퓨터 상대 전체', () => {
  it('싸우는 단계가 아니면 입력을 비우고 이어서 낼 입력도 버린다', () => {
    const engine = createEngine();
    const ai = create(engine);
    expect(ai(1)).toEqual(emptyPad());
  });

  it('이어서 낼 입력이 있으면 하나씩 꺼내 낸다', () => {
    const engine = createEngine();
    engine.newMatch('cpu');
    patch(engine, { phase: 'fight' });
    rolls(0);
    const ai = create(engine, { level: 3 });
    patch(engine.fighters[1], { x: 400 });
    patch(engine.fighters[0], { x: 480, altitude: 80, velocityY: -3 });
    const first = ai(1);
    expect(first.r).toBe(1);
    const second = ai(1);
    expect(second.r).toBe(1);
    const third = ai(1);
    expect(third.d).toBe(1);
  });

  it('상대가 어느 쪽에 있든 그쪽으로 향하고, 어느 번호의 캐릭터든 조종한다', () => {
    const engine = createEngine();
    engine.newMatch('2p');
    patch(engine, { phase: 'fight' });
    patch(engine.fighters[0], { x: 800 });
    patch(engine.fighters[1], { x: 400 });
    rolls(0.5, 0.5, 0.5);
    const ai = create(engine, { level: 3 });
    expect(ai(1).r).toBe(1);
    expect(ai(0).l).toBe(1);
  });

  it('난수원을 주면 전역 Math.random을 읽지 않고 그 값으로 판단한다', () => {
    const engine = createEngine();
    engine.newMatch('cpu');
    patch(engine, { phase: 'fight' });
    const global = vi.spyOn(Math, 'random');
    const injected = vi.fn(() => 0.5);
    create(engine, { random: injected })(1);
    expect(injected).toHaveBeenCalled();
    expect(global).not.toHaveBeenCalled();
  });

  it('난이도는 숫자나 함수로 줄 수 있고 주지 않으면 보통이다', () => {
    const engine = createEngine();
    engine.newMatch('cpu');
    patch(engine, { phase: 'fight' });
    rolls();
    const calls = vi.fn(() => 1);
    create(engine, { level: calls })(1);
    expect(calls).toHaveBeenCalled();
    create(engine, { level: 0 })(1);
    create(engine)(1);
  });

  it('라운드가 오를수록 어려워지고 지고 있으면 한 단계 낮아진다', () => {
    expect(roundLevel({ round: 1, wins: [0, 0] })).toBe(0);
    expect(roundLevel({ round: 2, wins: [0, 0] })).toBe(1);
    expect(roundLevel({ round: 3, wins: [0, 0] })).toBe(2);
    expect(roundLevel({ round: 9, wins: [0, 0] })).toBe(2);
    expect(roundLevel({ round: 3, wins: [0, 1] })).toBe(1);
    expect(roundLevel({ round: 1, wins: [0, 1] })).toBe(0);
  });
});
