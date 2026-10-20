#!/bin/bash
# 숲속대전 개발 서버 관리. 이 게임의 서버만 다룬다.
# 사용: ./dev-server.sh start | stop | restart | status
# 규칙: 다른 서버를 건드리지 않도록 이름 검색(pkill -f 등)을 쓰지 않는다.
#       포트 사용 프로세스를 찾고, 그 프로세스의 실행 폴더가 이 폴더일 때만 끈다.

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="$(grep -oE 'port: [0-9]+' "$DIR/vite.config.ts" | head -1 | grep -oE '[0-9]+')"
LOG="$DIR/.dev-server.log"

if [ -z "${PORT}" ]; then echo "vite.config.ts에서 포트를 읽지 못했습니다."; exit 1; fi

listener_pid() { lsof -ti tcp:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -1; }
pid_cwd() { lsof -a -p "$1" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-; }
is_ours() { [ "$(pid_cwd "$1")" = "$DIR" ]; }

status() {
  local pid; pid="$(listener_pid)"
  if [ -z "$pid" ]; then echo "꺼져 있음 (포트 ${PORT} 비어 있음)"; return 1; fi
  if is_ours "$pid"; then echo "실행 중 (pid $pid, http://localhost:${PORT}/)"; return 0; fi
  echo "포트 ${PORT}를 다른 프로세스가 쓰는 중 (pid $pid, 폴더 $(pid_cwd "$pid")). 건드리지 않음."; return 2
}

stop() {
  local pid; pid="$(listener_pid)"
  if [ -z "$pid" ]; then echo "이미 꺼져 있음"; return 0; fi
  if ! is_ours "$pid"; then
    echo "중단: 포트 ${PORT}를 쓰는 pid $pid는 이 게임의 서버가 아닙니다 (폴더 $(pid_cwd "$pid"))."; return 2
  fi
  kill "$pid" && echo "이 게임의 서버만 종료함 (pid $pid)"
  for i in 1 2 3 4 5 6 7 8 9 10; do [ -z "$(listener_pid)" ] && return 0; sleep 0.3; done
  echo "아직 종료되지 않음. 직접 확인하세요 (pid $pid)."; return 1
}

start() {
  local pid; pid="$(listener_pid)"
  if [ -n "$pid" ]; then
    if is_ours "$pid"; then echo "이미 실행 중 (pid $pid)"; return 0; fi
    echo "중단: 포트 ${PORT}를 다른 프로세스가 쓰는 중 (pid $pid, 폴더 $(pid_cwd "$pid"))."; return 2
  fi
  cd "$DIR" && nohup pnpm run dev > "$LOG" 2>&1 &
  for i in $(seq 1 20); do [ -n "$(listener_pid)" ] && break; sleep 0.5; done
  status
}

case "$1" in
  start) start ;;
  stop) stop ;;
  restart) stop && start ;;
  status) status ;;
  *) echo "사용: $0 start|stop|restart|status"; exit 1 ;;
esac
