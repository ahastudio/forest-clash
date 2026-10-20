import type { Fighter, MoveId } from '../engine';
import type { Difficulty } from './difficulty';
import type { AiPad, Side } from './pad';

/** 컴퓨터 상대가 기억해 두는 것. */
export interface Mind {
  /** 이어서 낼 입력들(연속 입력을 낼 때 쓴다). */
  queue: AiPad[];
  /** 다음 행동까지 더 쉬어야 하는 프레임 수. */
  wait: number;
  /** 상대 기술을 본 뒤 막기까지 기다리는 프레임 수. */
  reaction: number;
  /** 상대 기술을 마지막으로 본 시각과 그 기술. */
  lastTime: number;
  lastMove: MoveId | null;
  /** 0 이상 1 미만의 수를 돌려주는 난수원. 확률 판단은 모두 이것을 쓴다. */
  random: () => number;
}

/** 이번 판단에 쓰는 모든 것: 나, 상대, 거리, 상대가 있는 쪽과 반대쪽, 기억, 난이도. */
export interface Context {
  me: Fighter;
  foe: Fighter;
  dist: number;
  toward: Side;
  away: Side;
  mind: Mind;
  difficulty: Difficulty;
}

/** 컴퓨터 상대의 기억을 처음 상태로 만든다: 대기열, 대기 시간, 반응 지연, 마지막 시각과 기술이 비어 있다. 난수원을 주지 않으면 Math.random을 부를 때마다 읽는다. */
export const newMind = (random: () => number = () => Math.random()): Mind => ({
  queue: [],
  wait: 0,
  reaction: 0,
  lastTime: -1,
  lastMove: null,
  random,
});
