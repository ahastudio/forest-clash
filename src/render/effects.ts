import { patch } from '../patch';
import type { Point } from './canvas';
import { polar, strokeCircle, strokeSegment, tracePolygon, withAlpha, withState } from './canvas';
import type { Ctx } from './layout';
import { GOLD, INK, SCREEN_WIDTH } from './layout';

interface Particle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
  color: string;
  size?: number;
  soft?: boolean;
  star?: boolean;
}

interface Burst {
  kind: 'ring' | 'lines';
  x: number;
  y: number;
  life: number;
  max: number;
  big?: boolean;
  color?: string;
}

const HIT_GRAVITY = 0.25;
const RESULT_GRAVITY = 0.15;
const CONFETTI_LIMIT = 80;
const CONFETTI_PIECES = 3;
const CONFETTI_COLORS = ['#ff6b8b', GOLD, '#6bd6ff', '#9be37a'];
const DEFAULT_SPARK_COLOR = '#ffa526';
const WHITE_SPARKS = 5;
const COLOR_SPARKS = 4;
const STAR_TIPS = 5;
const STAR_OUTER = 10;
const STAR_INNER = 4;
const RAYS = 8;

const times = <T>(count: number, make: (index: number) => T): T[] => Array.from({ length: count }, (_, i) => make(i));

/** 별 모양의 꼭짓점: 바깥 꼭짓점과 안쪽 꼭짓점이 번갈아 열 개. */
const STAR_POINTS: readonly Point[] = times(STAR_TIPS * 2, i => {
  const radius = i % 2 ? STAR_INNER : STAR_OUTER;
  const angle = (i * Math.PI) / STAR_TIPS;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
});

/** 먼지 한 알. */
const dustParticle = (x: number, y: number): Particle => ({
  x: x + (Math.random() - 0.5) * 18,
  y: y - 2,
  velocityX: (Math.random() - 0.5) * 2.6,
  velocityY: -Math.random() * 1.5,
  life: 22,
  color: '#fffffff0',
  size: 5 + Math.random() * 4,
  soft: true,
});

const whiteSpark = ({ x, y }: Point): Particle => ({
  x,
  y,
  velocityX: (Math.random() - 0.5) * 9,
  velocityY: (Math.random() - 0.8) * 9,
  life: 18,
  color: '#fff',
});

const starSpark = ({ x, y }: Point, color: string): Particle => ({
  x,
  y,
  velocityX: (Math.random() - 0.5) * 11,
  velocityY: (Math.random() - 0.5) * 11,
  life: 18,
  color,
  star: true,
});

const confettiPiece = (index: number): Particle => ({
  x: Math.random() * SCREEN_WIDTH,
  y: -10,
  velocityX: (Math.random() - 0.5) * 2,
  velocityY: 2 + Math.random() * 3,
  life: 160,
  size: 5,
  /* 나머지 연산이라 언제나 색 목록 안이다. */
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length] as string,
});

/** 별: 속을 칠하고 어두운 테두리를 두른다. */
function drawStar(g: Ctx, p: Particle): void {
  withState(g, () => {
    g.translate(p.x, p.y);
    g.rotate(p.life * 0.3);
    tracePolygon(g, STAR_POINTS);
    g.fill();
    strokeOutline(g, { color: INK, width: 1.5 });
  });
}

function strokeOutline(g: Ctx, line: { color: string; width: number }): void {
  patch(g, { strokeStyle: line.color, lineWidth: line.width });
  g.stroke();
}

function drawDot(g: Ctx, p: Particle): void {
  if (p.soft) {
    g.globalAlpha = p.life / 30;
  }
  g.beginPath();
  g.arc(p.x, p.y, p.size ?? 4, 0, 7);
  g.fill();
}

function drawParticle(g: Ctx, p: Particle): void {
  patch(g, { globalAlpha: Math.min(1, p.life / 24), fillStyle: p.color });
  if (p.star) {
    drawStar(g, p);
  } else {
    drawDot(g, p);
  }
}

