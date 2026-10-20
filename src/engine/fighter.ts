import { patch } from '../patch';
import { BUFFER_FRAMES, DOUBLE_TAP_FRAMES, MAX_HP } from './constants';
import type { Move } from './moves';
import { MOVES } from './moves';
import type {
  Button,
  ButtonCounts,
  Fighter,
  FighterAction,
  FighterBody,
  FighterReactions,
  InputTracking,
  Pad,
  PadInput,
  PlayerId,
  World,
} from './types';

export const BUTTONS: readonly Button[] = ['A', 'B', 'C', 'D'];
const HISTORY_LIMIT = 40;
/** 버튼을 한 번도 누르지 않은 것으로 보는 나이. */
const BUTTON_IDLE_AGE = 99;
const START_X: Record<PlayerId, number> = { 0: 720, 1: 480 };
const NO_TAP_YET = -99;

/** 아무것도 누르지 않은 입력. */
export const emptyPad = (): Pad => ({ l: false, r: false, u: false, d: false, A: false, B: false, C: false, D: false });
const idleButtonAges = (): ButtonCounts => ({
  A: BUTTON_IDLE_AGE,
  B: BUTTON_IDLE_AGE,
  C: BUTTON_IDLE_AGE,
  D: BUTTON_IDLE_AGE,
});

/** 위치와 몸 상태: 어디에 서 있고 어느 쪽을 보며 체력과 분노가 얼마인가. */
function makeBody(id: PlayerId): FighterBody {
  return {
    id,
    x: START_X[id],
    altitude: 0,
    velocityX: 0,
    velocityY: 0,
    knockback: 0,
    face: id === 0 ? -1 : 1,
    hp: MAX_HP,
    rage: 0,
  };
}

/** 지금 하는 행동과 그 진행: 상태, 기술, 경직, 무적. */
function makeAction(): FighterAction {
  return {
    state: 'idle',
    elapsed: 0,
    moveId: null,
    landedWindows: 0,
    contact: null,
    cancelable: false,
    stunFrames: 0,
    lockFrames: 0,
    invincibleFrames: 0,
    launched: false,
    juggleCount: 0,
    knockedDown: false,
  };
}

/** 입력 읽기: 지금 누른 것, 방금 누른 것, 기록, 두 번 누르기. */
function makeInputTracking(): InputTracking {
  return {
    input: emptyPad(),
    justPressed: { A: 0, B: 0, C: 0, D: 0 },
    directionHistory: [],
    buttonAge: idleButtonAges(),
    lastForwardPress: NO_TAP_YET,
    lastBackPress: NO_TAP_YET,
    wasForwardHeld: false,
    wasBackHeld: false,
    doubleTapForward: false,
    doubleTapBack: false,
  };
}

/** 점프, 맞은 모습, 구르기, 잡힘처럼 상태에 딸린 표시와 방향. */
function makeReactions(): FighterReactions {
  return {
    jumpDirection: 0,
    airAttackUsed: false,
    hurtFlash: 0,
    guardingCrouched: false,
    hitCrouching: false,
    gettingUp: false,
    rollDirection: 0,
    heldBy: -1,
  };
}

/** 새 캐릭터를 처음 모습으로 만든다: 몸, 행동, 입력 기록, 반응 값을 합친다. */
export function makeFighter(id: PlayerId): Fighter {
  return { ...makeBody(id), ...makeAction(), ...makeInputTracking(), ...makeReactions() };
}

/** 바라보는 쪽 방향키를 누르고 있는가. */
export const forwardHeld = (fighter: Fighter): boolean => (fighter.face > 0 ? fighter.input.r : fighter.input.l);
/** 바라보는 반대쪽 방향키를 누르고 있는가. */
export const backHeld = (fighter: Fighter): boolean => (fighter.face > 0 ? fighter.input.l : fighter.input.r);

/** 숫자패드 방향의 가로 칸: 앞이면 첫째, 뒤면 둘째, 아니면 셋째 줄. */
const NUMPAD = {
  forward: { down: 3, up: 9, none: 6 },
  back: { down: 1, up: 7, none: 4 },
  neutral: { down: 2, up: 8, none: 5 },
} as const;

function horizontal(fighter: Fighter): keyof typeof NUMPAD {
  const forward = forwardHeld(fighter);
  const back = backHeld(fighter);
  if (forward && !back) {
    return 'forward';
  }
  return back && !forward ? 'back' : 'neutral';
}

function vertical(fighter: Fighter): 'down' | 'up' | 'none' {
  if (fighter.input.d) {
    return 'down';
  }
  return fighter.input.u ? 'up' : 'none';
}

