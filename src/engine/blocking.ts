import { patch } from '../patch';
import { KNOCKBACK_DECAY } from './constants';
import { directionToward } from './damage';
import type { MoveKind } from './moves';
import type { Spark, Strike } from './strike';
import { exchangeRage, recoil, registerContact } from './strike';
import type { Fighter, World } from './types';
import { emit } from './world';

const BLOCK_RAGE_DEFENDER = 1.5;
const BLOCK_RAGE_ATTACKER = 2;
const BLOCK_PUSH_SHARE = 0.5;
const MIN_BLOCK_HITSTOP = 5;
const BLOCK_HITSTOP_DISCOUNT = 2;
const BLOCKING_STATES = ['idle', 'crouch', 'walk', 'blockstun'];

// 높이별로 막는 자세: 하단은 앉아서만, 상단은 서서만, 중단은 어느 자세로든 막는다.
const GUARD_POSTURE: Record<MoveKind, (crouchGuard: boolean) => boolean> = {
  low: crouchGuard => crouchGuard,
  high: crouchGuard => !crouchGuard,
  mid: () => true,
  grab: () => false,
};

// 상대 반대쪽(뒤)을 누르고 있는가.
const holdingBack = (defender: Fighter, attacker: Fighter): boolean =>
  defender.x < attacker.x ? defender.input.l : defender.input.r;

// 막을 수 있는 상태인가: 땅에서 무적이 아니고 서 있거나 걷거나 앉아 있거나 이미 막는 중이어야 한다.
const isGuardable = (defender: Fighter): boolean =>
  defender.altitude === 0 && defender.invincibleFrames === 0 && BLOCKING_STATES.includes(defender.state);

/**
 * 막을 수 있는가: 막을 수 있는 상태에서 뒤를 누르고 있고, 높이에 맞는 자세여야 한다. 잡기는 막을 수 없다.
 */
export function canBlock({ attacker, defender, move }: Strike): boolean {
  if (!isGuardable(defender) || !holdingBack(defender, attacker)) {
    return false;
  }
  return GUARD_POSTURE[move.kind](defender.input.d);
}

// 막은 쪽의 자세와 밀림. 하단을 막았으면 앉은 채로 막는다.
function guardDefender({ attacker, defender, move }: Strike): void {
  const push = directionToward(attacker, defender) * move.pushback * (1 - KNOCKBACK_DECAY);
  const guard: Partial<Fighter> = {
    state: 'blockstun',
    stunFrames: move.blockstun,
    guardingCrouched: !!defender.input.d,
    moveId: null,
  };
  patch(defender, { ...guard, velocityX: 0, knockback: push });
  if (move.chipDamage) {
    defender.hp = Math.max(1, defender.hp - move.chipDamage);
  }
}

function rewardBlock(world: World, strike: Strike): void {
  exchangeRage(strike, { defenderGain: BLOCK_RAGE_DEFENDER, attackerGain: BLOCK_RAGE_ATTACKER });
  registerContact(strike, 'block');
  world.comboCount[strike.attacker.id] = 0;
  world.hitstop = Math.max(world.hitstop, Math.max(MIN_BLOCK_HITSTOP, strike.move.hitstop - BLOCK_HITSTOP_DISCOUNT));
}

/**
 * 막았다: 방어한 쪽은 밀리고 막힘 경직에 들어가고, 때린 쪽은 반동과 보상을 받는다.
 */
export function blockStrike(world: World, strike: Strike, spark: Spark): void {
  const { attacker, defender, move } = strike;
  guardDefender(strike);
  recoil(strike, BLOCK_PUSH_SHARE);
  rewardBlock(world, strike);
  emit(world, { type: 'block', ...spark, attacker: attacker.id, defender: defender.id, moveId: move.id });
}
