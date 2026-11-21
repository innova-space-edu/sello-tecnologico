#!/usr/bin/env bash
# Controlled Dell production-candidate activation. NO Cloudflare, DNS or Vercel writes.
# Prerequisite: real admin PASS and real unrelated DOCENTE denied HTTP 404.
set -euo pipefail
set +x
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
config="$HOME/.config/innova-storage-dell/storage.env"
compose="$ROOT/services/innova-storage-dell/compose.production.yml"
image="innova-storage-gateway:prod-candidate"
project="innova-storage-dell-production"
container="innova-storage-dell-prod"

[[ -f "$config" && ! -L "$config" && -r "$config" ]] || { echo "FAIL: no existe configuración privada"; exit 1; }
[[ "$(stat -c %a "$config")" == "600" && "$(stat -c %u "$config")" == "$(id -u)" ]] || { echo "FAIL: configuración privada debe pertenecer al usuario y ser 0600"; exit 1; }
grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=false([[:space:]]*)$' "$config" || { echo "FAIL: mantener la configuración persistente desactivada"; exit 1; }
command -v docker >/dev/null && docker compose version >/dev/null || { echo "FAIL: falta Docker Compose"; exit 1; }
command -v curl >/dev/null || { echo "FAIL: falta curl"; exit 1; }
[[ -r "$compose" ]] || { echo "FAIL: falta compose.production.yml"; exit 1; }

[[ "$(docker inspect -f '{{.State.Running}}' intranet-tunnel 2>/dev/null || true)" == true ]] || {
  echo "FAIL: intranet-tunnel no está en ejecución"; exit 1;
}
if docker inspect "$container" >/dev/null 2>&1; then
  echo "FAIL: el contenedor de producción ya existe; no se sobrescribirá. Revisa su estado por separado."
  exit 1
fi
if curl -sS --max-time 2 -o /dev/null http://127.0.0.1:8789/healthz 2>/dev/null; then
  echo "FAIL: puerto de prueba 8789 ocupado; sin cambios."
  exit 1
fi

# Use the existing tunnel's network, not a host-port proxy or a second Tunnel.
# Detect which network resolves the existing internal service named portal.
mapfile -t candidates < <(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' intranet-tunnel)
image_probe="innova-storage-gateway:local-auth-smoke"
docker image inspect "$image_probe" >/dev/null 2>&1 || { echo "FAIL: no existe imagen local-auth-smoke"; exit 1; }
networks=()
for candidate in "${candidates[@]}"; do
  [[ -n "$candidate" ]] || continue
  if docker run --rm --network "$candidate" --read-only --cap-drop ALL \
    --security-opt no-new-privileges --pids-limit 32 --memory 128m \
    --entrypoint node "$image_probe" -e \
    "fetch('http://portal:3000',{signal:AbortSignal.timeout(5000)}).then(()=>process.exit(0)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    networks+=("$candidate")
  fi
done
if [[ "${#networks[@]}" -ne 1 ]]; then
  echo "FAIL: no se identificó exactamente una red compartida entre intranet-tunnel y portal."
  echo "Revisar docker inspect sin exponer credenciales; no se hizo ningún cambio."
  exit 1
fi
export INNOVA_SHARED_TUNNEL_NETWORK="${networks[0]}"
export INNOVA_STORAGE_ENV_FILE="$config"
# Validate interpolation/YAML without disclosing the rendered secrets.
docker compose --project-name "$project" -f "$compose" config --quiet ||
  { echo "FAIL: docker compose config inválida; sin cambios"; exit 1; }
echo "PASS: red Docker y Compose validadas (sin modificar otros servicios)."

# The Dockerfile-specific .dockerignore includes ONLY three source files.
echo "Construyendo imagen independiente del gateway; el piloto desactivado :8788 no se modifica..."
docker build --quiet -t "$image" -f services/innova-storage-dell/Dockerfile "$ROOT" >/dev/null
echo "Iniciando nueva API en 127.0.0.1:8789 y red privada compartida..."
started=false
cleanup_on_fail() {
  if [[ "$started" == true ]]; then
    echo "FAIL: se detiene el contenedor nuevo; servicio piloto y Cloudflare intactos."
    docker compose --project-name "$project" -f "$compose" down >/dev/null 2>&1 || true
  fi
}
trap cleanup_on_fail EXIT
started=true
docker compose --project-name "$project" -f "$compose" up -d --no-build --no-deps

ready=false
for i in $(seq 1 24); do
  result="$(curl --silent --max-time 3 http://127.0.0.1:8789/healthz || true)"
  if [[ "$result" == *'"ok":true'* && "$result" == *'"enabled":true'* ]]; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo "FAIL: API de producción candidata sin healthz enabled=true"; exit 1; }
echo "PASS: nuevo gateway local respondió enabled=true"
status="$(curl --silent --max-time 12 -o /dev/null -w '%{http_code}' -X POST \
  http://127.0.0.1:8789/v1/evidences/cb497fe7-f927-401c-81e2-bf09d4256cc6/authorize)"
[[ "$status" == 401 ]] || { echo "FAIL: HTTP $status sin JWT, se esperaba 401"; exit 1; }
echo "PASS: acceso sin JWT rechazado HTTP 401"
status="$(curl --silent --max-time 12 -o /dev/null -w '%{http_code}' -X OPTIONS \
  -H 'Origin: https://sello-tecnologico.vercel.app' \
  http://127.0.0.1:8789/v1/evidences/cb497fe7-f927-401c-81e2-bf09d4256cc6/authorize)"
[[ "$status" == 204 ]] || { echo "FAIL: CORS HTTP $status, se esperaba 204"; exit 1; }
echo "PASS: CORS de CreaLab autorizado HTTP 204"

# Test same path from another container on the tunnel's existing network.
docker run --rm --network "$INNOVA_SHARED_TUNNEL_NETWORK" --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 32 --memory 128m \
  --entrypoint node "$image_probe" -e \
  "fetch('http://innova-storage-prod:8080/healthz',{signal:AbortSignal.timeout(5000)}).then(r=>r.json()).then(x=>process.exit(x.ok===true&&x.enabled===true?0:1)).catch(()=>process.exit(1))" \
  >/dev/null || { echo "FAIL: no se puede acceder desde la red del Tunnel"; exit 1; }

echo "PASS: API accesible desde la red Docker del Tunnel (http://innova-storage-prod:8080)"
pilot="$(curl --silent --max-time 3 http://127.0.0.1:8788/healthz || true)"
if [[ "$pilot" != *'"enabled":false'* ]]; then echo "FAIL: estado del piloto :8788 inesperado"; exit 1; fi
echo "PASS: el gateway piloto original sigue desactivado en :8788"

started=false
trap - EXIT
echo "PASS: despliegue local controlado completado. NO se modificó Cloudflare DNS/Tunnel ni Vercel."
echo "API pública todavía NO configurada; el contenedor innova-storage-dell-prod sí está activo localmente."
