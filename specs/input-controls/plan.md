# Implementation Plan: 조작과 입력

## Summary

키보드는 `Keyboard`가 눌린 키를 기억해 플레이어별 입력으로 바꾸고, 엔진의 `readInput`이 방향 기록과 버튼 나이를 쌓는다.
모션은 방향 기록을 뒤에서부터 훑어 판정한다.

## Requirements

1. 버튼 네 개와 방향 넷으로 두 사람이 한 키보드를 쓴다.
2. 방향 두 개를 차례로 누르는 모션과 동시 입력, 잡기 입력을 낸다.
3. 타이틀과 결과 화면은 공격 버튼으로 진행한다.

## Critical Files

### New Files

- `src/input/keyboard.ts`
- `src/controls.ts`
- `src/engine/fighter.ts`
- `src/engine/motions.ts`
- `src/engine/actions.ts`
- `src/render/screens.ts`

### Modified Files

- 없음

### Reference Files

- `src/engine/flow.ts`
- `src/engine/types.ts`
- `src/game.ts`

## Architecture

### User Flow

```text
키를 누름 → controls.onKeyDown → Keyboard.press
Game.update → Keyboard.read(0, 1) → engine.step([1P 입력, 2P 입력])
```

### Event Flow

```text
1. Engine.step: readInputs → readInput(fighter, 입력)
       ↓
2. readButtons / readDoubleTaps / recordHistory
       ↓
3. 행동 고르기: chooseAction → specialInput / 구르기 / 강타 / 잡기 / 일반기
       ↓
4. 모션 판정: motionAge(방향 기록, 모션, 한도)
```

### Domain Model

```text
Fighter
├── input        지금 누른 방향과 버튼
├── justPressed  이번 프레임에 새로 누른 버튼
├── buttonAge    버튼을 누른 지 몇 프레임인가(최대 99)
└── directionHistory  최근 40칸의 숫자패드 방향
```

## Implementation Steps

### Step 1: UI Layer - 키보드와 조작 연결

`Keyboard`가 눌린 키를 기억하고 플레이어별 입력으로 바꾼다. `attachControls`가 키와 창 이벤트를 게임에 연결한다.

**Red:** `src/input/keyboard.test.ts`

```ts
  it('누른 키를 플레이어별 방향과 버튼으로 바꾼다', () => {
    const keyboard = new Keyboard();
    keyboard.press('ArrowLeft');
    keyboard.press('KeyI');
    keyboard.press('KeyR');
    expect(keyboard.read(0)).toEqual({ l: true, r: false, u: false, d: false, A: true, B: false, C: false, D: false });
    expect(keyboard.read(1)).toEqual({ l: false, r: false, u: false, d: false, A: true, B: false, C: false, D: false });
  });
```

**Green:** `src/input/keyboard.ts`

```ts
  read(player: PlayerId): Pad {
    const keys = KEY_MAP[player];
    const held = (control: keyof Pad): boolean => this.down.has(keys[control]);
    return {
      l: held('l'),
      r: held('r'),
      u: held('u'),
      d: held('d'),
      A: held('A'),
      B: held('B'),
      C: held('C'),
      D: held('D'),
    };
  }
```

**Refactoring:** 키 이름은 `KEY_MAP` 한 곳에 두고 두 플레이어의 키가 겹치지 않는지 테스트한다.

### Step 2: Engine Layer - 입력 기록

엔진이 매 프레임 입력을 읽어 버튼 나이와 방향 기록, 두 번 누름을 갱신한다.

**Red:** `src/engine/fighter.test.ts`

```ts
  it('앞을 짧은 간격으로 두 번 누르면 달리기 입력이다', () => {
    const world = newWorld();
    const fighter = makeFighter(1);
    world.frame = 10;
    readInput(world, fighter, { r: 1 });
    expect(fighter.doubleTapForward).toBe(false);
    world.frame = 11;
    readInput(world, fighter, {});
    world.frame = 14;
    readInput(world, fighter, { r: 1 });
    expect(fighter.doubleTapForward).toBe(true);
    world.frame = 60;
    readInput(world, fighter, {});
    world.frame = 80;
    readInput(world, fighter, { r: 1 });
    expect(fighter.doubleTapForward).toBe(false);
  });
```

**Green:** `src/engine/fighter.ts`

```ts
function nextTap(frame: number, press: Press): Tap {
  const pressedNow = press.held && !press.wasHeld;
  return { double: pressedNow && frame - press.last <= DOUBLE_TAP_FRAMES, last: pressedNow ? frame : press.last };
}

function readDoubleTaps(world: World, fighter: Fighter): void {
  const forward = nextTap(world.frame, {
    held: forwardHeld(fighter),
    wasHeld: fighter.wasForwardHeld,
    last: fighter.lastForwardPress,
  });
  const back = nextTap(world.frame, {
    held: backHeld(fighter),
    wasHeld: fighter.wasBackHeld,
    last: fighter.lastBackPress,
  });
  const held = { wasForwardHeld: forwardHeld(fighter), wasBackHeld: backHeld(fighter) };
  patch(fighter, {
    ...held,
    doubleTapForward: forward.double,
    lastForwardPress: forward.last,
    doubleTapBack: back.double,
    lastBackPress: back.last,
  });
}
```

**Refactoring:** 눌림 기록을 `Press` 객체로 묶어 함수 인자를 줄이고 `Object.assign` 대신 `patch`를 쓴다.

### Step 3: Engine Layer - 모션과 행동 고르기

방향 기록을 뒤에서부터 훑어 모션이 완성되었는지 보고, `chooseAction`이 의도를 위에서부터 차례로 시도한다.

**Red:** `src/engine/motions.test.ts`

```ts
  it('↓→ 두 방향을 차례로 누르면 마지막 입력의 나이를 돌려준다', () => {
    expect(motionAge(withHistory([5, 2, 6]), 'qcf', BASIC_MOTION)).toBe(0);
    expect(motionAge(withHistory([5, 2, 6, 5, 5]), 'qcf', BASIC_MOTION)).toBe(2);
  });
```

**Green:** `src/engine/motions.ts`

```ts
export function motionAge(fighter: Fighter, name: MotionName, limits: MotionLimits): number {
  const matches = MOTIONS[name].map(sequence => matchSequence(fighter.directionHistory, sequence));
  const ages = matches.filter(m => isWithin(m, limits)).map(m => m.age);
  return ages.length ? Math.min(...ages) : -1;
}
```

**Refactoring:** 모션 목록은 숫자패드 번호의 표로 두고, 대각선이 낀 입력도 같은 모션으로 보는 순서를 함께 적는다.

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

1. `./dev-server.sh start` 뒤 http://localhost:58969/ 를 열어 I를 눌러 대전을 시작한다.
2. 방향키와 I K O L로 1P가, W A S D와 R F T G로 2P가 움직이는지 본다(둘이서 대전은 타이틀에서 R을 눌러 시작).
3. ↓→ + I, →↓ + I로 특수기가 나가는지, Space·M·H가 동작하는지 본다.

## Considerations

### 키보드의 한계

키보드는 대각선을 누르기 어렵고 여러 키를 동시에 누르면 일부가 인식되지 않을 수 있다.
그래서 모션은 방향 두 개를 차례로 누르는 것만으로 낼 수 있게 했다.

### 컴퓨터 상대와의 호환

컴퓨터 상대는 방향 넷과 버튼 넷을 0 또는 1로 낸다.
엔진의 입력은 불리언과 숫자를 모두 받는다.
