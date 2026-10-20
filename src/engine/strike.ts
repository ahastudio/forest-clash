import { patch } from '../patch';
import { KNOCKBACK_DECAY } from './constants';
import { directionToward, gainRage } from './damage';
import type { Move } from './moves';
import type { Fighter } from './types';

/** 한 번의 타격: 공격하는 쪽, 맞는 쪽, 기술, 그 기술의 몇 번째 판정 구간인가. */
export interface Strike {
  attacker: Fighter;
  defender: Fighter;
  move: Move;
  window: number;
}

/** 맞은 곳에 피어나는 불꽃의 위치. */
export interface Spark {
  x: number;
  y: number;
}

const SPARK_SIDE_OFFSET = 10;
const SPARK_MIN_HEIGHT = 12;
const SPARK_MAX_HEIGHT = 110;
const SPARK_HEIGHT_OFFSET = 56;

/** 맞은 곳에 피어나는 불꽃의 위치. */
export function sparkPosition({ attacker, defender }: Strike): Spark {
  const direction = directionToward(attacker, defender);
  const y = Math.max(SPARK_MIN_HEIGHT, Math.min(SPARK_MAX_HEIGHT, defender.altitude + SPARK_HEIGHT_OFFSET));
  return { x: (attacker.x + defender.x) / 2 + direction * SPARK_SIDE_OFFSET, y };
}

/** 때린 쪽은 땅에 있으면 반동으로 조금 밀린다. */
export function recoil({ attacker, defender, move }: Strike, share: number): void {
  if (attacker.altitude > 0) {
    return;
  }
  attacker.knockback = -directionToward(attacker, defender) * move.pushback * share * (1 - KNOCKBACK_DECAY);
}

/** 막은 쪽과 때린 쪽의 분노 게이지가 찬다. */
export function exchangeRage(
  { attacker, defender }: Strike,
  { defenderGain, attackerGain }: { defenderGain: number; attackerGain: number },
): void {
  gainRage(defender, defenderGain);
  gainRage(attacker, attackerGain);
}

/** 때린 쪽에 접촉을 기록한다. 맞히거나 막힌 뒤 특수기로 취소할 수 있는 기술이면 표시한다. */
export function registerContact({ attacker, move }: Strike, type: 'block' | 'hit'): void {
  patch(attacker, { contact: { type, frame: attacker.elapsed }, cancelable: !!move.cancelable });
}
