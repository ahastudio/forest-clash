import { describe, expect, it } from 'vitest';
import { MOVE_LIST, MOVES } from './moves';

describe('기술 데이터', () => {
  it('기술 목록은 데이터의 순서 그대로이고 모든 기술이 MOVES에 있다', () => {
    expect(MOVE_LIST[0]).toBe('a5');
    expect(MOVE_LIST).toHaveLength(Object.keys(MOVES).length);
    for (const id of MOVE_LIST) {
      expect(MOVES[id].id).toBe(id);
    }
  });

  it('보통 기술은 발동·판정·후딜에서 끝 프레임과 전체 길이를 구한다', () => {
    const jab = MOVES.a5;
    expect(jab.start).toBe(3);
    expect(jab.end).toBe(5);
    expect(jab.total).toBe(9);
    expect(jab.windows).toEqual([[3, 5]]);
  });

  it('여러 번 맞는 기술은 구간 목록에서 시작과 끝을 구한다', () => {
    const special = MOVES.super;
    expect(special.start).toBe(8);
    expect(special.end).toBe(40);
    expect(special.windows).toHaveLength(3);
  });

  it('이득에서 경직을 계산한다: 경직 = 이득 + 판정 + 후딜', () => {
    expect(MOVES.a5.blockstun).toBe(1 + 3 + 3);
    expect(MOVES.a5.hitstun).toBe(5 + 3 + 3);
  });

  it('쓰러뜨리는 기술은 맞음 경직이 없다', () => {
    expect(MOVES.d2.hitstun).toBe(0);
    expect(MOVES.d2.blockstun).toBe(-6 + 3 + 18);
  });

  it('공중 기술은 경직을 직접 정한다', () => {
    expect(MOVES.ja.blockstun).toBe(12);
    expect(MOVES.ja.hitstun).toBe(15);
  });

  it('잡기는 막힘도 맞음도 경직이 없고, 여러 번 맞는 기술은 적어 둔 경직을 쓴다', () => {
    expect(MOVES.throw.blockstun).toBe(0);
    expect(MOVES.throw.hitstun).toBe(0);
    expect(MOVES.super.blockstun).toBe(14);
    expect(MOVES.super.hitstun).toBe(22);
  });

  it('타격 정지는 강한 기술 11, 약한 기술 8이고 기술이 직접 정할 수도 있다', () => {
    expect(MOVES.c5.hitstop).toBe(11);
    expect(MOVES.a5.hitstop).toBe(8);
    expect(MOVES.blow.hitstop).toBe(11);
    expect(MOVES.super.hitstop).toBe(14);
    expect(MOVES.throw.hitstop).toBe(0);
  });
});
