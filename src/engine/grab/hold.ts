import { patch } from '../../patch';
import { THROW_END, THROW_END_ALT, THROW_LIFT_ALT, THROW_TOSS } from '../constants';
import { toNeutral } from '../recovery';
import type { Fighter, World } from '../types';
import { emit, opponentOf } from '../world';
import { applyThrow } from './toss';

const GRAB_LIFT_FROM = 3;
const LIFT_FRAMES = 9;
const HOLD_OFFSET = 10;
const TOSS_OFFSET = 80;
/** 잡기의 시간표에서 소리와 연출이 나오는 순간. */
const THROW_CUES = new Map<number, 'lift' | 'toss'>([
  [GRAB_LIFT_FROM, 'lift'],
  [THROW_TOSS, 'toss'],
]);

/** 잡힌 쪽의 상태: 던지는 쪽을 마주 보고 움직임이 멎는다. */
function grabbedState(thrower: Fighter): Partial<Fighter> {
  return {
    state: 'thrown',
    elapsed: 0,
    heldBy: thrower.id,
    velocityX: 0,
    knockback: 0,
    face: thrower.face === 1 ? -1 : 1,
    stunFrames: 0,
  };
}

/** 잡기에 성공했다: 던지는 쪽은 던지는 중, 잡힌 쪽은 잡힌 상태가 된다. */
export function startGrab(world: World, thrower: Fighter, victim: Fighter): void {
  patch(thrower, { state: 'throwing', elapsed: 0, velocityX: 0, knockback: 0 });
  patch(victim, grabbedState(thrower));
  emit(world, { type: 'grab', id: thrower.id, x: victim.x, y: victim.altitude });
}

type ThrowStep = (world: World, thrower: Fighter, victim: Fighter) => void;

const isHeldBy = (victim: Fighter, thrower: Fighter): boolean =>
  victim.heldBy === thrower.id && victim.state === 'thrown';

const releaseThrower: ThrowStep = (_world, thrower) => toNeutral(thrower);

const progressThrow: ThrowStep = (world, thrower, victim) => {
  const cue = THROW_CUES.get(victim.elapsed);
  if (cue) {
    emit(world, { type: cue, id: thrower.id });
  }
  if (victim.elapsed >= THROW_END) {
    applyThrow(world, thrower, victim);
  }
};

/** 잡힌 쪽은 아무것도 할 수 없고 던져질 때까지 진행된다. 상대가 더는 잡혀 있지 않으면 던지는 쪽도 풀려난다. */
const throwStepFor = (thrower: Fighter, victim: Fighter): ThrowStep =>
  isHeldBy(victim, thrower) ? progressThrow : releaseThrower;

/** 던지는 쪽을 한 프레임 진행한다: 상대가 계속 잡혀 있으면 들어 올림과 던짐을 진행하고, 아니면 풀려난다. */
export function updateThrowing(world: World, fighter: Fighter): void {
  fighter.elapsed++;
  const victim = opponentOf(world, fighter);
  throwStepFor(fighter, victim)(world, fighter, victim);
}

const lerp = (from: number, to: number, u: number): number => from + (to - from) * u;
const ease = (u: number): number => u * u * (3 - 2 * u);
const progress = (time: number, { from, length }: { from: number; length: number }): number =>
  ease(Math.max(0, Math.min(1, (time - from) / length)));

interface Place {
  x: number;
  altitude: number;
}

/** 머리 위로 들어 올려지는 동안의 위치. */
function liftPlace(fighter: Fighter, { startX, overHead }: { startX: number; overHead: number }): Place {
  const lift = progress(fighter.elapsed, { from: GRAB_LIFT_FROM, length: LIFT_FRAMES });
  return { x: lerp(startX, overHead, lift), altitude: lerp(0, THROW_LIFT_ALT, lift) };
}

/** 위에서 앞으로 던져지는 동안의 위치. */
function tossPlace(fighter: Fighter, { overHead, endX }: { overHead: number; endX: number }): Place {
  const toss = progress(fighter.elapsed, { from: THROW_TOSS, length: THROW_END - THROW_TOSS });
  return { x: lerp(overHead, endX, toss), altitude: lerp(THROW_LIFT_ALT, THROW_END_ALT, toss) };
}

/** 잡힌 상대: 붙잡힘(0~2) → 머리 위로 들어 올림(3~12) → 위에서 유지(13~16) → 앞으로 던짐(17~22). */
function heldPlace(fighter: Fighter, thrower: Fighter, startX: number): Place {
  const overHead = thrower.x + thrower.face * HOLD_OFFSET;
  if (fighter.elapsed < THROW_TOSS) {
    return liftPlace(fighter, { startX, overHead });
  }
  return tossPlace(fighter, { overHead, endX: thrower.x + thrower.face * TOSS_OFFSET });
}

/** 잡힌 쪽을 한 프레임 진행한다: 아무것도 하지 못하고 머리 위로 들려 올라갔다가 던져진다. */
export function updateThrown(world: World, fighter: Fighter): void {
  fighter.elapsed++;
  fighter.grabStartX ??= fighter.x;
  patch(fighter, {
    ...heldPlace(fighter, opponentOf(world, fighter), fighter.grabStartX),
    velocityY: 0,
    velocityX: 0,
    knockback: 0,
  });
}
