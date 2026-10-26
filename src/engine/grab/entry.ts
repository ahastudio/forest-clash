import { NEUTRAL_STATES, THROW_RANGE } from '../constants';
import { attackMove, backHeld, forwardHeld, pressed } from '../fighter';
import type { Strike } from '../strike';
import type { Fighter, World } from '../types';
import { opponentOf } from '../world';
import { startGrab } from './hold';

const heavyPressed = (fighter: Fighter): boolean => pressed(fighter, 'C') || pressed(fighter, 'D');

// 잡기 입력: 앞이나 뒤로 밀면서 강펀치나 강킥을 누른다.
const asksForThrow = (fighter: Fighter): boolean =>
  (forwardHeld(fighter) || backHeld(fighter)) && heavyPressed(fighter);

const isWithinReach = (attacker: Fighter, defender: Fighter): boolean =>
  Math.abs(defender.x - attacker.x) <= THROW_RANGE;

/**
 * 닿는 거리(THROW_RANGE) 안에서 잡기 입력이 들어오면 상대의 상태와 상관없이 일반 공격 대신 잡기가 나간다. 상대가 잡을 수 없는 상태면 헛친다.
 */
export function wantsThrow(world: World, fighter: Fighter): boolean {
  return asksForThrow(fighter) && !fighter.input.d && isWithinReach(fighter, opponentOf(world, fighter));
}

// 기술을 막 시작해 아직 판정이 나오지 않은 상태인가(발동 전).
const isWindingUp = (fighter: Fighter): boolean => {
  const move = attackMove(fighter);
  return fighter.state === 'attack' && !!move && fighter.elapsed < move.start;
};

// 잡을 수 있는 상태인가: 땅에서 무적이 아니고, 행동 가능하거나 막고 있거나 공격이 아직 발동 전일 때. 판정이 나온 공격은 잡을 수 없다.
const isThrowable = (fighter: Fighter): boolean =>
  fighter.altitude === 0 &&
  fighter.invincibleFrames === 0 &&
  (NEUTRAL_STATES.includes(fighter.state) || fighter.state === 'blockstun' || isWindingUp(fighter));

// 잡기는 발동 프레임에 한 번만 시도한다.
const isGrabFrame = ({ attacker, move }: Strike): boolean => attacker.elapsed === move.start && !attacker.contact;

const canGrab = (attacker: Fighter, defender: Fighter): boolean =>
  isWithinReach(attacker, defender) && isThrowable(defender) && defender.state !== 'thrown';

/**
 * 발동 프레임에 잡을 수 있는 상대가 있으면 잡는다.
 */
export function tryGrab(world: World, strike: Strike): void {
  const { attacker, defender } = strike;
  if (!isGrabFrame(strike) || !canGrab(attacker, defender)) {
    return;
  }
  attacker.contact = { type: 'grab' };
  startGrab(world, attacker, defender);
}
