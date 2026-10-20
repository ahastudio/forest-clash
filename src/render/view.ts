import type { Engine } from '../engine';
import type { Ctx } from './layout';
import type { CharacterKind, Sprites } from './sprites';

/** 한 번 그릴 때 필요한 것들. now는 깜빡임에 쓰는 현재 시각(밀리초)이다. */
export interface View {
  g: Ctx;
  engine: Engine;
  sprites: Sprites;
  now: number;
}

interface Look {
  kind: CharacterKind;
  /** 초상화 바탕색. */
  face: string;
}

/** 두 캐릭터의 종류와 초상화 바탕색. 0번은 고양이, 1번은 새싹이다. */
export const LOOK: readonly [Look, Look] = [
  { kind: 'cat', face: '#ffe7c8' },
  { kind: 'sprout', face: '#cdeed6' },
];
