---
name: check
description: 테스트, 커버리지, 정적 분석, 품질 점수, 성능, 보안, 빌드, 의존성 취약점을 한 번에 점검한다. 커밋 전, 배포 전, 품질이나 완료를 보고하기 전에 쓴다.
---

숲속대전의 전체 점검 절차다.
명령 하나(`pnpm run check:full`)로 모든 항목을 순서대로 실행하고, 어느 한 단계라도 실패하면 거기서 멈춘다.

## 언제 쓰나

- 커밋하기 전, 배포하기 전.
- 품질이 좋다거나 끝났다고 보고하기 전.
- 의존성을 바꾼 직후, 빌드 설정(`vite.config.ts`, `vercel.json`)을 고친 직후.
- 코드만 빠르게 확인할 때는 `pnpm run check`만 돌려도 된다(1~5번).

## 실행

```bash
pnpm run check:full
```

PATH에 pnpm이 없으면 `.nvmrc`의 Node 버전과 `packageManager`의 pnpm 버전을 설치해 PATH에 먼저 둔다.

## 점검 항목 (실행 순서)

| 순서 | 영역 | 명령 | 통과 기준 |
| --- | --- | --- | --- |
| 1 | 가드 | `pnpm run guard` | TypeScript 7이 아니고, 커버리지 임계값 네 개(문장·분기·함수·줄)가 모두 100이며 측정에서 빠진 경로가 테스트 파일과 테스트 도우미뿐이다 |
| 2 | 정적 분석: 타입 | `pnpm run typecheck` | `tsc` 오류 0건 |
| 3 | 정적 분석: 린트·서식 | `pnpm run lint` | Biome 오류와 경고 0건 |
| 4 | 테스트·커버리지 | `pnpm run coverage` | 테스트 전부 통과, 줄과 분기를 포함해 문장·분기·함수·줄 네 항목 모두 100퍼센트(`vite.config.ts`의 임계값 네 개가 모두 100) |
| 5 | 코드 품질 | `pnpm run score` | 총점 95 이상(현재 100) |
| 6 | 빌드 | `pnpm run build` | 타입 검사와 `vite build` 성공 |
| 7 | 성능: 계산 시간 | `pnpm run bench` | 측정이 끝나고 `coverage/bench.json`이 만들어진다 |
| 8 | 성능: 예산 | `pnpm run budget` | 아래 「성능 예산」을 모두 지킨다 |
| 9 | 보안: 정적 점검 | `pnpm run security` | 위반 0건 |
| 10 | 보안: 의존성 | `pnpm run audit:dependencies` | 알려진 취약점 0건 |

## 성능 예산 (`_agent/checks/performance_budget.cjs`)

| 항목 | 기준 |
| --- | --- |
| 스크립트 압축 크기 | 60kB 이하 |
| 파일 하나의 최대 크기 | 400kB 이하 |
| 빌드 결과 전체 | 3MB 이하 |
| 첫 페이지(`index.html`) | 4kB 이하 |
| 프레임당 계산 시간(엔진과 컴퓨터 상대, 가장 느린 측정) | 한 프레임(16.7ms)의 5퍼센트인 0.83ms 이하 |

프레임당 계산 시간은 `src/testing/frame.bench.ts`가 가장 센 컴퓨터 둘의 600프레임을 재서 정한다.
기준을 넘으면 기준을 올리지 않고 원인(큰 그림, 늘어난 번들, 느려진 계산)을 고친다.

## 보안 점검 (`_agent/checks/security_scan.cjs`)

- 게임 코드에 `eval`, `new Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`가 없다.
- 게임 코드에 네트워크와 창 사이 통신 API(`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `postMessage`, `importScripts`)가 없다. 이 게임은 서버와 통신하지 않는다. 쓰게 되면 이 점검과 CSP를 함께 바꾼다.
- 코드, 페이지, 그림, `vercel.json`에 외부 주소와 비밀값(키, 토큰, 비공개 키)이 없다.
- `index.html`의 CSP 메타가 `script-src 'self'`만 허용하고 `unsafe-eval`을 허용하지 않는다.
- `vercel.json`에 CSP(`frame-ancestors 'none'` 포함), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`가 모두 있다.
- `.gitignore`가 `.env`를 막는다. 빌드 결과에 인라인 스크립트와 소스맵이 없다.

## 실패했을 때

- 출력의 첫 오류부터 읽고 원인을 고친 뒤 실패한 단계부터 다시 실행한다. 마지막에는 `pnpm run check:full`을 처음부터 다시 돌려 전부 통과하는지 본다.
- 점검을 건너뛰거나 기준을 낮추거나 파일을 점검 대상에서 빼서 통과시키지 않는다.
- 누가 만든 문제인지 가리지 않고 같은 작업 안에서 고친다.
- 고치지 못하는 항목은 「못 고친 것: 항목, 사유」로 적는다. 사유는 사용자만 아는 사실, 접근 불가, 다른 사람이 진행 중인 변경, 사용자의 금지 넷 가운데 하나여야 한다.

## 보고 형식

명령 출력을 그대로 옮긴다. 요약으로 바꾸지 않는다.

- 단계별 종료 코드와 결과 한 줄(테스트 N건 통과, 커버리지 네 항목, 품질 총점, 번들 크기, 성능 예산 다섯 항목, 보안 위반 N건, 취약점 N건).
- 「발견 N건, 고침 N건(증거), 못 고침 N건(사유)」.
- 측정하지 못한 영역은 「측정하지 않음」으로 따로 적는다. 이 점검이 재지 못하는 것은 실제 기기의 첫 프레임 지연, 모바일 성능, 배포된 사이트의 응답 헤더다. 배포 뒤에는 브라우저 개발자 도구의 Network 탭에서 응답 헤더를 직접 확인한다.

## 이 스킬을 고칠 때

- 점검 항목을 더하면 `package.json`의 `check:full`, 이 표, `_agent/rules/tech-stack.md`의 「확인 도구」 표, `README.md`의 「확인」을 같은 날 함께 고친다.
- 기준 숫자를 바꿀 때는 `performance_budget.cjs`의 `BUDGET`과 이 문서의 표를 함께 바꾸고, 올려야 하는 이유를 커밋 메시지에 적는다.
