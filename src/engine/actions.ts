import { patch } from '../patch';
import { NEUTRAL_STATES, RAGE_MAX } from './constants';
import { BUTTONS, backHeld, eatBuffer, forwardHeld, pressed } from './fighter';
import { wantsThrow } from './grab';
import { BASIC_MOTION, motion, motionAge, SUPER_MOTION } from './motions';
import type { Move, MoveId } from './moves';
import { MOVES } from './moves';
import type { Button, Fighter, World } from './types';
import { emit } from './world';

/**
 * 행동을 시도한다. 새 행동을 시작했으면 true를 돌려주고, 그러면 더 이상 다른 행동을 고르지 않는다.
 */
export type Intent = (world: World, fighter: Fighter) => boolean;

const SPECIAL_BUTTON_AGE = 8;
const SIMULTANEOUS_AGE = 2;
const ROLL_INVINCIBLE_FRAMES = 9;
const MOVE_START: Partial<Fighter> = {
  state: 'attack',
  elapsed: 0,
  landedWindows: 0,
  contact: null,
  cancelable: false,
};

/**
 * 조건이 맞으면 동작을 하고 true를 돌려주는 행동을 만든다.
 */
export const when =
  (wanted: (world: World, fighter: Fighter) => boolean, act: (world: World, fighter: Fighter) => void): Intent =>
  (world, fighter) => {
    const go = wanted(world, fighter);
    if (go) {
      act(world, fighter);
    }
    return go;
  };

/**
 * 땅에서 아무 동작도 하지 않아 새 행동을 고를 수 있는 상태인가.
 */
export const isActionable = (fighter: Fighter): boolean =>
  fighter.altitude === 0 && NEUTRAL_STATES.includes(fighter.state);

// 기술을 시작할 때 몸에 생기는 변화: 공중 기술은 공중 공격 표시, 땅 기술은 멈춤, 무적과 상승.
const startPatch = (move: Move): Partial<Fighter> => ({
  ...(move.air ? { airAttackUsed: true } : { velocityX: 0 }),
  ...(move.invincibleFrames ? { invincibleFrames: move.invincibleFrames } : {}),
  ...(move.rising ? { velocityY: 0 } : {}),
});

/**
 * 기술을 시작한다: 몸을 기술 시작 상태로 바꾸고, 쌓인 버튼 입력을 비우고, 사건을 알린다.
 */
export function startMove(world: World, fighter: Fighter, id: MoveId): void {
  patch(fighter, { ...MOVE_START, moveId: id, ...startPatch(MOVES[id]) });
  eatBuffer(fighter);
  emit(world, { type: 'move', id: fighter.id, moveId: id });
}

const happened = (age: number): boolean => age >= 0;

// 나이가 작을수록 최근이다. 상대 모션이 일어나지 않았으면 이쪽이 더 최근이다.
const isMoreRecent = ({ age, than }: { age: number; than: number }): boolean => !happened(than) || age < than;

// 두 모션이 겹치면 더 최근에 끝난 모션이 이긴다.
function latestMotion(fighter: Fighter): 'dp' | 'qcf' | null {
  const dp = motionAge(fighter, 'dp', BASIC_MOTION);
  const qcf = motionAge(fighter, 'qcf', BASIC_MOTION);
  if (happened(dp) && isMoreRecent({ age: dp, than: qcf })) {
    return 'dp';
  }
  return qcf >= 0 ? 'qcf' : null;
}

const SPECIAL_RULES: readonly { motion: 'dp' | 'qcf'; button: Button; move: MoveId }[] = [
  { motion: 'dp', button: 'A', move: 'dp_a' },
  { motion: 'dp', button: 'C', move: 'dp_c' },
  { motion: 'qcf', button: 'A', move: 'elbow_a' },
  { motion: 'qcf', button: 'C', move: 'elbow_c' },
];

