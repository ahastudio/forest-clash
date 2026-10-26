# Progress Log

> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**

## Session 2026-10-23

### Phase 1: Requirements & Discovery ✅

**작업 내역**:

1. 서버를 Vercel에 올릴 수 없는 이유를 정하고, 서버의 Docker 컨테이너와 앞의 Cloudflare, nginx 구성을 정했다.

**생성/수정 파일**:

- `specs/server-infra/spec.md`

### Phase 2: Planning & Structure ✅

**작업 내역**:

1. 이미지, 배포와 점검 절차, 문서, 정적 분석의 네 단계로 나누고 접속 경로와 배포 순서를 정했다.

**생성/수정 파일**:

- `specs/server-infra/plan.md`

### Phase 3: Implementation ✅

**작업 내역**:

1. `server/Dockerfile`과 `server/.dockerignore`를 만들었다.
2. `infra/`(`deploy.yml`, `status.yml`, `vars.yml.example`, `inventory.ini.example`, `README.md`)를 만들고 `.gitignore`에 `infra/inventory.ini`, `infra/vars.yml`을 더했다.
3. 컨테이너 포트 58970을 호스트에 그대로 내보내고 바깥의 nginx가 `/ws`를 넘기는 구성으로 맞췄다. nginx와 Cloudflare 설정을 `infra/README.md`에 적었다.
4. `hadolint`와 `ansible-lint`(production 기준)의 지적을 모두 고쳤다. 실행 사용자를 번호로, 상태 확인을 JSON 형태로 바꾸고 Ansible의 모듈 이름, 파이프, 변경 판정, 긴 줄을 고쳤다.
5. 배포 파일 점검(`pnpm run check:infra`)을 만들어 `check:full`에 넣었다.

**생성/수정 파일**:

- `server/Dockerfile`, `server/.dockerignore`
- `infra/deploy.yml`, `status.yml`, `vars.yml.example`, `inventory.ini.example`, `README.md`
- `_agent/checks/infra_checks.cjs`, `package.json`, `.gitignore`

### Phase 4: Testing ✅

**작업 내역**:

1. 이미지를 빌드하고(`linux/amd64`) 컨테이너를 띄웠다. `/healthz`가 `ok`, 컨테이너가 `healthy`, 실행 사용자가 `10001:10001`인 것을 확인했다.
2. 컨테이너에 대전 입력 300개를 중계해 보니 중앙 약 6밀리초였고, 연결한 폴더에 기록 파일이 써졌다. 확인한 컨테이너와 이미지는 지웠다.
3. 양식에서 복사한 `vars.yml`과 `inventory.ini`로 `deploy.yml`과 `status.yml`의 Ansible 문법 검사를 통과했다.
4. `infra/README.md`의 nginx 설정을 다이제스트로 고정한 nginx 컨테이너에서 `nginx -t`로 검사해 통과했다(업스트림 주소는 `127.0.0.1:58970`으로 바꿔서).
5. 바꾼 이미지를 다시 빌드해 `healthy`, 입력 중계, 기록 파일 저장을 확인했다. 틀린 `Dockerfile` 줄을 임시로 넣어 `check:infra`가 위반을 잡는 것을 확인했다.

**생성/수정 파일**:

- 없음(확인만 했다)

## Session 2026-10-25

### Phase 4: Testing ✅

**작업 내역**:

1. `pnpm run check:full`이 종료 코드 0으로 통과했다(테스트 512건, 커버리지 100퍼센트, 품질 점수 100.0, 서버·성능·보안·인프라 점검 위반 0건).
2. 컨테이너 실행 옵션(읽기 전용, 권한 전부 제거, 새 권한 금지, 메모리와 프로세스 수 한도)을 더하고 기본 이미지를 다이제스트로 고정했다. 같은 옵션으로 로컬에서 이미지를 띄워 `/healthz`가 `ok`이고 `/data`에는 쓰며 그 밖의 경로에는 쓰지 못하는 것을 확인했다.

**생성/수정 파일**:

- `infra/deploy.yml`
- `server/Dockerfile`

## Test Results

| Test                 | Input                                         | Expected                              | Actual                           | Status |
| -------------------- | --------------------------------------------- | ------------------------------------- | -------------------------------- | ------ |
| 이미지 빌드          | `docker buildx build --platform linux/amd64`  | 빌드 성공, 실행 사용자가 root가 아님  | 성공, 사용자 `10001:10001`       | ✅     |
| 상태 확인            | 컨테이너 실행 후 `/healthz`, 30초 뒤          | `ok`, `healthy`                       | 그렇다                           | ✅     |
| 입력 중계            | 컨테이너에 두 계정, 입력 300개                | 상대에게 모두 전달                    | 중앙 약 6밀리초, 최대 약 14밀리초 | ✅     |
| 기록 저장            | `/data`에 폴더를 연결하고 로그인              | 연결한 폴더에 기록 파일               | 그렇다                           | ✅     |
| Ansible 문법         | `--syntax-check`(`deploy.yml`, `status.yml`)  | 통과                                  | 통과                             | ✅     |
| nginx 설정           | 문서의 설정을 `nginx -t`로                    | 통과                                  | 통과                             | ✅     |
| Dockerfile 정적 분석 | hadolint                                      | 지적 0건                              | 0건(`check:infra`)               | ✅     |
| Ansible 정적 분석    | ansible-lint production 기준                  | 실패 0건, 경고 0건                    | 0건(`check:infra`)               | ✅     |
| 위반 검출            | 틀린 `Dockerfile` 줄을 임시로 넣음            | 위반으로 잡힘                         | 위반 1건을 잡고 원래대로 복구    | ✅     |
| 보안 옵션 컨테이너   | 읽기 전용, 권한 전부 제거 등 옵션으로 로컬 실행 | `/healthz` `ok`, `/data`만 쓰기 가능   | `ok`, `/data`는 쓰고 `/x`는 읽기 전용 오류 | ✅     |

## Error Log

| Timestamp  | Error                                                                 | Attempt | Resolution                                           |
| ---------- | --------------------------------------------------------------------- | ------- | ---------------------------------------------------- |
| 2026-10-23 | 호스트 포트를 `127.0.0.1:18970`으로만 열어 둔 초안이 바깥의 nginx 구성과 맞지 않음 | 1       | `-p 58970:58970`으로 고치고 방화벽 주의를 문서에 적음 |
| 2026-10-23 | `Dockerfile`과 Ansible 절차가 정적 분석(hadolint, ansible-lint)에 걸림  | 1       | 실행 사용자와 상태 확인 형태, 모듈 이름, 파이프, 변경 판정을 고침 |
| 2026-10-23 | `go install`이 mise의 Go 설치 폴더에 실행 파일을 남김                  | 1       | 파일을 지우고 `go run`으로 버전을 고정해 쓰도록 바꿈 |

## 5-Question Reboot Check

작업 재개 시 이 질문들로 컨텍스트 복구:

| Question               | Answer                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| 1. 현재 어느 단계인가? | 모든 Phase 완료                                                                       |
| 2. 다음에 할 일은?     | 없음 |
| 3. 목표는?             | 온라인 대전 서버를 Docker 컨테이너로 배포하고 앞에 Cloudflare와 nginx를 둔다                      |
| 4. 지금까지 배운 것?   | findings.md 참고                                                                                 |
| 5. 완료한 작업은?      | `server/Dockerfile`, `infra/`(배포, 점검, 양식, 문서), 이미지와 Ansible, nginx 설정 검사, 배포 파일 정적 분석 |
