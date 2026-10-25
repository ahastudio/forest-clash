# Feature Specification: 서버 인프라

## Overview

온라인 대전 서버를 Docker 이미지로 만들어 서버에 배포한다.
배포와 점검은 Ansible 절차(`infra/`)로 하고, 앞에는 Cloudflare와 nginx를 둔다.

## User Scenarios & Testing (mandatory)

### User Story 1: 서버 이미지를 만든다

- As: 배포하는 사람은
- I: 서버를 컨테이너 이미지로 만들 수 있다
- So: 서버의 환경과 상관없이 같은 서버를 띄우기 위해

#### Acceptance Scenarios

Scenario 1: **이미지 빌드**

- Given: `server/`의 Go 소스와 `go.mod`가 있을 때
- When: `server/Dockerfile`로 `linux/amd64` 이미지를 빌드하면
- Then: 빌드가 끝나고 실행 사용자는 root가 아니다

Scenario 2: **상태 확인**

- Given: 이미지로 컨테이너를 띄웠을 때
- When: `/healthz`를 부르거나 컨테이너의 상태 확인이 돌면
- Then: `ok`로 답하고 컨테이너는 `healthy`가 된다

Scenario 3: **기록 저장**

- Given: 컨테이너의 `/data`에 서버의 폴더를 연결했을 때
- When: 로그인으로 계정이 만들어지면
- Then: 연결한 폴더에 기록 파일이 써지고, 컨테이너를 지워도 남는다

Scenario 4: **개인 정보가 이미지에 없음**

- Given: 서버 폴더에 승패 기록 파일(`*.json`)과 개발용 파일이 있을 때
- When: 이미지를 빌드하면
- Then: 그 파일들은 이미지에 들어가지 않는다

### User Story 2: 서버에 배포한다

- As: 배포하는 사람은
- I: 한 명령으로 서버에 배포할 수 있다
- So: 손으로 명령을 치다 틀리지 않기 위해

#### Acceptance Scenarios

Scenario 1: **배포**

- Given: `infra/vars.yml`과 `infra/inventory.ini`가 채워져 있을 때
- When: `deploy.yml`을 실행하면
- Then: 이미지를 빌드해 서버에 올리고, 컨테이너를 새로 띄우고, `/healthz`가 200이 될 때까지 기다린다. 되지 않으면 실패로 끝난다

Scenario 2: **비밀 값이 남지 않음**

- Given: 환경변수에 구글 클라이언트 아이디 등이 들어 있을 때
- When: 배포하면
- Then: 값이 로그에 남지 않는다

### User Story 3: 서버를 점검한다

- As: 운영하는 사람은
- I: 서버 상태를 한 번에 읽을 수 있다
- So: 문제가 있는지 바꾸지 않고 확인하기 위해

#### Acceptance Scenarios

Scenario 1: **읽기만 하는 점검**

- Given: 서버에 접속할 수 있을 때
- When: `status.yml`을 실행하면
- Then: Docker 자동 시작, 네트워크, 컨테이너 상태와 재시작 정책, `/healthz`, 디스크와 데이터 폴더를 보여 주고 아무것도 바꾸지 않는다

### User Story 4: 웹소켓이 바깥에서 닿는다

- As: 플레이어는
- I: 브라우저에서 `wss`로 서버에 접속할 수 있다
- So: 인터넷 너머의 상대와 대전하기 위해

#### Acceptance Scenarios

Scenario 1: **웹소켓 넘기기**

- Given: nginx에 `infra/README.md`의 설정이 들어 있을 때
- When: 브라우저가 `wss://서버주소/ws`로 접속하면
- Then: Cloudflare가 TLS를 끝내고 nginx가 컨테이너의 58970으로 연결을 전환해 넘긴다

## Functional Requirements (mandatory)

- FR-1: MUST 서버는 컨테이너 이미지로 만들고, 컨테이너는 root가 아닌 사용자로 실행하며 스스로 상태를 확인한다.
- FR-2: MUST 승패 기록은 컨테이너를 지워도 남는다.
- FR-3: MUST 이미지에 승패 기록 파일과 개발용 파일을 넣지 않는다.
- FR-4: MUST 이미지는 이미지 보관소 없이 배포하는 컴퓨터에서 만들어 서버로 직접 올린다.
- FR-5: MUST 서버에는 컨테이너 하나만 띄우고, 서버가 다시 켜져도 자동으로 다시 실행된다. 포트 58970으로 받고 서버의 `nginx`가 닿는다.
- FR-6: MUST 서버 환경변수는 변수 파일에서 컨테이너로 넘기고, 값이 로그에 남지 않게 한다. 임시 로그인은 켜지 않는다.
- FR-7: MUST 배포는 서버가 `/healthz`에 응답할 때까지 기다리고, 응답하지 않으면 실패로 끝난다.
- FR-8: MUST 점검은 서버를 바꾸지 않고 읽기만 한다.
- FR-9: MUST nginx와 Cloudflare 설정을 `infra/README.md`에 적는다.

## Constraints (mandatory)

- CON-1: MUST 서버 접속 정보와 변수 값은 저장소에 올리지 않는다. 양식 파일만 올린다.
- CON-2: MUST 서버에 실제로 배포하는 것은 배포하는 사람이 명시적으로 실행할 때만 한다.
- CON-3: MUST 서버에서 이 서버의 컨테이너 외의 컨테이너는 건드리지 않는다.
- CON-4: MUST 배포하는 서버는 HTTPS 뒤에서 `wss`로 노출한다.
- CON-5: MUST 서버에 새 메시지를 더하는 변경은 서버를 먼저 배포한 뒤 게임 화면(Vercel)을 배포한다.

## Success Criteria (mandatory)

- SC-1: 이미지가 실제로 빌드되고, 컨테이너가 `healthy`가 되며, 대전 입력을 중계하고, 연결한 폴더에 기록 파일을 쓴다.
- SC-2: Ansible 문법 검사(`--syntax-check`)가 `deploy.yml`과 `status.yml`에서 통과한다.
- SC-3: `infra/README.md`의 nginx 설정이 `nginx -t`를 통과한다.
- SC-4: 실제 서버에 배포해 `/healthz`가 200이고 nginx와 Cloudflare를 거쳐 `wss`로 접속된다.
- SC-5: `pnpm run check:infra`가 `Dockerfile`(hadolint)과 Ansible 절차(ansible-lint production 기준)에서 지적 0건이고 nginx 설정이 `nginx -t`를 통과한다.
- SC-6: 서버(Go)의 서식, 정적 분석, 문장과 분기 커버리지 100퍼센트(`pnpm run check:server`)가 통과한다.