const isSuperInput = (fighter: Fighter): boolean =>
  fighter.rage >= RAGE_MAX && pressed(fighter, 'C', SPECIAL_BUTTON_AGE) && motion(fighter, 'qcf2', SUPER_MOTION);

/**
 * 모션으로 나가는 특수기를 고른다.
 * 분노 필살기가 대공 어퍼와 돌진 팔꿈치보다 먼저다.
 * 방향 두 개를 차례로 누르면 되고 대각선은 필요 없다.
 */
export function specialInput(fighter: Fighter): MoveId | null {
  if (isSuperInput(fighter)) {
    return 'super';
  }
  const latest = latestMotion(fighter);
  const rule = SPECIAL_RULES.find(r => r.motion === latest && pressed(fighter, r.button, SPECIAL_BUTTON_AGE));
  return rule ? rule.move : null;
}

/**
 * 특수기를 시작한다. 분노 필살기는 게이지를 모두 쓴다.
 */
export function startSpecial(world: World, fighter: Fighter, id: MoveId): void {
  if (id === 'super') {
    fighter.rage = 0;
  }
  startMove(world, fighter, id);
}

function startRoll(world: World, fighter: Fighter): void {
  patch(fighter, {
    state: 'roll',
    elapsed: 0,
    invincibleFrames: ROLL_INVINCIBLE_FRAMES,
    rollDirection: backHeld(fighter) ? -1 : 1,
  });
  eatBuffer(fighter);
  emit(world, { type: 'roll', id: fighter.id });
}

const STAND_NORMALS: Record<Button, MoveId> = { A: 'a5', B: 'b5', C: 'c5', D: 'd5' };
const CROUCH_NORMALS: Record<Button, MoveId> = { A: 'a2', B: 'b2', C: 'c2', D: 'd2' };
const FORWARD_NORMALS: Partial<Record<Button, MoveId>> = { C: 'c6', D: 'd6' };

// 가장 먼저 누른(나이가 가장 큰) 버튼. 눌린 버튼이 없으면 null.
function oldestPressedButton(fighter: Fighter): Button | null {
  const candidates = BUTTONS.filter(b => pressed(fighter, b));
  return candidates.reduce<Button | null>(
    (best, b) => (best === null || fighter.buttonAge[b] > fighter.buttonAge[best] ? b : best),
    null,
  );
}

function normalFor(fighter: Fighter, button: Button): MoveId {
  if (fighter.input.d) {
    return CROUCH_NORMALS[button];
  }
  return (forwardHeld(fighter) && FORWARD_NORMALS[button]) || STAND_NORMALS[button];
}

const bothPressed = (fighter: Fighter, first: Button, second: Button): boolean =>
  pressed(fighter, first, SIMULTANEOUS_AGE) && pressed(fighter, second, SIMULTANEOUS_AGE);

const trySpecial: Intent = (world, fighter) => {
  const special = specialInput(fighter);
  if (special) {
    startSpecial(world, fighter, special);
  }
  return !!special;
};

const tryRoll = when((_world, fighter) => bothPressed(fighter, 'A', 'B'), startRoll);
const tryBlow = when(
  (_world, fighter) => bothPressed(fighter, 'C', 'D'),
  (world, fighter) => startMove(world, fighter, 'blow'),
);
const tryThrow = when(wantsThrow, (world, fighter) => startMove(world, fighter, 'throw'));

const tryNormal: Intent = (world, fighter) => {
  const button = oldestPressedButton(fighter);
  if (button) {
    startMove(world, fighter, normalFor(fighter, button));
  }
  return !!button;
};

const ATTACK_INTENTS: readonly Intent[] = [trySpecial, tryRoll, tryBlow, tryThrow, tryNormal];

/**
 * 입력으로 새 기술을 시작했으면 true.
 */
export const chooseAction: Intent = (world, fighter) => ATTACK_INTENTS.some(intent => intent(world, fighter));
