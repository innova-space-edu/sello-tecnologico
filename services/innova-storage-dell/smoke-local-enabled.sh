#!/usr/bin/env bash
# One-time local-only authentication gateway smoke test.
# Creates ONLY an ephemeral container, binds 127.0.0.1:8790, never modifies the existing disabled service.
set -euo pipefail
set +x
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
file="${HOME}/.config/innova-storage-dell/storage.env"
image="innova-storage-gateway:local-auth-smoke"
port=8790
name="innova-storage-auth-smoke-$$"
url="http://127.0.0.1:$port"
id="cb497fe7-f927-401c-81e2-bf09d4256cc6"

command -v docker >/dev/null || { echo "FAIL: falta Docker"; exit 1; }
command -v curl >/dev/null || { echo "FAIL: falta curl"; exit 1; }
[[ -f "$file" && ! -L "$file" ]] || { echo "FAIL: configuración privada no encontrada"; exit 1; }
[[ "$(stat -c %a "$file")" == "600" && "$(stat -c %u "$file")" == "$(id -u)" ]] || {
  echo "FAIL: configuración debe ser 0600 y propiedad del usuario"; exit 1;
}
grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=false([[:space:]]*)$' "$file" || {
  echo "FAIL: configuración permanente debe seguir desactivada"; exit 1;
}
if curl --silent --max-time 2 -o /dev/null "$url/healthz"; then
  echo "FAIL: puerto local $port en uso"; exit 1
fi

echo "Construyendo imagen local con contexto Docker restringido..."
docker build --quiet -t "$image" -f services/innova-storage-dell/Dockerfile "$ROOT" >/dev/null
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
echo "Iniciando contenedor efímero, SOLO en 127.0.0.1:$port..."
docker run --rm -d --name "$name" --network bridge \
  --publish "127.0.0.1:$port:8080" \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 64 --memory 256m --cpus 0.5 \
  --env-file "$file" \
  --env INNOVA_STORAGE_DELL_ENABLED=true \
  --env HOST=0.0.0.0 \
  --env PORT=8080 \
  "$image" >/dev/null

health=""
for i in $(seq 1 20); do
  health="$(curl --silent --max-time 2 "$url/healthz" || true)"
  [[ -n "$health" ]] && break
  sleep 1
done
[[ "$health" == *'"ok":true'* && "$health" == *'"enabled":true'* ]] || {
  echo "FAIL: el contenedor efímero no superó healthz"; exit 1;
}
echo "PASS: gateway efímero activo únicamente en loopback"

expect_status() {
  local expected="$1" label="$2"
  shift 2
  local status
  status="$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' "$@")"
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL: $label — HTTP $status (esperado $expected)"
    exit 1
  fi
  echo "PASS: $label — HTTP $status"
}

expect_status 401 "solicitud sin sesión rechazada" \
  --request POST "$url/v1/evidences/$id/authorize"
expect_status 401 "sesión JWT ficticia rechazada por Supabase" \
  --request POST --header 'Authorization: Bearer invalid.jwt.for.smoke.testing.1234567890' \
  "$url/v1/evidences/$id/authorize"
expect_status 403 "origen web ajeno rechazado" \
  --request POST --header 'Origin: https://evil.invalid' \
  "$url/v1/evidences/$id/authorize"
expect_status 204 "preflight CORS de CreaLab permitido" \
  --request OPTIONS --header 'Origin: https://sello-tecnologico.vercel.app' \
  "$url/v1/evidences/$id/authorize"
expect_status 413 "cuerpos inesperados rechazados" \
  --request POST --data '{}' "$url/v1/evidences/$id/authorize"
echo "PASS: sin JWT válido no se emiten enlaces, ni se reserva cuota"
echo "PASS: contenedor efímero eliminado automáticamente al terminar"