/** 지금 입력을 숫자패드 방향(1~9)으로 바꾼다. 앞뒤는 캐릭터가 바라보는 쪽 기준이다. */
const numpad = (fighter: Fighter): number => NUMPAD[horizontal(fighter)][vertical(fighter)];

const toPad = (input: Partial<PadInput>): Pad => ({
  l: !!input.l,
  r: !!input.r,
  u: !!input.u,
  d: !!input.d,
  A: !!input.A,
  B: !!input.B,
  C: !!input.C,
  D: !!input.D,
});

/** 타격 정지 중에는 입력을 받아 두되 버튼의 나이는 늘지 않는다. */
function nextButtonAge(world: World, fighter: Fighter, button: Button): number {
  if (fighter.justPressed[button]) {
    return 0;
  }
  return world.hitstop > 0 ? fighter.buttonAge[button] : Math.min(BUTTON_IDLE_AGE, fighter.buttonAge[button] + 1);
}

/** 버튼마다 새로 눌렀는지와 눌린 지 몇 프레임인지를 갱신한다. */
function readButtons(world: World, fighter: Fighter, previous: Pad): void {
  for (const button of BUTTONS) {
    fighter.justPressed[button] = fighter.input[button] && !previous[button] ? 1 : 0;
    fighter.buttonAge[button] = nextButtonAge(world, fighter, button);
  }
}

interface Tap {
  double: boolean;
  last: number;
}

/** 한 방향의 눌림 기록: 지금 누르는가, 지난 프레임에 눌렀는가, 마지막으로 새로 누른 프레임. */
interface Press {
  held: boolean;
  wasHeld: boolean;
  last: number;
}

/** 방향을 새로 눌렀을 때 직전에 누른 지 얼마 안 되었으면 두 번 누른 것이다(달리기, 뒤 대시). */
function nextTap(frame: number, press: Press): Tap {
  const pressedNow = press.held && !press.wasHeld;
  return { double: pressedNow && frame - press.last <= DOUBLE_TAP_FRAMES, last: pressedNow ? frame : press.last };
}

function forwardTap(world: World, fighter: Fighter): Tap {
  return nextTap(world.frame, {
    held: forwardHeld(fighter),
    wasHeld: fighter.wasForwardHeld,
    last: fighter.lastForwardPress,
  });
}

function backTap(world: World, fighter: Fighter): Tap {
  return nextTap(world.frame, { held: backHeld(fighter), wasHeld: fighter.wasBackHeld, last: fighter.lastBackPress });
}

function readDoubleTaps(world: World, fighter: Fighter): void {
  const forward = forwardTap(world, fighter);
  const back = backTap(world, fighter);
  const held = { wasForwardHeld: forwardHeld(fighter), wasBackHeld: backHeld(fighter) };
  patch(fighter, {
    ...held,
    doubleTapForward: forward.double,
    lastForwardPress: forward.last,
    doubleTapBack: back.double,
    lastBackPress: back.last,
  });
}

function recordHistory(world: World, fighter: Fighter): void {
  const direction = numpad(fighter);
  if (world.hitstop > 0 && fighter.directionHistory.at(-1) === direction) {
    return;
  }
  fighter.directionHistory.push(direction);
  fighter.directionHistory.splice(0, Math.max(0, fighter.directionHistory.length - HISTORY_LIMIT));
}

/** 이번 프레임의 입력을 읽어 버튼 나이, 두 번 누르기, 방향 기록을 갱신한다. */
export function readInput(world: World, fighter: Fighter, input: Partial<PadInput>): void {
  const previous = fighter.input;
  fighter.input = toPad(input);
  readButtons(world, fighter, previous);
  readDoubleTaps(world, fighter);
  recordHistory(world, fighter);
}

/** 1프레임 지연: 두 버튼 동시 입력을 구분하기 위함이다. */
export const pressed = (fighter: Fighter, b: Button, maxAge = BUFFER_FRAMES): boolean =>
  fighter.buttonAge[b] <= maxAge && fighter.buttonAge[b] >= 1;

/** 쌓인 버튼 입력을 비워 같은 입력으로 기술이 다시 나가지 않게 한다. */
export function eatBuffer(fighter: Fighter): void {
  fighter.buttonAge = idleButtonAges();
}

/** 지금 쓰고 있는 기술. 공격 중이 아니면 null. */
export const attackMove = (fighter: Fighter): Move | null =>
  fighter.state === 'attack' && fighter.moveId ? MOVES[fighter.moveId] : null;
