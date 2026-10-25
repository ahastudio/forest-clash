import { describe, expect, it } from 'vitest';
import { Lockstep } from './lockstep';

const pressed = (inputs: ReturnType<Lockstep['next']>, index: 0 | 1) => inputs?.[index].A;

describe('락스텝', () => {
  it('처음 지연 프레임만큼은 아무것도 누르지 않은 입력으로 바로 진행한다', () => {
    const lockstep = new Lockstep(0, 2);
    expect(lockstep.next()).not.toBeNull();
    expect(lockstep.next()).not.toBeNull();
    expect(lockstep.next()).toBeNull();
  });

  it('내 입력은 지연 프레임 뒤의 번호를 달고 순서대로 나간다', () => {
    const lockstep = new Lockstep(0, 3);
    expect(lockstep.submit(16)).toEqual({ frame: 3, bits: 16 });
    expect(lockstep.submit(0)).toEqual({ frame: 4, bits: 0 });
  });

  it('상대 입력이 도착해야 그 프레임을 진행하고, 없으면 기다린다', () => {
    const lockstep = new Lockstep(0, 1);
    lockstep.next();
    lockstep.submit(16);
    expect(lockstep.next()).toBeNull();
    lockstep.receive({ frame: 1, bits: 0 });
    expect(pressed(lockstep.next(), 0)).toBe(1);
  });

  it('내 입력이 아직 없으면 상대 입력만 있어도 기다린다', () => {
    const lockstep = new Lockstep(0, 1);
    lockstep.next();
    lockstep.receive({ frame: 1, bits: 16 });
    expect(lockstep.next()).toBeNull();
  });

  it('슬롯 1이면 내 입력이 2P 자리에 들어간다', () => {
    const lockstep = new Lockstep(1, 1);
    lockstep.next();
    lockstep.submit(16);
    lockstep.receive({ frame: 1, bits: 32 });
    const inputs = lockstep.next();
    expect(pressed(inputs, 1)).toBe(1);
    expect(inputs?.[0].B).toBe(1);
  });

  it('상대 입력이 뒤바뀌어 도착해도 프레임 번호대로 진행한다', () => {
    const lockstep = new Lockstep(0, 1);
    lockstep.next();
    lockstep.submit(0);
    lockstep.submit(0);
    lockstep.receive({ frame: 2, bits: 16 });
    expect(lockstep.next()).toBeNull();
    lockstep.receive({ frame: 1, bits: 0 });
    expect(lockstep.next()?.[1].A).toBe(0);
    expect(lockstep.next()?.[1].A).toBe(1);
  });
});
