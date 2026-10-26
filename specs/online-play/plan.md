# Implementation Plan: 온라인 대전

## Summary

타이틀 메뉴(`TitleMenu`)가 대전 방식을 고르고, 온라인 대전은 `OnlineSession`이 로그인, 접속, 대기, 대전, 결과 보고를 관리한다.
두 브라우저는 입력 지연 락스텝(`Lockstep`)으로 같은 엔진을 같은 프레임에 진행하고, Go 서버(`server/`)는 로그인 검증, 매칭, 입력 전달, 승패 기록을 맡는다.

## Requirements

1. 타이틀에서 세 가지 대전 방식을 고르고 기존 두 방식은 그대로 동작한다.
2. 온라인 대전은 구글 로그인 후 서버가 짝지어 준 상대와 겨룬다.
3. 두 브라우저가 같은 입력으로 같은 프레임을 진행한다.
4. 판이 끝나면 승패가 두 사람의 보고가 같을 때 한 번 기록된다.
5. 상대 입력이 늦어도 게임 속도가 유지되고, 서버까지의 핑이 화면에 보인다.
6. 구글 로그인의 장애(스크립트 실패, 공개 키 장애, 만료된 토큰)와 표시 이름에 견딘다.

## Critical Files

### New Files

- `src/menu.ts`, `menu.test.ts` — 타이틀 선택 메뉴(정사각형에 가까운 버튼 세 개의 자리와 누른 버튼 찾기)
- `src/demo.ts`, `demo.test.ts` — 타이틀 뒤에서 싸우는 배경 대전(별도 엔진)
- `src/online/stub-login.ts`, `stub-login.test.ts` — 개발 중 구글 없이 하는 stub 로그인
- `server/stub.go`, `stub_test.go` — 서버의 stub 토큰 검증(`AUTH_STUB`을 켰을 때만)
- `server/dev-server.sh` — 개발용 서버 켜고 끄기(이 서버만 다룸)
- `src/online/bits.ts`, `bits.test.ts` — 입력 8비트 부호화
- `src/online/lockstep.ts`, `lockstep.test.ts` — 프레임별 입력 모으기
- `src/online/protocol.ts`, `protocol.test.ts` — 서버 메시지 읽기와 보낼 메시지 만들기
- `src/online/web-socket.ts`, `web-socket.test.ts` — 서버와의 연결(웹소켓)
- `src/online/session.ts`, `session.test.ts` — 온라인 대전 흐름
- `src/online/google-login.ts`, `google-login.test.ts` — 구글 로그인
- `src/online/config.ts`, `config.test.ts` — 환경 값 읽기
- `src/online/create.ts`, `create.test.ts` — 온라인 흐름 만들기
- `src/env.d.ts` — 빌드 환경 값과 구글 로그인 객체의 형식
- `src/game-online.test.ts` — 메뉴와 온라인 대전이 게임과 이어지는지 확인
- `server/` — Go 서버(`main.go`, `handler.go`, `hub.go`, `auth.go`, `store.go`, `protocol.go`와 테스트, `README.md`)
- `.env.example` — 온라인 설정 값 이름
- `src/online/ping.ts`, `ping.test.ts` — 서버와의 왕복 시간(핑)을 1초마다 재고 평균을 낸다
- `src/online/token.ts`, `token.test.ts` — 구글 ID 토큰의 만료 시각을 읽어 만료되었거나 60초 안에 만료되는지 판정한다

### Modified Files

