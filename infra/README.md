# 숲속대전 — 인프라

기획과 결정은 `../specs/server-infra/`에 있다.

## 구성

| 대상 | 위치 | 배포 방법 |
| --- | --- | --- |
| 게임 화면 | Vercel (`vercel.json`) | Vercel 연동 |
| 온라인 서버(Go) | 서버의 Docker 컨테이너 | `infra/deploy.yml` (Ansible) |
| 서버 이미지 | `forest-clash-server:<배포 시각>` | 이 컴퓨터에서 빌드해 서버로 직접 올린다. 레지스트리는 쓰지 않는다 |
| 승패 기록 | 서버의 `/root/data/forest-clash` 폴더 | 컨테이너의 `/data`에 연결한다 |

접속 경로는 다음과 같다.

```text
브라우저 --wss(443)--> Cloudflare --http(80)--> nginx --http(58970)--> forest-clash-server 컨테이너
```

- 웹소켓은 HTTP와 같은 포트를 쓴다. 연결은 HTTP 요청으로 시작해 웹소켓으로 전환된다.
  브라우저는 `wss://서버주소/ws`(443)로 접속하므로 서버 포트(58970)를 바깥에 열지 않는다.
- 컨테이너는 포트 58970을 호스트의 58970으로 그대로 내보낸다(`-p 58970:58970`).
  바깥의 nginx가 `게임서버:58970`으로 연결하고, 배포 확인과 `status.yml`도 이 포트를 쓴다.
- 이 포트는 호스트의 모든 인터페이스에 열린다. Docker가 연 포트는 `ufw` 규칙을 거치지 않으므로,
  Cloudflare를 거치지 않는 직접 접속을 막으려면 서버 앞단(클라우드 방화벽 등)에서
  58970을 nginx에서만 들어오게 제한한다.
- 서버 앞에 Cloudflare를 두면 TLS는 Cloudflare가 끝낸다. 서버의 Go 프로그램은 TLS를 모른다.

## 파일

| 파일 | 내용 | 버전 관리 |
| --- | --- | --- |
| `deploy.yml` | 서버 배포 절차 | 포함 |
| `status.yml` | 서버 상태 점검. 읽기만 한다 | 포함 |
| `inventory.ini.example` | 서버 접속 정보 양식 | 포함 |
| `vars.yml.example` | 변수 양식. 값은 비어 있다 | 포함 |
| `inventory.ini` | 서버 IP와 접속 정보 | 제외 |
| `vars.yml` | 이미지 이름, 포트, 네트워크, 서버 환경변수 | 제외 |
| `../server/Dockerfile` | Go 서버 이미지. 빌드와 실행 두 단계다 | 포함 |
| `../server/.dockerignore` | 승패 기록 파일과 개발용 파일을 이미지에서 뺀다 | 포함 |

`inventory.ini`와 `vars.yml`은 `.gitignore`에 있다.
두 파일은 권한을 `600`으로 둔다.

## 설정

```bash
cd infra
pip install ansible
cp inventory.ini.example inventory.ini
cp vars.yml.example vars.yml
chmod 600 inventory.ini vars.yml
```

- `inventory.ini`: 서버 IP, 접속 사용자, 포트
- `vars.yml`: 이미지 이름, 컨테이너 이름, 포트, 네트워크 이름, 서버 환경변수

## 서버 환경변수

서버 환경변수는 서버의 파일이 아니라 `vars.yml`의 `server_env`에 둔다.
배포가 이 값을 컨테이너에 `-e`로 넘긴다.

| 이름 | 용도 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | 구글 ID 토큰의 대상(aud)과 비교한다. 운영에서는 반드시 채운다 |
| `ALLOWED_ORIGIN` | 웹소켓을 열 수 있는 출처. 브라우저가 보내는 출처는 서버 주소가 아니라 게임 화면을 여는 주소다(예: `https://game.example`) |

