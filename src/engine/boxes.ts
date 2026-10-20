import { CROUCH_HEIGHT, HURT_HALF_WIDTH, STAND_HEIGHT } from './constants';
import { attackMove } from './fighter';
import type { Move } from './moves';
import type { Box, Fighter, FighterState } from './types';

/** 뒤 대시 중 3~16프레임은 아래쪽이 비어 하단 공격을 넘는다. */
const BACK_DASH_AIRBORNE_FROM = 3;
const BACK_DASH_AIRBORNE_UNTIL = 16;
const BACK_DASH_CLEARANCE = 26;
/** 공중에서는 발이 땅에서 이만큼 떠 있다. */
const AIRBORNE_FOOT_GAP = 6;
/** 공격이 발동한 뒤에는 뻗은 팔다리가 맞을 수 있도록 공격 상자 둘레에 이만큼 더한다. */
const EXTENDED_LIMB_MARGIN = 3;

/** 두 상자가 겹치는가. 맞닿기만 한 것은 겹침이 아니다. */
export const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** 공격 상자. 바닥 중앙에서 앞쪽 거리와 높이로 적힌 값을 바라보는 방향에 맞춰 세계 좌표로 바꾼다. */
export function hitboxOf(fighter: Fighter, move: Move): Box | null {
  if (move.grab) {
    return null;
  }
  const [near, far, bottom, top] = move.hitboxRange;
  const facingRight = fighter.face > 0;
  return {
    x0: facingRight ? fighter.x + near : fighter.x - far,
    x1: facingRight ? fighter.x + far : fighter.x - near,
    y0: fighter.altitude + bottom,
    y1: fighter.altitude + top,
  };
}

/** 지금 프레임에 판정이 살아 있는 구간의 번호. 없으면 -1. */
export function activeWindow(fighter: Fighter): number {
  const move = attackMove(fighter);
  return move ? move.windows.findIndex(([from, to]) => fighter.elapsed >= from && fighter.elapsed <= to) : -1;
}

/** 지금 판정이 살아 있으면 공격 상자를 돌려준다. */
export function activeHitbox(fighter: Fighter): Box | null {
  const move = attackMove(fighter);
  return move && activeWindow(fighter) >= 0 ? hitboxOf(fighter, move) : null;
}

/** 상태별로 앉아 있는지 판단하는 방법. 나머지 상태는 서 있다. */
const CROUCH_TESTS: Partial<Record<FighterState, (fighter: Fighter) => boolean>> = {
  crouch: () => true,
  hitstun: fighter => fighter.hitCrouching,
  blockstun: fighter => fighter.guardingCrouched,
  attack: fighter => !!attackMove(fighter)?.crouching,
};

const isCrouching = (fighter: Fighter): boolean => CROUCH_TESTS[fighter.state]?.(fighter) ?? false;

const isBackDashClearing = (fighter: Fighter): boolean =>
  fighter.state === 'bdash' &&
  fighter.elapsed >= BACK_DASH_AIRBORNE_FROM &&
  fighter.elapsed <= BACK_DASH_AIRBORNE_UNTIL;

function bodyBottom(fighter: Fighter): number {
  const bottom = fighter.altitude > 0 ? fighter.altitude + AIRBORNE_FOOT_GAP : fighter.altitude;
  return isBackDashClearing(fighter) ? Math.max(bottom, BACK_DASH_CLEARANCE) : bottom;
}

function bodyBox(fighter: Fighter): Box {
  const height = isCrouching(fighter) ? CROUCH_HEIGHT : STAND_HEIGHT;
  return {
    x0: fighter.x - HURT_HALF_WIDTH,
    x1: fighter.x + HURT_HALF_WIDTH,
    y0: bodyBottom(fighter),
    y1: fighter.altitude + height,
  };
}

const grow = (box: Box, margin: number): Box => ({
  x0: box.x0 - margin,
  x1: box.x1 + margin,
  y0: box.y0 - margin,
  y1: box.y1 + margin,
});

/** 발동한 공격의 뻗은 팔다리. 아직 발동 전이면 없다. */
function extendedLimbBox(fighter: Fighter): Box | null {
  const move = attackMove(fighter);
  const box = move && fighter.elapsed >= move.start ? hitboxOf(fighter, move) : null;
  return box && grow(box, EXTENDED_LIMB_MARGIN);
}

/** 맞을 수 있는 상자들. 뻗은 팔다리도 맞을 수 있어서 헛치면 위험하다. */
export function hurtboxes(fighter: Fighter): Box[] {
  if (fighter.state === 'down') {
    return [];
  }
  const limb = extendedLimbBox(fighter);
  return limb ? [bodyBox(fighter), limb] : [bodyBox(fighter)];
}
