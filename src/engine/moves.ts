import type { MoveId } from './move-specs';
import { SPECS } from './move-specs';
import type { AirSpec, GroundSpec, Move, MoveSpec, MultiHitSpec } from './move-types';

export type { MoveId } from './move-specs';
export type { BoxSpec, Move, MoveKind } from './move-types';

const HEAVY_HITSTOP = 11;
const LIGHT_HITSTOP = 8;
const NO_STUN = { blockstun: 0, hitstun: 0 };

const hasWindows = (spec: MoveSpec): spec is MultiHitSpec => 'windows' in spec;
const isAir = (spec: MoveSpec): spec is AirSpec => 'air' in spec;
const isGround = (spec: MoveSpec): spec is GroundSpec => 'blockAdvantage' in spec;

function timing(spec: MoveSpec): Pick<Move, 'start' | 'end' | 'total'> {
  if (hasWindows(spec)) {
    const [first, ...rest] = spec.windows;
    return { start: first[0], end: Math.max(first[1], ...rest.map(([, to]) => to)), total: spec.total };
  }
  return { start: spec.start, end: spec.start + spec.active - 1, total: spec.start + spec.active + spec.recovery };
}

/** 이득에서 경직을 계산한다: 경직 = 이득 + 판정 + 후딜. 쓰러뜨리는 기술은 맞음 경직이 없다. */
function stunsFromAdvantage(spec: GroundSpec): Pick<Move, 'blockstun' | 'hitstun'> {
  const recovery = spec.active + spec.recovery;
  return {
    blockstun: spec.blockAdvantage + recovery,
    hitstun: spec.hitAdvantage === 'kd' ? 0 : spec.hitAdvantage + recovery,
  };
}

function stuns(spec: MoveSpec): Pick<Move, 'blockstun' | 'hitstun'> {
  if (hasWindows(spec)) {
    return { blockstun: spec.blockstun, hitstun: spec.hitstun };
  }
  if (isAir(spec)) {
    return { blockstun: spec.blockstun, hitstun: spec.hitstun };
  }
  return isGround(spec) ? stunsFromAdvantage(spec) : NO_STUN;
}

function derive(id: MoveId, spec: MoveSpec): Move {
  const hs = spec.hitstop ?? (spec.heavy ? HEAVY_HITSTOP : LIGHT_HITSTOP);
  const { start, end, total } = timing(spec);
  const windows = hasWindows(spec) ? spec.windows : ([[start, end]] as const);
  return { ...spec, id, hitstop: hs, start, end, total, windows, ...stuns(spec) };
}

const ids = Object.keys(SPECS) as MoveId[];

export const MOVE_LIST: readonly MoveId[] = ids;
export const MOVES = Object.fromEntries(ids.map(id => [id, derive(id, SPECS[id])])) as Record<MoveId, Move>;
