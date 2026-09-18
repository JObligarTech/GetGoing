#!/usr/bin/env bash
# Spins up a throwaway PostgreSQL 16 cluster, applies the auth shim, all migrations
# and the seed, then runs the RLS test suite. Used in CI and locally when the
# Supabase CLI/Docker aren't available. Requires: postgresql-16 binaries.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/.."
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA="${VOYA_PGDATA:-/tmp/voya-pg}"
PORT="${VOYA_PGPORT:-55432}"
export PGHOST=127.0.0.1 PGPORT=$PORT PGUSER=voya PGDATABASE=voya PGPASSWORD=voya

# Postgres refuses to run as root; drop to the postgres user for server processes.
if [[ "$(id -u)" == "0" ]]; then
  pg() { runuser -u postgres -- "$PGBIN/$1" "${@:2}"; }
else
  pg() { "$PGBIN/$1" "${@:2}"; }
fi
cleanup() { pg pg_ctl -D "$DATA" stop -m fast >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$DATA"; mkdir -p "$DATA"; [[ "$(id -u)" == "0" ]] && chown postgres "$DATA"
pg initdb -D "$DATA" -U voya --auth=trust >/dev/null
pg pg_ctl -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/log" start >/dev/null
"$PGBIN/createdb" -h 127.0.0.1 -p "$PORT" -U voya voya 2>/dev/null || true

psql -v ON_ERROR_STOP=1 -q -f "$here/shim/auth_shim.sql"
for f in "$root"/migrations/*.sql; do
  echo "→ $(basename "$f")"; psql -v ON_ERROR_STOP=1 -q -f "$f"
done
if [[ "${VOYA_SEED:-1}" == "1" ]]; then
  echo "→ seed"; psql -v ON_ERROR_STOP=1 -q -f "$root/seed/seed.sql"
fi

echo "→ rls tests"
export VOYA_TEST_DATABASE_URL="postgresql://voya:voya@127.0.0.1:$PORT/voya"
cd "$root/.." && pnpm --filter @voya/core exec vitest run --config vitest.db.config.ts
