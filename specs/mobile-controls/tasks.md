# Tasks: 모바일 조작

## Goal

폰에서 화면 조이스틱과 버튼으로 컴퓨터와 대전할 수 있게 한다.

## Current Phase

✅ Phase 4: Testing

## Phases

### Phase 1: Requirements & Discovery ✅

- [x] 요구사항 정의(모바일에서만 보임, 언제나 1P)
- [x] 스펙 문서 작성 (spec.md)

### Phase 2: Planning & Structure ✅

- [x] 입력 전달 구조 정하기(1P 키보드 입력으로 옮김) (plan.md)
- [x] 계산, 입력 전달, 화면 요소 연결의 역할 나누기

### Phase 3: Implementation ✅

- [x] Step 1: 기울기와 방향 계산
- [x] Step 2: 조이스틱, 버튼, 일시정지 연결
- [x] Step 3: 화면 요소와 스타일, 안내 문구, 확대 막기
- [x] 단계별 타입 검사

### Phase 4: Testing ✅

- [x] 계산, 입력 전달, 요소 연결, 입력 장치 판별, 안내 문구 단위 테스트
- [x] 전체 검사 통과(`pnpm run check`)
- [x] 폰 크기 화면 배치 확인(세로, 가로)
- [x] 실제 폰에서 조작감 확인(점프, 앉기, 걷기, 확대가 일어나지 않는지)
- [x] 싸우는 중 캐릭터가 조작 영역에 가려지는지 확인

## Notes

- 진행할 때마다 Phase 상태를 업데이트하세요: ⏸️ 대기 → 🔄 진행 중 → ✅ 완료
- 결정 사항은 findings.md의 Technical Decisions에 기록하세요.
- 오류는 findings.md의 Issues Encountered에 기록하세요.
- 모바일의 입력은 언제나 1P다.
