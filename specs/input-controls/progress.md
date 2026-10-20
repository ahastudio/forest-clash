# Progress Log

> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**

## Session 2026-10-19

### Phase 1: Requirements & Discovery ✅

**작업 내역**:

1. 버튼 네 개와 두 사람의 키 배치를 정했다.
2. 키보드로는 대각선이 어렵다는 점을 반영해 모션을 방향 두 개를 차례로 누르는 것으로 정했다.

**생성/수정 파일**:

- `spec.md`

### Phase 2: Planning & Structure ✅

**작업 내역**:

1. 키보드와 엔진의 역할을 나눴다.
2. 모션을 숫자패드 번호의 표로 두기로 했다.

**생성/수정 파일**:

- `plan.md`

### Phase 3: Implementation ✅

**작업 내역**:

1. 키보드, 조작 연결, 입력 기록, 모션 판정, 행동 고르기를 만들었다.

**생성/수정 파일**:

- `src/input/keyboard.ts`
- `src/controls.ts`
- `src/engine/fighter.ts`
- `src/engine/motions.ts`
- `src/engine/actions.ts`

## Session 2026-10-20

### Phase 4: Testing ✅

**작업 내역**:

1. 키보드, 조작, 입력 기록, 모션 단위 테스트를 썼다.
2. 특수기 입력과 잡기 입력 시나리오 테스트를 썼다.
3. `pnpm run check`(타입 검사, 린트, 테스트, 커버리지 100%)가 통과했다.

**생성/수정 파일**:

- `src/input/keyboard.test.ts`
- `src/controls.test.ts`
- `src/engine/fighter.test.ts`
- `src/engine/motions.test.ts`
- `src/engine/scenarios.test.ts`

## Test Results

| Test | Input | Expected | Actual | Status |
| ---- | ----- | -------- | ------ | ------ |
| 키 배치 | 1P ←와 I, 2P R | 플레이어별 방향과 버튼으로 바뀜 | 그렇다(`keyboard.test.ts`) | ✅ |
| 키 겹침 | 두 키 배치 비교 | 16개가 겹치지 않음 | 그렇다(`keyboard.test.ts`) | ✅ |
| 돌진 팔꿈치 입력 | ↓ → 약펀치 | 돌진 팔꿈치(약) | 그렇다(`scenarios.test.ts`) | ✅ |
| 대공 어퍼 입력 | → ↓ 약펀치 | 대공 어퍼(약) | 그렇다(`scenarios.test.ts`) | ✅ |
| 모션 한도 | 10프레임 전에 완성한 모션 | 인정하지 않음 | 그렇다(`motions.test.ts`) | ✅ |
| 달리기 입력 | 앞을 두 번 누름 | 달리기 | 그렇다(`scenarios.test.ts`) | ✅ |
| 창 이탈 | 창이 포커스를 잃음 | 눌린 키를 모두 놓고 일시정지 | 그렇다(`controls.test.ts`) | ✅ |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --------- | ----- | ------- | ---------- |
| 2026-10-19 | 대각선이 필요한 모션은 키보드로 내기 어렵다 | 1 | 모션 표를 방향 두 개를 차례로 누르는 순서 중심으로 개정 |

## 5-Question Reboot Check

작업 재개 시 이 질문들로 컨텍스트 복구:

| Question | Answer |
| -------- | ------ |
| 1. 현재 어느 단계인가? | Phase 4 「Testing」 완료 |
| 2. 다음에 할 일은? | 없음 (완료) |
| 3. 목표는? | 버튼 네 개와 방향 입력으로 모든 동작을 내고 한 키보드로 둘이서 대전할 수 있게 한다 |
| 4. 지금까지 배운 것? | findings.md 참고 |
| 5. 완료한 작업은? | 키보드, 입력 기록, 모션 판정, 행동 고르기 구현과 테스트 |
