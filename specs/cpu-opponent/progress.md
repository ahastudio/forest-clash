# Progress Log

> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**

## Session 2026-10-19

### Phase 1: Requirements & Discovery ✅

**작업 내역**:

1. 컴퓨터 상대의 행동과 난이도 단계, 라운드별 난이도를 정했다.

**생성/수정 파일**:

- `specs/cpu-opponent/spec.md`

### Phase 2: Planning & Structure ✅

**작업 내역**:

1. 판단 구조, 방어·공격 전술, 난이도 표로 나눴다.

**생성/수정 파일**:

- `specs/cpu-opponent/plan.md`

### Phase 3: Implementation ✅

**작업 내역**:

1. 판단 구조, 방어 전술, 공격 전술, 난이도 표, 라운드별 난이도를 만들었다.

**생성/수정 파일**:

- `src/ai/index.ts`
- `src/ai/mind.ts`
- `src/ai/pad.ts`
- `src/ai/decision.ts`
- `src/ai/defense.ts`
- `src/ai/offense.ts`
- `src/ai/difficulty.ts`

## Session 2026-10-20

### Phase 4: Testing ✅

**작업 내역**:

1. 전술별 단위 테스트를 무작위를 고정해 썼다.
2. 컴퓨터끼리 한 판 회귀 테스트를 썼다.
3. `pnpm run check`(타입 검사, 린트, 테스트, 커버리지 100%)가 통과했다.

**생성/수정 파일**:

- `src/ai/ai.test.ts`
- `src/regression.test.ts`

## Test Results

| Test | Input | Expected | Actual | Status |
| ---- | ----- | -------- | ------ | ------ |
| 라운드별 난이도 | 1, 2, 3, 9라운드, 지고 있을 때 | 0, 1, 2, 2, 한 단계 낮음 | 그렇다(`ai.test.ts`) | ✅ |
| 막기 | 높이가 다른 기술 | 하단은 앉아서 막음 | 그렇다(`ai.test.ts`) | ✅ |
| 반격과 끊기 | 헛친 후딜, 느린 발동 | 약펀치 | 그렇다(`ai.test.ts`) | ✅ |
| 대공과 필살기 | 떨어지는 상대, 가득 찬 게이지 | 대공 어퍼, 필살기 입력 | 그렇다(`ai.test.ts`) | ✅ |
| 압박 | 막고 있는 상대의 자세별 | 하단, 상단, 잡기 | 그렇다(`ai.test.ts`) | ✅ |
| 컴퓨터끼리 한 판 | 시드와 난이도 조합이 다른 세 판 | 언제나 같은 결과 | 그렇다(`regression.test.ts`) | ✅ |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --------- | ----- | ------- | ---------- |
| 2026-10-20 | 돌진 팔꿈치 접근 분기가 실행될 수 없음 | 1 | 실행될 수 없는 분기를 지움 |

## 5-Question Reboot Check

작업 재개 시 이 질문들로 컨텍스트 복구:

| Question | Answer |
| -------- | ------ |
| 1. 현재 어느 단계인가? | Phase 4 「Testing」 완료 |
| 2. 다음에 할 일은? | 없음 (완료) |
| 3. 목표는? | 막고, 반격하고, 접근하고, 공격을 고르는 컴퓨터 상대를 만들고 난이도를 라운드와 전적으로 정한다 |
| 4. 지금까지 배운 것? | findings.md 참고 |
| 5. 완료한 작업은? | 판단 구조, 방어·공격 전술, 난이도 표 구현과 테스트 |
