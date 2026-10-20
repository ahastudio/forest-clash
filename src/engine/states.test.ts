import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import { drive, eventsOf, hold, setup, tap } from '../testing/duel';
import { canBlock } from './blocking';
import { MOVES } from './moves';

describe('상태 전이', () => {
  it('뒤를 누른 채 구르면 뒤로 구른다', () => {
    const duel = setup(300);
    drive(duel, 3, hold({ A: 1, B: 1, l: 1 }));
    expect(duel.L.state).toBe('roll');
    expect(duel.L.rollDirection).toBe(-1);
  });

  it('땅에서 구르기가 끝나면 다시 행동할 수 있다', () => {
    const duel = setup(300);
    drive(duel, 3, hold({ A: 1, B: 1 }));
    drive(duel, 40);
    expect(duel.L.state).toBe('idle');
    expect(duel.L.velocityX).toBe(0);
  });

  it('체력이 없는 채 띄워졌다 떨어지면 쓰러진 채로 있다', () => {
    const duel = setup(300);
    patch(duel.R, { state: 'hitstun', launched: true, hp: 0, altitude: 20, velocityY: -3, stunFrames: 60 });
    drive(duel, 10);
    expect(duel.R.state).toBe('ko');
  });

  it('체력이 남은 채 띄워졌다 떨어지면 쓰러졌다가 일어난다', () => {
    const duel = setup(300);
    patch(duel.R, { state: 'hitstun', launched: true, altitude: 20, velocityY: -3, stunFrames: 60 });
    drive(duel, 5);
    expect(duel.R.state).toBe('down');
    expect(eventsOf(duel, 'land').some(e => e.hard)).toBe(true);
    drive(duel, 80);
    expect(duel.R.state).toBe('idle');
  });

  it('일어나는 동안 잠깐 움직일 수 없다', () => {
    const duel = setup(300);
    patch(duel.R, { state: 'down', elapsed: 35 });
    drive(duel, 2);
    expect(duel.R.state).toBe('lock');
    expect(duel.R.gettingUp).toBe(true);
  });

  it('땅 기술이 끝나는 순간 공중에 있으면 공중 상태가 된다', () => {
    const duel = setup(300);
    patch(duel.L, { state: 'attack', moveId: 'a5', elapsed: MOVES.a5.total - 1, altitude: 50, velocityY: 5 });
    drive(duel, 1);
    expect(duel.L.state).toBe('air');
  });

  it('공중 기술이 끝나면 공중으로 돌아간다', () => {
    const duel = setup(300);
    patch(duel.L, {
      state: 'attack',
      moveId: 'ja',
      elapsed: MOVES.ja.total - 1,
      altitude: 80,
      velocityY: 1,
      airAttackUsed: true,
    });
    drive(duel, 1);
    expect(duel.L.state).toBe('air');
    expect(duel.L.moveId).toBeNull();
  });

  it('기술 정보가 없는 공격 상태는 아무 일도 하지 않는다', () => {
    const duel = setup(300);
    patch(duel.L, { state: 'attack', moveId: null, elapsed: 3 });
    drive(duel, 1);
    expect(duel.L.elapsed).toBe(3);
  });

  it('던지는 쪽은 상대가 더는 잡혀 있지 않으면 풀려난다', () => {
    const duel = setup(300);
    patch(duel.L, { state: 'throwing', elapsed: 5 });
    drive(duel, 1);
    expect(duel.L.state).toBe('idle');
  });

  it('공중에 떠 있으면 새 행동을 고르지 않고 떨어진다', () => {
    const duel = setup(300);
    patch(duel.L, { state: 'idle', altitude: 30, velocityY: 0 });
    drive(duel, 3, hold({ r: 1 }));
    expect(duel.L.velocityX).toBe(0);
    expect(duel.L.altitude).toBeLessThan(30);
  });

  it('땅에 닿는 순간 막 떠오른 높이만 있어도 공중이다', () => {
    const duel = setup(300);
    drive(duel, 6, hold({ u: 1 }));
    expect(duel.L.state).toBe('air');
    expect(duel.L.altitude).toBeGreaterThan(0);
  });
});

describe('잡기 결말', () => {
  it('체력이 다한 상대를 던지면 K.O.가 된다', () => {
    const duel = setup(55);
    duel.R.hp = 1;
    drive(duel, 60, i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }));
    expect(duel.engine.phase).toBe('ko');
    expect(duel.R.hp).toBe(0);
    expect(eventsOf(duel, 'ko')).toHaveLength(1);
  });

  it('방어 중인 상대도 잡을 수 있다고 본다', () => {
    const duel = setup(55);
    patch(duel.R, { state: 'blockstun', stunFrames: 10 });
    drive(duel, 30, i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }));
    expect(eventsOf(duel, 'grab')).toHaveLength(1);
  });
});

describe('막던 도중 맞기', () => {
  it('막기를 멈춘 사이 맞으면 앉아 있었는지를 기억한다', () => {
    const duel = setup(70);
    patch(duel.R, { state: 'blockstun', stunFrames: 30, guardingCrouched: true });
    drive(duel, 12, tap('A'));
    expect(eventsOf(duel, 'hit')).toHaveLength(1);
    expect(duel.R.hitCrouching).toBe(true);
  });
});

describe('방어 판정', () => {
  it('잡기는 어떤 자세로도 막을 수 없다', () => {
    const duel = setup(55);
    patch(duel.R, { input: { ...duel.R.input, r: true } });
    const strike = { attacker: duel.L, defender: duel.R, move: MOVES.throw, window: 0 };
    expect(canBlock(strike)).toBe(false);
  });
});