- `src/game.ts` — 화면 누름 처리, 버튼 위의 커서 모양, 온라인 프레임 진행, 일시정지 막기
- `src/controls.ts` — 캔버스 위의 마우스와 터치를 메뉴에 연결
- `src/engine/flow.ts`, `src/engine/index.ts` — 타이틀 지연 값 내보내기
- `src/render/screens.ts`, `scene.ts`, `view.ts`, `guide.ts`와 테스트 — 버튼 메뉴와 온라인 상황 그리기, 캐릭터를 그릴 엔진(`world`) 고르기
- `src/main.ts` — 온라인 흐름 연결
- `src/testing/canvas.ts` — 그리기 테스트용 View에 메뉴와 상황 추가
- `index.html`, `vercel.json` — 보안 정책에 구글 로그인과 웹소켓 허용, 팝업 허용
- `_agent/checks/security_scan.cjs` — 구글 로그인 주소 허용, 서버 통신은 한 파일에서만
- `src/loop.ts` — 진행하지 못한 프레임의 시간을 돌려받아 따라잡기(`update`가 진행했는지 돌려준다)
- `src/online/session.ts` — 시작할 때 남은 연결 닫기, 핑 재기와 값 내놓기
- `src/render/screens.ts`, `scene.ts`, `view.ts` — 오른쪽 아래 핑 표시(`drawPing`)
- `server/protocol.go`, `handler.go` — `ping`을 받으면 같은 시각을 `pong`으로 돌려준다
- `src/online/google-login.ts` — 로그인 창을 카드 모양으로 꾸미고 스크립트를 불러오지 못한 실패를 기억하지 않는다
- `vite.config.ts` — 서버 주소(`VITE_SERVER_URL`)의 출처를 보안 정책의 연결 허용에 더하는 `server-connection` 플러그인, 개발 서버가 `coverage`, `dist`, `server`, `infra`를 감시하지 않는다(검사를 돌릴 때마다 열려 있는 화면이 새로고침되는 것을 막는다)

### Reference Files

- `src/engine/flow.ts` — 타이틀에서 판을 시작하는 방법(1P가 누르면 컴퓨터, 2P만 누르면 둘이서)
- `src/input/keyboard.ts` — 1P 키 배치

## Architecture

### User Flow

```text
타이틀 → 메뉴에서 고르기
  ├ 컴퓨터 / 둘이서 → 엔진이 버튼 입력으로 판을 시작
  └ 온라인 → 로그인 → 접속 → 대기열 → 짝지어짐 → 같은 판 → 결과 보고 → 기록 → 타이틀
```

### Event Flow

```text
1. 캔버스를 누름(마우스, 터치) → 캔버스 그림 좌표로 변환 → TitleMenu.press → 누른 버튼의 방식
       ↓
2. 온라인: OnlineSession.start → 구글 로그인 → 웹소켓 접속 → hello(토큰)
       ↓
3. 서버: ready(이름, 승패) → 클라이언트 queue → matched(자리, 상대)
       ↓
4. 프레임마다: Lockstep.next(두 입력이 모였을 때만) → engine.step → submit(내 입력, 6프레임 뒤 번호)
   입력이 모이지 않으면 update가 false → 루프가 그 프레임의 시간을 돌려받아 나중에 따라잡는다
   1초마다 ping(보낸 시각) → 서버가 pong(같은 시각) → 왕복 시간의 평균을 화면에 보인다
       ↓
5. 판 종료: result(이긴 쪽) → 서버가 두 보고를 비교해 recorded 또는 error
```

### Domain Model

```text
TitleMenu
├── selected         마우스가 올라간 버튼(cpu, 2p, online, 없으면 null)
├── hover(point)     올라간 버튼을 갱신한다
└── press(point)     누른 점의 버튼을 돌려준다(choiceAt)

OnlineSession
├── state            idle, signingIn, connecting, waiting, playing, stopped
├── status           화면에 보일 현재 상황 한 줄
├── start / cancel / finish
└── nextInputs / submit / reportResult

Lockstep
├── submit(bits)     내 입력에 앞으로 진행할 프레임 번호를 붙여 돌려준다
├── receive(input)   상대 입력을 받아 둔다
└── next()           두 입력이 모인 프레임이면 슬롯 순서로 입력을 내준다

PingMeter
├── due()            보낼 때가 되었으면 보낼 시각을, 아니면 null을 돌려준다
├── record(sentAt)   돌아온 pong으로 왕복 시간 평균을 갱신한다(새 값 30퍼센트 반영)
└── milliseconds     화면에 보일 평균(재지 못했으면 null)

isExpired(token, now)  구글 토큰이 만료되었거나 60초 안에 만료되는가

Hub (서버)
├── online           접속한 계정(계정당 하나)
├── queue            대기열(먼저 들어온 사람이 1P)
└── Match            두 사람의 판과 보고
```

