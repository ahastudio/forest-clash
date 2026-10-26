import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import type { Duel } from '../testing/duel';
import { drive, eventsOf, setup } from '../testing/duel';
import type { MoveId } from './index';
import { MOVES } from './index';

// 띄워진 상대(R)에게 공격자(L)가 기술을 막 발동한 상태에서 몇 프레임 진행해 맞은 횟수를 센다.
function hitsOnLaunched(id: MoveId, juggleCount: number): number {
  const duel: Duel = setup(60);
  patch(duel.R, { state: 'hitstun', launched: true, altitude: 12, velocityY: 0, stunFrames: 90, juggleCount });
  patch(duel.L, { state: 'attack', moveId: id, elapsed: MOVES[id].start - 1 });
  drive(duel, MOVES[id].end - MOVES[id].start + 2);
  return eventsOf(duel, 'hit').filter(event => event.attacker === 1).length;
}

describe('띄워진 상대에게 이어 맞히기(저글)', () => {
  it('저글이 되는 기술은 한도 안에서만 맞는다', () => {
    expect(hitsOnLaunched('dp_a', 0)).toBeGreaterThanOrEqual(1);
    expect(hitsOnLaunched('dp_a', 1)).toBeGreaterThanOrEqual(1);
    expect(hitsOnLaunched('dp_a', 2)).toBe(0);
  });

  it('저글이 되지 않는 기술은 띄워진 상대에게 맞지 않는다', () => {
    expect(hitsOnLaunched('dp_a', 0)).toBeGreaterThanOrEqual(1);
    expect(hitsOnLaunched('a5', 0)).toBe(0);
  });
});
