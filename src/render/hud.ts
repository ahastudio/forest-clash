import type { Fighter, PlayerId } from '../engine';
import { patch } from '../patch';
import type { Circle, Point, Rect } from './canvas';
import { fillCircle, roundRectPath, strokeCircle, verticalGradient, withState } from './canvas';
import { BAR_TOP, BAR_WIDTH, drawHealthBar, drawRageBar, mirror } from './hud-bars';
import type { Ctx } from './layout';
import { CENTER_X, GOLD, NAVY, SCREEN_WIDTH } from './layout';
import { outlinedText } from './text';
import type { View } from './view';
import { LOOK } from './view';

const HP_DRAIN_PER_FRAME = 0.5;
const PORTRAIT_RADIUS = 36;
const ROUND_POINTS = 2;
const COMBO_FLASH_FRAMES = 70;
const COMBO_MIN_HITS = 2;
const LOW_TIME_FRAMES = 600;
const FRAMES_PER_SECOND = 60;
const PLATE_RADIUS = 18;
const SIDE_MARGIN = 100;
const PORTRAIT_MARGIN = 62;

// 초상화 안에 얼굴 부분만 오려 맞춘다.
function drawFaceCrop(g: Ctx, image: HTMLImageElement, { x, y, r }: Circle): void {
  const k = image.naturalWidth / 400;
  g.drawImage(image, 112 * k, 72 * k, 182 * k, 182 * k, x - r * 1.05, y - r * 1.05 + 2, r * 2.1, r * 2.1);
}

// 둥근 초상화 안쪽: 바탕색 위에 얼굴을 맞춰 넣는다.
function paintFace(view: View, fighter: Fighter, circle: Circle): void {
  const look = LOOK[fighter.id];
  const idle = view.sprites.pose(look.kind, 'idle');
  withState(view.g, () => {
    fillCircle(view.g, circle, look.face);
    view.g.clip();
    if (idle) {
      drawFaceCrop(view.g, idle, circle);
    }
  });
}

function drawPortrait(view: View, fighter: Fighter, center: Point): void {
  const circle: Circle = { ...center, r: PORTRAIT_RADIUS };
  paintFace(view, fighter, circle);
  strokeCircle(view.g, circle, { color: NAVY, width: 7 });
  strokeCircle(view.g, { ...circle, r: circle.r - 1 }, { color: fighter.id === 0 ? '#ff6b5a' : '#5a9bff', width: 3 });
}

// 이긴 판 수를 나타내는 동그라미 하나.
function drawWinMark(g: Ctx, { center, won }: { center: Point; won: boolean }): void {
  fillCircle(g, { ...center, r: 8 }, won ? GOLD : '#1b2a3a99');
  strokeCircle(g, { ...center, r: 8 }, { color: NAVY, width: 3 });
  if (won) {
    fillCircle(g, { x: center.x - 2, y: center.y - 2, r: 2.5 }, '#fff');
  }
}

// 이긴 판 수만큼 채워지는 동그라미 두 개.
function drawWinMarks(g: Ctx, side: { x: number; left: boolean }, wins: number): void {
  for (let i = 0; i < ROUND_POINTS; i++) {
    const x = side.x + (side.left ? 1 : -1) * (-10 + i * 22);
    drawWinMark(g, { center: { x, y: BAR_TOP + 76 }, won: i < wins });
  }
}

// 체력 막대와 분노 막대. 오른쪽 캐릭터의 것은 좌우로 뒤집어 그린다.
function drawBars(view: View, fighter: Fighter, shownHp: number): void {
  const left = fighter.id === 1;
  const barX = left ? SIDE_MARGIN : SCREEN_WIDTH - SIDE_MARGIN - BAR_WIDTH;
  withState(view.g, () => {
    if (!left) {
      mirror(view.g, barX);
    }
    drawHealthBar(view.g, barX, { hp: fighter.hp, shown: shownHp });
    drawRageBar(view, { x: barX, rage: fighter.rage });
  });
}

// 한쪽의 체력, 분노, 초상화, 이긴 판 표시.
function drawSide(view: View, fighter: Fighter, shownHp: number): void {
  const left = fighter.id === 1;
  const portraitX = left ? PORTRAIT_MARGIN : SCREEN_WIDTH - PORTRAIT_MARGIN;
  drawBars(view, fighter, shownHp);
  drawPortrait(view, fighter, { x: portraitX, y: BAR_TOP + 28 });
  drawWinMarks(view.g, { x: portraitX, left }, view.engine.wins[fighter.id]);
}