`AUTH_STUB`는 `server_env`에 넣지 않는다.
켜면 누구나 아무 이름으로 로그인할 수 있다.

값을 바꾸면 컨테이너를 다시 만들어야 적용된다.

## 게임 화면 쪽 설정

게임은 빌드할 때 `VITE_SERVER_URL`에서 서버 주소를 읽는다.
Vercel 프로젝트의 환경변수에 `wss://서버주소/ws`를 넣고 다시 배포한다.
화면의 보안 정책(CSP)은 `connect-src`에 `wss:`를 이미 열어 두어 따로 바꾸지 않는다.

### 구글 로그인 설정

온라인 대전은 구글 로그인을 쓴다. 구글 OAuth 클라이언트 ID 하나를 만들어 서버와 게임 화면이 함께 쓴다.

1. <https://console.cloud.google.com/apis/credentials>에서 프로젝트를 고르거나 새로 만든다.
2. 「OAuth consent screen」이 설정되어 있지 않으면 먼저 설정한다.
3. 「Credentials」 페이지에서 「Create credentials」를 누르고 「OAuth client ID」를 고른 뒤 「Application type」을 「Web application」으로 한다.
4. 「Authorized JavaScript origins」에 게임 화면을 여는 주소를 넣는다(예: `https://game.example`).
   경로와 끝의 `/`는 붙이지 않는다. `vars.yml`의 `ALLOWED_ORIGIN`과 같은 값이다.
5. 만들면 나오는 클라이언트 ID(`...apps.googleusercontent.com`)를 아래 두 곳에 같은 값으로 넣는다.

| 대상 | 위치 | 이름 |
| --- | --- | --- |
| 서버 | `vars.yml`의 `server_env` | `GOOGLE_CLIENT_ID` |
| 게임 화면 | Vercel 프로젝트의 환경변수 | `VITE_GOOGLE_CLIENT_ID` |

- 서버는 구글 ID 토큰의 대상(aud)을 `GOOGLE_CLIENT_ID`와 비교한다.
  비어 있고 `AUTH_STUB`도 꺼져 있으면 서버가 시작되지 않는다(`../server/main.go`).
- 게임은 빌드할 때 `VITE_GOOGLE_CLIENT_ID`를 읽는다. 값을 바꾸면 Vercel에서 다시 배포한다.
  비어 있으면 개발 서버에서만 stub 로그인을 쓴다(`../.env.example`).
- 서버 환경변수를 바꾸면 컨테이너를 다시 만들어야 적용된다(위 「서버 환경변수」).
- 화면의 보안 정책(CSP)은 `accounts.google.com`을 이미 열어 두어 따로 바꾸지 않는다.

## 이미지는 직접 올린다

`deploy.yml`이 이 컴퓨터에서 `server/Dockerfile`로 `linux/amd64` 이미지를 빌드하고,
`docker save`로 묶어 서버에 올린 뒤 `docker load`로 푼다.
태그는 배포 시각(UTC, `20261018-153000` 형태)이고 `latest`도 함께 붙는다.
이 컴퓨터에 Docker가 있어야 한다.

배포 없이 이미지만 만들어 확인하려면 저장소 루트에서 실행한다.

```bash
docker buildx build --platform linux/amd64 --load -t forest-clash-server:local server
```

## nginx와 Cloudflare

nginx는 이 저장소가 띄우지 않는다. 서버에 있는 nginx가 게임 서버(`게임서버:58970`)로 연결한다.
컨테이너는 포트 58970을 호스트에 내보내므로, nginx는 서버의 주소와 이 포트로 접근한다.
호스트에서 도는 nginx이면 `127.0.0.1`로 접근한다.
아래 설정을 nginx 설정 폴더(예: `conf.d/forest-clash.conf`)에 넣는다.
`server_name`은 게임이 접속할 서버 주소(`VITE_SERVER_URL`의 호스트)로 바꾼다.

