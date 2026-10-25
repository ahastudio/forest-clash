# Implementation Plan: 이동

## Summary

땅의 이동은 상태별 갱신 함수 표에서 입력 의도(`Intent`)를 위에서부터 시도해 고르고, 공중과 착지, 중력은 `airborne`가, 벽과 겹침은 `stage`가 맡는다.

## Requirements

1. 걷기, 앉기, 점프, 달리기, 뒤 대시, 구르기를 정해진 수치로 낸다.
2. 공중에서는 방향이 도약 순간에 고정된다.
3. 벽과 최대 간격, 몸 겹침을 정리한다.

## Critical Files

### New Files

- `src/engine/locomotion.ts`
- `src/engine/airborne.ts`
- `src/engine/recovery.ts`
- `src/engine/stage.ts`
- `src/engine/update.ts`
- `src/engine/constants.ts`

### Modified Files

- 없음

### Reference Files

- `src/engine/actions.ts`
- `src/engine/fighter.ts`
- `src/engine/boxes.ts`

## Architecture

### User Flow

```text
입력 → 상태 갱신 함수(neutral) → 의도 시도(행동 고르기 → 뒤 대시 → 점프 → 앉기 → 달리기 → 걷기)
       ↓
중력과 속도 적용(applyMovement) → 무대 정리(keepInStage)
```

### Event Flow

```text
1. updateFighter: prepareFrame(타이머, 상대 바라보기)
       ↓
2. STATE_UPDATERS[state]: neutral / updatePrejump / updateRoll / updateBackDash ...
       ↓
3. applyMovement: 중력, 위치, 밀림 감쇠
       ↓
4. keepInStage: 벽, 겹침, 최대 간격
```

### Domain Model

```text
Fighter
├── state            idle / crouch / walk / run / prejump / air / roll / bdash / lock ...
├── x, altitude      위치와 바닥 위 높이
├── velocityX / Y    속도
└── jumpDirection    도약 순간에 고정된 가로 방향
```

## Implementation Steps

### Step 1: Engine Layer - 땅의 이동

행동 고르기에서 의도를 위에서부터 시도한다. 걷기는 항상 마지막에 나온다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('걷기 속도는 프레임당 2.4다', () => {
    const duel = setup(300);
    drive(duel, 80, hold({ r: 1 }));
    expect(Math.abs(duel.L.x - 500 - 80 * 2.4)).toBeLessThan(40);
  });
```

**Green:** `src/engine/locomotion.ts`

```ts
function walkMotion(fighter: Fighter, direction: number): Partial<Fighter> {
  if (direction > 0) {
    return { state: 'walk', velocityX: fighter.face * WALK_FORWARD };
  }
  if (direction < 0) {
    return { state: 'walk', velocityX: -fighter.face * WALK_BACK };
  }
  return { state: 'idle', velocityX: 0 };
}

const walkOrStand: Intent = (_world, fighter) => {
  const direction = (forwardHeld(fighter) ? 1 : 0) - (backHeld(fighter) ? 1 : 0);
  patch(fighter, walkMotion(fighter, direction));
  return true;
};
```

**Refactoring:** 의도 함수를 `when(조건, 동작)`으로 만들어 한 줄씩 읽히게 한다.

### Step 2: Engine Layer - 점프와 공중

도약 준비 4프레임 뒤에 위 입력으로 일반 점프와 낮은 점프를 가르고, 땅에 닿는 방식(쓰러짐, 잠금)은 착지 처리 표에서 고른다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('낮은 점프는 일반 점프보다 짧고 낮다', () => {
    const hop = airStats(2);
    const jump = airStats(8);
    expect(hop.air).toBeLessThan(jump.air);
    expect(hop.maxAlt).toBeLessThan(jump.maxAlt);
    expect(hop.air).toBeGreaterThan(20);
  });
```

**Green:** `src/engine/locomotion.ts`

