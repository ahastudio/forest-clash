# Implementation Plan: 기술

## Summary

기술은 `move-specs.ts`의 표로 정의하고 `moves.ts`가 끝 프레임, 전체 길이, 경직을 계산한다.
`attack-state.ts`가 기술의 시간 진행을, `hits.ts`가 판정 닿음을, `grab/` 폴더가 잡기(입력과 조건, 붙잡힘, 던진 결과)를 한 곳에서 처리한다.

## Requirements

1. 일반기, 특수기, 잡기를 프레임 데이터로 정의한다.
2. 판정 프레임에 닿았는지와 막는지 맞는지를 가른다.
3. 연계와 취소, 잡기를 처리한다.

## Critical Files

### New Files

- `src/engine/move-specs.ts`: 기술 표의 진입점
- `src/engine/move-specs-ground.ts`, `move-specs-air.ts`, `move-specs-special.ts`: 갈래별 기술 표
- `src/engine/move-types.ts`
- `src/engine/moves.ts`
- `src/engine/boxes.ts`
- `src/engine/attack-state.ts`
- `src/engine/hits.ts`
- `src/engine/grab/`
- `src/engine/actions.ts`

### Modified Files

- 없음

### Reference Files

- `src/engine/impact.ts`
- `src/engine/blocking.ts`
- `src/engine/update.ts`

## Architecture

### User Flow

```text
버튼 입력 → chooseAction → startMove(기술 시작) → attack 상태 진행 → 판정 구간 → 닿음 → 막힘/맞음
```

### Event Flow

```text
1. startMove: 기술 상태로 들어가고 사건 move 발생
       ↓
2. updateAttack: 시간 진행, 돌진·상승, 취소 확인, 끝나면 복귀
       ↓
3. detectHits: 판정 구간과 상자가 겹치면 타격 목록에 올림(잡기는 즉시 처리)
       ↓
4. resolveStrike: 막힘 또는 맞음
```

### Domain Model

```text
MoveSpec(데이터)
├── GroundSpec   발동/판정/후딜 + 막힘·맞음 이득
├── AirSpec      공중 기술: 막힘·맞음 경직을 직접 정함
├── GrabSpec     잡기
└── MultiHitSpec 여러 번 맞는 기술(분노 필살기)

Move(파생)  끝 프레임, 전체 길이, 경직, 판정 구간 목록
```

## Implementation Steps

### Step 1: Data Layer - 기술 표와 파생값

기술 표에서 끝 프레임과 경직을 계산한다. 경직은 이득 + 판정 + 후딜이다.

**Red:** `src/engine/moves.test.ts`

```ts
  it('이득에서 경직을 계산한다: 경직 = 이득 + 판정 + 후딜', () => {
    expect(MOVES.a5.blockstun).toBe(1 + 3 + 3);
    expect(MOVES.a5.hitstun).toBe(5 + 3 + 3);
  });
```

**Green:** `src/engine/moves.ts`

```ts
function stunsFromAdvantage(spec: GroundSpec): Pick<Move, 'blockstun' | 'hitstun'> {
  const recovery = spec.active + spec.recovery;
  return {
    blockstun: spec.blockAdvantage + recovery,
    hitstun: spec.hitAdvantage === 'kd' ? 0 : spec.hitAdvantage + recovery,
  };
}
```

**Refactoring:** 기술을 땅·잡기·공중·여러 번 맞는 기술로 나눠 필요한 값이 빠지지 않게 타입으로 막는다.

### Step 2: Engine Layer - 기술 진행과 판정

기술은 상태 `attack`에서 시간이 흐르고, 판정 구간에 든 프레임에만 맞힐 수 있다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it.each(rows)('%s는 정확히 start 프레임에 맞는다', (id, button, extra) => {
    const duel = setup((MOVES[id].hitboxRange[1] ?? 0) - 8);
    drive(duel, 90, tap(button, 0, extra));
    const move = eventsOf(duel, 'move')[0];
    const contact = contactOf(duel);
    expect(contact && move ? contact.f - move.f : null).toBe(MOVES[id].start);
  });
