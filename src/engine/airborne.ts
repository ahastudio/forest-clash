import { patch } from '../patch';
import { startMove } from './actions';
import { GRAVITY, KNOCKBACK_DECAY } from './constants';
import { pressed } from './fighter';
import type { Fighter, World } from './types';
import { emit } from './world';

const LANDING_LOCK = 3;
const AIR_ATTACK_BUFFER = 3;
const KNOCKBACK_STOP = 0.05;
const AIR_ATTACKS = [
  ['A', 'ja'],
  ['B', 'jb'],
  ['C', 'jc'],
  ['D', 'jd'],
] as const;

/** 공중 공격은 하늘에서 버튼을 누르면 나간다. */
export function airAttack(world: World, fighter: Fighter): void {
  if (fighter.airAttackUsed) {
    return;
  }
  const attack = AIR_ATTACKS.find(
    ([button]) => fighter.justPressed[button] || pressed(fighter, button, AIR_ATTACK_BUFFER),
  );
  if (attack) {
    startMove(world, fighter, attack[1]);
  }
}

const remainKnockedOut = (_world: World, fighter: Fighter): void => {
  fighter.state = 'ko';
};

const collapse = (world: World, fighter: Fighter): void => {
  patch(fighter, { state: 'down', elapsed: 0, knockedDown: true, velocityX: 0 });
  emit(world, { type: 'land', id: fighter.id, hard: true });
};

/** 띄워졌다가 땅에 닿았을 때: 체력이 남았으면 쓰러지고, 다했으면 그대로 쓰러져 있다. */
const landFromLaunch = (world: World, fighter: Fighter): void => {
  fighter.launched = false;
  const outcome = fighter.hp <= 0 ? remainKnockedOut : collapse;
  outcome(world, fighter);
};

const landKnockedOut = (_world: World, fighter: Fighter): void => {
  patch(fighter, { velocityX: 0, knockback: 0 });
};

const landLightly = (world: World, fighter: Fighter): void => {
  patch(fighter, { state: 'lock', lockFrames: LANDING_LOCK, moveId: null, velocityX: 0 });
  emit(world, { type: 'land', id: fighter.id });
};

function landingFor(fighter: Fighter): (world: World, fighter: Fighter) => void {
  if (fighter.state === 'hitstun' && fighter.launched) {
    return landFromLaunch;
  }
  return fighter.state === 'ko' ? landKnockedOut : landLightly;
}

function land(world: World, fighter: Fighter): void {
  patch(fighter, { altitude: 0, velocityY: 0, airAttackUsed: false, juggleCount: 0 });
  landingFor(fighter)(world, fighter);
}

function fall(world: World, fighter: Fighter): void {
  fighter.altitude += fighter.velocityY;
  fighter.velocityY -= GRAVITY;
  if (fighter.altitude <= 0 && fighter.velocityY < 0) {
    land(world, fighter);
  }
}

/** 중력과 이동, 맞아서 밀려나는 움직임. */
export function applyMovement(world: World, fighter: Fighter): void {
  if (fighter.altitude > 0 || fighter.velocityY !== 0) {
    fall(world, fighter);
  }
  fighter.x += fighter.velocityX + fighter.knockback;
  fighter.knockback =
    Math.abs(fighter.knockback * KNOCKBACK_DECAY) < KNOCKBACK_STOP ? 0 : fighter.knockback * KNOCKBACK_DECAY;
}
