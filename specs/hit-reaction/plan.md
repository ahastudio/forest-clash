# Implementation Plan: 맞았을 때

## Summary

`landStrike`가 결과(`Outcome`)를 계산해 맞은 쪽의 몸을 바꾸고(`injure`), 반응(경직 또는 날아감)을 정하고, 맞힌 쪽에 보상을 준 뒤 사건을 알리고 K.O.를 확인한다.

## Requirements

1. 피해와 경직, 타격 정지, 밀림을 정한다.
2. 카운터 히트, 맞교환, 띄움·저글, 쓰러짐과 기상, 콤보 보정을 처리한다.
3. 체력이 다하면 K.O.로 라운드를 끝낸다.

## Critical Files

### New Files

- `src/engine/impact.ts`
- `src/engine/damage.ts`
- `src/engine/recovery.ts`
- `src/engine/airborne.ts`
- `src/engine/strike.ts`

### Modified Files

- 없음

### Reference Files

- `src/engine/hits.ts`
- `src/engine/flow.ts`
- `src/render/reactions.ts`
- `src/render/hud.ts`

## Architecture

### User Flow

```text
공격이 닿음 → 맞음 결과 계산 → 맞은 쪽이 경직/날아감 → 맞힌 쪽 보상 → 사건 hit → (체력 0이면 K.O.)
```

### Event Flow

```text
1. hitOutcome: 카운터 여부, 피해(콤보·저글 보정), 공중이었는가
       ↓
2. injure → reactToHit(sendFlying 또는 staggerDefender)
       ↓
3. rewardHit: 게이지, 접촉 기록, 콤보 수, 타격 정지
       ↓
4. announceHit: 사건 hit 발생, 체력 0이면 knockOut
```

### Domain Model

```text
Outcome
├── counter       카운터 히트인가
├── damage        보정이 적용된 피해
├── wasAirborne   맞기 전에 공중이었는가
└── spark         불꽃 위치

Flight  launch / knockdown / wasAirborne / direction
```

## Implementation Steps

### Step 1: Engine Layer - 피해와 보정

피해는 기술 피해에 콤보 보정, 저글 보정, 카운터 배율을 곱해 구하고 최소 1이다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('상대 기술이 발동하는 중에 맞히면 카운터 히트이고 피해가 25퍼센트 늘며 상대 기술이 끊긴다', () => {
    const duel = setup(78);
    drive(duel, 1, tap('B'), null);
    drive(duel, 1, null, tap('A'));
    drive(duel, 40);
    const hit = eventsOf(duel, 'hit').find(e => e.attacker === 0);
    expect(hit?.counter).toBe(true);
    expect(hit?.damage).toBe(Math.round(MOVES.a5.damage * 1.25));
    expect(eventsOf(duel, 'hit').some(e => e.attacker === 1)).toBe(false);
  });
```

**Green:** `src/engine/impact.ts`

```ts
function strikeDamage(world: World, strike: Strike, { counter }: Pick<Outcome, 'counter'>): number {
  const base = strike.move.windowDamages?.[strike.window] ?? strike.move.damage;
  return Math.max(1, Math.round(base * damageScale(world, strike) * (counter ? COUNTER_DAMAGE_RATE : 1)));
}
```

**Refactoring:** 콤보와 저글 보정을 `scaleFor`로 한 곳에서 계산한다.

### Step 2: Engine Layer - 반응

띄움·쓰러짐·공중에서 맞은 경우는 날아가고, 그 밖에는 땅에서 경직과 밀림을 입는다.

**Red:** `src/engine/states.test.ts`

```ts
  it('체력이 남은 채 띄워졌다 떨어지면 쓰러졌다가 일어난다', () => {
    const duel = setup(300);
    patch(duel.R, { state: 'hitstun', launched: true, altitude: 20, velocityY: -3, stunFrames: 60 });
    drive(duel, 5);
    expect(duel.R.state).toBe('down');
    expect(eventsOf(duel, 'land').some(e => e.hard)).toBe(true);
    drive(duel, 80);
    expect(duel.R.state).toBe('idle');
  });
```

**Green:** `src/engine/impact.ts`

```ts
function reactToHit(strike: Strike, outcome: Outcome): void {
  const flight = flightOf(strike, outcome);
  if (isFlying(flight)) {
    sendFlying(strike.defender, flight);
  } else {
    staggerDefender(strike, outcome);
  }
}
```

**Refactoring:** 날아가는지 판단을 `isFlying`으로 이름 붙이고 속도 계산을 `flightVelocity`로 나눈다.

### Step 3: Engine Layer - K.O.

체력이 다하면 맞은 쪽을 높이 날려 보내고 단계를 K.O.로 바꾼다.

**Red:** `src/engine/flow.test.ts`

```ts
  it('K.O.가 난 쪽은 맞은 방향으로 높이 날아간다', () => {
    const duel = setup(70);
    duel.R.hp = 1;
    drive(duel, 1, tap('A'));
    drive(duel, 5, tap('A'));
    const knockOut = eventsOf(duel, 'ko')[0];
    expect(knockOut).toBeDefined();
    expect(duel.R.launched).toBe(true);
    expect(duel.R.altitude).toBeGreaterThan(0);
    expect(duel.R.velocityX).toBeGreaterThan(0);
  });
```

**Green:** `src/engine/damage.ts`

```ts
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
```

**Refactoring:** 날아가는 값을 한 객체로 묶어 한 번에 적용한다.

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
2. 약펀치 연타와 앉아 강펀치 띄움에서 타격 정지와 밀림이 느껴지는지 본다.
3. 상대 기술이 나오는 순간에 빠른 기술로 끊어 카운터 히트 불꽃(노랑)이 나오는지 본다.
4. 쓸기로 쓰러뜨려 누웠다 일어나는지, 체력이 다하면 K.O.가 나오는지 본다.

## Considerations

### 저글 한도

띄워진 상대에게 저글이 되는 기술만 이어 맞게 하고 한도를 2로 두어 무한 콤보를 막는다.

### 콤보 보정의 바닥

콤보와 저글 보정은 각각 최소 50퍼센트이므로 두 보정이 겹쳐도 피해는 기본 피해의 4분의 1 밑으로 내려가지 않고, 최종 피해는 최소 1이다.
