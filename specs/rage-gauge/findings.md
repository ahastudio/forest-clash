# Findings & Decisions

> **기술적 발견, 중요한 결정이 있을 때마다 이 파일을 즉시 업데이트하세요.**

## Requirements

- 범위는 작게 한다.
- 게이지가 가득 차도 별도의 상태 변화(맥스 모드)는 없다.

## Research Findings

### 코드베이스 구조

- `src/engine/damage.ts`: 게이지 증가. `src/engine/actions.ts`: 필살기 입력 판정과 시작.
- `src/engine/move-specs-special.ts`: 분노 필살기 표. `src/render/hud-bars.ts`: 분노 막대. `src/render/fighters.ts`: 주황빛.

### 기존 패턴

- 분노 필살기는 별도 규칙 없이 기술 표의 한 기술(여러 번 맞는 기술)이다.
- 표시는 엔진의 값을 읽어서만 한다.

## Resources

### 코드 참조

- 게이지 증가: `src/engine/damage.ts:17`
- 필살기 입력: `src/engine/actions.ts:76`
- 분노 막대 색: `src/render/hud-bars.ts:129`

## Technical Decisions

| Decision | Rationale |
| -------- | --------- |
| 게이지 증가 비율: 맞히면 1.0배, 맞으면 1.6배, 막으면 1.5와 2 | 맞은 쪽이 더 빨리 차게 해 밀리는 쪽이 큰 기술로 뒤집을 기회를 얻게 하고, 막는 쪽과 막힌 쪽도 차서 방어 중에도 게이지가 쌓이게 하기 위해서다. |
| 가득 차면 별도 상태 없이 필살기 한 번 | 게이지를 쓰는 방법을 필살기 하나로 단순하게 두기 위해서다. |
| 분노 필살기는 앞 7프레임 무적 | 발동하는 동안 맞아서 게이지만 쓰고 헛되이 끝나지 않게 하기 위해서다. |

## Issues Encountered

## Learnings

### 필살기도 기술 표의 한 줄이다 (2026-10-19)

여러 번 맞는 기술을 표의 한 갈래로 두면 판정, 막힘, 경직 처리를 별도 코드 없이 같은 흐름으로 쓴다.
