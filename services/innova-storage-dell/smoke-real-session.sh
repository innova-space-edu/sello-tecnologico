#!/usr/bin/env bash
# Test real CreaLab sign-in locally on Dell. Does not publish any port.
# The password is read with terminal echo disabled; never stored in a file.
set -euo pipefail
set +x
umask 077
[[ -t 0 && -t 1 ]] || { echo "FAIL: ejecuta directamente desde SSH, sin pipes ni redirecciones"; exit 1; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
file="${HOME}/.config/innova-storage-dell/storage.env"
script="$root/services/innova-storage-dell/smoke-real-session.mjs"
image="innova-storage-gateway:local-auth-smoke"
[[ -f "$file" && ! -L "$file" && -r "$file" ]] || { echo "FAIL: falta configuración privada"; exit 1; }
[[ "$(stat -c %a "$file")" == "600" && "$(stat -c %u "$file")" == "$(id -u)" ]] || { echo "FAIL: permisos del archivo privado inválidos"; exit 1; }
grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=false([[:space:]]*)$' "$file" || { echo "FAIL: gateway permanente debe estar desactivado"; exit 1; }
docker image inspect "$image" >/dev/null 2>&1 || { echo "FAIL: primero ejecuta smoke-local-enabled.sh para construir la imagen"; exit 1; }

echo "Usa la cuenta de CreaLab autorizada para el archivo piloto (administrador o autor)."
echo "Los datos se usarán solo en memoria dentro de un contenedor efímero; no se registran."
IFS= read -r -p "Correo de CreaLab: " email
IFS= read -r -s -p "Contraseña de CreaLab (no visible): " password
printf '\n'
[[ -n "$email" && -n "$password" ]] || { echo "FAIL: campos vacíos"; exit 1; }
echo "Probando autorización real y hash del archivo piloto. Consumirá una reserva de cuota."
# Password and email are passed via stdin, never a process argument, command or env variable.
# All backend secrets remain inside the private env-file, mounted only in this ephemeral container.
printf '%s\n%s\n' "$email" "$password" | docker run --rm -i \
  --network bridge --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 64 --memory 256m --cpus 0.5 \
  --env-file "$file" \
  --mount "type=bind,src=$script,dst=/app/services/innova-storage-dell/smoke-real-session.mjs,readonly" \
  --entrypoint node "$image" /app/services/innova-storage-dell/smoke-real-session.mjs
unset email password
echo "PASS: contenedor de prueba eliminado; servicio permanente sin cambios"
