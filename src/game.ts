import { create as createAi, roundLevel } from './ai';
import { Sound } from './audio/sound';
import type { PadInput, Phase } from './engine';
import { createEngine } from './engine';
import { Keyboard } from './input/keyboard';
import type { Effects } from './render/effects';
import { Reactions } from './render/reactions';
import { Scene } from './render/scene';
import { Sprites } from './render/sprites';

/** 1이면 60프레임/초. 프레임 수치는 그대로 두고 흐르는 속도만 낮춰 준비 동작과 후딜이 눈에 보이게 한다. */
export const GAME_SPEED = 0.75;

const advanceBattle = (effects: Effects): void => effects.advanceBattle();

/** 단계마다 알갱이를 움직이는 방법. 타이틀에서는 움직이지 않고, 결과 화면에서는 천천히 떨어진다. */
const EFFECT_ADVANCERS: Record<Phase, (effects: Effects) => void> = {
  title: effects => effects.advanceTitle(),
  intro: advanceBattle,
  fight: advanceBattle,
  ko: advanceBattle,
  time: advanceBattle,
  over: effects => effects.advanceResult(),
};

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = canvas.getContext('2d');
  if (!g) {
    throw new Error('2D 캔버스를 쓸 수 없습니다.');
  }
  return g;
}

/** 게임 한 판에 필요한 것들을 묶는다: 엔진, 컴퓨터 상대, 소리, 화면, 입력. */
export class Game {
  readonly engine = createEngine();
  readonly keyboard = new Keyboard();
  readonly sound = new Sound();
  readonly scene = new Scene();
  readonly reactions = new Reactions({ engine: this.engine, effects: this.scene.effects, sound: this.sound });
  /** 처음에는 봐주면서, 라운드가 갈수록 어려워진다. */
  readonly cpu = createAi(this.engine, { level: () => roundLevel(this.engine) });
  paused = false;
  showBoxes = false;

  private readonly g: CanvasRenderingContext2D;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly version: string,
    private readonly sprites: Sprites = new Sprites(),
  ) {
    this.g = contextOf(canvas);
    this.engine.toTitle();
  }

  /** 2P 자리의 입력: 컴퓨터와 대전 중이고 싸우는 단계이면 컴퓨터, 아니면 키보드. */
  private secondInput(): PadInput {
    const { phase, mode } = this.engine;
    const waiting = phase === 'title' || phase === 'over';
    return !waiting && mode === 'cpu' ? this.cpu(1) : this.keyboard.read(1);
  }

  /** 시뮬레이션을 한 프레임 진행한다. 일시정지 중에는 멈춘다. */
  update(): void {
    if (this.paused) {
      return;
    }
    this.engine.step([this.keyboard.read(0), this.secondInput()]);
    this.reactions.handle();
    this.advanceEffects();
  }

  advanceEffects(): void {
    EFFECT_ADVANCERS[this.engine.phase](this.scene.effects);
  }

  /** 지금 상태를 캔버스에 그린다. now는 깜빡임에 쓰는 현재 시각(밀리초)이다. */
  render(now: number): void {
    const view = { g: this.g, engine: this.engine, sprites: this.sprites, now };
    this.scene.draw(view, { paused: this.paused, showBoxes: this.showBoxes, version: this.version });
  }

  /** 일시정지를 켜고 끈다. */
  togglePause(): void {
    this.paused = !this.paused;
  }

  /** 대전 중에 창을 벗어나면 일시정지한다. */
  pauseIfFighting(): void {
    if (this.engine.phase === 'fight') {
      this.paused = true;
    }
  }
}
