import type { Box, Fighter } from '../engine';
import { RAGE_MAX } from '../engine';
import { patch } from '../patch';
import { strokeSegment, withState } from './canvas';
import type { Ctx } from './layout';
import { ARENA_WIDTH, GROUND_Y } from './layout';
import { poseKey } from './poses';
import { SPRITE_SCALE, SPRITE_SIZE } from './sprites';
import type { View } from './view';
import { LOOK } from './view';

const SHADOW_FADE_HEIGHT = 160;
const HURT_FLASH_FRAMES = 8;
const HURT_BRIGHT_FROM = 5;
const INVINCIBLE_BLINK_FRAMES = 3;
const HURT_SQUASH = 0.12;
const SPRITE_PIXELS = SPRITE_SIZE * SPRITE_SCALE;

// 발밑 그림자. 높이 떠 있을수록 작고 옅다.
function drawShadow({ g }: View, fighter: Fighter): void {
  const height = Math.max(0, Math.min(1, fighter.altitude / SHADOW_FADE_HEIGHT));
  withState(g, () => {
    patch(g, { globalAlpha: 0.28 * (1 - height * 0.6), fillStyle: '#2b1d10' });
    g.beginPath();
    g.ellipse(fighter.x, GROUND_Y + 2, 40 * (1 - height * 0.4), 9 * (1 - height * 0.3), 0, 0, 7);
    g.fill();
  });
}

// 분노 게이지가 가득이면 몸 뒤에 주황빛이 맥동한다.
function drawRageAura({ g, now }: View): void {
  withState(g, () => {
    g.globalAlpha = 0.22 + 0.1 * Math.sin(now / 90);
    g.beginPath();
    g.ellipse(0, -52, 58, 72, 0, 0, 7);
    patch(g, { fillStyle: '#ff8a3a' });
    g.fill();
  });
}

// 맞은 직후에는 찌그러졌다 펴지고, 처음에는 하얗게 번쩍인다.
function applyHurtLook(g: Ctx, fighter: Fighter): void {
  const k = fighter.hurtFlash / HURT_FLASH_FRAMES;
  if (fighter.hurtFlash > 0) {
    g.scale(1 - HURT_SQUASH * k, 1 + HURT_SQUASH * k);
  }
  if (fighter.hurtFlash > HURT_BRIGHT_FROM) {
    g.filter = 'brightness(2)';
  }
}

// 캐릭터의 자리로 옮기고, 바라보는 방향으로 뒤집고, 맞음과 무적에 따른 모습을 입힌다.
function placeAndTint(g: Ctx, fighter: Fighter, frame: number): void {
  g.translate(fighter.x, GROUND_Y - fighter.altitude);
  g.scale(fighter.face, 1);
  applyHurtLook(g, fighter);
  if (fighter.invincibleFrames > 0 && Math.floor(frame / INVINCIBLE_BLINK_FRAMES) % 2) {
    g.globalAlpha = 0.55;
  }
}

function drawSprite(view: View, fighter: Fighter, image: HTMLImageElement): void {
  placeAndTint(view.g, fighter, view.engine.frame);
  if (fighter.rage >= RAGE_MAX) {
    drawRageAura(view);
  }
  view.g.drawImage(image, -200 * SPRITE_SCALE, -360 * SPRITE_SCALE, SPRITE_PIXELS, SPRITE_PIXELS);
}

// 지금 자세의 그림. 아직 불러오지 못했으면 서 있는 그림으로 대신한다.
function fighterImage({ sprites, engine }: View, fighter: Fighter): HTMLImageElement | null {
  const kind = LOOK[fighter.id].kind;
  return sprites.pose(kind, poseKey(fighter, engine.frame)) ?? sprites.pose(kind, 'idle');
}

/**
 * 캐릭터를 그림자와 함께 그린다. 그림이 아직 없으면 그림자만 그린다.
 */
export function drawFighter(view: View, fighter: Fighter): void {
  const image = fighterImage(view, fighter);
  drawShadow(view, fighter);
  if (image) {
    withState(view.g, () => drawSprite(view, fighter, image));
  }
  view.g.filter = 'none';
}

function strokeBox(g: Ctx, box: Box, colors: { fill: string; stroke: string }): void {
  const [x, y, w, h] = [box.x0, GROUND_Y - box.y1, box.x1 - box.x0, box.y1 - box.y0];
  patch(g, { fillStyle: colors.fill, strokeStyle: colors.stroke });
  g.fillRect(x, y, w, h);
  g.strokeRect(x, y, w, h);
}

const HURT_COLORS = { fill: '#3b7fe033', stroke: '#3b7fe0' };
const ATTACK_COLORS = { fill: '#e8473c66', stroke: '#e8473c' };

function strokeAttackBox({ g, engine }: View, fighter: Fighter): void {
  const attack = engine.hitboxOf(fighter);
  if (attack) {
    strokeBox(g, attack, ATTACK_COLORS);
  }
}

// 캐릭터의 기준점(발 아래 가운데)을 작은 노란 점으로 표시한다.
function drawAnchor(g: Ctx, fighter: Fighter): void {
  g.fillStyle = '#ffd54a';
  g.fillRect(fighter.x - 3, GROUND_Y - fighter.altitude - 3, 6, 6);
}

function drawFighterBoxes(view: View, fighter: Fighter): void {
  for (const box of view.engine.hurtboxes(fighter)) {
    strokeBox(view.g, box, HURT_COLORS);
  }
  strokeAttackBox(view, fighter);
  drawAnchor(view.g, fighter);
}

// 바닥선: 판정 상자가 바닥 기준으로 그려졌는지 눈으로 확인할 수 있다.
function drawGroundLine(g: Ctx): void {
  g.strokeStyle = '#ffffffaa';
  strokeSegment(g, { x: 0, y: GROUND_Y }, { x: ARENA_WIDTH, y: GROUND_Y });
}

/**
 * 판정 상자 표시(H 키): 파란 상자가 맞을 수 있는 곳, 빨간 상자가 공격이다.
 */
export function drawDebugBoxes(view: View): void {
  view.g.lineWidth = 2;
  for (const fighter of view.engine.fighters) {
    drawFighterBoxes(view, fighter);
  }
  drawGroundLine(view.g);
}
