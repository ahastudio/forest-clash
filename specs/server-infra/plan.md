# Implementation Plan: 서버 인프라

## Summary

Go 서버(`server/`)를 Docker 이미지(`server/Dockerfile`)로 만들고, Ansible(`infra/`)이 배포 컴퓨터에서 이미지를 빌드해 서버로 직접 올려 컨테이너를 띄운다.
앞에는 Cloudflare와 서버의 nginx를 둔다.

## Requirements

1. 서버를 Docker 이미지로 만든다.
2. 한 명령으로 서버에 배포한다.
3. 서버 상태를 읽기만 하는 점검 절차를 둔다.
4. 브라우저가 Cloudflare와 nginx를 거쳐 `wss`로 접속한다.
5. 배포 파일은 정적 분석을 지적 0건으로 통과한다.

## Critical Files

### New Files

- `server/Dockerfile` — 두 단계 이미지(빌드, 실행), 실행 사용자, `/data`, 상태 확인
- `server/.dockerignore` — 승패 기록 파일과 개발용 파일을 이미지에서 뺀다
- `infra/deploy.yml` — 빌드, 업로드, 컨테이너 교체, 상태 확인 대기
- `infra/status.yml` — 서버 상태 점검(읽기만)
- `infra/vars.yml.example`, `infra/inventory.ini.example` — 변수와 접속 정보 양식
- `infra/README.md` — 접속 경로, 설정, 배포, 점검, nginx와 Cloudflare 설정
- `_agent/checks/infra_checks.cjs` — 배포 파일의 정적 분석(`check:infra`)
- `_agent/checks/server_checks.cjs` — 서버(Go)의 서식, 정적 분석, 시험, 커버리지 점검(`check:server`)

### Modified Files

- `.gitignore` — `infra/inventory.ini`, `infra/vars.yml` 제외
- `package.json` — `check:infra`를 `check:full`에 포함
- `server/README.md` — 배포 절차는 `infra/README.md`에 있음을 알림
- `_agent/rules/tech-stack.md`, `README.md` — `infra/`와 서버 배포 방식

### Reference Files

- `server/main.go` — 환경 변수(`PORT`, `GOOGLE_CLIENT_ID`, `ALLOWED_ORIGIN`, `DATA_FILE`, `AUTH_STUB`)
- `server/store.go` — 임시 파일에 쓰고 이름을 바꾸는 저장 방식

## Architecture

### User Flow

```text
배포하는 사람 → deploy.yml 실행 → 서버에 새 컨테이너 → status.yml로 확인
플레이어 → 게임 화면(Vercel) → wss로 접속 → Cloudflare → nginx → 컨테이너
```

### Event Flow

```text
1. 배포 컴퓨터: docker buildx build(linux/amd64) → docker save | gzip
       ↓
2. 서버: 업로드 → docker load → 압축 파일 삭제
       ↓
3. 서버: 데이터 폴더 만들기(uid 10001, 0700), forest-clash 네트워크 만들기(없을 때)
       ↓
4. 서버: 기존 컨테이너 제거 → 새 컨테이너 실행(-p 58970:58970, -v 데이터 폴더:/data, 환경변수)
       ↓
5. 서버: /healthz가 200이 될 때까지 대기(최대 20번, 3초 간격)
```

### Domain Model

```text
Server (서버의 Docker)
├── forest-clash-server  컨테이너. 포트 58970, 하나만 띄운다
├── forest-clash         Docker 네트워크
└── /root/data/forest-clash  승패 기록 폴더. 컨테이너의 /data에 연결한다
```

## Implementation Steps

### Step 1: Image Layer - 서버 이미지

서버를 두 단계 이미지로 만들고, root가 아닌 사용자로 실행하며 스스로 상태를 확인하게 한다.

**Red:** 이미지를 빌드해 컨테이너를 띄우고 확인한다.

```bash
docker buildx build --platform linux/amd64 --load -t forest-clash-server:local server
docker run -d --name forest-clash-check -p 127.0.0.1:18971:58970 -e AUTH_STUB=1 forest-clash-server:local
curl http://127.0.0.1:18971/healthz   # ok
docker inspect forest-clash-check --format '{{.State.Health.Status}}'   # healthy
```

**Green:** `server/Dockerfile`

```dockerfile
FROM alpine:3.22
COPY --from=build /out/forest-clash-server /usr/local/bin/forest-clash-server
USER 10001:10001
ENV PORT=58970 DATA_FILE=/data/forest-clash-data.json
VOLUME /data
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD ["sh", "-c", "wget -qO- \"http://127.0.0.1:${PORT}/healthz\" || exit 1"]
ENTRYPOINT ["forest-clash-server"]
```

