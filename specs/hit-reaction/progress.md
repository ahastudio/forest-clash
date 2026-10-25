# Progress Log

> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**

## Session 2026-10-19

### Phase 1: Requirements & Discovery ✅

**작업 내역**:

1. 맞음 경직, 타격 정지, 카운터 히트, 맞교환, 띄움·저글, 쓰러짐, 콤보 보정의 규칙과 수치를 정했다.

**생성/수정 파일**:

- `specs/hit-reaction/spec.md`

### Phase 2: Planning & Structure ✅

**작업 내역**:

1. 맞음 결과, 반응, 보상, K.O.의 역할을 나눴다.

**생성/수정 파일**:

- `specs/hit-reaction/plan.md`

### Phase 3: Implementation ✅

**작업 내역**:

1. 피해와 보정, 반응, 보상, K.O., 일어남을 엔진 안에 만들었다.

**생성/수정 파일**:

- `src/engine/impact.ts`
- `src/engine/damage.ts`
- `src/engine/recovery.ts`
- `src/engine/airborne.ts`

## Session 2026-10-20

### Phase 4: Testing ✅

**작업 내역**:

1. 카운터 히트, 맞교환, 쓰러짐·기상, K.O.와 시간 초과 테스트를 썼다.
2. K.O.가 난 쪽이 날아가는 테스트를 더했다.
3. `pnpm run check`(타입 검사, 린트, 테스트, 커버리지 100%)가 통과했다.

**생성/수정 파일**:

- `src/engine/scenarios.test.ts`
- `src/engine/juggle.test.ts`
- `src/engine/states.test.ts`
- `src/engine/flow.test.ts`

## Test Results

| Test | Input | Expected | Actual | Status |
| ---- | ----- | -------- | ------ | ------ |
| 카운터 히트 | 약킥 발동 중 약펀치 | 카운터 히트, 피해 1.25배, 상대 기술 끊김 | 그렇다(`scenarios.test.ts`) | ✅ |
| 맞교환 | 같은 프레임 약펀치 서로 | 둘 다 맞음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 쓰러짐 | 쓸기 맞음 | 쓰러졌다 일어나 행동 가능 | 그렇다(`scenarios.test.ts`) | ✅ |
| 저글 한도 | 띄워진 상대에게 저글이 되는 기술과 되지 않는 기술, 저글 횟수 0, 1, 2 | 되는 기술은 한도 2 안에서만 맞고, 되지 않는 기술은 맞지 않음 | 그렇다(`juggle.test.ts`) | ✅ |
| 띄워졌다 떨어짐 | 체력이 남은 채 착지 | 쓰러졌다 일어남 | 그렇다(`states.test.ts`) | ✅ |
| K.O. | 체력 1인 상대에 약펀치 | K.O., 승수 증가, 날아감 | 그렇다(`flow.test.ts`) | ✅ |
| 시간 초과 | 체력 차이 상태로 시간 종료 | 많은 쪽이 승수 얻음 | 그렇다(`flow.test.ts`) | ✅ |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --------- | ----- | ------- | ---------- |
| 2026-10-20 | K.O.가 난 쪽이 날아가지 않음 | 1 | 날아가는 값을 대상 형식으로 적고 테스트를 더함 |

## 5-Question Reboot Check

작업 재개 시 이 질문들로 컨텍스트 복구:

| Question | Answer |
| -------- | ------ |
| 1. 현재 어느 단계인가? | Phase 4 「Testing」 완료 |
| 2. 다음에 할 일은? | 없음 (완료) |
| 3. 목표는? | 타격이 맞았을 때의 피해, 경직, 타격 정지, 밀림, 띄움·쓰러짐, 콤보 보정, K.O.가 규칙대로 동작한다 |
| 4. 지금까지 배운 것? | findings.md 참고 |
| 5. 완료한 작업은? | 맞음 결과·반응·보상·K.O. 구현과 테스트 |
