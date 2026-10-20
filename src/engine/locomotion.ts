import { patch } from '../patch';
import type { Intent } from './actions';
import { chooseAction, when } from './actions';
import {
  AIRBORNE_EPSILON,
  BACK_DASH_SPEED,
  HOP_DRIFT,
  HOP_VELOCITY,
  JUMP_DRIFT,
  JUMP_VELOCITY,
  RUN_SPEED,
  WALK_BACK,
  WALK_FORWARD,
} from './constants';
import { backHeld, eatBuffer, forwardHeld } from './fighter';
import { stopAndRecover } from './recovery';
import type { Fighter, World } from './types';
import { emit } from './world';

/** 도약 준비 프레임 수. */
const JUMP_PREPARE_FRAMES = 4;
const ROLL_FRAMES = 30;
const ROLL_MOVING_FRAMES = 20;
const ROLL_SPEED = 4.4;
const BACK_DASH_FRAMES = 26;
const BACK_DASH_BRAKE_FROM = 14;
const BACK_DASH_BRAKE = 0.8;
const RUN_RELEASE_LOCK = 8;

const stickDirection = (fighter: Fighter): number => (fighter.input.r ? 1 : 0) - (fighter.input.l ? 1 : 0);

function startBackDash(world: World, fighter: Fighter): void {
  patch(fighter, { state: 'bdash', elapsed: 0, velocityX: -fighter.face * BACK_DASH_SPEED });
  eatBuffer(fighter);
  emit(world, { type: 'dash', id: fighter.id });
}

function startRun(world: World, fighter: Fighter): void {
  patch(fighter, { state: 'run', velocityX: fighter.face * RUN_SPEED });
  emit(world, { type: 'dash', id: fighter.id });
}

/** 달리는 중에 앞을 누르고 있으면 계속 달리고, 놓으면 잠깐 멈춘다. */
const runOrStop = (fighter: Fighter): Partial<Fighter> =>
  forwardHeld(fighter)
    ? { velocityX: fighter.face * RUN_SPEED }
    : { state: 'lock', lockFrames: RUN_RELEASE_LOCK, velocityX: 0 };

function walkMotion(fighter: Fighter, direction: number): Partial<Fighter> {
  if (direction > 0) {
    return { state: 'walk', velocityX: fighter.face * WALK_FORWARD };
  }
  if (direction < 0) {
    return { state: 'walk', velocityX: -fighter.face * WALK_BACK };
  }
  return { state: 'idle', velocityX: 0 };
}

const tryBackDash = when((_world, fighter) => fighter.doubleTapBack && fighter.state !== 'run', startBackDash);
const tryJump = when(
  (_world, fighter) => fighter.input.u,
  (_world, fighter) => {
    patch(fighter, { state: 'prejump', elapsed: 0, jumpDirection: stickDirection(fighter), velocityX: 0 });
  },
);
const tryCrouch = when(
  (_world, fighter) => fighter.input.d,
  (_world, fighter) => {
    patch(fighter, { state: 'crouch', velocityX: 0 });
  },
);
const tryContinueRun = when(
  (_world, fighter) => fighter.state === 'run',
  (_world, fighter) => {
    patch(fighter, runOrStop(fighter));
  },
);
const tryStartRun = when((_world, fighter) => fighter.doubleTapForward && forwardHeld(fighter), startRun);

/** 아무 입력도 없으면 선다. 앞뒤로 눌렀으면 걷는다. */
const walkOrStand: Intent = (_world, fighter) => {
  const direction = (forwardHeld(fighter) ? 1 : 0) - (backHeld(fighter) ? 1 : 0);
  patch(fighter, walkMotion(fighter, direction));
  return true;
};

const NEUTRAL_INTENTS: readonly Intent[] = [
  chooseAction,
  tryBackDash,
  tryJump,
  tryCrouch,
  tryContinueRun,
  tryStartRun,
  walkOrStand,
];

/** 서 있거나 걷는 중에 다음 행동을 고른다. */
export function neutral(world: World, fighter: Fighter): void {
  if (fighter.altitude === 0) {
    NEUTRAL_INTENTS.some(intent => intent(world, fighter));
  }
}

function takeOff(world: World, fighter: Fighter): void {
  const hop = !fighter.input.u;
  const direction = fighter.jumpDirection || stickDirection(fighter);
  const velocity = {
    velocityY: hop ? HOP_VELOCITY : JUMP_VELOCITY,
    velocityX: direction * (hop ? HOP_DRIFT : JUMP_DRIFT),
  };
  patch(fighter, { ...velocity, altitude: AIRBORNE_EPSILON, state: 'air', airAttackUsed: false, elapsed: 0 });
  emit(world, { type: 'jump', id: fighter.id, hop });
}

/** 점프 준비를 한 프레임 진행하고, 준비가 끝나면 뛰어오른다. */
export function updatePrejump(world: World, fighter: Fighter): void {
  fighter.elapsed++;
  if (fighter.elapsed >= JUMP_PREPARE_FRAMES) {
    takeOff(world, fighter);
  }
}

/** 구르기를 한 프레임 진행한다: 앞쪽 구간에서만 움직이고, 끝나면 멈추고 회복한다. */
export function updateRoll(_world: World, fighter: Fighter): void {
  fighter.elapsed++;
  fighter.velocityX = fighter.elapsed <= ROLL_MOVING_FRAMES ? fighter.rollDirection * fighter.face * ROLL_SPEED : 0;
  if (fighter.elapsed >= ROLL_FRAMES) {
    stopAndRecover(fighter);
  }
}

/** 뒤로 물러나기를 한 프레임 진행한다: 후반에는 속도가 줄고, 끝나면 멈추고 회복한다. */
export function updateBackDash(_world: World, fighter: Fighter): void {
  fighter.elapsed++;
  if (fighter.elapsed > BACK_DASH_BRAKE_FROM) {
    fighter.velocityX *= BACK_DASH_BRAKE;
  }
  if (fighter.elapsed >= BACK_DASH_FRAMES) {
    stopAndRecover(fighter);
  }
}
