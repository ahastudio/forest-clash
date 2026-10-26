import type { Difficulty } from './difficulty';
import type { Context, Mind } from './mind';
import type { AiPad } from './pad';
import { padOf } from './pad';

/**
 * 한 번의 판단 결과.
 * press는 지금 누를 것, wait는 그 뒤에 쉴 기준 프레임 수(난이도 배율을 곱한다),
 * sequence는 이어서 낼 입력들이다(첫 입력은 지금 낸다).
 */
export interface Decision {
  press: Partial<AiPad>;
  wait?: number;
  sequence?: readonly Partial<AiPad>[];
}

/**
 * 판단을 고르는 방법. 해당하지 않으면 null을 돌려주고, 그러면 다음 방법이 이어서 판단한다.
 */
export type Tactic = (context: Context) => Decision | null;

/**
 * 지금 누를 것만 정한다.
 */
export const hold = (press: Partial<AiPad>): Decision => ({ press });

/**
 * 누르고 나서 wait 프레임(기준) 쉰다.
 */
export const holdThenWait = (press: Partial<AiPad>, wait: number): Decision => ({ press, wait });

/**
 * 정해진 입력 순서를 이어서 내고 나서 wait 프레임(기준) 쉰다.
 */
export const combo = (sequence: readonly Partial<AiPad>[], wait: number): Decision => ({
  press: sequence[0] ?? {},
  sequence,
  wait,
});

/**
 * 판단을 기억에 반영하고 이번 프레임에 낼 입력을 돌려준다.
 */
export function applyDecision(decision: Decision, mind: Mind, difficulty: Difficulty): AiPad {
  if (decision.wait !== undefined) {
    mind.wait = Math.round(decision.wait * difficulty.waitScale);
  }
  const [first = decision.press, ...rest] = decision.sequence ?? [];
  mind.queue = rest.map(padOf);
  return padOf(first);
}

/**
 * 전술을 차례로 적용해 처음 나온 결정을 돌려준다. 어떤 전술도 결정하지 않으면 가만히 있는다.
 */
export function firstOf(tactics: readonly Tactic[], context: Context): Decision {
  for (const tactic of tactics) {
    const decision = tactic(context);
    if (decision) {
      return decision;
    }
  }
  return hold({});
}