```

**Green:** `src/engine/hits.ts`

```ts
function connects(strike: Strike): boolean {
  const box = hitboxOf(strike.attacker, strike.move);
  if (!box || !isOpenWindow(strike) || !isReachable(strike)) return false;
  return hurtboxes(strike.defender).some(hurt => overlaps(box, hurt));
}
```

**Refactoring:** 닿았는지 판정을 열린 구간, 닿을 수 있는 상대, 상자 겹침으로 나눈다.

### Step 3: Engine Layer - 연계와 취소

맞히거나 막힌 뒤 취소 가능한 기술은 특수기 입력이 있으면 후딜을 끊고 특수기로 넘어간다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('앉아 약펀치 → 앉아 약킥 링크 → 대공 어퍼 취소 콤보', () => {
    const duel = setup(70);
    const script: Script = i => {
      if (i < 24) return i === 0 ? { d: 1, A: 1 } : i === 13 ? { d: 1, B: 1 } : { d: 1 };
      if (i < 26) return { r: 1 };
      if (i < 28) return { d: 1 };
      return i === 28 ? { d: 1, A: 1 } : {};
    };
    drive(duel, 120, script);
    const hits = eventsOf(duel, 'hit')
      .filter(e => e.attacker === 1)
      .map(e => e.moveId);
    expect(hits.slice(0, 2)).toEqual(['a2', 'b2']);
    expect(new Set(hits).size).toBeGreaterThanOrEqual(3);
    expect(hits).toContain('dp_a');
    expect(eventsOf(duel, 'block')).toHaveLength(0);
  });
```

**Green:** `src/engine/attack-state.ts`

```ts
function cancelIntoSpecial(world: World, fighter: Fighter, move: Move): boolean {
  const special = fighter.cancelable && fighter.contact && !move.special ? specialInput(fighter) : null;
  if (special) startSpecial(world, fighter, special);
  return !!special;
}
```

**Refactoring:** 기술이 끝나는 방식(공중 복귀, 땅에서 일어남)을 함수로 골라 조건문을 줄인다.

### Step 4: Engine Layer - 잡기

발동 프레임에 범위와 상대 상태를 보고 잡고, 잡힌 쪽의 시간표(들어 올림, 유지, 던짐)를 처리한다. 잡힌 쪽은 풀 수 없다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('잡히면 어떤 버튼을 눌러도 풀리지 않고 끝까지 던져진다', () => {
    const duel = setup(55);
    drive(duel, 60, grabAt, i => (i < 14 ? {} : { C: 1, D: 1, u: 1, l: 1 }));
    expect(duel.R.hp).toBe(MAX_HP - MOVES.throw.damage);
    expect(eventsOf(duel, 'toss')).toHaveLength(1);
  });
```

**Green:** `src/engine/hits.ts`

```ts
function tryGrab(world: World, strike: Strike): void {
  const { attacker, defender } = strike;
  if (!isGrabFrame(strike) || !canGrab(attacker, defender)) return;
  attacker.contact = { type: 'grab' };
  startGrab(world, attacker, defender);
}
```

**Refactoring:** 잡기의 시간표 사건(들어 올림, 던짐)을 표(`THROW_CUES`)로 둔다.

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
2. 각 버튼과 아래, 앞 입력으로 일반기가 나가는지 본다.
3. 앉아 약펀치 → 앉아 약킥 → →↓ + 약펀치 콤보가 이어지는지 본다.
4. 가까이서 앞으로 밀면서 강펀치로 잡기가 나가고 들어 올려졌다가 던져지는지 본다.
5. H 키로 판정 상자를 켜 공격 상자(빨강)와 맞을 수 있는 상자(파랑)를 확인한다.

## Considerations

### 공중 킥의 판정

공중 킥의 판정은 발끝이고 다리는 오른쪽 아래 대각선이다(그림과 판정이 같은 곳).

### 기술 데이터 한 곳

기술 정의는 기술 표(`move-specs.ts`와 갈래별 `move-specs-*.ts`)에만 두고, 막힘·맞음 경직 같은 파생값은 코드가 계산한다. 그래야 표와 테스트의 값이 어긋나지 않는다.
