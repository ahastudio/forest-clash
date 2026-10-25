# Tasks: 기술

## Goal

일반기, 특수기, 잡기를 프레임 데이터대로 내고 연계, 취소, 잡기의 발동 타이밍이 규칙대로 동작하게 한다.

## Current Phase

✅ Phase 4: Testing

## Phases

### Phase 1: Requirements & Discovery ✅

- [x] 요구사항 정의(기술 목록과 수치)
- [x] 스펙 문서 작성 (spec.md)

### Phase 2: Planning & Structure ✅

- [x] 기술 표, 기술 진행, 판정, 잡기의 역할 나누기 (plan.md)

### Phase 3: Implementation ✅

- [x] Step 1: 기술 표와 파생값
- [x] Step 2: 기술 진행과 판정
- [x] Step 3: 연계와 취소
- [x] Step 4: 잡기
- [x] 잡기 입력을 앞·뒤 + 강펀치·강킥으로 정하고 발동을 9프레임으로 맞추기
- [x] 단계별 타입 검사

### Phase 4: Testing ✅

- [x] 발동 프레임과 이득 테스트
- [x] 연계·취소 콤보 테스트
- [x] 특수기와 잡기 테스트
- [x] 새 잡기 입력 테스트와 컴퓨터끼리 한 판 기록 갱신
- [x] 전체 검사 통과(`pnpm run check`)

## Notes

- 진행할 때마다 Phase 상태를 업데이트하세요: ⏸️ 대기 → 🔄 진행 중 → ✅ 완료
- 결정 사항은 findings.md의 Technical Decisions에 기록하세요.
- 오류는 findings.md의 Issues Encountered에 기록하세요.
- 표의 수치는 이 게임의 두 캐릭터에 맞게 정한 값이다.
