# Implementation Plan: 방어

## Summary

`canBlock`이 방어할 수 있는 상태, 뒤를 누르는지, 높이와 자세를 차례로 판정한다.
막혔으면 `blockStrike`가 막은 쪽의 자세와 밀림, 보상(게이지, 콤보, 타격 정지)을 정한다.

## Requirements

1. 공격 높이와 방어 자세가 맞아야 막힌다.
2. 막힘 경직 중에도 계속 막는다.
3. 막은 뒤 경직, 밀림, 게이지, 취소 표시를 정한다.

## Critical Files

### New Files

- `src/engine/blocking.ts`
- `src/engine/strike.ts`

### Modified Files

- 없음

### Reference Files

- `src/engine/hits.ts`
- `src/engine/impact.ts`
- `src/engine/moves.ts`
- `src/engine/move-specs.ts`

## Architecture

### User Flow

```text
공격 판정이 닿음 → canBlock(strike) → 막힘: blockStrike / 맞음: landStrike
```

### Event Flow

```text
1. detectHits: 닿은 타격 목록을 만든다
       ↓
2. resolveStrike: 불꽃 위치를 정하고 canBlock을 묻는다
       ↓
3. blockStrike: guardDefender → recoil → rewardBlock
       ↓
4. 사건 block 발생(소리, 파란 불꽃)
```

### Domain Model

```text
Strike
├── attacker / defender  때리는 쪽과 맞는 쪽
├── move                쓴 기술(높이 kind, 막힘 경직 blockstun)
└── window              몇 번째 판정 구간인가

GUARD_POSTURE: low → 앉아서 / high → 서서 / mid → 아무 자세 / grab → 못 막음
```

## Implementation Steps

### Step 1: Engine Layer - 막을 수 있는가

방어할 수 있는 상태, 뒤를 누르는 방향, 높이별 자세를 차례로 본다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('상단은 서서만 막는다', () => {
    expect(outcome('c6', 'C', { r: 1 }, { r: 1 })).toBe('막음');
    expect(outcome('c6', 'C', { r: 1 }, { r: 1, d: 1 })).toBe('맞음');
  });
```

**Green:** `src/engine/blocking.ts`

```ts
export function canBlock({ attacker, defender, move }: Strike): boolean {
  if (!isGuardable(defender) || !holdingBack(defender, attacker)) return false;
  return GUARD_POSTURE[move.kind](defender.input.d);
}
```

**Refactoring:** 높이별 자세를 `GUARD_POSTURE` 표로 두어 조건문을 늘어놓지 않는다.

### Step 2: Engine Layer - 막힌 뒤의 결과

막은 쪽은 막힘 경직에 들어가 밀려나고, 때린 쪽은 반동과 보상을 받는다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('막힘 경직 중에도 계속 막고, 막으면 피해가 없다', () => {
    const duel = setup(70);
    drive(duel, 200, i => (i % 12 === 0 ? { A: 1 } : {}), hold({ r: 1 }));
    expect(eventsOf(duel, 'hit')).toHaveLength(0);
    expect(eventsOf(duel, 'block').length).toBeGreaterThanOrEqual(2);
    expect(duel.R.hp).toBe(MAX_HP);
  });
```

**Green:** `src/engine/blocking.ts`

```ts
export function blockStrike(world: World, strike: Strike, spark: Spark): void {
  const { attacker, defender, move } = strike;
  guardDefender(strike);
  recoil(strike, BLOCK_PUSH_SHARE);
  rewardBlock(world, strike);
  emit(world, { type: 'block', ...spark, attacker: attacker.id, defender: defender.id, moveId: move.id });
}
```

**Refactoring:** 밀림, 게이지, 접촉 기록은 맞았을 때와 함께 쓰는 도우미(`strike.ts`)로 나눈다.

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
2. 상대의 서서 약펀치를 서서와 앉아서 각각 막아 본다.
3. 앞+강펀치(상단)는 서서만, 앉아 약킥(하단)은 앉아서만 막히는지 본다.

## Considerations

### 막힘 이득을 낮게 둔 이유

약한 기술의 막힘 이득이 +3이면 연타하는 쪽이 이겼다.
이 게임은 방어 수단이 구르기와 뒤 대시뿐이라 막힘 이득을 +1 이하로 낮췄다.

### 공중 방어와 가드 캔슬

범위를 작게 잡기 위해 뺐다. 원하면 하나씩 더할 수 있다.
