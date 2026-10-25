import type { Engine } from '../engine';
import type { TitleMenu } from '../menu';
import type { Guide } from './guide';
import type { Ctx } from './layout';
import type { CharacterKind, Sprites } from './sprites';

/** 한 번 그릴 때 필요한 것들. now는 깜빡임에 쓰는 현재 시각(밀리초)이고, guide는 입력 장치에 맞는 안내 문구, menu는 타이틀의 선택 메뉴, notice는 온라인 상황 한 줄(없으면 빈 글자), ping은 온라인 대전 중 서버와의 왕복 시간(밀리초, 없으면 null)이다. */
export interface View {
  g: Ctx;
  engine: Engine;
  sprites: Sprites;
  now: number;
  guide: Guide;
  menu: TitleMenu;
  notice: string;
  ping: number | null;
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
