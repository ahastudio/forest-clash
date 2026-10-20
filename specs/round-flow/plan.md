# Implementation Plan: 라운드 진행

## Summary

`step`이 한 프레임을 진행하면서 현재 단계의 함수를 단계 표(`PHASE_STEPS`)에서 골라 호출한다.
단계가 바뀌는 조건은 각 함수가 정하고, 라운드 초기화는 `startRound`가 맡는다.

## Requirements

1. 한 판을 타이틀에서 결과까지 이어 간다.
2. K.O.와 시간 초과로 승패를 가르고 두 판을 먼저 이기면 끝낸다.
3. 새 라운드는 처음 상태에서 시작한다.

## Critical Files

### New Files

- `src/engine/flow.ts`
- `src/engine/world.ts`
- `src/render/screens.ts`
- `src/render/hud.ts`
- `src/game.ts`

### Modified Files

- 없음

### Reference Files

- `src/engine/damage.ts`
- `src/engine/types.ts`
- `src/render/scene.ts`

## Architecture

### User Flow

```text
타이틀 → (공격 버튼) → 라운드 시작 안내 → 대전 → K.O./시간 초과 안내 → 다음 라운드 또는 결과 → (공격 버튼) → 타이틀
```

### Event Flow

```text
1. step: frame 증가 → PHASE_STEPS[phase] 호출
       ↓
2. stepTitle / stepIntro / stepActive / stepResult
       ↓
3. stepBattle: 시간, 움직임, 판정, 무대, 끝났는지 확인(finishRound)
       ↓
4. nextRound(startRound) 또는 endMatch(사건 over)
```

### Domain Model

```text
World
├── phase / phaseTime  단계와 그 단계에서 흐른 프레임
├── roundTimer         남은 프레임
├── wins / round       승수와 라운드 번호
├── mode               cpu 또는 2p
└── matchWinner        판을 이긴 쪽
```

## Implementation Steps

### Step 1: Engine Layer - 단계와 입력

타이틀과 결과는 새로 눌린 버튼으로 진행하고, 단계 함수는 표에서 고른다.

**Red:** `src/engine/flow.test.ts`

```ts
  it('1P 버튼은 컴퓨터와 대전, 2P 버튼만이면 둘이서 대전이다', () => {
    const cpu = createEngine();
    for (let i = 0; i < 25; i++) cpu.step([idlePad(), idlePad()]);
    cpu.step([{ A: 1 }, { B: 1 }]);
    expect(cpu.mode).toBe('cpu');
    expect(cpu.consume().map(e => e.type)).toContain('start');
    const two = createEngine();
    for (let i = 0; i < 25; i++) two.step([idlePad(), idlePad()]);
    two.step([idlePad(), { B: 1 }]);
    expect(two.mode).toBe('2p');
  });
```

**Green:** `src/engine/flow.ts`

```ts
function stepTitle(world: World, inputs: Inputs): void {
  world.phaseTime++;
  const edges = risingEdges(world, 'titleButtonsHeld', inputs);
  if (world.phaseTime > TITLE_INPUT_DELAY && (edges.first || edges.second)) beginMatch(world, edges);
}
```

**Refactoring:** 새로 눌림 판정을 `risingEdges`로 모아 타이틀과 결과가 같이 쓴다.

### Step 2: Engine Layer - 승패와 다음 라운드

안내가 끝나면 판이 끝났는지 보고 다음 라운드를 시작하거나 결과로 넘어간다.

**Red:** `src/engine/flow.test.ts`

```ts
  it('두 판을 먼저 이기면 판이 끝나고 이긴 쪽을 알린다', () => {
    const duel = setup(70);
    finishRoundByKnockOut(duel);
    patch(duel, { L: duel.engine.fighters[1], R: duel.engine.fighters[0] });
    patch(duel.L, { x: 500, face: 1 });
    patch(duel.R, { x: 570, face: -1 });
    finishRoundByKnockOut(duel);
    expect(duel.engine.phase).toBe('over');
    expect(duel.engine.matchWinner).toBe(1);
    expect(eventsOf(duel, 'over')[0]?.winner).toBe(1);
  });
```

**Green:** `src/engine/flow.ts`

```ts
function finishRound(world: World): void {
  world.phaseTime--;
  if (world.phaseTime > 0) return;
  const advance = isMatchOver(world) ? endMatch : nextRound;
  advance(world);
}
```

**Refactoring:** 판 종료와 다음 라운드를 함수로 이름 붙이고 선택만 한 곳에서 한다.

### Step 3: UI Layer - 안내와 시계

단계에 따라 덮는 화면을 표(`OVERLAYS`)에서 고르고, 시계는 남은 초와 경고 색을 그린다.

**Red:** `src/render/screens.test.ts`

```ts
  it('시작 때는 ROUND, 마지막 45프레임은 FIGHT!', () => {
    const calling = makeView();
    patch(calling.engine, { phaseTime: 100, round: 2 });
    drawIntro(calling.view);
    expect(calling.canvas.texts()).toEqual(['ROUND 2']);
    const fight = makeView();
    patch(fight.engine, { phaseTime: 20 });
    drawIntro(fight.view);
    expect(fight.canvas.texts()).toEqual(['FIGHT!']);
  });
```

**Green:** `src/render/screens.ts`

```ts
export function drawIntro({ g, engine }: View): void {
  const calling = engine.phaseTime > INTRO_CALL_FRAMES;
  const text = calling ? `ROUND ${engine.round}` : 'FIGHT!';
  bannerText(g, { text, color: calling ? '#fff' : GOLD, size: calling ? 72 : 108, y: CENTER_Y - 20 });
}
```

**Refactoring:** 단계별 화면을 장면(`Scene`)의 표 한 곳에서 고른다.

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

1. 개발 서버를 켜고 I를 눌러 대전을 시작한다.
2. ROUND 1과 FIGHT! 안내가 나온 뒤 싸울 수 있는지 본다.
3. 한 라운드를 K.O.로 끝내 다음 라운드가 처음 상태로 시작되는지 본다.
4. 두 판을 이겨 결과 화면(색종이)이 나오고 버튼으로 타이틀로 돌아오는지 본다.

## Considerations

### 게임 속도

프레임 수치는 60프레임/초 기준이고 게임은 0.75배 속도로 흘러 준비 동작과 후딜이 눈에 보이게 한다.
그래서 라운드의 60초(3600프레임)는 실제로 약 80초 걸린다.

### 라운드 초기화

라운드가 바뀔 때 두 캐릭터를 새로 만들어 이전 라운드의 일시 표시(일어나는 중, 두 번 누름 등)가 남지 않게 한다.
