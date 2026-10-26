import { patch } from '../../patch';
import { AIRBORNE_EPSILON } from '../constants';
import { countCombo, directionToward, gainRage, knockOut } from '../damage';
import { MOVES } from '../moves';
import type { Fighter, World } from '../types';
import { emit } from '../world';

const THROW_DAMAGE_STUN = 40;
const THROW_HITSTOP = 8;
const THROWER_RECOVERY = 12;
const TOSS_LAUNCH_SPEED = 3;
const TOSS_DRIFT_SPEED = 3.2;
const CENTER_HEIGHT = 50;
const THROW_HIT_POWER = 10;
const VICTIM_RAGE_RATE = 1.6;
const THROWER_RAGE_RATE = 1.0;
const HIT_FLASH_FRAMES = 8;

// 한 번의 던지기: 던지는 쪽, 던져지는 쪽, 던지는 방향.
interface Throwing {
  thrower: Fighter;
  victim: Fighter;
  direction: number;
}

// 던져진 쪽은 맞은 상태가 되어 날아가 쓰러지고, 잡힘이 풀린다.
function markTossed(victim: Fighter): void {
  victim.altitude = Math.max(victim.altitude, AIRBORNE_EPSILON);
  patch(victim, {
    state: 'hitstun',
    knockedDown: true,
    launched: true,
    grabStartX: undefined,
    heldBy: -1,
    hurtFlash: HIT_FLASH_FRAMES,
  });
}

// 던져진 쪽이 위로 날아오르며 뒤로 밀린다.
function launchTossed(victim: Fighter, direction: number): void {
  patch(victim, {
    velocityY: TOSS_LAUNCH_SPEED,
    velocityX: direction * TOSS_DRIFT_SPEED,
    stunFrames: THROW_DAMAGE_STUN,
  });
}

// 던져진 쪽: 피해를 입고 땅에 닿을 때까지 날아간다.
function tossVictim({ victim, direction }: Throwing, damage: number): void {
  victim.hp -= damage;
  markTossed(victim);
  launchTossed(victim, direction);
}

function rewardThrow(world: World, { thrower, victim }: Throwing, damage: number): void {
  patch(thrower, { state: 'lock', lockFrames: THROWER_RECOVERY, moveId: null, heldBy: -1 });
  world.hitstop = THROW_HITSTOP;
  gainRage(victim, damage * VICTIM_RAGE_RATE);
  gainRage(thrower, damage * THROWER_RAGE_RATE);
  countCombo(world, thrower, victim);
}

// 던지기의 타격 사건을 알린다.
function announceThrow(world: World, { thrower, victim }: Throwing): void {
  const who = { attacker: thrower.id, defender: victim.id, moveId: 'throw', grab: true } as const;
  emit(world, { type: 'hit', x: victim.x, y: CENTER_HEIGHT, power: THROW_HIT_POWER, counter: false, ...who });
}

function knockOutIfDefeated(world: World, { victim, direction }: Throwing): void {
  if (victim.hp > 0) {
    return;
  }
  victim.hp = 0;
  knockOut(world, victim, direction);
}

/**
 * 던지기가 끝났다: 피해를 주고 쓰러뜨린다.
 */
export function applyThrow(world: World, thrower: Fighter, victim: Fighter): void {
  const throwing = { thrower, victim, direction: directionToward(thrower, victim) };
  tossVictim(throwing, MOVES.throw.damage);
  rewardThrow(world, throwing, MOVES.throw.damage);
  announceThrow(world, throwing);
  knockOutIfDefeated(world, throwing);
}
