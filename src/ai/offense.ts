import { RAGE_MAX } from '../engine';
import type { Decision, Tactic } from './decision';
import { combo, hold, holdThenWait } from './decision';
import type { Context, Mind } from './mind';
import type { AiPad } from './pad';
import { go } from './pad';

/** 이 거리까지 붙은 뒤 공격한다(약한 기술이 닿는 한계는 중심 거리로 약 110). */
const ATTACK_RANGE = 86;
const APPROACH_MARGIN = 8;
const RUSH_RANGE = 230;
const ANTI_AIR_RANGE = 120;
const ANTI_AIR_MIN_HEIGHT = 25;
const ANTI_AIR_RATE = 0.6;
const SUPER_RANGE = 110;
const SUPER_RATE = 0.05;
const GRAB_RANGE = 64;
const HOLD_BACK_FAR = 150;
const RUSH_RATE = 0.02;
const HOP_RANGE = 190;
const HOP_RATE = 0.012;

const roll = ({ random }: Mind, chance: number): boolean => random() < chance;

/** 날아 드는 상대는 대공 어퍼(↓→ 두 방향을 차례로, 위로 올려치는 입력)로 받는다. */
export const antiAir: Tactic = ({ me: _me, foe, dist, toward, mind, difficulty }) => {
  const falling = foe.altitude > ANTI_AIR_MIN_HEIGHT && foe.velocityY < 0 && dist < ANTI_AIR_RANGE && mind.wait === 0;
  if (!falling || !roll(mind, ANTI_AIR_RATE * difficulty.antiAir)) {
    return null;
  }
  const forward = go(toward);
  return combo([forward, forward, { d: 1 }, { d: 1 }, { d: 1, A: 1 }], 40);
};

/** 쉬는 동안은 움직이지 않는다. 너무 멀면 다가온다. */
export const coolDown: Tactic = ({ dist, toward, mind }) => {
  if (mind.wait <= 0) {
    return null;
  }
  return hold(dist > HOLD_BACK_FAR ? go(toward) : {});
};

/** 분노 게이지가 가득이면 가까울 때 분노 필살기(↓→↓→ + 강펀치)를 낸다. */
export const superMove: Tactic = ({ me, dist, toward, mind }) => {
  if (me.rage < RAGE_MAX || dist >= SUPER_RANGE || !roll(mind, SUPER_RATE)) {
    return null;
  }
  const forward = go(toward);
  return combo([{ d: 1 }, { d: 1 }, forward, forward, { d: 1 }, { d: 1 }, forward, { ...forward, C: 1 }], 60);
};

/** 앞 두 번으로 달려 붙는다. */
function rush({ toward, away }: Context): Decision {
  const forward = go(toward);
  return combo([forward, { [away]: 0 }, ...Array(10).fill(forward)], 20);
}

/** 멀리서 다가오다가 가끔 낮은 점프로 파고든다. */
function approach({ dist, toward }: Context, chance: number): Decision {
  const forward = go(toward);
  const hop = dist < HOP_RANGE && chance < HOP_RATE;
  return hop ? holdThenWait({ ...forward, u: 1 }, 40) : hold(forward);
}

/** 거리에 따른 접근. 공격할 거리 안이면 null. */
function closeIn(context: Context, chance: number): Decision | null {
  if (context.dist > RUSH_RANGE) {
    return chance < RUSH_RATE ? rush(context) : hold(go(context.toward));
  }
  return context.dist > ATTACK_RANGE + APPROACH_MARGIN ? approach(context, chance) : null;
}

/** 공격 하나: chance가 below보다 작고 조건이 맞으면 press를 누르고 wait만큼 쉰다. */
interface Attack {
  below: number;
  when?: (context: Context) => boolean;
  press: (context: Context) => Partial<AiPad>;
  wait?: number;
}

const AT = (context: Context): Partial<AiPad> => go(context.toward);
const AWAY = (context: Context): Partial<AiPad> => go(context.away);

/** 보통 때의 공격 고르기. 위에서부터 처음 맞는 것을 쓴다. */
const NORMAL_ATTACKS: readonly Attack[] = [
  { below: 0.03, when: c => c.dist <= GRAB_RANGE, press: c => ({ ...AT(c), C: 1 }), wait: 40 },
  { below: 0.1, press: () => ({ A: 1 }), wait: 12 },
  { below: 0.14, press: () => ({ B: 1 }), wait: 16 },
  { below: 0.17, press: () => ({ d: 1, A: 1 }), wait: 12 },
  { below: 0.2, press: () => ({ d: 1, B: 1 }), wait: 14 },
  { below: 0.225, press: () => ({ C: 1 }), wait: 26 },
  { below: 0.245, press: () => ({ D: 1 }), wait: 28 },
  { below: 0.27, press: AWAY },
];

/** 상대가 막고 서 있는 자세. 뒤를 누른 채 서 있으면 하단과 잡기가, 앉아서 막으면 상단과 잡기가 먹힌다. */
interface Guard {
  standing: boolean;
  crouching: boolean;
  any: boolean;
}

function readGuard({ me, foe }: Context): Guard {
  const holdingBack = foe.x < me.x ? foe.input.l : foe.input.r;
  return {
    standing: holdingBack && !foe.input.d,
    crouching: holdingBack && foe.input.d,
    any: foe.state === 'blockstun' || holdingBack,
  };
}

/** 막고 있는 상대를 읽은 자세에 맞춰 압박한다. */
function pressureAttacks(guard: Guard): readonly Attack[] {
  return [
    { below: 0.12, when: c => c.dist <= GRAB_RANGE, press: c => ({ ...AT(c), C: 1 }), wait: 40 },
    { below: 0.2, when: () => guard.standing, press: () => ({ d: 1, B: 1 }), wait: 16 },
    { below: 0.26, when: () => guard.standing, press: () => ({ d: 1, A: 1 }), wait: 12 },
    { below: 0.2, when: () => guard.crouching, press: c => ({ ...AT(c), D: 1 }), wait: 36 },
    { below: 0.3, press: () => ({ A: 1 }), wait: 12 },
    { below: 0.34, press: () => ({ B: 1 }), wait: 16 },
    { below: 0.5, when: c => c.dist > GRAB_RANGE, press: AT },
    { below: 0.54, press: AWAY },
  ];
}

function chooseAttack(attacks: readonly Attack[], context: Context, scaled: number): Decision {
  const attack = attacks.find(a => scaled < a.below && (a.when?.(context) ?? true));
  if (!attack) {
    return hold({});
  }
  return attack.wait === undefined ? hold(attack.press(context)) : holdThenWait(attack.press(context), attack.wait);
}

/** 사거리 안에서 공격을 고른다. 쉬울수록 공격 빈도가 낮고, 어려울수록 상대의 방어 자세를 읽어 압박한다. */
function strikeFromRange(context: Context, chance: number): Decision {
  const scaled = chance / context.difficulty.aggression;
  const guard = readGuard(context);
  const pressing = guard.any && roll(context.mind, context.difficulty.mix);
  return chooseAttack(pressing ? pressureAttacks(guard) : NORMAL_ATTACKS, context, scaled);
}

/** 접근하거나 공격한다. 이 전술은 언제나 판단을 내린다. */
export const engage: Tactic = context => {
  const chance = context.mind.random();
  return closeIn(context, chance) ?? strikeFromRange(context, chance);
};