## Implementation Steps

### Step 1: Server - Go 서버

계정(구글 토큰 검증), 대기열 매칭, 입력 전달, 승패 기록을 한 허브에서 하나의 잠금으로 관리한다.

**Red:** `server/hub_test.go`, `auth_test.go`, `handler_test.go`, `store_test.go` — 인증, 매칭, 중계, 기록 일치와 불일치, 도중 이탈, 중복 접속, 저장 복원

**Green:** `server/hub.go`, `auth.go`, `handler.go`, `store.go`, `protocol.go`, `main.go`

**Refactoring:** 저장소와 구글 키 가져오기는 인터페이스 뒤에 두어 테스트에서 가짜를 쓴다.

### Step 2: Network Layer - 입력과 서버 메시지

입력을 8비트로 묶고, 프레임별 입력을 모으고, 서버 메시지를 검사해서 읽는다.

**Red:** `src/online/lockstep.test.ts`

```ts
  it('상대 입력이 도착해야 그 프레임을 진행하고, 없으면 기다린다', () => {
    const lockstep = new Lockstep(0, 1);
    lockstep.next();
    lockstep.submit(16);
    expect(lockstep.next()).toBeNull();
    lockstep.receive({ frame: 1, bits: 0 });
    expect(pressed(lockstep.next(), 0)).toBe(1);
  });
```

**Green:** `src/online/lockstep.ts`

```ts
  next(): Inputs | null {
    const pair = this.peek();
    if (!pair) {
      return null;
    }
    this.advance();
    return this.slot === 0 ? [decodePad(pair.mine), decodePad(pair.theirs)] : [decodePad(pair.theirs), decodePad(pair.mine)];
  }
```

**Refactoring:** 메시지 종류마다 읽는 방법을 표(`PARSERS`)에 모으고, 형식이 맞지 않으면 null로 버린다.

### Step 3: Session Layer - 온라인 흐름

로그인, 접속, 대기, 대전, 결과 보고를 상태로 관리한다.

**Red:** `src/online/session.test.ts`

```ts
  it('로그인하고 접속해 인사를 보낸 뒤 선수 정보를 받으면 대기열에 들어간다', async () => {
    const world = setup();
    world.session.start();
    await settle();
    world.handlers().open();
    world.say({ type: 'ready', name: '고양이', wins: 2, losses: 1 });
    expect(world.session.state).toBe('waiting');
    expect(types(world.sent)).toEqual(['hello', 'queue']);
  });
```

**Green:** `src/online/session.ts`

```ts
  private onReady(profile: Profile): void {
    this.state = 'waiting';
    this.status = `${profile.name} ${profile.wins}승 ${profile.losses}패 · 상대를 찾는 중`;
    this.send(clientMessage.queue());
  }
```

**Refactoring:** 서버 메시지 종류마다 처리를 표(`handlers`)로 고르고, 웹소켓과 구글 로그인은 바깥에서 주입받아 테스트에서 가짜로 바꾼다.

### Step 4: UI Layer - 메뉴와 게임 연결

타이틀 메뉴를 그리고, 마우스나 터치로 누른 방식을 엔진이 받는 입력으로 바꿔 판을 시작하며, 온라인 대전 중에는 락스텝으로 프레임을 진행한다.

**Red:** `src/game-online.test.ts`

```ts
  it('둘이서 버튼을 누르면 둘이서 대전을 시작한다', () => {
    const { game } = setup();
    frames(game, 25);
    press(game, 1);
    expect(game.engine.mode).toBe('2p');
  });
```

**Green:** `src/game.ts`

```ts
  private readonly starters: Record<StartChoice, () => Inputs> = {
    cpu: () => [{ A: true }, {}],
    '2p': () => [{}, { A: true }],
    online: () => {
      this.online?.start();
      return NO_INPUT;
    },
  };
```

