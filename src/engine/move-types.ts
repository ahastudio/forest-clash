import type { MoveId } from './move-specs';

/** 높이: mid 중단(서서도 앉아서도 막는다), high 상단(서서만), low 하단(앉아서만), grab 잡기(방어를 무시한다). */
export type MoveKind = 'mid' | 'high' | 'low' | 'grab';
export type BoxSpec = readonly [number, number, number, number];

/** 모든 기술이 가진 값. */
interface CommonSpec {
  name: string;
  kind: MoveKind;
  damage: number;
  hitboxRange: BoxSpec;
  pushback: number;
  hitstop?: number;
  cancelable?: boolean;
  heavy?: boolean;
  crouching?: boolean;
  lungeSpeed?: number;
  lungeStart?: number;
  special?: boolean;
  super?: boolean;
  invincibleFrames?: number;
  rising?: boolean;
  launchSpeed?: number;
  finalLaunchSpeed?: number;
  knockdown?: boolean;
  juggles?: boolean;
  chipDamage?: number;
}

/** 발동·판정·후딜로 정해지는 기술의 시간. */
export interface Timing {
  start: number;
  active: number;
  recovery: number;
}

/** 땅 기술: 첫 판정 프레임에 맞혔을 때의 이득(advB 막힘, advH 맞음)으로 경직이 정해진다. 'kd'는 쓰러뜨린다. */
export interface GroundSpec extends CommonSpec, Timing {
  blockAdvantage: number;
  hitAdvantage: number | 'kd';
}

/** 잡기: 방어를 무시하고, 막힘과 맞음의 경직이 없다. */
interface GrabSpec extends CommonSpec, Timing {
  grab: true;
}

/** 공중 기술: 이득 대신 막힘 경직(bst)과 맞음 경직(hst)을 직접 정한다. */
export interface AirSpec extends CommonSpec, Timing {
  air: true;
  blockstun: number;
  hitstun: number;
}

/** 판정이 살아 있는 구간: [시작 프레임, 끝 프레임]. */
type FrameWindow = readonly [number, number];

/** 여러 번 맞는 기술: 구간마다 피해가 다르고 전체 길이와 경직을 직접 정한다. */
export interface MultiHitSpec extends CommonSpec {
  windows: readonly [FrameWindow, ...FrameWindow[]];
  windowDamages: readonly number[];
  total: number;
  blockstun: number;
  hitstun: number;
}

export type MoveSpec = GroundSpec | GrabSpec | AirSpec | MultiHitSpec;

export interface Move extends CommonSpec {
  air?: boolean;
  grab?: boolean;
  /** 첫 판정 프레임에 맞혔을 때의 이득. 막혔을 때와 맞았을 때. 'kd'는 쓰러뜨린다. */
  blockAdvantage?: number;
  hitAdvantage?: number | 'kd';
  id: MoveId;
  start: number;
  /** 마지막 판정 프레임. */
  end: number;
  total: number;
  hitstop: number;
  blockstun: number;
  hitstun: number;
  /** 판정이 살아 있는 구간들(시작 프레임, 끝 프레임). 대부분의 기술은 구간이 하나다. */
  windows: readonly [FrameWindow, ...FrameWindow[]];
  windowDamages?: readonly number[];
}