const CALM_PLATE: readonly [string, string] = ['#34476e', NAVY];
const WARN_PLATE: readonly [string, string] = ['#8a2a2a', '#4a1414'];
const PLATE: Rect = { x: CENTER_X - 46, y: 14, w: 92, h: 78 };

function fillRoundRect(g: Ctx, rect: Rect, fill: string): void {
  g.fillStyle = fill;
  roundRectPath(g, rect, PLATE_RADIUS);
  g.fill();
}

// 둥근 판을 채우고 테두리를 두른다.
function paintRoundRect(g: Ctx, rect: Rect, paint: { fill: CanvasGradient; line: string }): void {
  patch(g, { fillStyle: paint.fill, strokeStyle: paint.line, lineWidth: 4 });
  roundRectPath(g, rect, PLATE_RADIUS);
  g.fill();
  g.stroke();
}

// 가운데 시계판: 10초 안쪽이면 붉게 바뀐다.
function drawTimerPlate(g: Ctx, { warn }: { warn: boolean }): void {
  const gradient = verticalGradient(g, { top: PLATE.y, bottom: PLATE.y + PLATE.h }, warn ? WARN_PLATE : CALM_PLATE);
  fillRoundRect(g, { ...PLATE, x: PLATE.x + 3, y: PLATE.y + 5 }, '#0005');
  paintRoundRect(g, PLATE, { fill: gradient, line: GOLD });
}

function drawTimerText(g: Ctx, { round, seconds }: { round: number; seconds: number }): void {
  patch(g, { textAlign: 'center', fillStyle: GOLD, font: 'bold 13px sans-serif' });
  g.fillText(`ROUND ${round}`, CENTER_X, PLATE.y + 19);
  outlinedText(g, String(seconds), {
    x: CENTER_X,
    y: PLATE.y + 62,
    font: '900 46px sans-serif',
    width: 6,
    fill: '#fff',
  });
}

function drawTimer({ g, engine }: View): void {
  drawTimerPlate(g, { warn: engine.roundTimer < LOW_TIME_FRAMES });
  drawTimerText(g, { round: engine.round, seconds: Math.max(0, Math.ceil(engine.roundTimer / FRAMES_PER_SECOND)) });
}

// 막 맞힌 직후에는 조금 커졌다가 줄어든다.
const comboScale = (flashFrames: number): number => 1 + Math.min(0.25, (flashFrames / COMBO_FLASH_FRAMES) * 0.25);

function drawComboNumber(g: Ctx, hits: number): void {
  outlinedText(g, String(hits), { x: 0, y: 0, font: '900 64px sans-serif', width: 10, fill: GOLD });
}

function drawHitLabel(g: Ctx): void {
  outlinedText(g, 'HIT', { x: 0, y: 28, font: '900 24px sans-serif', width: 6, fill: '#fff' });
}

// 콤보 숫자와 HIT 글자.
function drawCombo({ g, engine }: View, owner: PlayerId): void {
  const scale = comboScale(engine.comboTimer[owner]);
  withState(g, () => {
    g.translate(owner === 0 ? SCREEN_WIDTH - 120 : 120, 190);
    g.scale(scale, scale);
    g.rotate(owner === 0 ? 0.06 : -0.06);
    drawComboNumber(g, engine.comboCount[owner]);
    drawHitLabel(g);
  });
}

function drawCombos(view: View): void {
  for (const owner of [0, 1] as const) {
    if (view.engine.comboCount[owner] >= COMBO_MIN_HITS) {
      drawCombo(view, owner);
    }
  }
}

/**
 * 체력 막대가 맞은 만큼 천천히 줄어드는 모습을 위해, 화면에 보이는 체력을 기억한다.
 */
export class Hud {
  private shown: [number | null, number | null] = [null, null];

  // 보이는 체력을 한 걸음 갱신하고 돌려준다. 체력이 오르면 곧바로 따라간다.
  private shownHp(fighter: Fighter): number {
    const previous = this.shown[fighter.id] ?? fighter.hp;
    const next = previous > fighter.hp ? Math.max(fighter.hp, previous - HP_DRAIN_PER_FRAME) : fighter.hp;
    this.shown[fighter.id] = next;
    return next;
  }

  draw(view: View): void {
    for (const fighter of view.engine.fighters) {
      drawSide(view, fighter, this.shownHp(fighter));
    }
    drawTimer(view);
    drawCombos(view);
    view.g.textAlign = 'left';
  }
}
