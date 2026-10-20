import { MAX_SEPARATION, PUSH_HALF_WIDTH, WALL_L, WALL_R } from './constants';
import type { Fighter, World } from './types';

const WALL_TOUCH_MARGIN = 1;
const NO_PUSH_STATES = ['down', 'thrown'];

const clampToWalls = (fighter: Fighter): void => {
  fighter.x = Math.max(WALL_L, Math.min(WALL_R, fighter.x));
};

const touchesWall = (fighter: Fighter, direction: number): boolean =>
  (fighter.x <= WALL_L + WALL_TOUCH_MARGIN && direction < 0) ||
  (fighter.x >= WALL_R - WALL_TOUCH_MARGIN && direction > 0);

/** 밀어내는 몫: 벽에 붙은 쪽은 움직이지 않고 상대가 겹친 만큼을 모두 밀려난다. 둘 다 자유로우면 반씩이다. */
function pushShares(left: Fighter, right: Fighter, direction: number): { left: number; right: number } {
  const leftBlocked = touchesWall(left, -direction);
  const rightBlocked = touchesWall(right, direction);
  if (leftBlocked && !rightBlocked) {
    return { left: 0, right: 1 };
  }
  return rightBlocked && !leftBlocked ? { left: 1, right: 0 } : { left: 0.5, right: 0.5 };
}

function pushApart(left: Fighter, right: Fighter, overlap: number): void {
  const direction = left.x <= right.x ? 1 : -1;
  const shares = pushShares(left, right, direction);
  left.x -= direction * overlap * shares.left;
  right.x += direction * overlap * shares.right;
  [left, right].forEach(clampToWalls);
}

const canPush = (a: Fighter, b: Fighter): boolean =>
  a.altitude === 0 && b.altitude === 0 && !NO_PUSH_STATES.includes(a.state) && !NO_PUSH_STATES.includes(b.state);

/** 땅에 있는 두 몸이 겹치면 밀어낸다. */
function resolveBodyOverlap(a: Fighter, b: Fighter): void {
  const overlap = PUSH_HALF_WIDTH * 2 - Math.abs(a.x - b.x);
  if (overlap > 0 && canPush(a, b)) {
    pushApart(a, b, overlap);
  }
}

/** 더 빠르게 멀어지는 쪽이 끌려온다. */
function pullBack(a: Fighter, b: Fighter, correction: number): void {
  const side = Math.sign(correction);
  const [mover, shift] = a.velocityX * -side > b.velocityX * side ? [a, correction] : [b, -correction];
  mover.x += shift;
}

/** 두 캐릭터는 너무 멀리 벌어지지 않는다. */
function limitSeparation(a: Fighter, b: Fighter): void {
  const gap = b.x - a.x;
  const excess = Math.abs(gap) - MAX_SEPARATION;
  if (excess > 0) {
    pullBack(a, b, Math.sign(gap) * excess);
  }
}

/** 벽 안에 가두고, 겹침을 풀고, 너무 벌어지지 않게 한다. */
export function keepInStage(world: World): void {
  const [a, b] = world.fighters;
  world.fighters.forEach(clampToWalls);
  resolveBodyOverlap(a, b);
  limitSeparation(a, b);
}
