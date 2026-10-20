# Implementation Plan: 모바일 조작

## Summary

조이스틱과 버튼의 터치 입력을 `TouchPad`가 1P 키보드 입력으로 옮긴다.
요소는 `index.html`에 두고 CSS의 `pointer: coarse` 조건으로 터치 기기에서만 보이게 한다.
`attachTouch`가 요소에 이벤트를 연결하고, 안내 문구는 입력 장치별 표(`GUIDES`)에서 읽는다.

## Requirements

1. 모바일 입력은 1P 키보드 입력으로 들어가며 엔진은 바뀌지 않는다.
2. 조이스틱은 처음 닿은 곳 기준, 여덟 방향, 따라오는 기준점이다.
3. 두 손가락 조작이 확대를 일으키지 않는다.
4. 타이틀과 일시정지 화면의 안내 문구가 입력 장치에 맞는다.

## Critical Files

### New Files

- `src/input/touch/tilt.ts`, `tilt.test.ts` — 기울기와 방향을 읽는 순수 계산
- `src/input/touch/touch-pad.ts`, `touch-pad.test.ts` — 1P 키보드 입력으로 옮김
- `src/input/touch/stick-control.ts` — 조이스틱 요소
- `src/input/touch/button-control.ts` — 공격 버튼 요소
- `src/input/touch/attach.ts`, `attach.test.ts` — 요소 찾기, 일시정지, 확대 막기, 연결
- `src/input/touch/markup.test.ts` — 코드가 찾는 요소가 `index.html`에 있고 터치 기기에서만 보이는지 확인
- `src/testing/raw.d.ts` — 테스트가 `index.html`을 글자로 읽는 `?raw` 가져오기의 형식
- `src/input/kind.ts`, `kind.test.ts` — 입력 장치 알아내기
- `src/render/guide.ts` — 입력 장치별 안내 문구 표

### Modified Files

- `index.html` — 요소, 스타일, 뷰포트
- `src/main.ts`, `src/main.test.ts` — 연결과 입력 장치 정하기
- `src/game.ts`, `src/controls.ts` — `inputKind`, `togglePause`
- `src/render/view.ts`, `scene.ts`, `screens.ts`, `pause.ts`와 각 테스트 — 안내 문구를 표에서 읽음
- `src/testing/canvas.ts` — 그리기 테스트용 View에 안내 문구 추가

### Reference Files

- `src/input/keyboard.ts` — 1P 키 배치 `KEY_MAP`
- `src/engine/locomotion.ts` — 점프가 위 입력을 읽는 곳

## Architecture

### User Flow

```text
손가락이 조이스틱에 닿음 → StickControl.start (기준점 저장)
손가락이 움직임 → StickControl.drag → tiltOf → TouchPad.tilt → Keyboard.press/release
Game.update → Keyboard.read(0) → engine.step([1P 입력, 2P 입력])
```

### Event Flow

```text
1. pointerdown / pointermove / pointerup / pointercancel
       ↓
2. followOrigin: 끝까지 민 거리를 넘으면 기준점을 손가락 쪽으로 끌어온다
       ↓
3. tiltOf → directionsOf: 기울기에서 여덟 방향을 읽는다
       ↓
4. TouchPad: 1P의 방향키와 I K O L을 누르거나 뗀다
```

### Domain Model

```text
TouchPad
├── tilt(tilt)       기울기에서 방향 네 개를 누르거나 뗀다
├── press(control)   1P 키를 누른다
└── release(control) 1P 키를 뗀다

Guide (입력 장치별)
├── titleHint        타이틀 아래 문구
├── pauseFooter      일시정지 화면 아래 문구
└── showKeyboards    키보드 그림을 그릴지
```

## Implementation Steps

### Step 1: Input Layer - 기울기와 방향 계산

손가락이 움직인 만큼을 기울기로 바꾸고 기울기에서 여덟 방향을 읽는다.

**Red:** `src/input/touch/tilt.test.ts`

```ts
  it('곧게 위로 밀면 위만 눌리고, 비스듬히 밀어야 대각선이 된다', () => {
    expect(directionsOf({ x: 0.2, y: -0.9 })).toEqual({ l: false, r: false, u: true, d: false });
    expect(directionsOf({ x: -0.7, y: -0.7 })).toEqual({ l: true, r: false, u: true, d: false });
  });
```

**Green:** `src/input/touch/tilt.ts`

