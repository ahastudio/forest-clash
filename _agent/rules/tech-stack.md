# 기술 스택

## 디렉터리 역할

- `src/` — 게임 코드(TypeScript).
  - `src/engine/` — 전투 규칙. 순수 로직이며 화면·소리·브라우저를 모른다.
  - `src/ai/` — 컴퓨터 상대. 사람과 같은 입력만 낸다.
  - `src/render/` — 캔버스 그리기와 엔진 사건에 대한 효과.
  - `src/audio/` — 코드로 합성하는 효과음과 배경음악.
  - `src/input/` — 키보드 입력, 모바일 화면 조이스틱(`touch/` 폴더), 입력 장치 알아내기(`kind.ts`).
  - `src/menu.ts`, `src/demo.ts`, `src/online/` — 타이틀 선택 메뉴(버튼 세 개), 타이틀 뒤에서 싸우는 배경 대전, 온라인 대전(구글 또는 stub 로그인, 서버 접속, 입력 지연 락스텝). 서버와 통신하는 코드는 `src/online/web-socket.ts`에만 둔다.
  - `src/testing/` — 테스트 도우미(가짜 캔버스, 가짜 오디오, 대결 장면). 게임에는 들어가지 않는다.
  - `src/main.ts` — 시작 파일. `src/game.ts`가 엔진·컴퓨터 상대·소리·화면·입력을 묶는다.
- `server/` — 온라인 대전 서버(Go). 계정(구글 토큰 검증), 매칭, 입력 전달, 승패 기록. 개발 중에는 `server/dev-server.sh`로만 켜고 끈다. 배포용 Docker 이미지는 `server/Dockerfile`이다.
- `infra/` — 온라인 대전 서버 배포(Ansible). 서버 Docker 컨테이너, nginx와 Cloudflare 설명. 서버 접속 정보와 변수 값(`inventory.ini`, `vars.yml`)은 저장소에 올리지 않는다.
- `public/` — 배경, 로고, 캐릭터 그림(SVG).
  `public/characters/`는 그림 자산이므로 코드로 고치지 않는다.
- `specs/` — FBPW 기능 디렉터리(기능당 6개 파일).
  기능 이름은 kebab-case다.
- `_agent/` — 세션 규칙(`_agent/rules/`)·스킬(`_agent/skills/`).

## 언어와 실행 환경

- 모든 코드는 TypeScript(`strict`)로 쓴다.
  `.js` 파일을 새로 만들지 않는다.
- 프레임워크 없이 만든다.
  화면은 `<canvas>` 2D(960×540)로 그리고, 소리는 Web Audio로 코드에서 합성한다.
  소리 파일은 쓰지 않는다.
- 개발 서버와 빌드는 Vite를 쓴다(`vite.config.ts`).
  패키지 매니저는 pnpm이다(`package.json`의 `packageManager`로 버전을 고정한다). Node 버전은 `.nvmrc`로 고정한다.
- 게임 화면의 배포는 Vercel이다. 설치·빌드·출력 폴더·보안 헤더·캐시 규칙은 `vercel.json`에 있다.
  온라인 대전 서버(Go)는 Vercel에 올릴 수 없으므로 서버의 Docker 컨테이너로 배포한다(`infra/README.md`).
  서버에 새 메시지를 더하는 변경은 서버를 먼저 배포한 뒤 게임 화면을 배포한다.
  `.vercel/`은 저장소에 올리지 않는다.
  보안 헤더나 CSP를 바꾸면 `index.html`의 CSP 메타와 `vercel.json`을 함께 맞추고 `pnpm run security`를 통과시킨다.
- 방문 분석은 Clicky(`index.html`의 `static.getclicky.com` 스크립트, 사이트 ID는 그 스크립트의 `data-id`)다.
  CSP는 `script-src`에 `static.getclicky.com`, `img-src`와 `connect-src`에 `in.getclicky.com`을 열어 두었고, 보안 점검의 허용 주소(`ALLOWED_HOSTS`)도 같다.
  게임 코드(`src/`)는 여전히 네트워크를 쓰지 않는다.
