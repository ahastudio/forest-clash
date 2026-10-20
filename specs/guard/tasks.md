# Tasks: 방어

## Goal

공격 높이와 방어 자세가 맞아야 막히고, 막은 뒤의 경직, 밀림, 게이지가 규칙대로 정해지게 한다.

## Current Phase

✅ Phase 4: Testing

## Phases

### Phase 1: Requirements & Discovery ✅

- [x] 요구사항 정의(방어 입력, 높이, 막은 뒤의 결과)
- [x] KOF 98의 방어 규칙 조사
- [x] 스펙 문서 작성 (spec.md)

### Phase 2: Planning & Structure ✅

- [x] 방어 판정과 막은 뒤 처리의 역할 나누기 (plan.md)

### Phase 3: Implementation ✅

- [x] Step 1: 막을 수 있는가
- [x] Step 2: 막힌 뒤의 결과
- [x] 단계별 타입 검사

### Phase 4: Testing ✅

- [x] 방어 높이 테스트(여섯 조합)
- [x] 막힘 이득과 후딜 반격 테스트
- [x] 전체 검사 통과(`pnpm run check`)

## Notes

- 진행할 때마다 Phase 상태를 업데이트하세요: ⏸️ 대기 → 🔄 진행 중 → ✅ 완료
- 결정 사항은 findings.md의 Technical Decisions에 기록하세요.
- 오류는 findings.md의 Issues Encountered에 기록하세요.
- 약한 기술의 막힘 이득을 +1 이하로 낮춘 이유는 findings.md의 Technical Decisions에 있다.
