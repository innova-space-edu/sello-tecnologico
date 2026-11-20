#!/usr/bin/env bash
# Authorized once: create, validate, and DELETE a temporary docente test user.
# No interactive credential collection, no real user emails, no published ports.
set -euo pipefail
set +x
umask 077
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
file="${HOME}/.config/innova-storage-dell/storage.env"
script="$root/services/innova-storage-dell/smoke-ephemeral-docente.mjs"
image="innova-storage-gateway:local-auth-smoke"

[[ -f "$file" && ! -L "$file" && -r "$file" ]] || { echo "FAIL: configuración privada no encontrada"; exit 1; }
[[ "$(stat -c %a "$file")" == "600" && "$(stat -c %u "$file")" == "$(id -u)" ]] ||
  { echo "FAIL: archivo privado debe pertenecer al usuario y ser 0600"; exit 1; }
grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=false([[:space:]]*)$' "$file" ||
  { echo "FAIL: el servicio permanente debe seguir desactivado"; exit 1; }
docker image inspect "$image" >/dev/null 2>&1 ||
  { echo "FAIL: falta imagen Docker, ejecutar smoke-local-enabled.sh primero"; exit 1; }
[[ -r "$script" ]] || { echo "FAIL: falta script de prueba"; exit 1; }

echo "Creación AUTORIZADA de una cuenta docente aleatoria; verificación de rechazo y eliminación automática."
echo "No solicita contraseñas de funcionarios ni alumnos. La identidad de prueba no se conservará."
docker run --rm --network bridge --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 64 --memory 256m --cpus 0.5 \
  --env-file "$file" \
  --env INNOVA_EPHEMERAL_TEST_ACK=EXPLICITLY_AUTHORIZED_EPHEMERAL_TEST_ACCOUNT \
  --mount "type=bind,src=$script,dst=/app/services/innova-storage-dell/smoke-ephemeral-docente.mjs,readonly" \
  --entrypoint node "$image" \
  /app/services/innova-storage-dell/smoke-ephemeral-docente.mjs
echo "PASS: contenedor efímero eliminado; gateway permanente sin cambios."
