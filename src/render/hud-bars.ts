import { MAX_HP, RAGE_MAX } from '../engine';
import { patch } from '../patch';
import type { Point, Rect } from './canvas';
import { tracePolygon, verticalGradient, withState } from './canvas';
import type { Ctx } from './layout';
import { NAVY } from './layout';
import type { View } from './view';

export const BAR_WIDTH = 340;
export const BAR_TOP = 26;
const BAR_HEIGHT = 30;
const BAR_SLANT = 16;
const RAGE_WIDTH = 250;
const RAGE_HEIGHT = 12;
const RAGE_SLANT = 9;
const PULSE_PERIOD = 90;

/** 비스듬히 기울어진 막대: 왼쪽 위 모서리, 크기, 기울기. */
interface Slant extends Rect {
  skew: number;
}

/** 화면에 보이는 체력과 실제 체력. 맞은 만큼 보이는 체력이 천천히 따라 내려온다. */
interface Health {
  hp: number;
  shown: number;
}

const slantPoints = ({ x, y, w, h, skew }: Slant): Point[] => [
  { x: x + skew, y },
  { x: x + w, y },
  { x: x + w - skew, y: y + h },
  { x, y: y + h },
];

const slantPath = (g: Ctx, slant: Slant): void => tracePolygon(g, slantPoints(slant));

/** 겹겹이 칠하는 막대의 한 층. */
interface Layer {
  slant: Slant;
  fill: string;
}

/** 아래 층부터 차례로 칠한다. */
function paintLayers(g: Ctx, layers: readonly Layer[]): void {
  for (const layer of layers) {
    g.fillStyle = layer.fill;
    slantPath(g, layer.slant);
    g.fill();
  }
}

const grow = (slant: Slant, margin: number): Slant => ({
  ...slant,
  x: slant.x - margin,
  y: slant.y - margin,
  w: slant.w + margin * 2,
  h: slant.h + margin * 2,
});

/** 막대 안쪽을 왼쪽에서부터 width만큼 칠한다. */
function fillBar(g: Ctx, bar: { frame: Slant; width: number }, fill: string | CanvasGradient): void {
  g.fillStyle = fill;
  g.fillRect(bar.frame.x, bar.frame.y, bar.width, bar.frame.h);
}

/** 막대 안쪽에서만 칠하도록 모양대로 잘라 두고 그린다. */
function withinSlant(g: Ctx, frame: Slant, draw: () => void): void {
  withState(g, () => {
    slantPath(g, frame);
    g.clip();
    draw();
  });
}

const barGradient = (g: Ctx, frame: Slant, colors: readonly [string, string]): CanvasGradient =>
  verticalGradient(g, { top: frame.y, bottom: frame.y + frame.h }, colors);

const healthFrame = (x: number): Slant => ({ x, y: BAR_TOP, w: BAR_WIDTH, h: BAR_HEIGHT, skew: BAR_SLANT });
const rageFrame = (x: number): Slant => ({
  x,
  y: BAR_TOP + BAR_HEIGHT + 10,
  w: RAGE_WIDTH,
  h: RAGE_HEIGHT,
  skew: RAGE_SLANT,
});

function healthColors(ratio: number): [string, string] {
  if (ratio > 0.5) {
    return ['#b6f08a', '#4cbf3f'];
  }
  return ratio > 0.25 ? ['#ffe27a', '#f0a820'] : ['#ff8a7a', '#e8302a'];
}

/** 체력 막대 안쪽: 맞은 만큼 천천히 줄어드는 옅은 부분 위에 현재 체력이 겹친다. */
function fillHealthGauge(g: Ctx, frame: Slant, health: Health): void {
  const ratio = Math.max(0, health.hp / MAX_HP);
  const gradient = barGradient(g, frame, healthColors(ratio));
  withinSlant(g, frame, () => {
    fillBar(g, { frame, width: frame.w * Math.max(0, health.shown / MAX_HP) }, '#fff3c4');
    fillBar(g, { frame, width: frame.w * ratio }, gradient);
    g.fillStyle = '#ffffff66';
    g.fillRect(frame.x, frame.y + 3, frame.w, 7);
  });
}

/** 체력 막대 바닥: 그림자, 테두리, 막대 바탕. */
const healthLayers = (frame: Slant): Layer[] => [
  { slant: { ...frame, x: frame.x + 3, y: frame.y + 5 }, fill: '#0005' },
  { slant: grow(frame, 4), fill: NAVY },
  { slant: frame, fill: '#2a3550' },
];

function outlineSlant(g: Ctx, frame: Slant, line: { color: string; width: number }): void {
  patch(g, { strokeStyle: line.color, lineWidth: line.width });
  slantPath(g, frame);
  g.stroke();
}

/** x에 놓인 체력 막대를 그린다. */
export function drawHealthBar(g: Ctx, x: number, health: Health): void {
  const frame = healthFrame(x);
  paintLayers(g, healthLayers(frame));
  fillHealthGauge(g, frame, health);
  outlineSlant(g, frame, { color: '#fff', width: 2 });
}

/** 분노 게이지 색: 가득 차면 노랑에서 주황으로 깜빡인다. */
function rageColors({ rage, now }: { rage: number; now: number }): [string, string] {
  if (rage < RAGE_MAX) {
    return ['#ffb08a', '#e8473c'];
  }
  return ['#fff2a0', 0.5 + 0.5 * Math.sin(now / PULSE_PERIOD) > 0.5 ? '#ffb300' : '#ff8a00'];
}

/** x에 놓인 분노 막대를 그린다. 가득 차면 색이 깜빡인다. */
export function drawRageBar({ g, now }: View, { x, rage }: { x: number; rage: number }): void {
  const frame = rageFrame(x);
  const gradient = barGradient(g, frame, rageColors({ rage, now }));
  paintLayers(g, [
    { slant: grow(frame, 3), fill: NAVY },
    { slant: frame, fill: '#2a3550' },
  ]);
  withinSlant(g, frame, () => {
    fillBar(g, { frame, width: (frame.w * rage) / RAGE_MAX }, gradient);
    g.fillStyle = '#ffffff55';
    g.fillRect(frame.x, frame.y + 2, frame.w, 3);
  });
}

/** 오른쪽 막대는 왼쪽 막대를 좌우로 뒤집어 그린다. */
export function mirror(g: Ctx, barX: number): void {
  g.translate(barX + BAR_WIDTH, 0);
  g.scale(-1, 1);
  g.translate(-barX, 0);
}
