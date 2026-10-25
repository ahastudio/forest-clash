# Tasks: 조작과 입력

## Goal

버튼 네 개와 방향 입력으로 모든 동작을 내고, 한 키보드로 둘이서 대전할 수 있게 한다.

## Current Phase

✅ Phase 4: Testing

## Phases

### Phase 1: Requirements & Discovery ✅

- [x] 요구사항 정의(버튼 네 개, 두 사람의 키 배치)
- [x] 스펙 문서 작성 (spec.md)

### Phase 2: Planning & Structure ✅

- [x] 입력 기록과 모션 판정 구조 정하기 (plan.md)
- [x] 키보드와 엔진의 역할 나누기

### Phase 3: Implementation ✅

- [x] Step 1: 키보드와 조작 연결
- [x] Step 2: 입력 기록(방향 기록, 버튼 나이, 두 번 누름)
- [x] Step 3: 모션과 행동 고르기
- [x] 단계별 타입 검사

### Phase 4: Testing ✅

- [x] 키보드, 조작, 입력 기록, 모션 단위 테스트
- [x] 특수기 입력과 잡기 입력 시나리오 테스트
- [x] 전체 검사 통과(`pnpm run check`)

## Notes

- 진행할 때마다 Phase 상태를 업데이트하세요: ⏸️ 대기 → 🔄 진행 중 → ✅ 완료
- 결정 사항은 findings.md의 Technical Decisions에 기록하세요.
- 오류는 findings.md의 Issues Encountered에 기록하세요.
- 버튼 배치를 지키고 별도 진행 키를 두지 않는다.