```ts
function takeOff(world: World, fighter: Fighter): void {
  const hop = !fighter.input.u;
  const direction = fighter.jumpDirection || stickDirection(fighter);
  const velocity = {
    velocityY: hop ? HOP_VELOCITY : JUMP_VELOCITY,
    velocityX: direction * (hop ? HOP_DRIFT : JUMP_DRIFT),
  };
  patch(fighter, { ...velocity, altitude: AIRBORNE_EPSILON, state: 'air', airAttackUsed: false, elapsed: 0 });
  emit(world, { type: 'jump', id: fighter.id, hop });
}
```

**Refactoring:** 착지 결과를 함수 하나(`landingFor`)가 고르게 해 호출하는 쪽에 조건문을 늘어놓지 않는다.

### Step 3: Engine Layer - 대시와 구르기

뒤 대시와 구르기는 프레임 수와 속도를 상수로 두고, 끝나면 `stopAndRecover`로 행동 가능한 상태로 돌아간다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('구르기는 앞부분이 무적이다', () => {
    const duel = setup(60);
    drive(duel, 3, hold({ A: 1, B: 1 }));
    drive(duel, 4, null, tap('A', 0));
    expect(duel.L.state).toBe('roll');
    expect(eventsOf(duel, 'hit').some(e => e.attacker === 0)).toBe(false);
  });
```

**Green:** `src/engine/locomotion.ts`

```ts
export function updateRoll(_world: World, fighter: Fighter): void {
  fighter.elapsed++;
  fighter.velocityX = fighter.elapsed <= ROLL_MOVING_FRAMES ? fighter.rollDirection * fighter.face * ROLL_SPEED : 0;
  if (fighter.elapsed >= ROLL_FRAMES) {
    stopAndRecover(fighter);
  }
}
```

**Refactoring:** 구르기 무적 프레임은 행동 고르기(`startRoll`)에서 정한다.

### Step 4: Engine Layer - 무대

벽 안에 가두고, 겹친 몸을 밀어내고, 최대 간격을 지킨다.

**Red:** `src/engine/stage.test.ts`

```ts
  it('겹친 두 몸은 반씩 밀려난다', () => {
    const [right, left] = stage({ x: 600 }, { x: 590 });
    expect(left.x).toBeLessThan(590);
    expect(right.x).toBeGreaterThan(600);
    expect(Math.abs(right.x - left.x)).toBeCloseTo(52);
  });
```

**Green:** `src/engine/stage.ts`

```ts
function pushApart(left: Fighter, right: Fighter, overlap: number): void {
  const direction = left.x <= right.x ? 1 : -1;
  const shares = pushShares(left, right, direction);
  left.x -= direction * overlap * shares.left;
  right.x += direction * overlap * shares.right;
  [left, right].forEach(clampToWalls);
}
```

**Refactoring:** 밀어내는 몫을 `pushShares`로 나눠 벽에 붙은 쪽과 자유로운 쪽의 경우를 한 곳에서 정한다.

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

1. 개발 서버를 켜고 대전을 시작한다.
2. 앞뒤로 걷고, 위를 짧게/길게 눌러 점프 높이가 다른지 본다.
3. 앞 두 번으로 달리기, 뒤 두 번으로 뒤 대시, I와 K를 함께 눌러 구르기가 나가는지 본다.
4. 벽 앞에서 상대에게 밀어 붙여 벽 밖으로 나가지 않는지 본다.

## Considerations

### 프레임 수치와 체감 속도

게임은 60프레임/초 기준 수치를 그대로 두고 흐르는 속도를 0.75배로 낮춰 준비 동작과 후딜이 눈에 보이게 한다.
이동 수치를 바꿀 때도 프레임 수치를 기준으로 바꾸고 속도 배율은 건드리지 않는다.

### 공중 방어와 슈퍼 점프

이번 범위에서 뺐다. 공중에서는 방향을 바꿀 수 없다.
