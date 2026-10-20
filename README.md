# 숲속대전 (Forest Clash)

귀여운 2D 대전 격투 게임입니다.
기본 시스템은 KOF 98 방식이며, 오리지널 캐릭터 두 명(고양이, 새싹)이 나옵니다.
버튼은 네 개이고, 컴퓨터 상대는 라운드가 올라갈수록 강해집니다.

## 실행

```bash
pnpm install
./dev-server.sh start
```

브라우저에서 <http://localhost:58969/>를 엽니다.
서버 상태와 종료는 `./dev-server.sh status`, `./dev-server.sh stop`입니다.
빌드는 `pnpm run build`입니다.

## 확인

```bash
pnpm run check
```

타입 검사, 린트, 테스트, 커버리지(100퍼센트), 코드 품질 점수를 확인합니다.
개별 명령은 `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run coverage`, `pnpm run score`입니다.

배포하기 전에는 빌드, 성능, 보안, 의존성 취약점까지 한 번에 점검합니다.

```bash
pnpm run check:full
```

항목과 기준은 `_agent/skills/check/SKILL.md`에 있습니다.

## 배포

Vercel에 배포합니다. 설치, 빌드, 출력 폴더, 보안 헤더, 캐시 규칙은 `vercel.json`에 있고, Node 버전은 `package.json`의 `engines.node`를 따릅니다.
`.vercel/`은 Vercel 명령줄 도구가 만드는 연결 정보이므로 저장소에 올리지 않습니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `src/engine/` | 전투 규칙과 판정(순수 로직) |
| `src/ai/` | 컴퓨터 상대 |
| `src/render/` | 화면 그리기와 효과 |
| `src/audio/` | 코드로 합성하는 효과음과 배경음악 |
| `src/input/` | 키보드 입력 |
| `src/game.ts`, `src/main.ts` | 게임을 묶고 시작하는 곳 |
| `src/testing/` | 테스트 도우미와 계산 시간 벤치마크(게임에 들어가지 않음) |
| `public/` | 배경, 로고, 캐릭터 그림 |
| `specs/` | 기능별 기획 문서 |
| `_agent/` | 작업 규칙, 스킬, 점검 스크립트 |
