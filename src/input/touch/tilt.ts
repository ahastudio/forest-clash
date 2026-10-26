/**
 * 손가락이 처음 닿은 곳에서 움직인 만큼의 기울기를 읽는 순수 계산. 화면 요소를 모른다.
 */

export type Direction = 'l' | 'r' | 'u' | 'd';

/**
 * 손가락이 움직인 만큼의 기울기. 손잡이를 끝까지 민 거리가 1이다.
 */
export interface Tilt {
  x: number;
  y: number;
}

/**
 * 화면에서 손가락이 닿은 위치(픽셀).
 */
export interface Point {
  x: number;
  y: number;
}

export const DIRECTIONS: readonly Direction[] = ['l', 'r', 'u', 'd'];

/**
 * 조이스틱을 가운데로 돌려놓은 기울기.
 */
export const CENTER: Tilt = { x: 0, y: 0 };

// 이 기울기보다 작으면 아무 방향도 누르지 않은 것으로 본다.
const DEAD_ZONE = 0.35;

// 한 방향이 눌렸다고 보는 각도 기준. 기울기가 더 큰 축에 대한 작은 축의 비율이며, 22.5도의 탄젠트 값이다. 이보다 작은 축은 누르지 않아서 곧게 위로 밀면 점프 방향이 섞이지 않는다.
const SECTOR_RATIO = 0.414;

/**
 * 손가락이 처음 닿은 곳에서 움직인 만큼을 기울기로 바꾼다. 끝까지 밀면 1에 붙인다.
 */
export function tiltOf(offset: Point, reach: number): Tilt {
  const x = offset.x / reach;
  const y = offset.y / reach;
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/**
 * 기울기에서 눌린 방향을 읽는다. 여덟 방향으로 나누므로 대각선만 두 방향이 함께 눌린다.
 */
export function directionsOf(tilt: Tilt): Record<Direction, boolean> {
  if (Math.hypot(tilt.x, tilt.y) < DEAD_ZONE) {
    return { l: false, r: false, u: false, d: false };
  }
  const horizontal = Math.abs(tilt.x) >= Math.abs(tilt.y) * SECTOR_RATIO;
  const vertical = Math.abs(tilt.y) >= Math.abs(tilt.x) * SECTOR_RATIO;
  return {
    l: horizontal && tilt.x < 0,
    r: horizontal && tilt.x > 0,
    u: vertical && tilt.y < 0,
    d: vertical && tilt.y > 0,
  };
}

/**
 * 손가락이 끝까지 민 거리를 넘으면 기준점을 손가락 쪽으로 끌고 온다. 그래서 반대로 밀 때 바로 반응한다.
 */
export function followOrigin(origin: Point, point: Point, reach: number): Point {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const excess = distance > reach ? (distance - reach) / distance : 0;
  return { x: origin.x + dx * excess, y: origin.y + dy * excess };
}
