import type { Fighter } from './types';

// 숫자패드 방향으로 적은 모션. 2 아래, 3 아래앞, 6 앞, 4 뒤, 8 위. 같은 모션을 대각선 있는 입력과 없는 입력으로 모두 받는다.
const MOTIONS = {
  // ↓→ (돌진 팔꿈치)
  qcf: [
    [2, 6],
    [2, 3, 6],
  ],
  // →↓ (대공 어퍼)
  dp: [
    [6, 2],
    [6, 2, 3],
    [6, 3, 2, 3],
  ],
  // ↓→↓→ (분노 필살기)
  qcf2: [
    [2, 6, 2, 6],
    [2, 3, 6, 2, 3, 6],
    [2, 3, 6, 2, 6],
  ],
} as const satisfies Record<string, readonly (readonly number[])[]>;

type MotionName = keyof typeof MOTIONS;

interface Match {
  // 모션의 마지막 입력이 몇 프레임 전인가.
  age: number;
  // 모션의 첫 입력이 몇 프레임 전인가.
  span: number;
}

// 입력 기록 속 모션의 첫 입력과 마지막 입력의 자리(index).
interface Located {
  start: number;
  end: number;
}

// 아직 아무 방향도 찾지 못한 상태: 끝 자리는 없고, 기록 전체가 찾을 범위다.
const notStarted = (history: readonly number[]): Located => ({ start: history.length, end: -1 });

// 입력 기록을 뒤에서부터 훑어 모션의 각 방향이 놓인 자리를 찾는다. 하나라도 없으면 null.
const locate = (history: readonly number[], sequence: readonly number[]): Located | null =>
  [...sequence].reverse().reduce<Located | null>((found, direction) => {
    if (!found) {
      return null;
    }
    const index = history.slice(0, found.start).lastIndexOf(direction);
    return index < 0 ? null : { start: index, end: found.end < 0 ? index : found.end };
  }, notStarted(history));

function matchSequence(history: readonly number[], sequence: readonly number[]): Match | null {
  const found = locate(history, sequence);
  const last = history.length - 1;
  return found && { age: last - found.end, span: last - found.start };
}

// 모션을 인정하는 한도: 처음부터 끝까지 걸린 프레임 수(window)와 마지막 입력의 나이(recent).
interface MotionLimits {
  window: number;
  recent: number;
}

export const BASIC_MOTION: MotionLimits = { window: 16, recent: 9 };
export const SUPER_MOTION: MotionLimits = { window: 34, recent: 10 };

const isWithin = (match: Match | null, limits: MotionLimits): match is Match =>
  !!match && match.age <= limits.recent && match.span <= limits.window;

/**
 * 모션이 완성된 시점이 지금으로부터 몇 프레임 전인지 돌려준다. 맞지 않으면 -1.
 */
export function motionAge(fighter: Fighter, name: MotionName, limits: MotionLimits): number {
  const matches = MOTIONS[name].map(sequence => matchSequence(fighter.directionHistory, sequence));
  const ages = matches.filter(m => isWithin(m, limits)).map(m => m.age);
  return ages.length ? Math.min(...ages) : -1;
}

/**
 * 모션이 제한 안에 완성되었는가.
 */
export function motion(fighter: Fighter, name: MotionName, limits: MotionLimits): boolean {
  return motionAge(fighter, name, limits) >= 0;
}