**Refactoring:** 엔진은 그대로 두고 타이틀 입력만 바꿔 준다. 온라인 대전의 프레임 진행은 `OnlineFrame`(`src/online/frame.ts`)으로 나눈다.

### Step 5: Security - 보안 정책

구글 로그인 스크립트와 웹소켓을 허용하고 그 밖은 막는다.

**Red:** `pnpm run security`가 서버 통신 코드를 위반으로 잡는다.

**Green:** 서버 통신은 `src/online/web-socket.ts`에서만 허용하고, 구글 로그인 주소를 허용 목록에 더하며, `index.html`과 `vercel.json`의 보안 정책에 로그인 스크립트, 스타일, 프레임, 연결을 연다. 로그인 창이 열리도록 창 격리 정책을 팝업 허용 값으로 바꾼다.

**Refactoring:** 허용 주소는 점검 도구의 한 곳(`ALLOWED_HOSTS`, `ALLOWED_SCRIPT_SOURCES`)에서 관리한다.

### Step 6: Network Layer - 핑과 멈춘 시간 따라잡기

서버까지의 왕복 시간을 재서 보이고, 상대 입력을 기다린 시간 때문에 게임이 느려지지 않게 한다.

**Red:** `src/loop.test.ts`

```ts
it('진행하지 못한 프레임의 시간은 돌려받아 입력이 오면 따라잡는다', () => {
  const { loop, game, advance } = setup();
  game.update.mockReturnValueOnce(false);
  advance(34);
  loop.tick();
  expect(game.update).toHaveBeenCalledTimes(1);
  advance(17);
  loop.tick();
  expect(game.update).toHaveBeenCalledTimes(4);
});
```

**Green:** `src/loop.ts`, `src/online/ping.ts`, 서버 `server/handler.go`

```ts
private runDueSteps(): void {
  for (let steps = 0; this.accumulated >= this.stepMs && steps < MAX_STEPS_PER_TICK; steps++) {
    this.accumulated -= this.stepMs;
    if (!this.game.update()) {
      this.accumulated = Math.min(this.accumulated + this.stepMs, MAX_BACKLOG_MS);
      return;
    }
  }
}
```

`PingMeter`가 1초마다 `ping(보낸 시각)`을 보내게 하고, 서버는 받은 시각을 `pong`으로 그대로 돌려준다. 화면 오른쪽 아래에 평균을 `Ping Nms`로 그린다.

**Refactoring:** 서버의 접속 확인 간격은 전역 값이 아니라 `Server`의 필드로 받아 시험이 경쟁 조건 없이 값을 넣게 한다.

### Step 7: Session Layer - 구글 로그인의 장애에 견디기

**Red:** `src/online/token.test.ts`

```ts
it('만료까지 60초 이하로 남았으면 곧 만료되는 것으로 본다', () => {
  expect(isExpired(tokenWith({ exp: NOW + 60 }), NOW)).toBe(true);
  expect(isExpired(tokenWith({ exp: NOW + 61 }), NOW)).toBe(false);
});
```

**Green:** `src/online/token.ts`

```ts
export function isExpired(token: string, nowSeconds: number): boolean {
  const expiry = expiryOf(token);
  return expiry !== null && expiry - EXPIRY_MARGIN_SECONDS <= nowSeconds;
}
```

세션은 로그인한 토큰이 만료되지 않았을 때만 다시 쓴다. 스크립트를 불러오지 못한 실패는 기억하지 않아 다시 시도하면 다시 불러온다. 서버는 표시 이름에서 제어 문자를 빼고 앞뒤 공백을 지운 뒤 32글자까지만 쓰며, 공개 키를 가져오지 못해도 받아 둔 키로 확인하고 가져오기는 1분에 한 번만 시도한다.

**Refactoring:** 서버의 이름 거르기는 stub 이름과 같은 함수(`shortName`)를 쓴다.

### Step 8: Server - 보안 결함 고치기

**Red:** `server/hub_test.go`

