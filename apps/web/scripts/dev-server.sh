#!/usr/bin/env bash
# Start/stop/restart the demo-mode dev server detached from the calling shell.
# Usage: scripts/dev-server.sh start|stop|restart [port]
set -euo pipefail
cmd="${1:-start}"; port="${2:-3000}"
here="$(cd "$(dirname "$0")/.." && pwd)"
log="${VOYA_DEV_LOG:-/tmp/voya-dev-$port.log}"

stop() {
  # Kill whatever listens on the port (Next's dev server + its workers), nothing else.
  local pids; pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$pids" ]] && kill $pids 2>/dev/null || true
  sleep 1
}
start() {
  cd "$here"
  VOYA_DEMO=1 NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$port" setsid nohup pnpm exec next dev -p "$port" >"$log" 2>&1 < /dev/null &
  for _ in $(seq 1 40); do
    curl -sf "http://127.0.0.1:$port/api/health" >/dev/null 2>&1 && { echo "dev server up on :$port (log: $log)"; return 0; }
    sleep 1
  done
  echo "dev server failed to start; tail of log:"; tail -20 "$log"; return 1
}
case "$cmd" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  *) echo "usage: $0 start|stop|restart [port]"; exit 2 ;;
esac
