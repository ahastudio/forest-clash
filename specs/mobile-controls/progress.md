# Progress Log

> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**

## Session 2026-10-20

### Phase 1: Requirements & Discovery ✅

**작업 내역**:

1. 모바일은 언제나 1P이고 조이스틱은 터치 기기에서만 보이게 하기로 정했다.

**생성/수정 파일**:

- `spec.md`

### Phase 2: Planning & Structure ✅

**작업 내역**:

1. 입력을 1P 키보드 입력으로 옮기는 구조로 정했다.
2. 계산, 입력 전달, 화면 요소 연결의 역할을 나눴다.

**생성/수정 파일**:

- `plan.md`

### Phase 3: Implementation ✅

**작업 내역**:

1. 기울기와 방향 계산, `TouchPad`, 조이스틱, 버튼, 일시정지 연결을 만들었다.
2. 화면 요소와 스타일을 놓고 터치 기기에서만 보이게 했다.
3. 두 손가락 조작으로 화면이 확대되는 문제에 확대 막기를 더했다.
4. 점프가 잘 나가지 않는 문제에 조이스틱을 처음 닿은 곳 기준, 여덟 방향, 따라오는 기준점으로 바꿨다.
5. 타이틀과 일시정지 화면의 Space 안내를 입력 장치별 안내 표로 옮기고 일시정지 토글을 `Game.togglePause`로 모았다.

**생성/수정 파일**:

- `src/input/touch/tilt.ts`, `touch-pad.ts`, `stick-control.ts`, `button-control.ts`, `attach.ts`
- `src/input/kind.ts`
- `src/render/guide.ts`
- `src/game.ts`, `src/controls.ts`, `src/main.ts`
- `src/render/view.ts`, `scene.ts`, `screens.ts`, `pause.ts`
- `index.html`

### Phase 4: Testing ✅

**작업 내역**:

1. 계산, 입력 전달, 요소 연결, 입력 장치 판별, 안내 문구 단위 테스트를 썼다.
2. `pnpm run check`(타입 검사, 린트, 테스트, 커버리지 100%, 품질 점수)가 통과했다.
3. 폰 크기(세로, 가로)에서 화면 배치를 확인했다.
4. 실제 폰에서 조작을 확인했다.

**생성/수정 파일**:

- `src/input/touch/tilt.test.ts`, `touch-pad.test.ts`, `attach.test.ts`, `markup.test.ts`
- `src/testing/raw.d.ts`
- `src/input/kind.test.ts`
- `src/render/pause.test.ts`, `screens.test.ts`
- `src/game.test.ts`, `src/controls.test.ts`, `src/main.test.ts`

## Test Results

| Test | Input | Expected | Actual | Status |
| ---- | ----- | -------- | ------ | ------ |
| 곧게 위로 밀기 | 기울기 (0.2, -0.9) | 위만 눌림 | 그렇다(`tilt.test.ts`) | ✅ |
| 대각선 | 기울기 (-0.7, -0.7) | 왼쪽과 위가 함께 눌림 | 그렇다(`tilt.test.ts`) | ✅ |
| 작은 움직임 | 기울기 (0.2, -0.2) | 아무 방향도 누르지 않음 | 그렇다(`tilt.test.ts`) | ✅ |
| 1P 입력으로 전달 | 오른쪽 기울임과 강펀치 | 1P만 눌림, 2P는 그대로 | 그렇다(`touch-pad.test.ts`) | ✅ |
| 기준점 따라오기 | 끝까지 민 뒤 반대로 짧게 되돌림 | 반대 방향이 눌림 | 그렇다(`attach.test.ts`) | ✅ |
| 확대 막기 | 확대 동작, 터치 시작·이동, 길게 누르기 | 기본 동작 취소 | 그렇다(`attach.test.ts`) | ✅ |
| 터치 안내 문구 | 터치 기기의 일시정지 화면 | Space 안내와 키보드 그림 없음 | 그렇다(`pause.test.ts`) | ✅ |
| 입력 장치 판별 | `pointer: coarse` 여부 | touch 또는 keyboard | 그렇다(`kind.test.ts`) | ✅ |
| 컴퓨터에서 숨김 | `index.html`의 스타일 | 기본은 숨기고 터치 기기 조건에서만 보임 | 그렇다(`markup.test.ts`) | ✅ |
| 요소와 코드의 약속 | 코드가 찾는 요소와 뷰포트 | 모두 페이지에 있고 확대가 꺼져 있음 | 그렇다(`markup.test.ts`) | ✅ |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --------- | ----- | ------- | ---------- |
| 2026-10-20 | 두 손가락으로 조작하면 화면이 확대된다 | 1 | 확대 동작과 터치 기본 동작을 막고 뷰포트 확대를 끔 |
| 2026-10-20 | 점프가 잘 나가지 않는다 | 1 | 처음 닿은 곳 기준, 여덟 방향, 따라오는 기준점으로 바꿈 |
| 2026-10-20 | 터치 기기의 안내 문구에 Space와 키보드 그림이 나온다 | 1 | 입력 장치별 안내 표로 옮김 |

## 5-Question Reboot Check

작업 재개 시 이 질문들로 컨텍스트 복구:

| Question | Answer |
| -------- | ------ |
| 1. 현재 어느 단계인가? | Phase 4 「Testing」 완료 |
| 2. 다음에 할 일은? | 없음 (완료) |
| 3. 목표는? | 폰에서 화면 조이스틱과 버튼으로 컴퓨터와 대전할 수 있게 한다 |
| 4. 지금까지 배운 것? | findings.md 참고 |
| 5. 완료한 작업은? | 기울기 계산, 입력 전달, 요소 연결, 안내 문구, 확대 막기 구현과 테스트 |
