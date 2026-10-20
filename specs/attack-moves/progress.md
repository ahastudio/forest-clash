# Progress Log

> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**

## Session 2026-10-19

### Phase 1: Requirements & Discovery ✅

**작업 내역**:

1. 기술 목록과 프레임 수치를 정했다.

**생성/수정 파일**:

- `spec.md`

### Phase 2: Planning & Structure ✅

**작업 내역**:

1. 기술 표, 진행, 판정, 잡기의 역할을 나눴다.

**생성/수정 파일**:

- `plan.md`

### Phase 3: Implementation ✅

**작업 내역**:

1. 기술 표와 파생값, 기술 진행, 판정, 연계와 취소, 잡기를 엔진 안에 만들었다.

**생성/수정 파일**:

- `src/engine/move-specs.ts`
- `src/engine/moves.ts`
- `src/engine/attack-state.ts`
- `src/engine/hits.ts`
- `src/engine/grab/` (잡기 입력과 조건 `entry.ts`, 붙잡힘과 들어 올림 `hold.ts`, 던진 결과 `toss.ts`)

## Session 2026-10-20

### Phase 3: Implementation ✅

**작업 내역**:

1. 잡기 입력을 앞이나 뒤로 밀면서 강펀치·강킥을 누르는 것으로 바꿨다(방향 없이 누르면 일반 강공격).
2. 잡기 발동을 강공격과 비슷한 9프레임으로 늦추고, 발동 전의 공격은 잡을 수 있게 했다. 범위를 90으로 늘렸다.
3. 잡기 풀기를 없애고(잡히면 아무것도 할 수 없음) 컴퓨터 상대의 풀기 전술과 난이도 값(tech)을 지웠다.
4. 일시정지 화면의 설명을 새 규칙으로 고쳤다.

**생성/수정 파일**:

- `src/engine/actions.ts`, `src/engine/constants.ts`, `src/engine/move-specs.ts` (수정)
- `src/engine/grab/`, `src/engine/types.ts` (수정: 잡기 풀기 제거)
- `src/render/pause.ts`, `src/render/reactions.ts` (수정)
- `src/ai/defense.ts`, `src/ai/index.ts`, `src/ai/difficulty.ts` (수정: 풀기 전술 제거)

### Phase 4: Testing ✅

**작업 내역**:

1. 발동 프레임, 막힘·맞음 이득, 콤보, 특수기, 잡기 시나리오 테스트를 썼다.
2. 기술 데이터와 판정 상자 단위 테스트를 썼다.
3. 잡기 입력과 타이밍 테스트(앞·뒤, 강펀치·강킥, 방향 없음, 약한 버튼, 오른쪽 캐릭터, 방어 무시, 약한 공격에 끊김, 발동 전 강공격, 잡히면 끝)를 새 규칙으로 썼다.
4. 컴퓨터끼리 한 판의 기록 2건을 새 규칙에 맞게 갱신했다.
5. `pnpm run check`(타입 검사, 린트, 테스트, 커버리지 100%)가 통과했다(테스트 367건).

**생성/수정 파일**:

- `src/engine/scenarios.test.ts`
- `src/engine/states.test.ts`
- `src/regression.test.ts`
- `src/engine/moves.test.ts`
- `src/engine/boxes.test.ts`

## Test Results

| Test | Input | Expected | Actual | Status |
| ---- | ----- | -------- | ------ | ------ |
| 발동 프레임 | 서서·앉아서 여덟 기술 | 정확히 start 프레임에 맞음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 막힘·맞음 이득 | 아홉 기술을 맞히고 막게 하고 재기 | 표의 이득과 같음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 콤보 | 앉아 약펀치 → 앉아 약킥 → 대공 어퍼 | 서로 다른 기술 3개가 맞음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 대공 어퍼 무적 | 앞 5프레임에 상대 약펀치 | 맞지 않음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 잡기 | 가까이서 앞+강펀치, 방어 중 앞+강펀치 | 방어 여부와 상관없이 잡힘 | 그렇다(`scenarios.test.ts`) | ✅ |
| 잡히면 끝 | 잡힌 뒤 계속 버튼과 방향을 누름 | 풀리지 않고 던져짐 | 그렇다(`scenarios.test.ts`) | ✅ |
| 잡기 입력 | 근거리에서 앞·뒤 + 강펀치·강킥 네 가지 | 큰 공격 대신 잡기 | 그렇다(`scenarios.test.ts`) | ✅ |
| 방향 없음·약한 버튼 | 방향 없이 강펀치, 앞+약펀치 | 잡기가 아니라 일반 공격 | 그렇다(`scenarios.test.ts`) | ✅ |
| 발동 타이밍 | 잡는 사이 상대가 약펀치, 강킥을 막 시작, 강펀치 | 약펀치에는 맞고 강킥은 잡고 강펀치는 먼저 발동해 맞음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 방어 무시 | 막고 있는 상대에게 앞+강펀치 | 잡히고 막기 사건이 없음 | 그렇다(`scenarios.test.ts`) | ✅ |
| 연타 뒤 잡기 | 약펀치 3번이 막힌 뒤 잡기 | 물러나지 못하면 잡히고 물러나면 놓침 | 그렇다(`scenarios.test.ts`) | ✅ |
| 기술 데이터 | 표의 경직 계산 | 이득 + 판정 + 후딜 | 그렇다(`moves.test.ts`) | ✅ |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --------- | ----- | ------- | ---------- |
| 2026-10-20 | 잡기 입력 테스트에서 방향을 한 프레임만 눌러 일반 공격이 나감 | 1 | 방향을 계속 누르도록 테스트 입력 수정 |

## 5-Question Reboot Check

작업 재개 시 이 질문들로 컨텍스트 복구:

| Question | Answer |
| -------- | ------ |
| 1. 현재 어느 단계인가? | Phase 4 「Testing」 완료 |
| 2. 다음에 할 일은? | 없음 (완료) |
| 3. 목표는? | 일반기, 특수기, 잡기를 프레임 데이터대로 내고 연계와 취소, 잡기의 발동 타이밍이 규칙대로 동작하게 한다 |
| 4. 지금까지 배운 것? | findings.md 참고 |
| 5. 완료한 작업은? | 기술 표, 진행, 판정, 취소, 잡기 구현과 테스트 |
