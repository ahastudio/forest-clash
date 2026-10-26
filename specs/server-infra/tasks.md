# Tasks: 서버 인프라

## Goal

온라인 대전 서버를 Docker 이미지로 만들어 서버에 배포하고, 앞에 Cloudflare와 nginx를 둔다.

## Current Phase

✅ Phase 4: Testing

## Phases

### Phase 1: Requirements & Discovery ✅

- [x] 요구사항 정의(이미지, 배포, 점검, 웹소켓 접속 경로)
- [x] 스펙 문서 작성 (spec.md)

### Phase 2: Planning & Structure ✅

- [x] 이미지, 배포 절차, 문서, 정적 분석의 역할 나누기 (plan.md)

### Phase 3: Implementation ✅

- [x] Step 1: 서버 이미지(`server/Dockerfile`, `server/.dockerignore`)
- [x] Step 2: 배포와 점검 절차(`infra/deploy.yml`, `infra/status.yml`, 변수와 접속 정보 양식, `.gitignore`)
- [x] Step 3: nginx와 Cloudflare 설명(`infra/README.md`)
- [x] Step 4: 배포 파일 정적 분석(`check:infra`)
- [x] 컨테이너 포트 58970을 호스트에 그대로 내보내는 구성
- [x] 컨테이너 실행 옵션(읽기 전용, 권한 전부 제거, 새 권한 금지, 메모리와 프로세스 수 한도)과 기본 이미지 다이제스트 고정
- [x] 단계별 점검 통과(`pnpm run check:full`)

### Phase 4: Testing ✅

- [x] 이미지를 빌드해 컨테이너를 띄우고 `/healthz`, `healthy`, 대전 입력 중계, 기록 파일 저장 확인
- [x] Ansible 문법 검사(`deploy.yml`, `status.yml`)
- [x] 문서의 nginx 설정을 `nginx -t`로 검사
- [x] `Dockerfile`(hadolint)과 Ansible 절차(ansible-lint production 기준) 지적 0건
- [x] 서버(Go) 서식, 정적 분석, 문장과 분기 커버리지 100퍼센트 점검(`check:server`)을 `check`에 포함
- [x] 보안 옵션을 켠 컨테이너를 로컬에서 띄워 `/healthz`와 `/data` 쓰기, 그 밖의 경로 쓰기 거부 확인

## Notes

- 진행할 때마다 Phase 상태를 업데이트하세요: ⏸️ 대기 → 🔄 진행 중 → ✅ 완료
- 결정 사항은 findings.md의 Technical Decisions에 기록하세요.
- 오류는 findings.md의 Issues Encountered에 기록하세요.
