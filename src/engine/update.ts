import { isActionable } from './actions';
import { airAttack, applyMovement } from './airborne';
import { updateAttack } from './attack-state';
import { NEUTRAL_STATES } from './constants';
import { updateThrowing, updateThrown } from './grab';
import { neutral, updateBackDash, updatePrejump, updateRoll } from './locomotion';
import { updateBlockstun, updateDown, updateHitstun, updateLock } from './recovery';
import type { Fighter, FighterState, World } from './types';
import { opponentOf } from './world';

// 땅에서 상대를 바라보는 상태들.
const FACING_STATES: readonly FighterState[] = ['idle', 'crouch', 'walk', 'run', 'lock', 'blockstun', 'hitstun'];

const STATE_UPDATERS: Record<FighterState, (world: World, fighter: Fighter) => void> = {
  idle: neutral,
  crouch: neutral,
  walk: neutral,
  run: neutral,
  lock: updateLock,
  prejump: updatePrejump,
  air: airAttack,
  roll: updateRoll,
  bdash: updateBackDash,
  attack: updateAttack,
  throwing: updateThrowing,
  thrown: updateThrown,
  blockstun: updateBlockstun,
  hitstun: updateHitstun,
  down: updateDown,
  ko: () => undefined,
};

function faceOpponent(world: World, fighter: Fighter): void {
  const opponent = opponentOf(world, fighter);
  if (opponent.x !== fighter.x) {
    fighter.face = opponent.x > fighter.x ? 1 : -1;
  }
}

// 한 프레임을 시작할 때: 타이머를 줄이고, 땅에서 상대를 바라본다.
function prepareFrame(world: World, fighter: Fighter): void {
  fighter.hurtFlash = Math.max(0, fighter.hurtFlash - 1);
  if (fighter.invincibleFrames > 0) {
    fighter.invincibleFrames--;
  }
  if (fighter.altitude === 0 && FACING_STATES.includes(fighter.state)) {
    faceOpponent(world, fighter);
  }
}

// 경직이나 후딜이 끝난 프레임에 곧바로 다음 동작을 고른다(한 프레임을 버리지 않는다).
function resumeIfRecovered(world: World, fighter: Fighter, previous: FighterState): void {
  const justBecameIdle = fighter.state === 'idle' && !NEUTRAL_STATES.includes(previous);
  if (justBecameIdle && isActionable(fighter) && fighter.stunFrames <= 0) {
    neutral(world, fighter);
  }
}

/**
 * 캐릭터 하나를 한 프레임 진행한다: 타이머를 줄이고 상대를 바라본 뒤 상태별 갱신 함수를 부르고, 경직이 막 끝났으면 같은 프레임에 다음 행동을 고르고, 중력과 이동을 적용한다.
 */
export function updateFighter(world: World, fighter: Fighter): void {
  const previous = fighter.state;
  prepareFrame(world, fighter);
  STATE_UPDATERS[fighter.state](world, fighter);
  resumeIfRecovered(world, fighter, previous);
  applyMovement(world, fighter);
}
