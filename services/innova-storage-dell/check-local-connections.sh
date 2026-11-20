#!/usr/bin/env bash
# Dell operator: connectivity probe; NO writes, no port mapping, no service restart.
set -euo pipefail
set +x
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
file="${HOME}/.config/innova-storage-dell/storage.env"
script="$ROOT/services/innova-storage-dell/check-local-connections.mjs"
image="innova-storage-gateway:local-test"

[[ -f "$file" && ! -L "$file" ]] || { echo "FAIL: archivo de credenciales no encontrado"; exit 1; }
[[ "$(stat -c %a "$file")" == 600 ]] || { echo "FAIL: archivo no tiene permisos 0600"; exit 1; }
[[ "$(stat -c %u "$file")" == "$(id -u)" ]] || { echo "FAIL: dueño del archivo distinto al usuario actual"; exit 1; }
grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=false([[:space:]]*)$' "$file" || { echo "FAIL: API debe continuar desactivada"; exit 1; }
[[ -r "$script" ]] || { echo "FAIL: falta el script de comprobación"; exit 1; }
docker image inspect "$image" >/dev/null || { echo "FAIL: primero ejecutar setup-local-disabled.sh"; exit 1; }

echo "Probando credenciales sin activación, cambios de cuotas ni exposición de archivos..."
docker run --rm \
  --network bridge \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 64 --memory 256m --cpus 0.5 \
  --env-file "$file" \
  --mount "type=bind,src=$script,dst=/app/services/innova-storage-dell/check-local-connections.mjs,readonly" \
  --entrypoint node "$image" \
  /app/services/innova-storage-dell/check-local-connections.mjs
echo "PASS: comprobación finalizada. API Dell sigue desactivada."