```ts
export function directionsOf(tilt: Tilt): Record<Direction, boolean> {
  if (Math.hypot(tilt.x, tilt.y) < DEAD_ZONE) {
    return { l: false, r: false, u: false, d: false };
  }
  const horizontal = Math.abs(tilt.x) >= Math.abs(tilt.y) * SECTOR_RATIO;
  const vertical = Math.abs(tilt.y) >= Math.abs(tilt.x) * SECTOR_RATIO;
  return { l: horizontal && tilt.x < 0, r: horizontal && tilt.x > 0, u: vertical && tilt.y < 0, d: vertical && tilt.y > 0 };
}
```

**Refactoring:** 계산은 화면 요소를 모르는 순수 함수로 두고, 기준점이 따라오는 계산(`followOrigin`)도 같은 파일에 모은다.

### Step 2: Input Layer - 화면 요소 연결

조이스틱과 버튼의 터치를 1P 키보드 입력으로 옮긴다.

**Red:** `src/input/touch/touch-pad.test.ts`

```ts
  it('기울인 방향과 누른 버튼이 1P 입력으로만 읽힌다', () => {
    const keyboard = new Keyboard();
    const pad = new TouchPad(keyboard);
    pad.tilt({ x: 1, y: 0 });
    pad.press('C');
    expect(keyboard.read(0)).toMatchObject({ r: true, l: false, C: true, A: false });
    expect(keyboard.read(1)).toMatchObject({ r: false, C: false });
  });
```

**Green:** `src/input/touch/touch-pad.ts`

```ts
export class TouchPad {
  constructor(private readonly keyboard: Keyboard) {}

  press(control: keyof Pad): void {
    this.keyboard.press(KEY_MAP[0][control]);
  }

  release(control: keyof Pad): void {
    this.keyboard.release(KEY_MAP[0][control]);
  }
}
```

**Refactoring:** 조이스틱(`StickControl`)과 버튼(`ButtonControl`)을 클래스로 나누고, 요소를 찾고 연결하는 일은 `attach.ts`에 모은다. 일시정지는 `Game.togglePause`로 Space와 함께 쓴다.

### Step 3: UI Layer - 화면 요소, 안내 문구, 확대 막기

터치 기기에서만 보이는 요소를 놓고, 안내 문구를 입력 장치별 표에서 읽고, 확대를 막는다.

**Red:** `src/render/pause.test.ts`

```ts
  it('터치 기기에서는 키보드 그림과 Space 안내 없이 일시정지 버튼으로 계속하라고 알린다', () => {
    const { view, canvas } = makeView({ input: 'touch' });
    drawPause(view, 'abc123');
    expect(canvas.texts()).toContain('오른쪽 위 ⏸ 버튼으로 계속');
    expect(canvas.texts()).not.toContain('←');
  });
```

**Green:** `src/render/guide.ts`

```ts
export const GUIDES: Record<InputKind, Guide> = {
  keyboard: { titleHint: '…', pauseFooter: 'Space 계속   M 소리   H 판정 상자 표시', showKeyboards: true },
  touch: { titleHint: '오른쪽 위 ⏸ 버튼: 조작법과 일시정지', pauseFooter: '오른쪽 위 ⏸ 버튼으로 계속', showKeyboards: false },
};
```

**Refactoring:** 화면 코드는 `View.guide`를 읽기만 하고, 입력 장치 분기는 이 표 하나에만 둔다.

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

1. `./dev-server.sh start` 뒤 같은 네트워크의 폰에서 개발 서버(포트 58969)를 연다.
2. 조이스틱과 버튼이 보이고, 컴퓨터 화면에서는 보이지 않는지 본다.
3. 곧게 위로 밀어 제자리 점프가, 비스듬히 밀어 앞(뒤) 점프가 나가는지 본다.
4. 한 손으로 조이스틱, 다른 손으로 버튼을 눌러도 화면이 확대되지 않는지 본다.
5. 타이틀과 일시정지 화면에 Space 대신 일시정지 버튼 안내가 나오는지 본다.

## Considerations

### 두 손가락 조작과 확대

두 손가락이 닿으면 브라우저가 확대 동작으로 읽는다.
확대 동작(`gesturestart`)과 조작 영역의 터치 기본 동작을 막고 뷰포트에서 확대를 끈다.

### 고정된 가운데 기준의 문제

조이스틱을 고정된 가운데 기준으로 읽으면 손가락이 가운데에서 벗어나 닿을 때 의도하지 않은 방향이 눌린다.
그래서 처음 닿은 곳을 가운데로 삼고, 곧게 위로 밀었을 때 옆 방향이 섞이지 않도록 여덟 방향으로 나눈다.

### 실제 폰 확인

기기 흉내 모드는 터치 기기 조건(`pointer: coarse`)으로 바뀌지 않는 경우가 있다.
화면 배치는 조건을 강제로 켜고 확인하고, 조작감은 실제 폰에서 확인한다.
