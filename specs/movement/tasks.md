# Tasks: 이동

## Goal

걷기, 점프, 달리기, 뒤 대시, 구르기와 벽, 최대 간격을 spec.md의 수치대로 낸다.

## Current Phase

✅ Phase 4: Testing

## Phases

### Phase 1: Requirements & Discovery ✅

- [x] 요구사항 정의(이동 종류와 수치)
- [x] KOF 98에서 이동 수치 조사
- [x] 스펙 문서 작성 (spec.md)

### Phase 2: Planning & Structure ✅

- [x] 상태와 갱신 함수 나누기 (plan.md)
- [x] 땅의 이동, 공중, 무대의 역할 나누기

### Phase 3: Implementation ✅

- [x] Step 1: 땅의 이동
- [x] Step 2: 점프와 공중
- [x] Step 3: 대시와 구르기
- [x] Step 4: 무대
- [x] 단계별 타입 검사

### Phase 4: Testing ✅

- [x] 이동 시나리오 테스트(점프, 달리기, 대시, 구르기, 걷기 속도)
- [x] 무대 단위 테스트(벽, 겹침, 최대 간격)
- [x] 전체 검사 통과(`pnpm run check`)

## Notes

- 진행할 때마다 Phase 상태를 업데이트하세요: ⏸️ 대기 → 🔄 진행 중 → ✅ 완료
- 결정 사항은 findings.md의 Technical Decisions에 기록하세요.
- 오류는 findings.md의 Issues Encountered에 기록하세요.
- 이동 수치는 KOF 98의 표를 참고해 이 게임의 두 캐릭터에 맞게 정한 값이며 원작 값과 다르다.
