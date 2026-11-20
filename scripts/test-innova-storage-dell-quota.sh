#!/usr/bin/env bash
# Local disposable PostgreSQL; no Supabase connection, no real data, no exposed port.
set -euo pipefail
cd "$(dirname "$0")/.."
image="${INNOVA_TEST_PG_IMAGE:-postgres:17}"
docker image inspect "$image" >/dev/null || { echo "No existe la imagen local $image; no se descargará automáticamente."; exit 1; }
name="innova-r2-quota-test-$(python3 -c 'import secrets; print(secrets.token_hex(8))')"
tmp="$(mktemp -d)"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
docker run -d --name "$name" --network none --memory 384m --cpus 1 --tmpfs /var/lib/postgresql/data:rw,size=256m -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
for i in $(seq 1 60); do
  if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null
psql_local() { docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
psql_local -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;"
psql_local < scripts/innova-storage-read-registry.review.sql
psql_local < scripts/innova-storage-dell-quota.review.sql
psql_local < scripts/test-innova-storage-dell-quota.sql
# 60 simultaneous requests by one synthetic user; exactly 40 may reserve.
seq 1 60 | xargs -P 10 -I{} sh -c 'docker exec "$1" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -c "set role service_role; select public.innova_reserve_r2_gateway_read('\''30000000-0000-0000-0000-000000000001'\'','\''10000000-0000-0000-0000-000000000001'\'');" > "$2/$3"' sh "$name" "$tmp" {}
accepted="$(grep -hxc t "$tmp"/* | awk '{s+=$1} END {print s}')"
rejected="$(grep -hxc f "$tmp"/* | awk '{s+=$1} END {print s}')"
test "$accepted" = 40 && test "$rejected" = 20
test "$(psql_local -qAt -c "select operations from public.innova_r2_read_usage where period_kind='day'")" = 40
echo "PASS: concurrency — accepted=$accepted rejected=$rejected"
echo "PASS: disposable database; no production changes"
