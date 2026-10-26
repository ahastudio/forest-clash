import { create as createAi, roundLevel } from './ai';
import { Sound } from './audio/sound';
import { TitleDemo } from './demo';
import type { Inputs, PadInput, Phase } from './engine';
import { constants, createEngine } from './engine';
import { Keyboard } from './input/keyboard';
import type { InputKind } from './input/kind';
import type { Point, StartChoice } from './menu';
import { TitleMenu } from './menu';
import { OnlineFrame } from './online/frame';
import type { OnlineSession } from './online/session';
import type { Effects } from './render/effects';
import { GUIDES } from './render/guide';
import { Reactions } from './render/reactions';
import { Scene } from './render/scene';
import { Sprites } from './render/sprites';

/**
 * 1이면 60프레임/초. 프레임 수치는 그대로 두고 흐르는 속도만 낮춰 준비 동작과 후딜이 눈에 보이게 한다.
 */
export const GAME_SPEED = 0.75;

const advanceBattle = (effects: Effects): void => effects.advanceBattle();

// 단계마다 알갱이를 움직이는 방법. 타이틀에서는 움직이지 않고, 결과 화면에서는 천천히 떨어진다.
const EFFECT_ADVANCERS: Record<Phase, (effects: Effects) => void> = {
  title: advanceBattle,
  intro: advanceBattle,
  fight: advanceBattle,
  ko: advanceBattle,
  time: advanceBattle,
  over: effects => effects.advanceResult(),
};

const NO_INPUT: Inputs = [{}, {}];

// 이번 프레임에 화면을 눌렀는가, 눌렀다면 타이틀 메뉴의 어느 줄이었는가.
interface Tap {
  pressed: boolean;
  choice: StartChoice | null;
}

const NO_TAP: Tap = { pressed: false, choice: null };

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = canvas.getContext('2d');
  if (!g) {
    throw new Error('2D 캔버스를 쓸 수 없습니다.');
  }
  return g;
}

/**
 * 게임 한 판에 필요한 것들을 묶는다: 엔진, 컴퓨터 상대, 소리, 화면, 입력.
 */
export class Game {
  readonly engine = createEngine();
  readonly keyboard = new Keyboard();
  readonly sound = new Sound();
  readonly scene = new Scene();
  readonly reactions = new Reactions({ engine: this.engine, effects: this.scene.effects, sound: this.sound });
  /**
   * 처음에는 봐주면서, 라운드가 갈수록 어려워진다.
   */
  readonly cpu = createAi(this.engine, { level: () => roundLevel(this.engine) });
  paused = false;
  showBoxes = false;
  /**
   * 안내 문구가 따르는 입력 장치. 폰이면 시작할 때 touch로 바꾼다.
   */
  inputKind: InputKind = 'keyboard';
  readonly menu = new TitleMenu();
  /**
   * 타이틀 뒤에서 가볍게 싸우는 캐릭터 둘. 소리를 내지 않도록 장치를 열지 않은 소리를 쓴다.
   */
  readonly demo = new TitleDemo(this.scene.effects, new Sound());
  /**
   * 온라인 대전 흐름. 없으면 온라인 대전은 쓸 수 없다.
   */
  online: OnlineSession | null = null;
  // 마지막으로 처리하지 않은 화면 누름. 프레임마다 한 번 꺼내 쓴다.
  private tap: Tap = NO_TAP;
  // 온라인 대전을 시작해 아직 타이틀로 돌아오지 않았는가.
  private inOnlineMatch = false;
  // 컴퓨터와, 둘이서 대전은 엔진이 1P 또는 2P의 버튼 입력으로 시작하므로 그 입력을 만들어 준다.
  private readonly starters: Record<StartChoice, () => Inputs> = {
    cpu: () => [{ A: true }, {}],
    '2p': () => [{}, { A: true }],
    online: () => {
      this.online?.start();
      return NO_INPUT;
    },
  };

  // 온라인 대전 중 한 프레임을 상대와 맞춰 진행한다.
  private readonly onlineFrame = new OnlineFrame({
    engine: this.engine,
    keyboard: this.keyboard,
    step: inputs => this.stepWith(inputs),
  });

