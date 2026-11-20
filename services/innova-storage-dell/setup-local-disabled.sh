#!/usr/bin/env bash
# Set up a local, DISABLED Dell gateway pilot. No Cloudflare, DNS, production or R2 credentials.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
command -v docker >/dev/null || { echo "Docker no disponible"; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose no disponible"; exit 1; }
command -v curl >/dev/null || { echo "curl no disponible"; exit 1; }
# Node.js runs ONLY in the Docker image. No host Node.js installation is required.
# This image may be downloaded once. Run tests with no network or host secrets.
image="innova-storage-gateway:local-test"
echo "Construyendo imagen Docker de prueba (sin iniciar el servicio)..."
docker build --tag "$image" --file services/innova-storage-dell/Dockerfile "$ROOT"
test_node() {
  docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges --pids-limit 64 --memory 256m \
    --mount "type=bind,src=$ROOT,dst=/workspace,readonly" \
    --workdir /workspace --entrypoint node "$image" "$@"
}
test_node --test services/innova-storage-dell/server.test.mjs
test_node scripts/test-innova-r2-sign.mjs

dir="${HOME}/.config/innova-storage-dell"
file="$dir/storage.env"
mkdir -p "$dir"
chmod 700 "$dir"
if [[ ! -e "$file" ]]; then
  cat > "$file" <<'ENV'
INNOVA_STORAGE_DELL_ENABLED=false
SUPABASE_URL=https://xfleqorozycfdmefdejs.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
R2_ACCOUNT_ID=84ed45de70a021c365e93b960c406d48
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
ALLOWED_ORIGINS=https://sello-tecnologico.vercel.app
ENV
  chmod 600 "$file"
else
  [[ -f "$file" && ! -L "$file" ]] || { echo "Configuración inválida o symlink"; exit 1; }
  chmod 600 "$file"
  if grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=true([[:space:]]*)$' "$file"; then
    echo "El archivo ya tiene el servicio habilitado; se cancela para evitar modificarlo."
    exit 1
  fi
fi

# Do not change any existing Docker Compose project.
if docker ps --format '{{.Names}} {{.Ports}}' | grep -E '127\.0\.0\.1:8788->' | grep -v '^innova-storage-gateway-' >/dev/null; then
  echo "Puerto 8788 ocupado por otro contenedor; se cancela."
  exit 1
fi
echo "Se construirá únicamente el servicio de prueba, deshabilitado, enlazado a 127.0.0.1:8788."
INNOVA_STORAGE_ENV_FILE="$file" docker compose --project-name innova-storage-gateway \
  -f services/innova-storage-dell/compose.example.yml up -d --no-build --no-deps
result=""
for attempt in $(seq 1 15); do
  result="$(curl --fail --silent --max-time 3 http://127.0.0.1:8788/healthz || true)"
  [[ -n "$result" ]] && break
  sleep 1
done
printf 'Health: %s\n' "$result"
if [[ "$result" != *'"enabled":false'* ]]; then
  echo "Se esperaba un servicio DESHABILITADO. Comprobar manualmente."
  exit 1
fi
echo "PASS: Docker local, API desactivada; sin DNS ni Cloudflare Tunnel configurados."
echo "Config privada local: $file (modo 600, SIN credenciales)"
