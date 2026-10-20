import type { Phase } from '../engine';
import { fillScreen, verticalGradient, withState } from './canvas';
import { Effects } from './effects';
import { drawDebugBoxes, drawFighter } from './fighters';
import { Hud } from './hud';
import type { Ctx } from './layout';
import { CAMERA_X, CAMERA_Y, CAMERA_ZOOM, CENTER_X, CENTER_Y, SCREEN_HEIGHT, SCREEN_WIDTH } from './layout';
import { drawPause } from './pause';
import { drawIntro, drawResult, drawRoundEnd, drawTitle } from './screens';
import type { View } from './view';

interface SceneFlags {
  paused: boolean;
  showBoxes: boolean;
  version: string;
}

/** 땅의 윗선(그림의 63퍼센트 높이)을 화면 390에 맞춘 고정 배경. */
const BACKGROUND_SCALE = 1.15;
const BACKGROUND_GROUND_LINE = 0.63;
const BACKGROUND_GROUND_Y = 390;
const OVERSCAN = 40;

function drawSky(g: Ctx): void {
  g.fillStyle = verticalGradient(g, { top: 0, bottom: SCREEN_HEIGHT }, ['#64c8ff', '#d6f1ff']);
  g.fillRect(-OVERSCAN, -OVERSCAN, SCREEN_WIDTH + OVERSCAN * 2, SCREEN_HEIGHT + OVERSCAN * 2);
}

function drawBackdropImage(g: Ctx, image: HTMLImageElement): void {
  const width = SCREEN_WIDTH * BACKGROUND_SCALE;
  const height = (width * image.height) / image.width;
  g.drawImage(image, (SCREEN_WIDTH - width) / 2, BACKGROUND_GROUND_Y - BACKGROUND_GROUND_LINE * height, width, height);
}

/** 배경 그림을 아직 못 불렀으면 초록색 땅으로 대신한다. */
function drawBackground({ g, sprites }: View): void {
  const image = sprites.background();
  if (image) {
    drawBackdropImage(g, image);
  } else {
    g.fillStyle = '#9bcd68';
    g.fillRect(-OVERSCAN, 440, SCREEN_WIDTH + OVERSCAN * 2, SCREEN_HEIGHT);
  }
}

/** 가장자리를 어둡게 하는 원형 그라데이션. */
function vignetteGradient(g: Ctx): CanvasGradient {
  const gradient = g.createRadialGradient(
    CENTER_X,
    CENTER_Y,
    SCREEN_HEIGHT * 0.45,
    CENTER_X,
    CENTER_Y,
    SCREEN_HEIGHT * 0.95,
  );
  gradient.addColorStop(0, '#0000');
  gradient.addColorStop(1, '#0a1a3a33');
  return gradient;
}

function drawVignette(g: Ctx): void {
  fillScreen(g, vignetteGradient(g));
}

/** 고정 카메라: 화면 가운데에서 확대해 바라본다. */
function applyCamera(g: Ctx): void {
  g.translate(CENTER_X, CENTER_Y);
  g.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  g.translate(-CAMERA_X, -CAMERA_Y);
}

function drawActors(view: View, { showBoxes }: Pick<SceneFlags, 'showBoxes'>): void {
  for (const fighter of view.engine.fighters) {
    drawFighter(view, fighter);
  }
  if (showBoxes) {
    drawDebugBoxes(view);
  }
}

/** 단계마다 위에 덮는 화면. 대전 중에는 체력 막대가 있고, 단계에 따라 안내가 더해진다. */
const OVERLAYS: Record<Phase, (scene: Scene, view: View) => void> = {
  title: (_scene, view) => drawTitle(view),
  intro: (scene, view) => {
    scene.hud.draw(view);
    drawIntro(view);
  },
  fight: (scene, view) => scene.hud.draw(view),
  ko: (scene, view) => {
    scene.hud.draw(view);
    drawRoundEnd(view);
  },
  time: (scene, view) => {
    scene.hud.draw(view);
    drawRoundEnd(view);
  },
  over: (scene, view) => {
    scene.hud.draw(view);
    drawResult(view);
    scene.effects.confetti();
  },
};

/** 화면 전체를 그린다. 그림은 전부 이 클래스가 만들고, 규칙은 엔진이 정한 상태를 보여 주기만 한다. */
export class Scene {
  readonly effects = new Effects();
  readonly hud = new Hud();

  draw(view: View, flags: SceneFlags): void {
    withState(view.g, () => this.drawScene(view, flags));
    drawVignette(view.g);
    OVERLAYS[view.engine.phase](this, view);
    if (flags.paused) {
      drawPause(view.g, flags.version);
    }
  }

  /** 하늘, 배경, 그리고 카메라로 바라본 세계(캐릭터, 판정 상자, 효과). */
  private drawScene(view: View, flags: SceneFlags): void {
    drawSky(view.g);
    drawBackground(view);
    withState(view.g, () => {
      applyCamera(view.g);
      drawActors(view, flags);
      this.effects.draw(view.g, flags);
    });
  }
}
