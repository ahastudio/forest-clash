import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import { makeFighter } from './fighter';
import { BASIC_MOTION, motion, motionAge, SUPER_MOTION } from './motions';

const withHistory = (hist: number[]) => patch(makeFighter(0), { directionHistory: hist });

describe('모션 입력', () => {
  it('↓→ 두 방향을 차례로 누르면 마지막 입력의 나이를 돌려준다', () => {
    expect(motionAge(withHistory([5, 2, 6]), 'qcf', BASIC_MOTION)).toBe(0);
    expect(motionAge(withHistory([5, 2, 6, 5, 5]), 'qcf', BASIC_MOTION)).toBe(2);
  });

  it('대각선이 낀 입력도 같은 모션으로 본다', () => {
    expect(motionAge(withHistory([2, 3, 6]), 'qcf', BASIC_MOTION)).toBe(0);
    expect(motionAge(withHistory([6, 3, 2, 3]), 'dp', BASIC_MOTION)).toBe(0);
  });

  it('순서가 맞지 않으면 모션이 아니다', () => {
    expect(motionAge(withHistory([6, 2]), 'qcf', BASIC_MOTION)).toBe(-1);
    expect(motionAge(withHistory([]), 'qcf', BASIC_MOTION)).toBe(-1);
  });

  it('마지막 입력이 너무 오래되었거나 모션이 너무 길게 이어지면 모션이 아니다', () => {
    const old = [2, 6, ...Array<number>(10).fill(5)];
    expect(motionAge(withHistory(old), 'qcf', BASIC_MOTION)).toBe(-1);
    const slow = [2, ...Array<number>(20).fill(5), 6];
    expect(motionAge(withHistory(slow), 'qcf', BASIC_MOTION)).toBe(-1);
  });

  it('여러 방식 가운데 가장 최근에 완성된 것의 나이를 쓴다', () => {
    expect(motionAge(withHistory([2, 6, 2, 3, 6]), 'qcf', BASIC_MOTION)).toBe(0);
  });

  it('분노 필살기는 ↓→↓→ 네 방향이다', () => {
    expect(motion(withHistory([2, 6, 2, 6]), 'qcf2', SUPER_MOTION)).toBe(true);
    expect(motion(withHistory([2, 6]), 'qcf2', SUPER_MOTION)).toBe(false);
  });
});
