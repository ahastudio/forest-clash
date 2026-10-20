import { patch } from '../patch';
import { AIRBORNE_EPSILON, RAGE_MAX } from './constants';
import type { Fighter, World } from './types';
import { emit, otherId } from './world';

/** 마지막으로 맞힌 뒤 이 프레임 안에 또 맞히면 콤보가 이어진다. */
const COMBO_WINDOW = 70;
const KO_LAUNCH_SPEED = 11;
const KO_DRIFT_SPEED = 6;
const KO_BANNER_FRAMES = 180;
const KO_STUN = 9999;

/** from에서 to를 향하는 가로 방향: 오른쪽이면 1, 왼쪽이면 -1. */
export const directionToward = (from: Fighter, to: Fighter): 1 | -1 => (from.x < to.x ? 1 : -1);

/** 분노 게이지를 채운다. 가득을 넘지 않는다. */
export function gainRage(fighter: Fighter, amount: number): void {
  fighter.rage = Math.min(RAGE_MAX, fighter.rage + amount);
}

/** 맞힌 쪽의 콤보 수를 하나 올린다. 이어진 콤보가 없으면 새 콤보로 센다. */
export function countCombo(world: World, attacker: Fighter, defender: Fighter): void {
  const sofar = world.comboTimer[attacker.id] > 0 ? world.comboCount[attacker.id] : 0;
  world.comboCount[attacker.id] = sofar + 1;
  world.comboTimer[attacker.id] = COMBO_WINDOW;
  world.comboCount[defender.id] = 0;
}

/** 체력이 다한 쪽을 날려 보내고 라운드를 끝낸다. */
export function knockOut(world: World, defender: Fighter, direction: number): void {
  const flight: Partial<Fighter> = {
    velocityY: KO_LAUNCH_SPEED,
    velocityX: direction * KO_DRIFT_SPEED,
    altitude: Math.max(defender.altitude, AIRBORNE_EPSILON),
  };
  patch(defender, { ...flight, state: 'ko', launched: true, moveId: null, stunFrames: KO_STUN });
  patch(world, { phase: 'ko', phaseTime: KO_BANNER_FRAMES, banner: 'K.O.' });
  world.wins[otherId(defender.id)]++;
  emit(world, { type: 'ko', id: defender.id, x: defender.x });
}
