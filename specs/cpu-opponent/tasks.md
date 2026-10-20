# Tasks: 컴퓨터 상대

## Goal

막고, 반격하고, 접근하고, 공격을 고르는 컴퓨터 상대를 만들고 난이도를 라운드와 전적으로 정한다.

## Current Phase

✅ Phase 4: Testing

## Phases

### Phase 1: Requirements & Discovery ✅

- [x] 요구사항 정의(전술과 난이도)
- [x] KOF 98에서 컴퓨터 상대의 행동 조사
- [x] 스펙 문서 작성 (spec.md)

### Phase 2: Planning & Structure ✅

- [x] 판단 구조와 방어·공격 전술, 난이도 표의 역할 나누기 (plan.md)

### Phase 3: Implementation ✅

- [x] Step 1: 판단 구조
- [x] Step 2: 방어 전술
- [x] Step 3: 공격 전술과 난이도
- [x] 단계별 타입 검사

### Phase 4: Testing ✅

- [x] 전술별 단위 테스트(무작위 고정)
- [x] 라운드별 난이도 테스트
- [x] 컴퓨터끼리 한 판 회귀 테스트
- [x] 전체 검사 통과(`pnpm run check`)

## Notes

- 진행할 때마다 Phase 상태를 업데이트하세요: ⏸️ 대기 → 🔄 진행 중 → ✅ 완료
- 결정 사항은 findings.md의 Technical Decisions에 기록하세요.
- 오류는 findings.md의 Issues Encountered에 기록하세요.
- 처음 하는 사람이 바로 지지 않도록 처음에는 봐준다.
