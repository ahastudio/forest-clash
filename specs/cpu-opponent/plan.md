# Implementation Plan: 컴퓨터 상대

## Summary

`create`가 만드는 함수가 매 프레임 `think`로 기억과 상황을 보고 `firstOf(TACTICS, context)`로 첫 판단을 얻어 입력으로 바꾼다.
전술은 방어(`defense.ts`)와 공격(`offense.ts`)으로 나누고, 난이도는 표(`difficulty.ts`)로 둔다.

## Requirements

1. 사람과 같은 입력으로 막고, 반격하고, 접근하고, 공격을 고른다.
2. 난이도를 표로 두고 라운드와 전적으로 고른다.
3. 판단의 무작위 사용 순서를 일정하게 유지한다.

## Critical Files

### New Files

- `src/ai/index.ts`
- `src/ai/decision.ts`
- `src/ai/defense.ts`
- `src/ai/offense.ts`
- `src/ai/difficulty.ts`
- `src/ai/mind.ts`
- `src/ai/pad.ts`

### Modified Files

- 없음

### Reference Files

- `src/engine/index.ts`
- `src/engine/moves.ts`
- `src/game.ts`

## Architecture

### User Flow

```text
엔진 상태 관찰 → 전술을 위에서부터 시도 → 판단(누를 것, 쉬는 시간, 연속 입력) → 입력(사람과 같은 모양)
```

### Event Flow

```text
1. think: 싸우는 단계가 아니면 입력을 비움
       ↓
2. 이어서 낼 입력이 있으면 하나 꺼냄, 없으면 decideNow
       ↓
3. decideNow: observe → firstOf(TACTICS) → applyDecision
       ↓
4. applyDecision: 쉬는 시간과 연속 입력을 기억에 반영, 입력 반환
```

### Domain Model

```text
Context
├── me / foe        나와 상대(엔진의 캐릭터)
├── dist / toward / away
├── mind            쉬는 시간, 반응 지연, 연속 입력
└── difficulty      난이도 표

Decision  press(지금 누를 것) / wait(쉴 프레임) / sequence(이어서 낼 입력)
```

## Implementation Steps

### Step 1: AI Layer - 판단 구조

전술은 판단 또는 null을 돌려주고, 위에서부터 처음 판단이 이긴다.

**Red:** `src/ai/ai.test.ts`

```ts
  it('처음으로 판단을 내리는 방법이 이기고, 아무도 내리지 못하면 가만히 있는다', () => {
    const context = situation();
    expect(firstOf([() => null, () => hold({ A: 1 }), () => hold({ B: 1 })], context).press).toEqual({ A: 1 });
    expect(firstOf([() => null], context).press).toEqual({});
  });
```

**Green:** `src/ai/decision.ts`

```ts
export function firstOf(tactics: readonly Tactic[], context: Context): Decision {
  for (const tactic of tactics) {
    const decision = tactic(context);
    if (decision) {
      return decision;
    }
  }
  return hold({});
}
```

**Refactoring:** 판단을 누를 것·쉬는 시간·연속 입력으로 나눠 적용 함수(`applyDecision`)가 한 곳에서 기억에 반영한다.

### Step 2: AI Layer - 방어 전술

막는 중 반격, 상대 공격에 대한 대응(반격, 끊기, 막기)을 만든다.

**Red:** `src/ai/ai.test.ts`

```ts
  it('헛친 기술의 후딜에 반격한다', () => {
    rolls(0.1, 0.1);
    const context = situation({ foe: { state: 'attack', moveId: 'a5', elapsed: 8 }, dist: 100 });
    const decision = answerAttack(context);
    expect(decision?.press).toEqual({ A: 1 });
    expect(decision?.wait).toBe(14);
  });
```

**Green:** `src/ai/defense.ts`

```ts
export const answerAttack: Tactic = context => {
  const move = attackMove(context.foe);
  if (!move || context.dist >= SEE_ATTACK_RANGE) {
    return null;
  }
  noticeAttack(context);
  return punishRecovery(context, move) ?? interruptSlowMove(context, move) ?? blockIncoming(context, move);
};
```

**Refactoring:** 반격, 끊기, 막기를 각각 함수로 나눠 `??`로 이어 위 순서를 지킨다.

### Step 3: AI Layer - 공격 전술과 난이도

대공, 쉬는 중, 필살기, 접근과 공격을 만들고, 공격 고르기는 표로 둔다.

**Red:** `src/ai/ai.test.ts`

```ts
  it('아주 멀면 앞으로 걷고 가끔 앞을 두 번 눌러 달려서 다가간다', () => {
    rolls(0.5);
    expect(engage(situation({ dist: 300 }))?.press).toEqual({ r: 1 });
    rolls(0.01);
    const rush = engage(situation({ dist: 300 }));
    expect(rush?.sequence).toHaveLength(12);
    expect(rush?.wait).toBe(20);
  });
```

**Green:** `src/ai/offense.ts`

```ts
export const engage: Tactic = context => {
  const chance = context.mind.random();
  return closeIn(context, chance) ?? strikeFromRange(context, chance);
};
```

**Refactoring:** 공격 고르기를 `Attack` 표로 두어 조건문을 늘어놓지 않는다.

## Verification

### Build

```bash
pnpm run typecheck
```

### Test

```bash
pnpm run check
```

### Manual Test

1. 개발 서버를 켜고 컴퓨터와 대전해 1라운드가 쉬운지 본다.
2. 라운드가 오를수록 막기와 반격이 늘어나는지 본다.
3. 컴퓨터끼리 싸우는 영상을 만들어 본다(소리 포함).

## Considerations

### 무작위의 순서

컴퓨터 상대의 판단은 `Math.random`을 정해진 순서로만 부른다.
판단이 갈라지는 자리에서 무작위를 부르는 순서가 바뀌면 같은 시드의 결과가 달라지므로, 순서를 바꾸는 변경은 회귀 테스트가 알려 준다.

### 사람과 같은 입력

컴퓨터 상대는 엔진의 상태만 보고 입력만 낸다. 그래서 입력 처리가 한 갈래이고, 영상 녹화처럼 컴퓨터끼리 싸우게 하는 일도 같은 방식으로 된다.
