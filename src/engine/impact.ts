import { patch } from '../patch';
import { AIRBORNE_EPSILON, KNOCKBACK_DECAY } from './constants';
import { countCombo, directionToward, knockOut } from './damage';
import { attackMove } from './fighter';
import type { Move } from './moves';
import type { Spark, Strike } from './strike';
import { exchangeRage, recoil, registerContact } from './strike';
import type { Fighter, GameEvent, World } from './types';
import { emit } from './world';

// 맞은 결과: 카운터 히트인가, 입힌 피해, 맞기 전에 공중에 있었는가, 불꽃의 위치.
interface Outcome {
  counter: boolean;
  damage: number;
  wasAirborne: boolean;
  spark: Spark;
}

// 날아가는 모습: 띄우는 속도, 쓰러뜨리는가, 맞기 전에 공중이었는가, 날아가는 방향.
interface Flight {
  launch: number;
  knockdown: boolean;
  wasAirborne: boolean;
  direction: number;
}

const COUNTER_DAMAGE_RATE = 1.25;
const COUNTER_STUN_BONUS = 4;
const COUNTER_HITSTOP_BONUS = 3;
const HIT_FLASH_FRAMES = 8;
const LAUNCH_STUN_FRAMES = 60;
const KNOCKDOWN_LAUNCH_SPEED = 7;
const KNOCKDOWN_DRIFT = 4.2;
const LAUNCH_DRIFT = 2.4;
const AIR_JUGGLE_MIN_SPEED = 6;
const COMBO_SCALE_STEP = 0.08;
const JUGGLE_SCALE_STEP = 0.1;
const MIN_DAMAGE_SCALE = 0.5;
const MIN_HIT_POWER = 3;
const VICTIM_RAGE_RATE = 1.6;
const ATTACKER_RAGE_RATE = 1.0;
const HIT_PUSH_SHARE = 0.25;
const HIT_PUSH_BOOST = 1.2;

// 기술을 쓰는 중(발동~판정)에 맞히면 카운터 히트다.
function isCounterHit(defender: Fighter): boolean {
  const move = attackMove(defender);
  return !!move && defender.elapsed <= move.end;
}

const scaleFor = ({ count, step }: { count: number; step: number }): number =>
  Math.max(MIN_DAMAGE_SCALE, 1 - step * count);

// 콤보가 길수록, 공중에서 여러 번 맞을수록 피해가 줄어든다(최소 절반).
function damageScale(world: World, { attacker, defender }: Strike): number {
  const hitsSoFar = world.comboTimer[attacker.id] > 0 ? world.comboCount[attacker.id] : 0;
  return (
    scaleFor({ count: hitsSoFar, step: COMBO_SCALE_STEP }) *
    scaleFor({ count: defender.juggleCount, step: JUGGLE_SCALE_STEP })
  );
}

// 카운터 히트는 피해가 늘어난다.
function strikeDamage(world: World, strike: Strike, { counter }: Pick<Outcome, 'counter'>): number {
  const base = strike.move.windowDamages?.[strike.window] ?? strike.move.damage;
  return Math.max(1, Math.round(base * damageScale(world, strike) * (counter ? COUNTER_DAMAGE_RATE : 1)));
}

function hitOutcome(world: World, strike: Strike, spark: Spark): Outcome {
  const counter = isCounterHit(strike.defender);
  return {
    counter,
    damage: strikeDamage(world, strike, { counter }),
    wasAirborne: strike.defender.altitude > 0,
    spark,
  };
}

// 이 타격이 상대를 띄우는 속도. 띄우지 않으면 0.
function launchSpeed({ move, window }: Strike): number {
  if (move.launchSpeed) {
    return move.launchSpeed;
  }
  const lastWindow = window === move.windows.length - 1;
  return move.finalLaunchSpeed && lastWindow ? move.finalLaunchSpeed : 0;
}

// 맞은 쪽이 입는 몸의 변화. 앉아 있었는지는 자세가 바뀌기 전에 기록한다.
function injure(defender: Fighter, damage: number): void {
  const crouching = defender.state === 'crouch' || (defender.state === 'blockstun' && defender.guardingCrouched);
  defender.hp -= damage;
  patch(defender, {
    hurtFlash: HIT_FLASH_FRAMES,
    moveId: null,
    velocityX: 0,
    hitCrouching: crouching,
  });
}