```go
func TestLeavingAfterReportingDoesNotGiveTheWinToTheOtherPlayer(t *testing.T) {
	arena := newTable()
	first, second, _, secondBox := arena.matchedPair(t)
	arena.hub.Report(first, winnerOf(0))
	arena.hub.Disconnect(first)

	if secondBox.count("opponentLeft") != 1 || secondBox.count("recorded") != 0 {
		t.Fatalf("남은 사람이 받은 메시지 = %v", secondBox.types())
	}
```

**Green:** `server/hub.go`

```go
if !match.finished && match.reports[player.slot] == nil {
	hub.recordLocked(match, opponent.slot)
}
```

접속마다 1초 창으로 메시지를 세는 `rateLimiter`가 한도를 넘으면 오류를 보내고 접속을 끊는다. `Server`는 동시 접속 수를 세어 한도를 넘으면 503으로 거절한다. 로그인 오류는 `publicLoginErrors`에 있는 것만 사용자에게 보내고 나머지는 로그에 남긴다. 저장소 로그인은 `reserve`로 접속 상태를 먼저 잡은 뒤 허브의 잠금을 풀고 한다. 승패 기록(`recordLocked`)은 판을 끝난 것으로 표시한 뒤 `record`가 잠금 밖에서 저장하고 결과를 보낸다. 클라이언트의 `Lockstep.receive`는 지나갔거나 36000프레임보다 먼 입력을 버린다.

**Refactoring:** 한도 값은 `Server`의 필드(`messageLimit`, `maxConnections`)로 받아 시험이 전역 값을 바꾸지 않고 작은 값을 넣는다.

## Verification

### Build

```bash
pnpm run typecheck
```

### Test

```bash
pnpm run check:full
cd server && go test -race ./... -cover && go vet ./... && gofmt -l .
```

### Manual Test

1. 서버를 실행하고(`server/README.md`) 구글 클라이언트 아이디와 서버 주소를 `.env.local`에 넣어 개발 서버를 연다.
2. 타이틀에서 세 가지 대전 방식이 보이고 마우스를 올리면 강조되며 눌러서 고를 수 있는지, 폰에서도 눌러서 고를 수 있는지 본다.
3. 서로 다른 구글 계정의 두 브라우저로 온라인 대전을 골라 서로를 찾는지 본다.
4. 같은 판을 끝까지 진행하고 두 계정의 승패가 한 번씩만 기록되는지 본다.
5. 판 도중 한쪽이 나가면 남은 사람의 승으로 기록되는지 본다.

## Considerations

### 롤백 방식을 쓰지 않는 이유

롤백 방식은 상태를 저장하고 되감는 구현이 크다.
입력 지연 락스텝은 구현이 작고, 느린 쪽에 맞춰 멈추는 약점은 입력 지연으로 줄인다.

### 서버가 게임을 계산하지 않는다

엔진은 무작위와 현재 시각을 부르지 않으므로 같은 입력이면 같은 결과가 나온다.
그래서 서버는 입력을 전달만 하고, 승패는 두 사람의 보고가 같을 때만 기록해 한 사람의 거짓 보고를 막는다.

### 입력 지연과 멈춤은 맞바꾸는 값이다

입력 지연을 늘리면 멈춤이 줄지만 조작이 그만큼 늦게 반영된다(6프레임은 약 133밀리초).
멈춘 시간을 돌려받아 따라잡게 해서 짧은 지연이 게임을 계속 느리게 남기지 않게 한다.
두 사람이 서로 다른 컴퓨터에서 확인해 6프레임을 유지한다. 화면의 핑이 그 판단의 재료다.

### 새 메시지는 서버를 먼저 배포한다

새 화면은 `ping`을 보내므로 `ping`을 모르는 옛 서버는 오류(「알 수 없는 메시지입니다」)로 답하고, 화면은 오류를 받으면 대전을 끝낸다.
배포 순서는 `../server-infra/plan.md`에 있다.

### 입력 조작은 막지 못한다

입력을 전달만 하므로 클라이언트를 고쳐 부정하게 입력하는 것은 막지 못한다.
승패 기록에는 두 사람의 보고가 필요하므로 한 사람이 혼자 거짓 기록을 만들 수는 없다.