- 새 의존성은 실제로 필요한 최소한만 추가한다.

## 확인 도구

| 명령 | 하는 일 |
| --- | --- |
| `pnpm run typecheck` | 타입 검사(`tsc`, 게임 코드와 설정 파일) |
| `pnpm run lint` | 린트와 서식 검사(Biome). 세미콜론은 반드시 쓴다 |
| `pnpm test` | 테스트 실행(Vitest) |
| `pnpm run coverage` | 테스트와 커버리지. 문장·분기·함수·줄 모두 100퍼센트여야 통과한다 |
| `pnpm run guard` | TypeScript 7 금지, 커버리지 임계값(네 항목 모두 100), 양식 파일(`*.example`)이 원본과 값만 다른지, 마크다운 표기(굵은 글씨 소제목(FBPW 라벨 제외), 맨 주소, 제목 앞 빈 줄), 스펙 문서가 FBPW 템플릿과 같은 틀인지 검사 |
| `pnpm run check` | 가드, 타입 검사, 린트, 커버리지, 품질 점수, 서버 점검을 모두 실행한다 |
| `pnpm run build` | 타입 검사와 프로덕션 빌드(`dist/`) |
| `pnpm run bench` | 엔진과 컴퓨터 상대의 600프레임 계산 시간을 잰다(`src/testing/frame.bench.ts`, 결과는 `coverage/bench.json`) |
| `pnpm run budget` | 빌드 크기와 프레임당 계산 시간을 성능 예산과 비교한다(`_agent/checks/performance_budget.cjs`) |
| `pnpm run security` | 위험한 API, 외부 주소, 비밀값, CSP와 배포 헤더, 인라인 스크립트와 소스맵을 점검한다(`_agent/checks/security_scan.cjs`) |
| `pnpm run audit:dependencies` | 의존성의 알려진 취약점을 점검한다 |
| `pnpm run check:full` | 위 모든 점검을 순서대로 실행한다. 절차와 기준은 `_agent/skills/check/SKILL.md`다 |
| `pnpm run check:infra` | 서버 배포 파일의 정적 분석: `Dockerfile`(hadolint), Ansible 절차(ansible-lint production 기준), `infra/README.md`의 nginx 설정(`nginx -t`). Docker가 필요하다(`_agent/checks/infra_checks.cjs`) |
| `pnpm run check:server` | 서버(Go)의 서식, `go vet`, `staticcheck`, `-race` 테스트와 문장 커버리지 100퍼센트, 분기 커버리지 100퍼센트(`gobco`)를 점검한다(`_agent/checks/server_checks.cjs`) |

- 커밋하기 전에 `pnpm run check`가 통과해야 한다. 배포하기 전에는 `pnpm run check:full`이 통과해야 한다.
- 린트와 서식은 `npx biome check --write .`로 고친다.

## 개발 서버

- 포트는 **58969**로 고정이다(`vite.config.ts`의 `strictPort`).
  다른 포트로 피하지 않는다.
- 서버는 `./dev-server.sh start|stop|restart|status`로만 다룬다.
- 서버를 끌 때는 포트를 쓰는 프로세스의 실행 폴더가 이 저장소일 때 그 PID 하나만 끈다.
  `pkill`·`killall`, 이름으로 찾는 종료, `kill -9`는 쓰지 않는다.
  다른 프로세스가 포트를 쓰고 있으면 끄지 않고 알린다.

## 그림

- 캐릭터 그림은 `public/characters/`에 있다.
- 게임 속 크기와 비율은 실행 중인 게임 화면으로 확인한다.

## 영상

- 플레이 영상에는 배경음과 효과음을 항상 담는다.
  소리가 없거나 무음이면 실패로 끝낸다.
