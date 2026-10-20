import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import type { Duel } from '../testing/duel';
import { drive, eventsOf, hold, idlePad, setup, tap } from '../testing/duel';
import { createEngine } from './index';

const lethal = (duel: Duel): void => {
  duel.R.hp = 1;
  drive(duel, 10, tap('A'));
};

/** 한 라운드를 K.O.로 끝내고 다음 안내가 끝날 때까지 흘려보낸다. */
function finishRoundByKnockOut(duel: Duel): void {
  lethal(duel);
  drive(duel, 400);
}

describe('타이틀과 결과 화면', () => {
  it('타이틀에서 20프레임이 지나기 전에는 버튼을 눌러도 시작하지 않는다', () => {
    const engine = createEngine();
    engine.step([{ A: 1 }, idlePad()]);
    expect(engine.phase).toBe('title');
  });

  it('1P 버튼은 컴퓨터와 대전, 2P 버튼만이면 둘이서 대전이다', () => {
    const cpu = createEngine();
    for (let i = 0; i < 25; i++) {
      cpu.step([idlePad(), idlePad()]);
    }
    cpu.step([{ A: 1 }, { B: 1 }]);
    expect(cpu.mode).toBe('cpu');
    expect(cpu.consume().map(e => e.type)).toContain('start');
    const two = createEngine();
    for (let i = 0; i < 25; i++) {
      two.step([idlePad(), idlePad()]);
    }
    two.step([idlePad(), { B: 1 }]);
    expect(two.mode).toBe('2p');
  });

  it('버튼을 계속 누르고 있으면 새로 누른 것이 아니라 시작하지 않는다', () => {
    const engine = createEngine();
    engine.step([{ A: 1 }, idlePad()]);
    for (let i = 0; i < 40; i++) {
      engine.step([{ A: 1 }, idlePad()]);
    }
    expect(engine.phase).toBe('title');
  });

  it('어떤 버튼이 눌렸는지 가른다', () => {
    const engine = createEngine();
    expect(engine.anyButton([{ A: 1 }, {}])).toEqual([true, false]);
    expect(engine.anyButton([{ l: 1 }, { D: 1 }])).toEqual([false, true]);
  });

  it('결과 화면에서 120프레임이 지나기 전에는 눌러도 돌아가지 않는다', () => {
    const duel = setup(70);
    patch(duel.engine, { phase: 'over', phaseTime: 0 });
    duel.engine.step([{ A: 1 }, idlePad()]);
    expect(duel.engine.phase).toBe('over');
  });
});

describe('K.O.와 라운드 진행', () => {
  it('체력이 다하면 K.O.가 되고 이긴 쪽이 한 판을 얻는다', () => {
    const duel = setup(70);
    lethal(duel);
    expect(duel.engine.phase).toBe('ko');
    expect(duel.engine.wins).toEqual([0, 1]);
    expect(duel.engine.banner).toBe('K.O.');
    expect(duel.R.state).toBe('ko');
    expect(eventsOf(duel, 'ko')).toHaveLength(1);
  });

  it('K.O.가 난 쪽은 맞은 방향으로 높이 날아간다', () => {
    const duel = setup(70);
    duel.R.hp = 1;
    drive(duel, 1, tap('A'));
    drive(duel, 5, tap('A'));
    const knockOut = eventsOf(duel, 'ko')[0];
    expect(knockOut).toBeDefined();
    expect(duel.R.launched).toBe(true);
    expect(duel.R.altitude).toBeGreaterThan(0);
    expect(duel.R.velocityX).toBeGreaterThan(0);
  });

  it('K.O. 안내가 끝나면 다음 라운드가 시작된다', () => {
    const duel = setup(70);
    finishRoundByKnockOut(duel);
    expect(duel.engine.round).toBe(2);
    expect(duel.engine.phase).toBe('fight');
    expect(duel.engine.fighters[0].hp).toBe(100);
    expect(duel.engine.banner).toBeNull();
  });

  it('두 판을 먼저 이기면 판이 끝나고 이긴 쪽을 알린다', () => {
    const duel = setup(70);
    finishRoundByKnockOut(duel);
    patch(duel, { L: duel.engine.fighters[1], R: duel.engine.fighters[0] });
    patch(duel.L, { x: 500, face: 1 });
    patch(duel.R, { x: 570, face: -1 });
    finishRoundByKnockOut(duel);
    expect(duel.engine.phase).toBe('over');
    expect(duel.engine.matchWinner).toBe(1);
    expect(eventsOf(duel, 'over')[0]?.winner).toBe(1);
  });

  it('왼쪽 캐릭터가 두 판을 이겨도 판이 끝난다', () => {
    const duel = setup(70);
    duel.engine.wins[0] = 1;
    duel.R.hp = 1;
    duel.L.hp = 1;
    drive(duel, 10, null, tap('A'));
    drive(duel, 400);
    expect(duel.engine.phase).toBe('over');
    expect(duel.engine.matchWinner).toBe(0);
  });
});

describe('시간 초과', () => {
  const runOut = (a: number, b: number): Duel => {
    const duel = setup(300);
    duel.engine.roundTimer = 2;
    duel.engine.fighters[0].hp = a;
    duel.engine.fighters[1].hp = b;
    drive(duel, 5);
    return duel;
  };

  it('체력이 더 많은 쪽이 한 판을 얻는다', () => {
    expect(runOut(80, 50).engine.wins).toEqual([1, 0]);
    expect(runOut(50, 80).engine.wins).toEqual([0, 1]);
  });

  it('체력이 같으면 아무도 얻지 못한다', () => {
    const duel = runOut(60, 60);
    expect(duel.engine.wins).toEqual([0, 0]);
    expect(duel.engine.phase).toBe('time');
    expect(duel.engine.banner).toBe('TIME UP');
    expect(eventsOf(duel, 'time')).toHaveLength(1);
  });
});

describe('타격 정지와 안내', () => {
  it('타격 정지 중에는 시간이 흐르지 않는다', () => {
    const duel = setup(70);
    drive(duel, 1, tap('A'));
    drive(duel, 3, hold({}));
    const before = duel.engine.roundTimer;
    duel.engine.hitstop = 3;
    drive(duel, 3);
    expect(duel.engine.roundTimer).toBe(before);
  });

  it('라운드 시작 안내가 끝날 때 FIGHT를 알린다', () => {
    const engine = createEngine();
    engine.newMatch('2p');
    const types: string[] = [];
    for (let i = 0; i < 120; i++) {
      engine.step([idlePad(), idlePad()]);
      types.push(...engine.consume().map(e => e.type));
    }
    expect(types).toContain('fight');
    expect(engine.phase).toBe('fight');
  });

  it('타이틀로 돌아가면 사건과 캐릭터가 초기화된다', () => {
    const engine = createEngine();
    engine.newMatch('cpu');
    engine.toTitle();
    expect(engine.phase).toBe('title');
    expect(engine.events).toHaveLength(0);
    expect(engine.fighters[0].hp).toBe(100);
  });
});
