# Progress Log

> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**

## Session 2026-10-19

### Phase 1: Requirements & Discovery ✅

**작업 내역**:

1. 단계, 승패, 시간 수치를 정했다.

**생성/수정 파일**:

- `specs/round-flow/spec.md`

### Phase 2: Planning & Structure ✅

**작업 내역**:

1. 단계 표와 단계 함수의 역할을 나눴다.

**생성/수정 파일**:

- `specs/round-flow/plan.md`

### Phase 3: Implementation ✅

**작업 내역**:

1. 단계와 입력, 승패와 다음 라운드, 안내와 시계를 만들었다.

**생성/수정 파일**:

- `src/engine/flow.ts`
- `src/engine/world.ts`
- `src/render/screens.ts`
- `src/render/hud.ts`
- `src/game.ts`

## Session 2026-10-20

### Phase 4: Testing ✅

**작업 내역**:

1. 타이틀과 결과 진행, K.O., 시간 초과, 판 종료 테스트를 썼다.
2. 무작위 입력으로 한 판 끝까지 가는 테스트를 썼다.
3. `pnpm run check`(타입 검사, 린트, 테스트, 커버리지 100%)가 통과했다.

**생성/수정 파일**:

- `src/engine/flow.test.ts`
- `src/engine/scenarios.test.ts`
- `src/render/screens.test.ts`

## Test Results

| Test | Input | Expected | Actual | Status |
| ---- | ----- | -------- | ------ | ------ |
| 시작 모드 | 1P 버튼, 2P 버튼만 | 컴퓨터와 대전, 둘이서 대전 | 그렇다(`flow.test.ts`) | ✅ |
| K.O.와 다음 라운드 | 체력 1인 상대 K.O. | 승수 증가, 다음 라운드 체력 가득, 안내 문구 지움 | 그렇다(`flow.test.ts`) | ✅ |
| 판 종료 | 두 판 승리 | 결과 화면, 이긴 쪽 표시 | 그렇다(`flow.test.ts`) | ✅ |
| 시간 초과 | 체력 차이, 같은 체력 | 많은 쪽이 한 판, 같으면 없음 | 그렇다(`flow.test.ts`) | ✅ |
| 한 판 전체 | 무작위 입력 | 오류 없이 끝나고 타이틀로 돌아옴 | 그렇다(`scenarios.test.ts`) | ✅ |
| 안내 화면 | 단계별 화면 | ROUND, FIGHT, K.O., 승리 문구 | 그렇다(`screens.test.ts`) | ✅ |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --------- | ----- | ------- | ---------- |
| 2026-10-20 | 새 라운드에 이전 라운드의 일시 표시가 남음 | 1 | 라운드를 시작할 때 두 캐릭터를 새로 만들도록 수정 |

## 5-Question Reboot Check

작업 재개 시 이 질문들로 컨텍스트 복구:

| Question | Answer |
| -------- | ------ |
| 1. 현재 어느 단계인가? | Phase 4 「Testing」 완료 |
| 2. 다음에 할 일은? | 없음 (완료) |
| 3. 목표는? | 타이틀에서 결과까지 한 판을 이어 가고 두 판을 먼저 이긴 쪽을 가린다 |
| 4. 지금까지 배운 것? | findings.md 참고 |
| 5. 완료한 작업은? | 단계와 승패, 라운드 초기화, 안내 화면 구현과 테스트 |
