# Findings & Decisions

> **기술적 발견, 중요한 결정이 있을 때마다 이 파일을 즉시 업데이트하세요.**

## Requirements

- 낮은 점프는 위를 짧게(4프레임 이하) 눌렀을 때이고 일반 점프보다 빠르고 반응하기 어렵다.
- 뒤 대시는 하단 공격을 넘지만 무적은 아니다.
- 공중에서는 방향을 바꿀 수 없다.

## Research Findings

### 코드베이스 구조

- `src/engine/locomotion.ts`: 땅에서의 의도와 점프·구르기·대시 갱신.
- `src/engine/airborne.ts`: 공중 공격, 착지, 중력과 이동.
- `src/engine/stage.ts`: 벽, 겹침, 최대 간격.
- `src/engine/update.ts`: 상태별 갱신 함수 표와 한 프레임 진행.

### 기존 패턴

- 상태마다 갱신 함수를 표(`STATE_UPDATERS`)로 고른다.
- 입력 의도는 `Intent` 함수 배열이고 처음으로 새 행동을 시작한 것이 이긴다.

## Resources

### 코드 참조

- 걷기와 서기: `src/engine/locomotion.ts:81`
- 도약: `src/engine/locomotion.ts:104`
- 착지 고르기: `src/engine/airborne.ts:56`
- 벽과 겹침: `src/engine/stage.ts:37`
- 뒤 대시 하단 넘기: `src/engine/boxes.ts:55`

## Technical Decisions

| Decision | Rationale |
| -------- | --------- |
| 낮은 점프를 따로 둔다 | 위를 짧게 누르면 더 빠르고 반응하기 어려운 점프가 된다. |
| 뒤 대시는 피격 상자의 아래쪽(26)만 비우고 무적을 두지 않는다 | 낮게 들어오는 하단 공격은 넘고, 무적이 없어 다른 공격은 맞게 하기 위해서다. |
| 공중에서 방향을 바꾸지 못한다 | 도약을 시작할 때 정한 방향으로 날아간다. 공중 방어와 슈퍼 점프는 두지 않는다. |
| 몸이 겹치면 벽에 붙은 쪽은 움직이지 않고 상대가 겹친 만큼 밀려난다 | 캐릭터가 벽 밖으로 나가지 않게 하면서 몸이 겹치지 않게 하기 위해서다. |

## Issues Encountered

기록할 문제 없음.

## Learnings

### 이동 수치는 프레임 단위로 정한다 (2026-10-19)

체공 시간은 `2 × 상승 속도 ÷ 중력`이므로 상승 속도 13은 약 46프레임, 9.6은 약 34프레임이다. 수치를 바꾸면 체공 시간도 함께 바뀐다.
