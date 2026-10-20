import type { Engine, PlayerId } from '../engine';
import type { Tactic } from './decision';
import { applyDecision, firstOf } from './decision';
import { answerAttack, holdGuard, stayStill } from './defense';
import { difficultyFor } from './difficulty';
import type { Context, Mind } from './mind';
import { newMind } from './mind';
import { antiAir, coolDown, engage, superMove } from './offense';
import type { AiPad } from './pad';
import { emptyPad } from './pad';

interface AiOptions {
  /** 0 아주 쉬움, 1 조금 쉬움, 2 보통, 3 어려움. 함수를 주면 부를 때마다 난이도를 새로 정한다. */
  level?: number | (() => number);
  /** 확률 판단에 쓰는 난수원. 주지 않으면 Math.random이다. */
  random?: () => number;
}

const NORMAL_LEVEL = 2;

/** 위에서부터 처음 판단을 내리는 전술이 이긴다. */
const TACTICS: readonly Tactic[] = [holdGuard, stayStill, answerAttack, antiAir, coolDown, superMove, engage];

/** 컴퓨터 상대 하나: 보는 엔진, 기억, 난이도를 정하는 방법. */
interface Brain {
  engine: Engine;
  mind: Mind;
  level: () => number;
}

function observe({ engine, mind, level }: Brain, id: PlayerId): Context {
  const me = engine.fighters[id];
  const foe = engine.fighters[id === 0 ? 1 : 0];
  const dx = foe.x - me.x;
  const [toward, away] = dx > 0 ? (['r', 'l'] as const) : (['l', 'r'] as const);
  return { me, foe, dist: Math.abs(dx), toward, away, mind, difficulty: difficultyFor(level()) };
}

function decideNow(brain: Brain, id: PlayerId): AiPad {
  const context = observe(brain, id);
  brain.mind.wait = Math.max(0, brain.mind.wait - 1);
  return applyDecision(firstOf(TACTICS, context), brain.mind, context.difficulty);
}

function think(brain: Brain, id: PlayerId): AiPad {
  if (brain.engine.phase !== 'fight') {
    brain.mind.queue = [];
    return emptyPad();
  }
  return brain.mind.queue.length ? { ...emptyPad(), ...brain.mind.queue.shift() } : decideNow(brain, id);
}

/** 컴퓨터 상대를 만든다. 엔진의 상태만 보고 사람과 같은 입력(방향과 버튼 네 개)을 낸다. */
export function create(engine: Engine, options?: AiOptions): (id: PlayerId) => AiPad {
  const level = options?.level ?? NORMAL_LEVEL;
  const brain = { engine, mind: newMind(options?.random), level: typeof level === 'function' ? level : () => level };
  return id => think(brain, id);
}

/** 라운드마다 정해진 기본 난이도: 1라운드 아주 쉬움, 2라운드 조금 쉬움, 그 뒤로는 보통. */
function baseLevel(round: number): number {
  if (round <= 1) {
    return 0;
  }
  return round === 2 ? 1 : NORMAL_LEVEL;
}

/** 처음에는 봐주면서 시작해 점점 어려워진다. 플레이어가 지고 있으면 한 단계 낮춘다. */
export function roundLevel({ round, wins }: Pick<Engine, 'round' | 'wins'>): number {
  const base = baseLevel(round);
  return wins[1] > wins[0] ? Math.max(0, base - 1) : base;
}
