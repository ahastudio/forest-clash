import { patch } from '../patch';
import { specialInput, startSpecial } from './actions';
import { AIRBORNE_EPSILON } from './constants';
import { attackMove } from './fighter';
import type { Move } from './moves';
import { stopAndRecover } from './recovery';
import type { Fighter, World } from './types';

const LUNGE_BRAKE = 0.6;
const LUNGE_LEAD_FRAMES = 4;
const RISE_SPEED = 5.5;

/** 돌진하는 기술은 앞으로 나아가고, 그 밖의 땅 기술은 서서히 멈춘다. */
function attackVelocity(fighter: Fighter, move: Move): number {
  const lunge = move.lungeSpeed ?? 0;
  const lungeFrom = move.lungeStart ?? move.start - LUNGE_LEAD_FRAMES;
  if (lunge && fighter.elapsed >= lungeFrom && fighter.elapsed <= move.end) {
    return fighter.face * lunge;
  }
  return move.air ? fighter.velocityX : fighter.velocityX * LUNGE_BRAKE;
}

function applyAttackMotion(fighter: Fighter, move: Move): void {
  fighter.velocityX = attackVelocity(fighter, move);
  if (!move.rising || fighter.elapsed < move.start || fighter.elapsed > move.end) {
    return;
  }
  patch(fighter, { velocityY: RISE_SPEED, altitude: fighter.altitude === 0 ? AIRBORNE_EPSILON : fighter.altitude });
}

/** 맞히거나 막힌 뒤 특수기로 끊어 잇는다. */
function cancelIntoSpecial(world: World, fighter: Fighter, move: Move): boolean {
  const special = fighter.cancelable && fighter.contact && !move.special ? specialInput(fighter) : null;
  if (special) {
    startSpecial(world, fighter, special);
  }
  return !!special;
}

const returnToAir = (fighter: Fighter): void => {
  patch(fighter, { state: 'air', moveId: null });
};

/** 땅 기술은 멈춘 뒤 일어난다. 그 사이 공중에 떠 있으면 공중 상태가 된다. */
const endGroundAttack = (fighter: Fighter): void => {
  stopAndRecover(fighter);
  if (fighter.altitude > 0) {
    fighter.state = 'air';
  }
};

function endAttack(fighter: Fighter, move: Move): void {
  const finish = move.air ? returnToAir : endGroundAttack;
  finish(fighter);
}

function progressAttack(world: World, fighter: Fighter, move: Move): void {
  fighter.elapsed++;
  applyAttackMotion(fighter, move);
  if (!cancelIntoSpecial(world, fighter, move) && fighter.elapsed >= move.total) {
    endAttack(fighter, move);
  }
}

/** 기술을 쓰는 중이면 한 프레임 진행한다. */
export function updateAttack(world: World, fighter: Fighter): void {
  const move = attackMove(fighter);
  if (move) {
    progressAttack(world, fighter, move);
  }
}
