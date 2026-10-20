# Implementation Plan: 분노 게이지와 필살기

## Summary

`gainRage`가 게이지를 올리고, 맞았을 때(`rewardHit`)와 막았을 때(`rewardBlock`), 던졌을 때(`rewardThrow`)가 각자 비율로 호출한다.
분노 필살기는 기술 표의 여러 번 맞는 기술이고, 입력은 `specialInput`이 가득 찬 게이지와 모션으로 판정한다.

## Requirements

1. 때리고 맞고 막을 때 게이지가 찬다.
2. 가득이면 ↓→↓→ + 강펀치로 분노 필살기를 쓰고 게이지를 비운다.
3. 게이지를 화면에서 알아볼 수 있게 한다.

## Critical Files

### New Files

- `src/engine/damage.ts`
- `src/engine/actions.ts`
- `src/engine/move-specs.ts`
- `src/render/hud-bars.ts`
- `src/render/fighters.ts`

### Modified Files

- 없음

### Reference Files

- `src/engine/impact.ts`
- `src/engine/blocking.ts`
- `src/engine/grab/`
- `src/engine/motions.ts`

## Architecture

### User Flow

```text
타격이 맞거나 막힘 → 게이지가 참 → 가득이면 입력 ↓→↓→ + 강펀치 → 분노 필살기(게이지 비움)
```

### Event Flow

```text
1. rewardHit / rewardBlock / rewardThrow: gainRage(맞은 쪽, 때린 쪽)
       ↓
2. chooseAction: specialInput → isSuperInput(게이지, 버튼, 모션)
       ↓
3. startSpecial: super이면 게이지 0 → startMove
       ↓
4. 화면: HUD 분노 막대, 가득이면 깜빡임과 주황빛
```

### Domain Model

```text
Fighter
└── rage   0~100

MOVES.super (여러 번 맞는 기술)
├── windows       [8,11] [20,23] [34,40]
├── windowDamages 7, 7, 12
├── invincibleFrames 7
└── chipDamage 2, finalLaunchSpeed 12
```

## Implementation Steps

### Step 1: Engine Layer - 게이지

게이지는 100을 넘지 않게 올리고, 맞았을 때와 막았을 때, 던졌을 때 서로 다른 비율로 올린다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('게이지가 가득이면 나가고 게이지를 모두 쓰며 여러 타가 맞는다', () => {
    const duel = setup(70);
    duel.L.rage = 100;
    drive(duel, 160, super_);
    expect(movesOf(duel)).toContain('super');
    expect(duel.L.rage).toBeLessThan(100);
    expect(eventsOf(duel, 'hit').filter(e => e.attacker === 1).length).toBeGreaterThanOrEqual(2);
  });
```

**Green:** `src/engine/damage.ts`

```ts
export function gainRage(fighter: Fighter, amount: number): void {
  fighter.rage = Math.min(RAGE_MAX, fighter.rage + amount);
}
```

**Refactoring:** 맞았을 때와 막았을 때가 같은 도우미(`exchangeRage`)로 양쪽 게이지를 올린다.

### Step 2: Engine Layer - 분노 필살기

게이지가 가득이고 강펀치와 모션이 완성되면 분노 필살기를 고르고, 쓰면 게이지를 비운다.

**Red:** `src/engine/scenarios.test.ts`

```ts
  it('게이지가 모자라면 나가지 않는다', () => {
    const duel = setup(70);
    duel.L.rage = 50;
    drive(duel, 60, super_);
    expect(movesOf(duel)).not.toContain('super');
  });
```

**Green:** `src/engine/actions.ts`

```ts
const isSuperInput = (fighter: Fighter): boolean =>
  fighter.rage >= RAGE_MAX && pressed(fighter, 'C', SPECIAL_BUTTON_AGE) && motion(fighter, 'qcf2', SUPER_MOTION);

export function startSpecial(world: World, fighter: Fighter, id: MoveId): void {
  if (id === 'super') fighter.rage = 0;
  startMove(world, fighter, id);
}
```

**Refactoring:** 필살기 조건을 `isSuperInput`으로 이름 붙인다.

### Step 3: UI Layer - 분노 막대와 주황빛

체력 막대 아래에 분노 막대를 그리고, 가득 차면 색이 깜빡이며 캐릭터 뒤에 주황빛을 그린다.

**Red:** `src/render/hud.test.ts`

```ts
  it('분노 게이지가 가득이면 깜빡이는 색이다', () => {
    const lit = makeView({ now: 0 });
    patch(lit.engine.fighters[1], { rage: 100 });
    new Hud().draw(lit.view);
    const dim = makeView({ now: 140 });
    patch(dim.engine.fighters[1], { rage: 100 });
    new Hud().draw(dim.view);
    expect(lit.canvas.calls.length).toBeGreaterThan(0);
    expect(dim.canvas.calls.length).toBeGreaterThan(0);
  });
```

**Green:** `src/render/hud-bars.ts`

```ts
function rageColors(rage: number, now: number): [string, string] {
  if (rage < RAGE_MAX) return ['#ffb08a', '#e8473c'];
  return ['#fff2a0', 0.5 + 0.5 * Math.sin(now / PULSE_PERIOD) > 0.5 ? '#ffb300' : '#ff8a00'];
}
```

**Refactoring:** 깜빡임은 현재 시각(`now`)을 인자로 받아 테스트에서 고정할 수 있게 한다.

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

1. 개발 서버를 켜고 대전을 시작해 때리고 막으며 분노 막대가 차는지 본다.
2. 게이지가 가득 차면 막대가 깜빡이고 캐릭터 뒤에 주황빛이 도는지 본다.
3. ↓→↓→ + O(강펀치)로 필살기를 내고 게이지가 비워지는지 본다.

## Considerations

### 맥스 모드 없음

게이지가 가득 차도 별도의 상태 변화는 없다. 필요하면 나중에 더할 수 있다.

### 컴퓨터 상대

컴퓨터 상대도 게이지가 가득이고 가까우면 확률로 같은 입력을 낸다(cpu-opponent).
