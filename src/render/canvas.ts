import { patch } from '../patch';
import type { Ctx } from './layout';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './layout';

export interface Point {
  x: number;
  y: number;
}

export interface Circle extends Point {
  r: number;
}

interface Line {
  color: string | CanvasGradient;
  width: number;
}

/** 그리는 동안만 바꾸는 상태(변환, 클립, 스타일)를 가두고 끝나면 되돌린다. */
export function withState(g: Ctx, draw: () => void): void {
  g.save();
  draw();
  g.restore();
}

/** 그리는 동안 투명도를 바꾸고, 끝나면 불투명으로 되돌린다. */
export function withAlpha(g: Ctx, alpha: number, draw: () => void): void {
  g.globalAlpha = alpha;
  draw();
  g.globalAlpha = 1;
}

/** 원의 경로를 만든다. */
export function pathCircle(g: Ctx, { x, y, r }: Circle): void {
  g.beginPath();
  g.arc(x, y, r, 0, 7);
}

/** 원을 색으로 채운다. */
export function fillCircle(g: Ctx, circle: Circle, color: string | CanvasGradient): void {
  pathCircle(g, circle);
  g.fillStyle = color;
  g.fill();
}

/** 원의 테두리를 그린다. */
export function strokeCircle(g: Ctx, circle: Circle, line: Line): void {
  pathCircle(g, circle);
  patch(g, { strokeStyle: line.color, lineWidth: line.width });
  g.stroke();
}

/** 점들을 이어 닫힌 길을 만든다(첫 점은 선을 긋지 않고 시작점이 된다). */
export function tracePolygon(g: Ctx, points: readonly Point[]): void {
  g.beginPath();
  for (const point of points) {
    g.lineTo(point.x, point.y);
  }
  g.closePath();
}

export interface Rect extends Point {
  w: number;
  h: number;
}

/** 모서리가 둥근 사각형의 경로를 만든다. */
export function roundRectPath(g: Ctx, { x, y, w, h }: Rect, radius: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, radius);
}

/** 기준점에서 각도와 거리만큼 떨어진 점. */
export const polar = (origin: Point, angle: number, distance: number): Point => ({
  x: origin.x + Math.cos(angle) * distance,
  y: origin.y + Math.sin(angle) * distance,
});

/** 두 점을 잇는 선분을 그린다. */
export function strokeSegment(g: Ctx, from: Point, to: Point): void {
  g.beginPath();
  g.moveTo(from.x, from.y);
  g.lineTo(to.x, to.y);
  g.stroke();
}

/** 위에서 아래로 두 색이 번지는 세로 그라데이션. */
export function verticalGradient(
  g: Ctx,
  span: { top: number; bottom: number },
  colors: readonly [string, string],
): CanvasGradient {
  const gradient = g.createLinearGradient(0, span.top, 0, span.bottom);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  return gradient;
}

/** 화면 전체를 한 가지 색(또는 그라데이션)으로 덮는다. */
export function fillScreen(g: Ctx, fill: string | CanvasGradient): void {
  g.fillStyle = fill;
  g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}
