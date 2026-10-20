# Tasks: 맞았을 때

## Goal

타격이 맞았을 때의 피해, 경직, 타격 정지, 밀림, 띄움·쓰러짐, 콤보 보정, K.O.가 규칙대로 동작하게 한다.

## Current Phase

✅ Phase 4: Testing

## Phases

### Phase 1: Requirements & Discovery ✅

- [x] 요구사항 정의(맞음 반응의 종류와 수치)
- [x] KOF 98의 맞음 규칙 조사
- [x] 스펙 문서 작성 (spec.md)

### Phase 2: Planning & Structure ✅

- [x] 맞음 결과, 반응, 보상, K.O.의 역할 나누기 (plan.md)

### Phase 3: Implementation ✅

- [x] Step 1: 피해와 보정
- [x] Step 2: 반응(경직, 날아감)
- [x] Step 3: K.O.
- [x] 단계별 타입 검사

### Phase 4: Testing ✅

- [x] 카운터 히트와 맞교환 테스트
- [x] 쓰러짐·기상, 띄움 테스트
- [x] K.O.와 시간 초과 테스트
- [x] 전체 검사 통과(`pnpm run check`)

## Notes

- 진행할 때마다 Phase 상태를 업데이트하세요: ⏸️ 대기 → 🔄 진행 중 → ✅ 완료
- 결정 사항은 findings.md의 Technical Decisions에 기록하세요.
- 오류는 findings.md의 Issues Encountered에 기록하세요.
- 낙법과 슈퍼 점프는 이번 범위에서 뺐다.