```nginx
# 웹소켓 요청이면 연결을 전환하고, 아니면 닫는다.
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream forest_clash_server {
    # nginx가 호스트에서 돌면 127.0.0.1:58970으로 바꾼다.
    server forest-clash-server:58970;
}

server {
    listen 80;
    server_name api.example.com;

    location /ws {
        proxy_pass http://forest_clash_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        # 대전은 길어질 수 있으므로 읽기 제한을 넉넉히 둔다. 서버가 주기적으로 ping을 보내 연결은 계속 살아 있다.
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location /healthz {
        proxy_pass http://forest_clash_server;
    }
}
```

- 서버가 출처를 검사하므로 `Origin` 헤더는 그대로 넘긴다(nginx는 기본으로 넘긴다).
  `ALLOWED_ORIGIN`은 서버 주소가 아니라 게임 화면을 여는 주소다.
- 설정을 고친 뒤 `nginx -t`로 검사하고 다시 읽는다(`nginx -s reload`).
- `/ws`와 `/healthz` 말고는 넘기지 않는다. 서버에는 이 두 주소만 있다.

Cloudflare에서는 해당 주소의 프록시(주황 구름)를 켜고
SSL/TLS 모드를 서버 구성에 맞춘다.
웹소켓은 Cloudflare 프록시를 지나간다.
Cloudflare가 프록시하는 포트는 정해져 있으므로, 서버 포트(58970)를 직접 열어 접속시키지 않고
443을 거치게 한다.

## 배포

```bash
cd infra
ansible-playbook -i inventory.ini deploy.yml
```

실행 순서:

1. 이 컴퓨터에서 이미지 빌드 후 압축 파일로 저장
2. 서버로 업로드하고 `docker load`. 끝나면 서버와 이 컴퓨터의 압축 파일은 지운다
3. 승패 기록 폴더를 만든다(소유자 uid 10001, 권한 `0700`). 안의 파일은 건드리지 않는다
4. `forest-clash` Docker 네트워크가 없으면 만든다
5. 기존 서버 컨테이너 제거. 없으면 건너뛴다
6. 서버 컨테이너 실행. `forest-clash` 네트워크, 호스트 포트 `58970`,
   `--restart always`, 데이터 폴더 연결, `server_env`의 환경변수
7. `/healthz`가 200이 될 때까지 대기. 되지 않으면 실패로 끝난다

컨테이너 실행 단계는 환경변수 값이 로그에 남지 않도록 출력을 숨긴다.
이 절차는 서버 배포를 지시받았을 때만 실행한다.

## 점검

배포 파일(`server/Dockerfile`, `deploy.yml`, `status.yml`, 이 문서의 nginx 설정)의 정적 분석은
저장소 루트에서 `pnpm run check:infra`로 한다(hadolint, ansible-lint production 기준, `nginx -t`). Docker가 필요하다.

서버 상태는 아래 절차로 읽는다.

```bash
cd infra
ansible-playbook -i inventory.ini status.yml
```

읽기만 한다.
Docker 자동 시작, 네트워크, 컨테이너 상태와 재시작 정책, `/healthz`,
디스크와 데이터 폴더를 한 번에 보여 준다.

## 주의

- 서버는 매칭 대기열과 대전을 메모리에 들고 있어 컨테이너를 하나만 띄운다.
  여러 개로 늘리면 두 사람이 서로 다른 컨테이너에 붙어 매칭되지 않는다.
- 컨테이너를 다시 만들면 진행 중인 대전은 끊긴다. 사람이 적은 때에 배포한다.
- 승패 기록 폴더(`server_data_path`)는 지우거나 이동하지 않는다.
  기록에는 이름과 승패가 들어 있다. 저장소에 넣지 않는다.
- 서버에서 직접 명령을 실행했다면 같은 내용을 이 문서와 `vars.yml`에 반영한다.
