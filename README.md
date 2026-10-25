# 숲속대전 (Forest Clash)

귀여운 2D 대전 격투 게임입니다.
오리지널 캐릭터 두 명(고양이, 새싹)이 나옵니다.
버튼은 네 개이고, 컴퓨터 상대는 라운드가 올라갈수록 강해집니다.

## 실행

```bash
pnpm install
./dev-server.sh start
```

브라우저에서 <http://localhost:58969/>를 엽니다.
폰 같은 터치 기기에서 열면 화면에 조이스틱과 버튼이 나타납니다(컴퓨터에서는 보이지 않습니다).
서버 상태와 종료는 `./dev-server.sh status`, `./dev-server.sh stop`입니다.
타이틀에서 「혼자서 컴퓨터와」, 「같은 컴퓨터에서 둘이서」, 「온라인 대전」을 고릅니다. 온라인 대전은 로그인 후 서버에서 상대를 찾습니다. 개발 서버에서는 구글 없이 stub 로그인과 로컬 서버(58970 포트)로 바로 시험할 수 있고(`server/README.md`의 실행 방법), 구글 로그인과 배포에는 서버 주소와 구글 클라이언트 아이디를 `.env.example`의 이름대로 넣어야 합니다.
빌드는 `pnpm run build`입니다.

## 확인

```bash
pnpm run check
```

타입 검사, 린트, 테스트, 커버리지(100퍼센트), 코드 품질 점수, 서버(Go)의 서식과 정적 분석과 테스트와 커버리지(줄과 분기 100퍼센트)를 확인합니다.
개별 명령은 `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run coverage`, `pnpm run score`, `pnpm run check:server`입니다.

배포하기 전에는 빌드, 성능, 보안, 의존성 취약점, 서버 배포 파일(`Dockerfile`, Ansible, nginx 설정)의 정적 분석까지 한 번에 점검합니다.

```bash
pnpm run check:full
```

항목과 기준은 `_agent/skills/check/SKILL.md`에 있습니다.

## 배포

Vercel에 배포합니다. 설치, 빌드, 출력 폴더, 보안 헤더, 캐시 규칙은 `vercel.json`에 있고, Node 버전은 `package.json`의 `engines.node`를 따릅니다.
`.vercel/`은 Vercel 명령줄 도구가 만드는 연결 정보이므로 저장소에 올리지 않습니다.

온라인 대전 서버(Go)는 Vercel에 올릴 수 없어서 서버의 Docker 컨테이너로 배포합니다. 이미지는 `server/Dockerfile`이고, 배포 절차와 nginx, Cloudflare 설정은 `infra/README.md`에 있습니다.
서버가 새 메시지를 더하는 변경은 서버를 먼저 배포한 뒤 게임 화면을 배포합니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `src/engine/` | 전투 규칙과 판정(순수 로직) |
| `src/ai/` | 컴퓨터 상대 |
| `src/render/` | 화면 그리기와 효과 |
| `src/audio/` | 코드로 합성하는 효과음과 배경음악 |
| `src/input/` | 키보드 입력과 모바일 화면 조이스틱(1P) |
| `src/online/`, `src/menu.ts` | 온라인 대전(로그인, 접속, 프레임 동기화)과 타이틀 선택 메뉴 |
| `server/` | 온라인 대전 서버(Go: 계정, 매칭, 승패 기록)와 Docker 이미지 |
| `infra/` | 온라인 대전 서버 배포(Ansible, nginx와 Cloudflare 설명) |
| `src/game.ts`, `src/main.ts` | 게임을 묶고 시작하는 곳 |
| `src/testing/` | 테스트 도우미와 계산 시간 벤치마크(게임에 들어가지 않음) |
| `public/` | 배경, 로고, 캐릭터 그림 |
| `specs/` | 기능별 기획 문서 |
| `_agent/` | 작업 규칙, 스킬, 점검 스크립트 |
