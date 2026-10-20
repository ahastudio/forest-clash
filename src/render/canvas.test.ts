import { describe, expect, it } from 'vitest';
import { fakeCanvas } from '../testing/canvas';
import {
  fillCircle,
  fillScreen,
  pathCircle,
  polar,
  roundRectPath,
  strokeCircle,
  strokeSegment,
  tracePolygon,
  verticalGradient,
  withAlpha,
  withState,
} from './canvas';

describe('캔버스 도우미', () => {
  it('상태를 가두고 끝나면 되돌린다', () => {
    const { g, calls } = fakeCanvas();
    withState(g, () => g.translate(1, 2));
    expect(calls.map(c => c[0])).toEqual(['save', 'translate', 'restore']);
  });

  it('투명도를 바꿔 그리고 불투명으로 되돌린다', () => {
    const { g, calls } = fakeCanvas();
    withAlpha(g, 0.4, () => g.fill());
    expect(calls).toEqual([['set globalAlpha', 0.4], ['fill'], ['set globalAlpha', 1]]);
  });

  it('원을 그린다', () => {
    const { g, calls, of, last } = fakeCanvas();
    pathCircle(g, { x: 1, y: 2, r: 3 });
    fillCircle(g, { x: 1, y: 2, r: 3 }, 'red');
    strokeCircle(g, { x: 1, y: 2, r: 3 }, { color: 'blue', width: 4 });
    expect(of('arc')).toHaveLength(3);
    expect(of('arc')[0]).toEqual([1, 2, 3, 0, 7]);
    expect(of('fill')).toHaveLength(1);
    expect(of('stroke')).toHaveLength(1);
    expect(last('lineWidth')).toBe(4);
    expect(last('strokeStyle')).toBe('blue');
    expect(calls.length).toBeGreaterThan(6);
  });

  it('점들을 이어 닫힌 길을 만든다', () => {
    const { g, calls } = fakeCanvas();
    tracePolygon(g, [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
    expect(calls.map(c => c[0])).toEqual(['beginPath', 'lineTo', 'lineTo', 'closePath']);
  });

  it('둥근 사각형 길과 선분을 만든다', () => {
    const { g, of } = fakeCanvas();
    roundRectPath(g, { x: 1, y: 2, w: 3, h: 4 }, 5);
    strokeSegment(g, { x: 0, y: 0 }, { x: 9, y: 9 });
    expect(of('roundRect')[0]).toEqual([1, 2, 3, 4, 5]);
    expect(of('lineTo')[0]).toEqual([9, 9]);
    expect(of('stroke')).toHaveLength(1);
  });

  it('기준점에서 각도와 거리만큼 떨어진 점을 구한다', () => {
    const point = polar({ x: 10, y: 20 }, 0, 5);
    expect(point.x).toBeCloseTo(15);
    expect(point.y).toBeCloseTo(20);
  });

  it('세로 그라데이션과 화면 채우기', () => {
    const { g, of, last } = fakeCanvas();
    const gradient = verticalGradient(g, { top: 0, bottom: 10 }, ['#fff', '#000']);
    expect(of('createLinearGradient')[0]).toEqual([0, 0, 0, 10]);
    expect(gradient).toBeDefined();
    fillScreen(g, 'green');
    expect(last('fillStyle')).toBe('green');
    expect(of('fillRect')[0]).toEqual([0, 0, 960, 540]);
  });
});
