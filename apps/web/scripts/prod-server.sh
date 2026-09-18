#!/usr/bin/env bash
# Build (unless --no-build) and run the production server in demo mode, detached.
# Usage: scripts/prod-server.sh start|stop|restart [port] [--no-build]
set -euo pipefail
cmd="${1:-start}"; port="${2:-3001}"; nobuild="${3:-}"
here="$(cd "$(dirname "$0")/.." && pwd)"
log="${VOYA_PROD_LOG:-/tmp/voya-prod-$port.log}"
export VOYA_DEMO=1 NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$port" VOYA_RATE_LIMIT_CAPACITY="${VOYA_RATE_LIMIT_CAPACITY:-1000}"

listeners() {
  # Whatever tool is available: lsof, fuser, or ss. Prints PIDs (may be empty).
  { lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true; }
  { fuser "$port"/tcp 2>/dev/null | tr -s ' ' '\n' || true; }
  { ss -ltnp 2>/dev/null | grep -E ":$port\b" | grep -oE 'pid=[0-9]+' | cut -d= -f2 || true; }
}
port_free() { ! (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null; }

stop() {
  local pids; pids="$(listeners | sort -u | tr '\n' ' ')"
  [[ -n "${pids// /}" ]] && kill $pids 2>/dev/null || true
  for _ in $(seq 1 20); do port_free && return 0; sleep 0.5; done
  pids="$(listeners | sort -u | tr '\n' ' ')"
  [[ -n "${pids// /}" ]] && kill -9 $pids 2>/dev/null || true
  sleep 1
  port_free || { echo "could not free port $port"; return 1; }
}
start() {
  cd "$here"
  port_free || { echo "port $port is busy — run '$0 stop $port' first"; return 1; }
  [[ "$nobuild" == "--no-build" ]] || pnpm exec next build >"$log.build" 2>&1 || { echo "build failed:"; tail -30 "$log.build"; return 1; }
  setsid nohup pnpm exec next start -p "$port" >"$log" 2>&1 < /dev/null &
  for _ in $(seq 1 40); do
    curl -sf "http://127.0.0.1:$port/api/health" >/dev/null 2>&1 && { echo "prod server up on :$port (built $(date -r "$here/.next/BUILD_ID" '+%H:%M:%S'))"; return 0; }
    sleep 1
  done
  echo "prod server failed to start:"; tail -20 "$log"; return 1
}
case "$cmd" in
  start) start ;; stop) stop ;; restart) stop; start ;;
  *) echo "usage: $0 start|stop|restart [port] [--no-build]"; exit 2 ;;
esac
