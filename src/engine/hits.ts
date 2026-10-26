import { blockStrike, canBlock } from './blocking';
import { activeWindow, hitboxOf, hurtboxes, overlaps } from './boxes';
import { attackMove } from './fighter';
import { tryGrab } from './grab';
import { landStrike } from './impact';
import type { Move } from './moves';
import type { Strike } from './strike';
import { sparkPosition } from './strike';
import type { Fighter, World } from './types';
import { opponentOf } from './world';

const JUGGLE_LIMIT = 2;
const UNTOUCHABLE_STATES = ['down', 'ko', 'thrown', 'throwing'];

function resolveStrike(world: World, strike: Strike): void {
  const spark = sparkPosition(strike);
  strike.attacker.landedWindows |= 1 << strike.window;
  if (canBlock(strike)) {
    blockStrike(world, strike, spark);
  } else {
    landStrike(world, strike, spark);
  }
}

const isOpenWindow = ({ attacker, window }: Strike): boolean =>
  window >= 0 && !(attacker.landedWindows & (1 << window));

// 띄워진 상대는 저글이 되는 기술(특수기, 공중 기술)만 맞고, 저글 한도가 있다.
const canJuggle = (defender: Fighter, move: Move): boolean =>
  !!(move.juggles || move.air) && defender.juggleCount < JUGGLE_LIMIT;

function isReachable({ defender, move }: Strike): boolean {
  if (defender.invincibleFrames > 0 || UNTOUCHABLE_STATES.includes(defender.state)) {
    return false;
  }
  return !defender.launched || canJuggle(defender, move);
}

// 이 프레임에 판정 상자가 상대의 맞을 수 있는 상자에 닿는가.
function connects(strike: Strike): boolean {
  const box = hitboxOf(strike.attacker, strike.move);
  if (!box || !isOpenWindow(strike) || !isReachable(strike)) {
    return false;
  }
  return hurtboxes(strike.defender).some(hurt => overlaps(box, hurt));
}

function buildStrike(world: World, attacker: Fighter): Strike | null {
  const move = attackMove(attacker);
  return move ? { attacker, defender: opponentOf(world, attacker), move, window: activeWindow(attacker) } : null;
}

// 잡기는 이 자리에서 바로 처리하고, 나머지는 닿았으면 타격 목록에 올린다.
function strikesOf(world: World, attacker: Fighter): Strike[] {
  const strike = buildStrike(world, attacker);
  if (strike?.move.grab) {
    tryGrab(world, strike);
  }
  return strike && !strike.move.grab && connects(strike) ? [strike] : [];
}

/**
 * 판정 검사. 같은 프레임에 서로 맞히면 둘 다 맞는다.
 * 맞은 쪽의 기술은 이 프레임의 판정 뒤 끊긴다.
 */
export function detectHits(world: World): void {
  const strikes = world.fighters.flatMap(attacker => strikesOf(world, attacker));
  for (const strike of strikes) {
    resolveStrike(world, strike);
  }
}