/** 충격 고리: 퍼져 나가며 옅어지는 흰 고리 안쪽에 색 고리가 하나 더 있다. */
function drawRing(g: Ctx, burst: Burst): void {
  const k = burst.life / burst.max;
  const radius = Math.max(0, (1 - k) * (burst.big ? 84 : 46) + 8);
  withAlpha(g, k, () => {
    strokeCircle(g, { x: burst.x, y: burst.y, r: radius }, { color: '#fff', width: 3 + 3 * k });
    strokeCircle(g, { x: burst.x, y: burst.y, r: Math.max(0, radius - 7) }, { color: burst.color ?? GOLD, width: 2 });
  });
}

/** 방사선 한 줄. 남은 수명이 적을수록 바깥으로 멀어진다. */
function strokeRay(g: Ctx, burst: Burst, index: number): void {
  const k = burst.life / burst.max;
  const angle = (index * Math.PI) / 4 + 0.2;
  const inner = 16 + (1 - k) * 22;
  const outer = inner + 14 + k * 12;
  strokeSegment(g, polar(burst, angle, inner), polar(burst, angle, outer));
}

function drawLines(g: Ctx, burst: Burst): void {
  patch(g, { strokeStyle: '#fff', lineWidth: 2.5 });
  withAlpha(g, burst.life / burst.max, () => {
    for (let ray = 0; ray < RAYS; ray++) {
      strokeRay(g, burst, ray);
    }
  });
}

const BURST_DRAWERS = { ring: drawRing, lines: drawLines };

/** 화면 효과: 먼지, 불꽃, 별, 충격 고리, 결과 화면의 색종이. 글자는 쓰지 않는다. */
export class Effects {
  particles: Particle[] = [];
  bursts: Burst[] = [];

  dust({ x, y }: Point, count: number): void {
    this.particles.push(...times(count, () => dustParticle(x, y)));
  }

  ring(at: Point, style: { life: number; big: boolean; color?: string }): void {
    this.bursts.push({ kind: 'ring', ...at, life: style.life, max: style.life, big: style.big, color: style.color });
  }

  /** 타격 불꽃: 고리, 방사선, 흰 알갱이 다섯, 색 별 넷. */
  impact(at: Point, power: number, color?: string): void {
    this.ring(at, { life: 14, big: power > 9, color });
    this.bursts.push({ kind: 'lines', ...at, life: 10, max: 10 });
    this.particles.push(...times(WHITE_SPARKS, () => whiteSpark(at)));
    this.particles.push(...times(COLOR_SPARKS, () => starSpark(at, color ?? DEFAULT_SPARK_COLOR)));
  }

  /** 결과 화면에서 하늘에서 색종이를 떨어뜨린다. */
  confetti(): void {
    if (this.particles.length < CONFETTI_LIMIT) {
      this.particles.push(...times(CONFETTI_PIECES, confettiPiece));
    }
  }

  /** 알갱이를 한 걸음 움직이고(gravity가 null이면 움직이지 않고) 수명이 다한 것을 치운다. */
  private advance(gravity: number | null): void {
    for (const p of this.particles) {
      if (gravity !== null) {
        patch(p, { x: p.x + p.velocityX, y: p.y + p.velocityY, velocityY: p.velocityY + gravity, life: p.life - 1 });
      }
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  /** 타이틀에서는 움직이지 않고 치우기만 한다. */
  advanceTitle(): void {
    this.advance(null);
  }

  advanceBattle(): void {
    this.advance(HIT_GRAVITY);
  }

  advanceResult(): void {
    this.advance(RESULT_GRAVITY);
  }

  draw(g: Ctx, { paused }: { paused: boolean }): void {
    for (const p of this.particles) {
      drawParticle(g, p);
    }
    g.globalAlpha = 1;
    this.drawBursts(g, { paused });
  }

  private drawBursts(g: Ctx, { paused }: { paused: boolean }): void {
    for (const burst of this.bursts) {
      BURST_DRAWERS[burst.kind](g, burst);
      if (!paused) {
        burst.life--;
      }
    }
    this.bursts = this.bursts.filter(b => b.life > 0);
  }
}
