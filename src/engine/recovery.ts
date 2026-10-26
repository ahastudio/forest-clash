import { patch } from '../patch';
import type { Fighter, World } from './types';

const WAKE_UP_LOCK = 14;
const DOWN_FRAMES = 36;

/**
 * 행동할 수 있는 처음 상태로 돌아간다.
 */
export function toNeutral(fighter: Fighter): void {
  patch(fighter, { state: 'idle', moveId: null, stunFrames: 0, elapsed: 0, gettingUp: false });
}

/**
 * 멈추고 일어난다.
 */
export function stopAndRecover(fighter: Fighter): void {
  fighter.velocityX = 0;
  toNeutral(fighter);
}

/**
 * 움직일 수 없는 시간을 한 프레임 줄이고, 끝나면 기본 상태로 돌아간다.
 */
export function updateLock(_world: World, fighter: Fighter): void {
  fighter.lockFrames--;
  if (fighter.lockFrames <= 0) {
    toNeutral(fighter);
  }
}

/**
 * 막은 뒤의 경직을 한 프레임 줄이고, 끝나면 기본 상태로 돌아간다.
 */
export function updateBlockstun(_world: World, fighter: Fighter): void {
  fighter.stunFrames--;
  if (fighter.stunFrames <= 0) {
    toNeutral(fighter);
  }
}

function recoverFromHit(fighter: Fighter): void {
  fighter.hitCrouching = false;
  toNeutral(fighter);
}

/**
 * 공중에서 맞은 동안은 땅에 닿을 때까지 기다린다.
 */
export function updateHitstun(_world: World, fighter: Fighter): void {
  if (fighter.launched || fighter.altitude > 0) {
    return;
  }
  fighter.stunFrames--;
  if (fighter.stunFrames <= 0) {
    recoverFromHit(fighter);
  }
}

/**
 * 쓰러져 있다가 일어난다. 일어나는 동안은 행동할 수 없다.
 */
export function updateDown(_world: World, fighter: Fighter): void {
  fighter.elapsed++;
  if (fighter.elapsed >= DOWN_FRAMES) {
    patch(fighter, { state: 'lock', lockFrames: WAKE_UP_LOCK, knockedDown: false, gettingUp: true });
  }
}