// 날아가는 속도: 띄우면 띄우는 속도, 쓰러뜨리면 빠르게 솟고, 공중에서 맞으면 지금 속도를 지킨다.
function flightVelocity(defender: Fighter, flight: Flight): Pick<Fighter, 'velocityX' | 'velocityY'> {
  const { launch, knockdown, direction } = flight;
  const velocityY = launch || (knockdown ? KNOCKDOWN_LAUNCH_SPEED : Math.max(defender.velocityY, AIR_JUGGLE_MIN_SPEED));
  return { velocityY, velocityX: direction * (launch || !knockdown ? LAUNCH_DRIFT : KNOCKDOWN_DRIFT) };
}

// 띄우거나 쓰러뜨리거나 공중에서 맞은 경우: 땅에 닿을 때까지 날아간다.
function sendFlying(defender: Fighter, flight: Flight): void {
  const rising: Partial<Fighter> = {
    state: 'hitstun',
    launched: true,
    altitude: Math.max(defender.altitude, AIRBORNE_EPSILON),
    stunFrames: LAUNCH_STUN_FRAMES,
    juggleCount: defender.juggleCount + Number(flight.wasAirborne),
    knockedDown: defender.knockedDown || (flight.knockdown && !flight.launch),
  };
  patch(defender, { ...flightVelocity(defender, flight), ...rising });
}

// 땅에서 맞고 잠시 굳는다. 카운터 히트는 더 오래 굳는다.
function staggerDefender(strike: Strike, { counter }: Pick<Outcome, 'counter'>): void {
  const { attacker, defender, move } = strike;
  const push = directionToward(attacker, defender) * move.pushback * (1 - KNOCKBACK_DECAY) * HIT_PUSH_BOOST;
  const stun = move.hitstun + (counter ? COUNTER_STUN_BONUS : 0);
  patch(defender, { state: 'hitstun', stunFrames: stun, launched: false, knockback: push });
  recoil(strike, HIT_PUSH_SHARE);
}

function flightOf(strike: Strike, outcome: Outcome): Flight {
  const { attacker, defender, move } = strike;
  const knockdown = !!move.knockdown || move.hitstun === 0;
  const direction = directionToward(attacker, defender);
  return { launch: launchSpeed(strike), knockdown, wasAirborne: outcome.wasAirborne, direction };
}

const isFlying = (flight: Flight): boolean => !!flight.launch || flight.knockdown || flight.wasAirborne;

function reactToHit(strike: Strike, outcome: Outcome): void {
  const flight = flightOf(strike, outcome);
  if (isFlying(flight)) {
    sendFlying(strike.defender, flight);
  } else {
    staggerDefender(strike, outcome);
  }
}

// 카운터 히트는 타격 정지가 더 길다.
const hitstopFor = (move: Move, { counter }: Pick<Outcome, 'counter'>): number =>
  counter ? move.hitstop + COUNTER_HITSTOP_BONUS : move.hitstop;

// 맞힌 쪽의 보상: 게이지, 콤보, 취소 가능 표시, 타격 정지.
function rewardHit(world: World, strike: Strike, outcome: Outcome): void {
  exchangeRage(strike, {
    defenderGain: outcome.damage * VICTIM_RAGE_RATE,
    attackerGain: outcome.damage * ATTACKER_RAGE_RATE,
  });
  registerContact(strike, 'hit');
  countCombo(world, strike.attacker, strike.defender);
  world.hitstop = Math.max(world.hitstop, hitstopFor(strike.move, outcome));
}

function hitEvent({ attacker, defender, move }: Strike, outcome: Outcome): GameEvent {
  const power = Math.max(MIN_HIT_POWER, outcome.damage);
  const who = { attacker: attacker.id, defender: defender.id, moveId: move.id };
  return { type: 'hit', ...outcome.spark, power, counter: outcome.counter, ...who, damage: outcome.damage };
}

function knockOutIfDefeated(world: World, { attacker, defender }: Strike): void {
  if (defender.hp > 0) {
    return;
  }
  defender.hp = 0;
  knockOut(world, defender, directionToward(attacker, defender));
}

// 맞았다는 사건을 알리고, 체력이 다했으면 쓰러뜨린다.
function announceHit(world: World, strike: Strike, outcome: Outcome): void {
  emit(world, hitEvent(strike, outcome));
  knockOutIfDefeated(world, strike);
}

/**
 * 타격이 들어갔다: 피해, 반응, 보상, 사건 알림을 차례로 처리한다.
 */
export function landStrike(world: World, strike: Strike, spark: Spark): void {
  const outcome = hitOutcome(world, strike, spark);
  injure(strike.defender, outcome.damage);
  reactToHit(strike, outcome);
  rewardHit(world, strike, outcome);
  announceHit(world, strike, outcome);
}
