import type { Move } from '../engine';
import { attackMove } from '../engine';
import type { Decision, Tactic } from './decision';
import { hold, holdThenWait } from './decision';
import type { Context, Mind } from './mind';
import type { AiPad } from './pad';
import { go } from './pad';

// 이 거리 안이면 약펀치가 닿는다.
const PUNISH_RANGE = 111;
const STUFF_RANGE = 105;
const SEE_ATTACK_RANGE = 190;
const STUFF_MIN_STARTUP = 6;
const STUFF_RATE = 0.35;
const PUNISH_WAIT = 14;
const STUFF_WAIT = 12;
const FREE_STATES = ['idle', 'walk', 'crouch', 'run'];

const roll = ({ random }: Mind, chance: number): boolean => random() < chance;

// 상대 기술이 끝나 가는 틈에 반격할 수 있는가.
function canCounterBlocked({ me, foe, dist }: Context): boolean {
  const move = attackMove(foe);
  return !!move && me.stunFrames <= 2 && dist <= PUNISH_RANGE && foe.elapsed > move.end;
}

// 막는 자세를 유지한다. 앉아서 막고 있었으면 계속 앉는다.
const guardPress = ({ me, away }: Context): Partial<AiPad> => ({
  ...go(away),
  ...(me.guardingCrouched ? { d: 1 } : {}),
});

/**
 * 막는 동안 방어를 유지하고, 상대 후딜이 보이면 약펀치로 반격한다.
 */
export const holdGuard: Tactic = context => {
  if (context.me.state !== 'blockstun') {
    return null;
  }
  return hold(canCounterBlocked(context) ? { A: 1 } : guardPress(context));
};

/**
 * 행동할 수 없는 상태(공격 중, 맞는 중 등)에서는 아무것도 누르지 않는다.
 */
export const stayStill: Tactic = ({ me }) => (FREE_STATES.includes(me.state) ? null : hold({}));

// 상대가 기술을 새로 쓰기 시작했으면 반응 지연을 새로 뽑는다.
function noticeAttack({ foe, mind, difficulty }: Context): void {
  const [min, max] = difficulty.reaction;
  if (foe.moveId !== mind.lastMove || foe.elapsed < mind.lastTime) {
    mind.reaction = min + Math.floor(mind.random() * (max - min));
    mind.lastMove = foe.moveId;
  }
  mind.lastTime = foe.elapsed;
}

// 헛친 기술의 후딜은 약펀치로 반격한다.
function punishRecovery({ foe, dist, mind, difficulty }: Context, move: Move): Decision | null {
  const open = foe.elapsed > move.end && !foe.contact && dist <= PUNISH_RANGE;
  return open && roll(mind, difficulty.punish) ? holdThenWait({ A: 1 }, PUNISH_WAIT) : null;
}

// 발동이 느린 기술은 더 빠른 약펀치로 끊는다(카운터 히트).
function interruptSlowMove({ foe, dist, mind, difficulty }: Context, move: Move): Decision | null {
  const slow = move.start - foe.elapsed >= STUFF_MIN_STARTUP && dist <= STUFF_RANGE && !move.grab;
  return slow && roll(mind, difficulty.interrupt * STUFF_RATE) ? holdThenWait({ A: 1 }, STUFF_WAIT) : null;
}

// 상대 기술이 닿기 전에, 높이에 맞춰 막는다(하단은 앉아서). 쉬울수록 자주 놓친다.
function blockIncoming({ foe, away, mind, difficulty }: Context, move: Move): Decision | null {
  const inWindow = foe.elapsed >= Math.min(mind.reaction, move.start - 1) && foe.elapsed <= move.end;
  const miss = move.kind === 'low' ? difficulty.missLow : difficulty.missOther;
  if (!inWindow || mind.random() < miss) {
    return null;
  }
  return hold({ ...go(away), ...(move.kind === 'low' ? { d: 1 } : {}) });
}

/**
 * 상대가 공격하는 것을 본 뒤 반응 지연을 두고 반격하거나 막는다.
 */
export const answerAttack: Tactic = context => {
  const move = attackMove(context.foe);
  if (!move || context.dist >= SEE_ATTACK_RANGE) {
    return null;
  }
  noticeAttack(context);
  return punishRecovery(context, move) ?? interruptSlowMove(context, move) ?? blockIncoming(context, move);
};