  private readonly g: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly version: string,
    private readonly sprites: Sprites = new Sprites(),
  ) {
    this.g = contextOf(this.canvas);
    this.engine.toTitle();
  }

  // 2P 자리의 입력: 컴퓨터와 대전 중이고 싸우는 단계이면 컴퓨터, 아니면 키보드.
  private secondInput(): PadInput {
    const { phase, mode } = this.engine;
    const waiting = phase === 'title' || phase === 'over';
    return !waiting && mode === 'cpu' ? this.cpu(1) : this.keyboard.read(1);
  }

  /**
   * 마우스나 손가락이 화면을 눌렀다. 타이틀에서 메뉴의 어느 줄인지 읽는다.
   */
  pointerDown(point: Point): void {
    this.tap = { pressed: true, choice: this.menu.press(point) };
  }

  // 쌓인 화면 누름을 꺼내고 비운다.
  private takeTap(): Tap {
    const tap = this.tap;
    this.tap = NO_TAP;
    return tap;
  }

  // 타이틀에서는 누른 메뉴를 엔진이 받는 입력으로 바꾸고, 그 밖의 단계에서는 사람의 입력을 그대로 쓴다.
  private localInputs(): Inputs {
    const pads: Inputs = [this.keyboard.read(0), this.secondInput()];
    const tap = this.takeTap();
    return this.engine.phase === 'title' ? this.titleInputs(tap) : pads;
  }

  // 온라인 접속 중이면 화면을 눌러 취소하고, 아니면 누른 방식으로 시작한다.
  private titleInputs(tap: Tap): Inputs {
    if (this.online?.busy) {
      return this.cancelOnline(tap);
    }
    const { choice } = tap;
    const ready = choice !== null && this.engine.phaseTime > constants.TITLE_INPUT_DELAY;
    return ready ? this.starters[choice]() : NO_INPUT;
  }

  private cancelOnline(tap: Tap): Inputs {
    if (tap.pressed) {
      this.online?.cancel();
    }
    return NO_INPUT;
  }

  // 시뮬레이션을 한 프레임 진행하고 그 사건을 화면 반응으로 잇는다.
  private stepWith(inputs: Inputs): void {
    this.engine.step(inputs);
    this.reactions.handle();
  }

  // 오류나 상대의 이탈로 온라인 대전이 끝났는데 판이 남아 있으면 타이틀로 돌아간다.
  private leaveEndedOnlineMatch(): void {
    if (this.inOnlineMatch && !this.online?.playing) {
      this.inOnlineMatch = false;
      this.engine.toTitle();
    }
  }

  /**
   * 시뮬레이션을 한 프레임 진행한다. 일시정지 중에는 멈춘다. 상대 입력을 기다리느라 진행하지 못했으면 false다.
   */
  update(): boolean {
    if (this.paused) {
      return true;
    }
    this.leaveEndedOnlineMatch();
    this.online?.measurePing();
    return this.runFrame();
  }

  // 실제 대전, 타이틀 뒤의 배경 대전, 화면 효과를 차례로 한 프레임씩 진행한다. 기다리는 중이면 아무것도 진행하지 않고 false다.
  private runFrame(): boolean {
    if (!this.stepFrame()) {
      return false;
    }
    this.stepDemo();
    this.advanceEffects();
    return true;
  }

  // 타이틀이 나와 있는 동안에만 배경의 대전을 진행한다.
  private stepDemo(): void {
    if (this.engine.phase === 'title') {
      this.demo.step();
    }
  }

  // 온라인 대전 중이면 상대와 맞춰, 아니면 이 컴퓨터의 입력으로 한 프레임 진행한다.
  private stepFrame(): boolean {
    const session = this.online;
    if (session?.playing) {
      return this.onlineFrame.step(session);
    }
    this.stepWith(this.localInputs());
    return true;
  }

  /**
   * 온라인 상대가 정해졌을 때 새 판을 시작한다. 내 입력이 들어갈 자리는 온라인 흐름이 알고 있다.
   */
  startOnlineMatch(): void {
    this.paused = false;
    this.inOnlineMatch = true;
    this.engine.newMatch('2p');
  }

  advanceEffects(): void {
    EFFECT_ADVANCERS[this.engine.phase](this.scene.effects);
  }

  // 타이틀에서 마우스가 버튼 위에 있으면 커서를 손가락 모양으로, 그 밖에는 기본 모양으로 바꾼다.
  private applyCursor(): void {
    const overButton = this.engine.phase === 'title' && this.menu.selected !== null;
    this.canvas.style.cursor = overButton ? 'pointer' : 'default';
  }

  /**
   * 지금 상태를 캔버스에 그린다. now는 깜빡임에 쓰는 현재 시각(밀리초)이다.
   */
  render(now: number): void {
    this.applyCursor();
    const guide = GUIDES[this.inputKind];
    const view = {
      g: this.g,
      engine: this.engine,
      sprites: this.sprites,
      now,
      guide,
      menu: this.menu,
      notice: this.notice(),
      ping: this.online?.pingMilliseconds ?? null,
    };
    const world = this.engine.phase === 'title' ? this.demo.engine : this.engine;
    this.scene.draw(view, { world, paused: this.paused, showBoxes: this.showBoxes, version: this.version });
  }

  // 화면에 보일 온라인 상황 한 줄. 대전 중에는 보이지 않고, 타이틀에서는 마지막 상황을 보인다.
  private notice(): string {
    const session = this.online;
    return session && !session.playing && this.engine.phase === 'title' ? session.status : '';
  }

  /**
   * 일시정지를 켜고 끈다. 온라인 대전은 상대와 같이 진행하므로 멈출 수 없다.
   */
  togglePause(): void {
    if (!this.online?.playing) {
      this.paused = !this.paused;
    }
  }

  /**
   * 대전 중에 창을 벗어나면 일시정지한다. 온라인 대전은 제외한다.
   */
  pauseIfFighting(): void {
    if (this.engine.phase === 'fight' && !this.online?.playing) {
      this.paused = true;
    }
  }
}
