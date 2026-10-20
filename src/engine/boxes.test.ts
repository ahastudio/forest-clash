import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import { activeHitbox, activeWindow, hitboxOf, hurtboxes, overlaps } from './boxes';
import { makeFighter } from './fighter';
import { MOVES } from './moves';

const attacker = (mv: 'a5' | 'super' | 'throw', t: number) =>
  patch(makeFighter(1), { x: 500, state: 'attack', moveId: mv, elapsed: t, face: 1 });

describe('판정 상자', () => {
  it('공격 상자는 바라보는 방향에 맞춰 뒤집힌다', () => {
    const right = hitboxOf(attacker('a5', 3), MOVES.a5);
    const left = hitboxOf(patch(attacker('a5', 3), { face: -1 }), MOVES.a5);
    expect(right).toEqual({ x0: 546, x1: 582, y0: 34, y1: 60 });
    expect(left).toEqual({ x0: 418, x1: 454, y0: 34, y1: 60 });
  });

  it('잡기에는 공격 상자가 없다', () => {
    expect(hitboxOf(attacker('throw', 3), MOVES.throw)).toBeNull();
  });

  it('상자가 겹치는지 가른다', () => {
    const box = { x0: 0, x1: 10, y0: 0, y1: 10 };
    expect(overlaps(box, { x0: 5, x1: 15, y0: 5, y1: 15 })).toBe(true);
    expect(overlaps(box, { x0: 10, x1: 20, y0: 0, y1: 10 })).toBe(false);
  });

  it('판정이 살아 있는 구간의 번호를 돌려준다', () => {
    expect(activeWindow(attacker('a5', 2))).toBe(-1);
    expect(activeWindow(attacker('a5', 3))).toBe(0);
    expect(activeWindow(attacker('super', 21))).toBe(1);
    expect(activeWindow(attacker('super', 15))).toBe(-1);
    expect(activeWindow(makeFighter(0))).toBe(-1);
  });

  it('판정이 살아 있을 때만 공격 상자를 돌려준다', () => {
    expect(activeHitbox(attacker('a5', 3))).not.toBeNull();
    expect(activeHitbox(attacker('a5', 0))).toBeNull();
    expect(activeHitbox(makeFighter(0))).toBeNull();
  });
});

describe('맞을 수 있는 상자', () => {
  it('서 있으면 높이 96, 앉으면 54, 공중에서는 발이 6 뜬다', () => {
    const standing = hurtboxes(makeFighter(0))[0];
    expect(standing?.y1).toBe(96);
    const crouch = hurtboxes(patch(makeFighter(0), { state: 'crouch' }))[0];
    expect(crouch?.y1).toBe(54);
    const air = hurtboxes(patch(makeFighter(0), { state: 'air', altitude: 100 }))[0];
    expect(air).toMatchObject({ y0: 106, y1: 196 });
  });

  it('맞는 중이나 막는 중에는 그때의 자세로 앉아 있는지 따른다', () => {
    expect(hurtboxes(patch(makeFighter(0), { state: 'hitstun', hitCrouching: true }))[0]?.y1).toBe(54);
    expect(hurtboxes(patch(makeFighter(0), { state: 'blockstun', guardingCrouched: true }))[0]?.y1).toBe(54);
    expect(hurtboxes(patch(makeFighter(0), { state: 'blockstun' }))[0]?.y1).toBe(96);
  });

  it('앉아서 쓰는 기술은 앉은 채다', () => {
    const fighter = patch(makeFighter(0), { state: 'attack', moveId: 'a2', elapsed: 0 });
    expect(hurtboxes(fighter)[0]?.y1).toBe(54);
  });

  it('쓰러져 있으면 맞지 않는다', () => {
    expect(hurtboxes(patch(makeFighter(0), { state: 'down' }))).toEqual([]);
  });

  it('뒤 대시 3~16프레임은 아래쪽이 비어 하단 공격을 넘는다', () => {
    const dashing = hurtboxes(patch(makeFighter(0), { state: 'bdash', elapsed: 5 }))[0];
    expect(dashing?.y0).toBe(26);
    const early = hurtboxes(patch(makeFighter(0), { state: 'bdash', elapsed: 1 }))[0];
    expect(early?.y0).toBe(0);
  });

  it('공격이 발동한 뒤에는 뻗은 팔다리가 맞을 수 있다', () => {
    expect(hurtboxes(attacker('a5', 2))).toHaveLength(1);
    const boxes = hurtboxes(attacker('a5', 3));
    expect(boxes).toHaveLength(2);
    expect(boxes[1]).toEqual({ x0: 543, x1: 585, y0: 31, y1: 63 });
  });

  it('잡기를 쓰는 중에는 뻗은 팔다리 상자가 없다', () => {
    expect(hurtboxes(attacker('throw', 5))).toHaveLength(1);
  });
});
