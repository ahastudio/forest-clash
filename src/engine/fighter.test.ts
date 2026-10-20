import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import { attackMove, backHeld, eatBuffer, forwardHeld, makeFighter, pressed, readInput } from './fighter';
import { newWorld } from './world';

const pad = (input: Record<string, number>) => input;

describe('입력 읽기', () => {
  it('바라보는 방향에 따라 앞뒤가 바뀐다', () => {
    const fighter = makeFighter(1);
    fighter.input.r = true;
    expect(forwardHeld(fighter)).toBe(true);
    expect(backHeld(fighter)).toBe(false);
    fighter.face = -1;
    expect(forwardHeld(fighter)).toBe(false);
    expect(backHeld(fighter)).toBe(true);
  });

  it('방향을 숫자패드 번호로 기록한다', () => {
    const world = newWorld();
    const fighter = makeFighter(1);
    const dirs: [Record<string, number>, number][] = [
      [{ r: 1, d: 1 }, 3],
      [{ r: 1, u: 1 }, 9],
      [{ r: 1 }, 6],
      [{ l: 1, d: 1 }, 1],
      [{ l: 1, u: 1 }, 7],
      [{ l: 1 }, 4],
      [{ d: 1 }, 2],
      [{ u: 1 }, 8],
      [{}, 5],
      [{ l: 1, r: 1 }, 5],
    ];
    for (const [input, expected] of dirs) {
      readInput(world, fighter, pad(input));
      expect(fighter.directionHistory.at(-1)).toBe(expected);
    }
  });

  it('입력 기록은 40칸까지만 남긴다', () => {
    const world = newWorld();
    const fighter = makeFighter(1);
    for (let i = 0; i < 60; i++) {
      readInput(world, fighter, i % 2 ? { r: 1 } : {});
    }
    expect(fighter.directionHistory).toHaveLength(40);
  });

  it('타격 정지 중에는 같은 방향을 또 기록하지 않고 버튼의 나이도 늘지 않는다', () => {
    const world = newWorld();
    const fighter = makeFighter(1);
    readInput(world, fighter, { A: 1 });
    world.hitstop = 5;
    readInput(world, fighter, { A: 1 });
    readInput(world, fighter, { A: 1 });
    expect(fighter.directionHistory).toHaveLength(1);
    expect(fighter.buttonAge.A).toBe(0);
    world.hitstop = 0;
    readInput(world, fighter, {});
    expect(fighter.buttonAge.A).toBe(1);
    expect(fighter.directionHistory).toHaveLength(2);
  });

  it('버튼은 새로 눌렀을 때만 눌림이고 나이는 99에서 멈춘다', () => {
    const world = newWorld();
    const fighter = makeFighter(1);
    readInput(world, fighter, { B: 1 });
    expect(fighter.justPressed.B).toBe(1);
    readInput(world, fighter, { B: 1 });
    expect(fighter.justPressed.B).toBe(0);
    for (let i = 0; i < 120; i++) {
      readInput(world, fighter, {});
    }
    expect(fighter.buttonAge.B).toBe(99);
  });

  it('앞을 짧은 간격으로 두 번 누르면 달리기 입력이다', () => {
    const world = newWorld();
    const fighter = makeFighter(1);
    world.frame = 10;
    readInput(world, fighter, { r: 1 });
    expect(fighter.doubleTapForward).toBe(false);
    world.frame = 11;
    readInput(world, fighter, {});
    world.frame = 14;
    readInput(world, fighter, { r: 1 });
    expect(fighter.doubleTapForward).toBe(true);
    world.frame = 60;
    readInput(world, fighter, {});
    world.frame = 80;
    readInput(world, fighter, { r: 1 });
    expect(fighter.doubleTapForward).toBe(false);
  });

  it('뒤를 두 번 누르면 뒤 대시 입력이다', () => {
    const world = newWorld();
    const fighter = makeFighter(1);
    world.frame = 5;
    readInput(world, fighter, { l: 1 });
    world.frame = 6;
    readInput(world, fighter, {});
    world.frame = 9;
    readInput(world, fighter, { l: 1 });
    expect(fighter.doubleTapBack).toBe(true);
  });
});

describe('버튼 기록', () => {
  it('1프레임 지연: 방금 누른 버튼은 한 프레임 뒤부터 눌림으로 본다', () => {
    const fighter = makeFighter(1);
    fighter.buttonAge.A = 0;
    expect(pressed(fighter, 'A')).toBe(false);
    fighter.buttonAge.A = 1;
    expect(pressed(fighter, 'A')).toBe(true);
    fighter.buttonAge.A = 7;
    expect(pressed(fighter, 'A')).toBe(false);
    expect(pressed(fighter, 'A', 8)).toBe(true);
  });

  it('버튼 기록을 지우면 모두 누르지 않은 것이 된다', () => {
    const fighter = makeFighter(1);
    fighter.buttonAge.A = 1;
    eatBuffer(fighter);
    expect(fighter.buttonAge.A).toBe(99);
  });
});

describe('지금 쓰는 기술', () => {
  it('공격 중일 때만 기술을 돌려준다', () => {
    const fighter = makeFighter(1);
    expect(attackMove(fighter)).toBeNull();
    patch(fighter, { state: 'attack', moveId: 'a5' });
    expect(attackMove(fighter)?.id).toBe('a5');
    patch(fighter, { state: 'attack', moveId: null });
    expect(attackMove(fighter)).toBeNull();
  });
});
