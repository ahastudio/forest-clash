import type { Fighter, FighterState, Move, MoveId } from '../engine';
import { MOVES } from '../engine';
import { hasMiddlePose } from './sprites';

const SUPER_ART = ['straight', 'kickheavy', 'upper'];
const WALK_FRAME_LENGTH = 7;
// 준비 구간의 앞 60퍼센트는 준비 자세, 나머지는 중간 자세.
const WINDUP_FIRST_PART = 0.6;
// 후딜의 앞 절반은 회수 자세, 나머지는 대기 자세.
const RECOVERY_FIRST_PART = 0.5;
const THROWN_HELD_FROM = 3;
const THROWN_TOSSED_FROM = 17;
const THROWN_FLIP_FROM = 20;

// 분노 필살기가 끝난 뒤: 앞 절반은 회수 자세, 나머지는 대기 자세.
const superRecoveryPose = (move: Move, t: number): string =>
  t - move.end < (move.total - move.end) * RECOVERY_FIRST_PART ? 'upper-r' : 'idle';

// 분노 필살기: 판정 구간마다 다른 기술 자세, 앞은 준비, 뒤는 회수와 대기.
function superPose(t: number): string {
  const move = MOVES.super;
  const index = move.windows.findIndex(([from, to]) => t >= from && t <= to);
  if (index >= 0) {
    return `${SUPER_ART[index]}-x`;
  }
  return t < move.start ? 'straight-a' : superRecoveryPose(move, t);
}

// 시간 흐름 속의 기술: 지금 몇 프레임째이고, 기술이 끝난 뒤 어떤 자세로 돌아가는가.
interface Timing {
  t: number;
  rest: string;
}

function windupPose(art: string, move: Move, t: number): string {
  return hasMiddlePose(art) && t / move.start >= WINDUP_FIRST_PART ? `${art}-m` : `${art}-a`;
}

function recoveryPose(art: string, move: Move, timing: Timing): string {
  const recovered = (timing.t - move.end) / Math.max(1, move.total - move.end);
  return recovered < RECOVERY_FIRST_PART ? `${art}-r` : timing.rest;
}

// 기술 그림 묶음에서 시간 흐름에 맞는 한 장. 준비 → 타격 → 회수 → 대기 순서다.
function groundAttackPose(art: string, move: Move, timing: Timing): string {
  if (timing.t < move.start) {
    return windupPose(art, move, timing.t);
  }
  return timing.t <= move.end ? `${art}-x` : recoveryPose(art, move, timing);
}

type AttackPose = (fighter: Fighter, move: Move) => string;

// 땅 기술: 그림 묶음 이름과, 기술이 끝난 뒤 돌아가는 자세(앉는 기술은 앉은 자세).
const ground =
  (art: string, rest = 'idle'): AttackPose =>
  (fighter, move) =>
    groundAttackPose(art, move, { t: fighter.elapsed, rest });

// 공중 기술: 발동 전에는 점프, 뒤에는 정해진 타격 자세.
const air =
  (strike: string): AttackPose =>
  (fighter, move) =>
    fighter.elapsed < move.start ? 'jump' : strike;

// 분노 필살기: 판정 구간마다 다른 기술 자세, 앞은 준비, 뒤는 회수와 대기.
const superAttack: AttackPose = fighter => superPose(fighter.elapsed);

// 기술마다 자세를 고르는 방법.
const ATTACK_POSES: Record<MoveId, AttackPose> = {
  a5: ground('jab'),
  b5: ground('kicklight'),
  c5: ground('straight'),
  d5: ground('kickheavy'),
  a2: ground('cjab', 'crouch'),
  b2: ground('lowkick', 'crouch'),
  c2: ground('upper', 'crouch'),
  d2: ground('sweep', 'crouch'),
  c6: ground('hammer'),
  d6: ground('lungekick'),
  throw: ground('grab'),
  elbow_a: ground('elbow'),
  elbow_c: ground('elbow'),
  dp_a: ground('dp'),
  dp_c: ground('dp'),
  blow: ground('shove'),
  ja: air('airpunch-x'),
  jb: air('airkick-x'),
  jc: air('airpunch-x'),
  jd: air('airkick-x'),
  super: superAttack,
};

// 붙잡힘 → 들려 있음 → 던져져 뒤집힘.
function thrownPose(fighter: Fighter): string {
  if (fighter.elapsed < THROWN_HELD_FROM) {
    return 'hurt';
  }
  if (fighter.elapsed < THROWN_TOSSED_FROM) {
    return 'held';
  }
  return fighter.elapsed < THROWN_FLIP_FROM ? 'hurt-air' : 'tossed';
}

// 움켜쥠 → 들어 올림 → 던짐.
function throwingPose(fighter: Fighter): string {
  if (fighter.elapsed < THROWN_HELD_FROM) {
    return 'grab-x';
  }
  return fighter.elapsed < THROWN_TOSSED_FROM ? 'throw-lift' : 'throw-toss';
}

function hitstunPose(fighter: Fighter): string {
  if (fighter.knockedDown && fighter.altitude === 0) {
    return 'down';
  }
  return fighter.altitude > 0 ? 'hurt-air' : 'hurt';
}

function lockPose(fighter: Fighter): string {
  if (fighter.altitude > 0) {
    return 'fall';
  }
  return fighter.gettingUp ? 'getup' : 'idle';
}

// 상태마다 그림을 고르는 방법. frame은 걷기 그림을 번갈아 바꾸는 데 쓴다.
const POSES: Record<FighterState, (fighter: Fighter, frame: number) => string> = {
  idle: () => 'idle',
  down: () => 'down',
  ko: fighter => (fighter.altitude > 0 ? 'hurt-air' : 'down'),
  hitstun: hitstunPose,
  thrown: thrownPose,
  throwing: throwingPose,
  blockstun: fighter => (fighter.guardingCrouched ? 'block-crouch' : 'block'),
  roll: () => 'dash',
  run: () => 'dash',
  bdash: () => 'jump',
  prejump: () => 'crouch',
  crouch: () => 'crouch',
  air: fighter => (fighter.velocityY > 0 ? 'jump' : 'fall'),
  lock: lockPose,
  walk: (_f, frame) => (Math.floor(frame / WALK_FRAME_LENGTH) % 2 ? 'walk1' : 'walk2'),
  attack: fighter => (fighter.moveId ? ATTACK_POSES[fighter.moveId](fighter, MOVES[fighter.moveId]) : 'idle'),
};

/**
 * 캐릭터의 상태(서기, 걷기, 공중, 기술 등)에 맞는 그림 이름을 돌려준다. frame은 걷는 그림을 번갈아 바꾸는 데 쓰는 진행 프레임이다.
 */
export const poseKey = (fighter: Fighter, frame: number): string => POSES[fighter.state](fighter, frame);
