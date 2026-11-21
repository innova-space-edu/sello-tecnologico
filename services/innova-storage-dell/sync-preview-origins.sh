#!/usr/bin/env bash
# Add the deployment-specific and stable branch-preview hosts to Dell CORS.
# Recreates ONLY the new innova-storage-dell-prod container to load the 0600 env.
# Requires HTTPS public security checks before touching the running container.
set -euo pipefail
set +x
umask 077
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
envfile="$HOME/.config/innova-storage-dell/storage.env"
compose="$root/services/innova-storage-dell/compose.production.yml"
image="innova-storage-gateway:prod-candidate"
[[ -f "$envfile" && ! -L "$envfile" && -r "$envfile" ]] || { echo "FAIL: no se encontró config privada"; exit 1; }
[[ "$(stat -c %a "$envfile")" == "600" && "$(stat -c %u "$envfile")" == "$(id -u)" ]] || { echo "FAIL: configuración privada requiere modo 0600"; exit 1; }
grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=false([[:space:]]*)$' "$envfile" || { echo "FAIL: el piloto debe seguir desactivado"; exit 1; }
[[ "$(docker inspect -f '{{.State.Running}}' innova-storage-dell-prod 2>/dev/null || true)" == true ]] || { echo "FAIL: falta contenedor de producción local"; exit 1; }
docker image inspect "$image" >/dev/null 2>&1 || { echo "FAIL: imagen de producción ausente"; exit 1; }

# Must prove that Cloudflare HTTPS is connected AND refuses unauthorized access.
bash services/innova-storage-dell/smoke-public-gateway.sh

stable="https://sello-tecnologico-git-feat-innova-stora-351f49-innova-space-edu.vercel.app"
unique="https://sello-tecnologico-9xgipzoem-innova-space-edu.vercel.app"
bash services/innova-storage-dell/add-allowed-preview-origin.sh "$stable"
bash services/innova-storage-dell/add-allowed-preview-origin.sh "$unique"

network="$(docker inspect -f '{{range $n, $_ := .NetworkSettings.Networks}}{{println $n}}{{end}}' innova-storage-dell-prod | head -n 1)"
[[ -n "$network" ]] || { echo "FAIL: no se identificó la red Docker actual"; exit 1; }
export INNOVA_SHARED_TUNNEL_NETWORK="$network"
export INNOVA_STORAGE_ENV_FILE="$envfile"
docker compose --project-name innova-storage-dell-production -f "$compose" config --quiet ||
  { echo "FAIL: Compose no valida. La configuración privada fue actualizada, pero no se reinició ningún contenedor."; exit 1; }
echo "Actualizando únicamente el gateway de producción local para usar los dos orígenes de Preview..."
docker compose --project-name innova-storage-dell-production -f "$compose" up -d --no-build --no-deps --force-recreate
for i in $(seq 1 20); do
  health="$(curl -sS --max-time 3 http://127.0.0.1:8789/healthz 2>/dev/null || true)"
  [[ "$health" == *'"ok":true'* && "$health" == *'"enabled":true'* ]] && break
  sleep 1
done
[[ "${health:-}" == *'"ok":true'* && "$health" == *'"enabled":true'* ]] || { echo "FAIL: gateway local no pasó healthz"; exit 1; }
echo "PASS: gateway recreado con credenciales locales, enabled=true, en loopback 8789"

for origin in "$stable" "$unique"; do
  status="$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' -X OPTIONS \
    -H "Origin: $origin" \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: authorization' \
    https://storage-api.innova-space-edu.cl/v1/evidences/cb497fe7-f927-401c-81e2-bf09d4256cc6/authorize)"
  [[ "$status" == 204 ]] || { echo "FAIL: CORS del origen Preview no aprobado, HTTP $status"; exit 1; }
  echo "PASS: CORS Preview habilitado para $origin"
done
bash services/innova-storage-dell/smoke-public-gateway.sh
pilot="$(curl -sS --max-time 3 http://127.0.0.1:8788/healthz || true)"
[[ "$pilot" == *'"enabled":false'* ]] || { echo "FAIL: estado inesperado del piloto :8788"; exit 1; }
echo "PASS: piloto :8788 permanece desactivado; DNS y Tunnel sin cambios adicionales"
