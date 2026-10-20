import { describe, expect, it } from 'vitest';
import { directionsOf, followOrigin, tiltOf } from './tilt';

describe('조이스틱 기울기', () => {
  it('끝까지 민 거리가 1이고 그 너머는 1에 붙인다', () => {
    expect(tiltOf({ x: 0, y: 0 }, 40)).toEqual({ x: 0, y: 0 });
    expect(tiltOf({ x: 40, y: 0 }, 40)).toEqual({ x: 1, y: 0 });
    expect(tiltOf({ x: 0, y: -20 }, 40)).toEqual({ x: 0, y: -0.5 });
    const clamped = tiltOf({ x: 300, y: 300 }, 40);
    expect(Math.hypot(clamped.x, clamped.y)).toBeCloseTo(1);
  });

  it('조금 기울인 것은 누른 것으로 보지 않는다', () => {
    expect(directionsOf({ x: 0.2, y: -0.2 })).toEqual({ l: false, r: false, u: false, d: false });
  });

  it('곧게 위로 밀면 위만 눌리고, 비스듬히 밀어야 대각선이 된다', () => {
    expect(directionsOf({ x: 0.2, y: -0.9 })).toEqual({ l: false, r: false, u: true, d: false });
    expect(directionsOf({ x: -0.9, y: 0.2 })).toEqual({ l: true, r: false, u: false, d: false });
    expect(directionsOf({ x: -0.7, y: -0.7 })).toEqual({ l: true, r: false, u: true, d: false });
    expect(directionsOf({ x: 0.7, y: 0.7 })).toEqual({ l: false, r: true, u: false, d: true });
  });
});

describe('조이스틱 기준점', () => {
  it('끝까지 민 거리 안에서는 기준점이 그대로다', () => {
    expect(followOrigin({ x: 10, y: 10 }, { x: 30, y: 10 }, 40)).toEqual({ x: 10, y: 10 });
  });

  it('끝까지 민 거리를 넘으면 기준점이 손가락 쪽으로 끌려와 거리가 그 값에 맞는다', () => {
    expect(followOrigin({ x: 0, y: 0 }, { x: 100, y: 0 }, 40)).toEqual({ x: 60, y: 0 });
  });
});
