import { activeHitbox, hurtboxes } from './boxes';
import { MAX_SEPARATION, THROW_RANGE, WALL_L, WALL_R } from './constants';
import type { Inputs } from './flow';
import { anyButton, newMatch, step, TITLE_INPUT_DELAY, toTitle } from './flow';
import { MOVE_LIST, MOVES } from './moves';
import type { Box, Fighter, GameEvent, GameMode, World } from './types';
import { newWorld } from './world';

export { MAX_HP, RAGE_MAX } from './constants';
export { attackMove } from './fighter';
export type { Inputs } from './flow';
export type { Move, MoveId, MoveKind } from './moves';
export type * from './types';
export { MOVE_LIST, MOVES };

export const constants = { WALL_L, WALL_R, MAX_SEPARATION, THROW_RANGE, TITLE_INPUT_DELAY } as const;

export interface Engine extends World {
  newMatch(mode: GameMode): void;
  toTitle(): void;
  step(inputs: Inputs): void;
  /** 쌓인 사건을 모두 꺼내고 비운다. */
  consume(): GameEvent[];
  hurtboxes(fighter: Fighter): Box[];
  hitboxOf(fighter: Fighter): Box | null;
  anyButton: typeof anyButton;
}

/** 게임 엔진을 만든다. 화면, 소리, 컴퓨터 상대가 쓰는 조작(판 시작, 한 프레임 진행, 사건 꺼내기)을 갖춘다. */
export function createEngine(): Engine {
  const world = newWorld();
  return Object.assign(world, {
    newMatch: (mode: GameMode) => newMatch(world, mode),
    toTitle: () => toTitle(world),
    step: (inputs: Inputs) => step(world, inputs),
    consume: () => world.events.splice(0),
    hurtboxes,
    hitboxOf: activeHitbox,
    anyButton,
  });
}