**Refactoring:** 실행 사용자를 이름이 아니라 번호로 적고 상태 확인을 JSON 형태로 바꿔 hadolint 지적을 없앴다.

### Step 2: Deploy Layer - 배포와 점검 절차

배포 컴퓨터에서 이미지를 빌드해 서버로 올리고 컨테이너를 교체하며, 상태 확인을 기다린다. 점검은 읽기만 한다.

**Red:** Ansible 문법 검사.

```bash
cd infra
ansible-playbook -i inventory.ini deploy.yml --syntax-check
ansible-playbook -i inventory.ini status.yml --syntax-check
```

**Green:** `infra/deploy.yml`

```yaml
    - name: Run server container
      no_log: true
      ansible.builtin.shell: |
        docker run -d --name {{ server_container_name }} \
          --restart always \
          --network={{ docker_network_name }} \
          --read-only \
          --cap-drop ALL \
          --security-opt no-new-privileges \
          --memory 256m \
          --pids-limit 256 \
          -p {{ server_host_port }}:{{ server_container_port }} \
          -v {{ server_data_path }}:/data \
```

**Refactoring:** 모든 모듈을 `ansible.builtin.*`로 적고, 파이프에 `pipefail`을, 명령에 `changed_when`을 더하고, 셸이 필요 없는 곳은 `command`로 바꿔 ansible-lint production 기준을 지켰다.

### Step 3: Docs Layer - nginx와 Cloudflare 설명

접속 경로, 설정, 배포, 점검, nginx 설정을 `infra/README.md`에 적는다.

**Red:** 문서의 nginx 설정을 컨테이너에서 검사한다.

```bash
nginx -t   # 다이제스트로 고정한 nginx 컨테이너 안에서, 업스트림은 127.0.0.1:58970으로 바꿔서
```

**Green:** `infra/README.md`

```nginx
location /ws {
    proxy_pass http://forest_clash_server;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
}
```

**Refactoring:** nginx 설정의 업스트림을 `upstream` 블록 한 곳에 두어 호스트에서 도는 nginx로 바꿀 때 한 줄만 고치게 했다.

### Step 4: Check Layer - 배포 파일 정적 분석

`Dockerfile`, Ansible 절차, 문서의 nginx 설정을 한 명령으로 점검한다.

**Red:** 틀린 `Dockerfile` 줄을 임시로 넣고 점검이 위반으로 잡는지 본다.

```bash
pnpm run check:infra   # Dockerfile 위반 2건(DL3066, DL3025)과 Ansible 지적
```

**Green:** `_agent/checks/infra_checks.cjs`

```js
const HADOLINT = 'hadolint/hadolint@sha256:...';
const ANSIBLE_LINT = 'pipelinecomponents/ansible-lint@sha256:...';
const NGINX = 'nginx@sha256:...';
```

**Refactoring:** 도구를 설치하지 않고 이미지 다이제스트를 고정해 Docker로 실행해, 같은 버전으로 반복해서 같은 결과를 얻게 했다.

## Verification

### Build

```bash
docker buildx build --platform linux/amd64 --load -t forest-clash-server:local server
```

### Test

```bash
pnpm run check:full
```

### Manual Test

1. `infra/vars.yml`과 `infra/inventory.ini`를 채우고 `deploy.yml`로 서버에 배포한다.
2. `status.yml`로 상태를 본다.
3. 서버의 nginx에 설정을 넣고 Cloudflare 프록시로 `wss` 접속을 확인한다.

## Considerations

### Vercel에 서버를 올리지 않는 이유

Vercel의 함수는 요청마다 잠깐 실행되고 끝나므로 연결을 계속 붙들고 대기열과 대전 상태를 메모리에 가지는 서버를 올릴 수 없다.
게임 화면(정적)만 Vercel에 두고 서버는 컨테이너로 띄운다.

### 컨테이너를 하나만 띄운다

서버가 대기열과 판을 메모리에 가지므로 여러 개로 늘리면 매칭이 갈라진다.
컨테이너를 다시 만들면 진행 중인 대전이 끊기므로 사람이 적은 때에 배포한다.

### 포트는 모든 인터페이스에 열린다

Docker가 연 포트는 `ufw` 규칙을 거치지 않는다.
Cloudflare를 거치지 않는 직접 접속을 막으려면 서버 앞단에서 58970을 nginx에서만 들어오게 제한해야 한다.

### 서버를 먼저 배포한다

새 화면이 새 메시지(예: `ping`)를 보내는데 옛 서버는 모르는 메시지에 오류로 답하고 화면은 오류를 받으면 대전을 끝낸다.
그래서 서버를 먼저, 게임 화면을 나중에 배포한다.
