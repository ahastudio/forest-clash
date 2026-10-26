import { vi } from 'vitest';
import type { Fighter } from '../engine';
import { makeFighter } from '../engine/fighter';
import { patch } from '../patch';
import { difficultyFor } from './difficulty';
import type { Context } from './mind';
import { newMind } from './mind';

interface Setup {
  me?: Partial<Fighter>;
  foe?: Partial<Fighter>;
  dist?: number;
  wait?: number;
  level?: number;
}

/**
 * 내가 왼쪽(오른쪽을 봄), 상대가 dist만큼 오른쪽에 서 있는 판단 상황을 만든다.
 */
export function situation({ me = {}, foe = {}, dist = 100, wait = 0, level = 2 }: Setup = {}): Context {
  const mind = newMind();
  mind.wait = wait;
  return {
    me: patch(makeFighter(1), { x: 500, face: 1, ...me }),
    foe: patch(makeFighter(0), { x: 500 + dist, face: -1, ...foe }),
    dist,
    toward: 'r',
    away: 'l',
    mind,
    difficulty: difficultyFor(level),
  };
}

/**
 * Math.random이 차례로 돌려줄 값을 정한다. 다 쓰면 0.5를 돌려준다.
 */
export function rolls(...values: number[]): ReturnType<typeof vi.spyOn> {
  const queue = [...values];
  return vi.spyOn(Math, 'random').mockImplementation(() => queue.shift() ?? 0.5);
}
