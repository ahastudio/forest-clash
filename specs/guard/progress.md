# Progress Log

> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**

## Session 2026-10-19

### Phase 1: Requirements & Discovery ✅

**작업 내역**:

1. 방어 입력, 높이 규칙, 막은 뒤의 결과를 정했다.
2. 약한 기술의 막힘 이득을 연타 테스트로 +1 이하로 낮췄다.

**생성/수정 파일**:

- `specs/guard/spec.md`

### Phase 2: Planning & Structure ✅

**작업 내역**:

1. 막을 수 있는가와 막힌 뒤의 결과로 나눴다.

**생성/수정 파일**:

- `specs/guard/plan.md`

### Phase 3: Implementation ✅

**작업 내역**:

1. 방어 판정과 막힌 뒤 처리를 엔진 안에 만들었다.

**생성/수정 파일**:

- `src/engine/blocking.ts`
- `src/engine/strike.ts`
- `src/engine/hits.ts`

## Session 2026-10-20

### Phase 4: Testing ✅

**작업 내역**:

1. 방어 높이, 막힘 이득, 후딜 반격 시나리오 테스트를 썼다.
2. `pnpm run check`(타입 검사, 린트, 테스트, 커버리지 100%)가 통과했다.

**생성/수정 파일**:

- `src/engine/scenarios.test.ts`
- `src/engine/states.test.ts`

## Test Results

| Test | Input | Expected | Actual | Status |
| ---- | ----- | -------- | ------ | ------ |
| 중단 방어 | 서서 약펀치를 서서·앉아서 방어 | 둘 다 막음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 상단 방어 | 앞+강펀치를 서서·앉아서 방어 | 서서만 막음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 하단 방어 | 앉아 약킥을 서서·앉아서 방어 | 앉아서만 막음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 막힘 이득 | 아홉 기술을 막게 하고 재기 | 표의 막힘 이득과 같음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 연타를 계속 막음 | 12프레임마다 약펀치 연타 | 피해 없음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 연타 대 반격 | 여덟 판 | 반격하는 쪽이 6판 이상 | 그렇다(`scenarios.test.ts`) | ✅ |
| 잡기 | 방어 중 잡기 | 방어를 무시하고 잡힘 | 그렇다(`scenarios.test.ts`) | ✅ |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --------- | ----- | ------- | ---------- |
| 2026-10-19 | 막힘 이득 +3에서 연타하는 쪽이 이김 | 1 | 막힘 이득을 +1 이하로 낮춤 |

## 5-Question Reboot Check

작업 재개 시 이 질문들로 컨텍스트 복구:

| Question | Answer |
| -------- | ------ |
| 1. 현재 어느 단계인가? | Phase 4 「Testing」 완료 |
| 2. 다음에 할 일은? | 없음 (완료) |
| 3. 목표는? | 공격 높이에 맞는 자세로만 막히고 막은 뒤의 결과가 규칙대로 정해진다 |
| 4. 지금까지 배운 것? | findings.md 참고 |
| 5. 완료한 작업은? | 방어 판정과 막힌 뒤 처리 구현과 테스트 |
