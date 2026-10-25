# 서버 인프라

## Background

온라인 대전 서버(Go, `server/`)는 로컬에서만 켜고 끌 수 있었다.
서버는 연결을 계속 붙들고 대기열과 대전 상태를 메모리에 가지므로 요청마다 잠깐 실행되는 Vercel에 올릴 수 없다.
그래서 서버의 Docker 컨테이너로 띄우고, 앞에 Cloudflare와 nginx를 둔다.

## Goal

서버 이미지를 만들고 한 명령으로 서버에 배포하고 상태를 점검할 수 있다.
브라우저는 `wss://서버주소/ws`로 접속한다.

## How it works

### 접속 경로

```text
브라우저 --wss(443)--> Cloudflare --http(80)--> nginx --http(58970)--> forest-clash-server 컨테이너
```

- 웹소켓은 HTTP와 같은 포트를 쓴다. 연결은 HTTP 요청으로 시작해 웹소켓으로 전환된다. 브라우저는 443으로 접속한다. 서버 포트(58970)는 nginx가 연결하는 포트이므로, 직접 접속을 막으려면 서버 앞단에서 nginx에서만 들어오게 제한한다(`infra/README.md`).
- TLS는 Cloudflare가 끝낸다. Go 서버는 TLS를 모른다.
- nginx는 이 저장소가 띄우지 않는다. 서버에 있는 nginx가 `게임서버:58970`으로 연결한다. 설정 예시는 `infra/README.md`에 있다.

### 이미지

- `server/Dockerfile`은 두 단계다. `golang:1.27.3-alpine`에서 빌드하고 `alpine:3.22`에서 실행한다. Go 버전은 `go.mod`와 같다.
- 실행 사용자는 `forestclash`(uid 10001)이고, 승패 기록은 `/data`에 쓴다(`DATA_FILE=/data/forest-clash-data.json`).
- 컨테이너는 30초마다 `/healthz`로 스스로 상태를 확인한다.
- `server/.dockerignore`가 승패 기록 파일(`*.json`)과 개발용 파일을 이미지에서 뺀다.

### 배포

- 이미지는 레지스트리 없이 배포하는 컴퓨터에서 `linux/amd64`로 빌드해 `docker save`로 묶어 서버에 올린다. 태그는 배포 시각(UTC)이다.
- 컨테이너는 하나만 띄운다. 서버가 대기열을 메모리에 가지므로 여러 개로 늘리면 두 사람이 서로 다른 컨테이너에 붙어 매칭되지 않는다.
- 컨테이너 포트 58970을 호스트의 58970으로 그대로 내보낸다.
- 승패 기록 폴더는 서버의 폴더(`server_data_path`)를 컨테이너의 `/data`에 연결한다. 컨테이너를 지워도 기록이 남는다.
- 환경변수(`GOOGLE_CLIENT_ID`, `ALLOWED_ORIGIN`)는 `infra/vars.yml`에 둔다. `AUTH_STUB`은 넣지 않는다.
- 서버에 새 메시지를 더하는 변경은 서버를 먼저 배포한 뒤 게임 화면(Vercel)을 배포한다.

### 점검

`infra/status.yml`이 Docker 자동 시작, 네트워크, 컨테이너 상태와 재시작 정책, `/healthz`, 디스크와 데이터 폴더를 읽기만 해서 보여 준다.

## Related Documents

- [spec.md](spec.md): 요구사항 및 상세 스펙
- [plan.md](plan.md): 기술 구현 계획
- [tasks.md](tasks.md): 작업 계획 및 추적
- [findings.md](findings.md): 기술적 발견사항 및 결정
- [progress.md](progress.md): 세션별 작업 내역
- [../../infra/README.md](../../infra/README.md): 배포 절차, nginx와 Cloudflare 설정
- [../online-play/README.md](../online-play/README.md): 배포하는 온라인 대전 서버의 동작
