# Progress Log

> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**

## Session 2026-10-19

### Phase 1: Requirements & Discovery ✅

**작업 내역**:

1. 걷기, 점프, 달리기, 뒤 대시, 구르기의 종류와 수치를 정했다.

**생성/수정 파일**:

- `spec.md`

### Phase 2: Planning & Structure ✅

**작업 내역**:

1. 상태와 갱신 함수의 역할을 나눴다.

**생성/수정 파일**:

- `plan.md`

### Phase 3: Implementation ✅

**작업 내역**:

1. 땅의 이동, 점프와 공중, 대시와 구르기, 무대를 엔진 안에 만들었다.

**생성/수정 파일**:

- `src/engine/locomotion.ts`
- `src/engine/airborne.ts`
- `src/engine/recovery.ts`
- `src/engine/stage.ts`
- `src/engine/update.ts`

## Session 2026-10-20

### Phase 4: Testing ✅

**작업 내역**:

1. 이동 시나리오 테스트와 무대 단위 테스트를 썼다.
2. `pnpm run check`(타입 검사, 린트, 테스트, 커버리지 100%)가 통과했다.

**생성/수정 파일**:

- `src/engine/scenarios.test.ts`
- `src/engine/stage.test.ts`
- `src/engine/states.test.ts`

## Test Results

| Test | Input | Expected | Actual | Status |
| ---- | ----- | -------- | ------ | ------ |
| 낮은 점프 | 위 2프레임 | 일반 점프보다 짧고 낮음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 달리기와 뒤 대시 | 앞 두 번, 뒤 두 번 | 달리기, 뒤 대시 | 그렇다(`scenarios.test.ts`) | ✅ |
| 구르기 무적 | 구르기 중 약펀치 | 맞지 않음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 벽과 간격 | 벽 앞에서 밀기, 멀어지기 | 벽 안, 간격 440 이하 | 그렇다(`scenarios.test.ts`) | ✅ |
| 겹침 밀어내기 | 겹친 두 몸 | 반씩 밀려나고 벽 쪽은 움직이지 않음 | 그렇다(`stage.test.ts`) | ✅ |
| 하단 넘기 | 뒤 대시 3~16프레임 | 아래쪽 26이 빔 | 그렇다(`boxes.test.ts`) | ✅ |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --------- | ----- | ------- | ---------- |
| — | 없음 | — | — |

## 5-Question Reboot Check

작업 재개 시 이 질문들로 컨텍스트 복구:

| Question | Answer |
| -------- | ------ |
| 1. 현재 어느 단계인가? | Phase 4 「Testing」 완료 |
| 2. 다음에 할 일은? | 없음 (완료) |
| 3. 목표는? | 걷기, 점프, 달리기, 뒤 대시, 구르기와 벽, 최대 간격을 spec.md의 수치대로 낸다 |
| 4. 지금까지 배운 것? | findings.md 참고 |
| 5. 완료한 작업은? | 이동 상태 갱신, 점프와 공중, 무대 구현과 테스트 |
