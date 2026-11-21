#!/usr/bin/env bash
# Controlled reconciliation. Read 10 already-copied R2 objects, verify SHA-256,
# optionally insert trusted registry rows exclusively with enabled=false.
set -euo pipefail
set +x
umask 077
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
envfile="$HOME/.config/innova-storage-dell/storage.env"
js="$root/services/innova-storage-dell/reconcile-unregistered.mjs"
image="innova-storage-gateway:local-auth-smoke"
[[ -f "$envfile" && ! -L "$envfile" && -r "$envfile" ]] || { echo "FAIL: falta config privada"; exit 1; }
[[ "$(stat -c %a "$envfile")" == 600 && "$(stat -c %u "$envfile")" == "$(id -u)" ]] || { echo "FAIL: permisos 0600 o propietario incorrectos"; exit 1; }
grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=false([[:space:]]*)$' "$envfile" || { echo "FAIL: gateway permanente debe estar desactivado"; exit 1; }
docker image inspect "$image" >/dev/null 2>&1 || { echo "FAIL: falta imagen gateway local"; exit 1; }
mode="${1:---verify-only}"
[[ "$mode" == "--verify-only" || "$mode" == "--register-disabled" ]] || { echo "Uso: $0 [--verify-only|--register-disabled]"; exit 2; }
echo "Conciliando únicamente 10 vídeos ya copiados. Descarga para validar ~394 MB desde R2."
args=()
if [[ "$mode" == "--register-disabled" ]]; then
  echo "Modo registro: creará filas en Supabase, siempre enabled=false, solo tras verificar TODOS los hashes."
  args+=(--env INNOVA_RECONCILE_CONFIRM=REGISTER_DISABLED_AFTER_HASH_VERIFY)
fi
docker run --rm --network bridge --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 64 --memory 256m --cpus 0.5 \
  --env-file "$envfile" "${args[@]}" \
  --mount "type=bind,src=$js,dst=/app/services/innova-storage-dell/reconcile-unregistered.mjs,readonly" \
  --entrypoint node "$image" /app/services/innova-storage-dell/reconcile-unregistered.mjs \
  "$mode"
echo "PASS: contenedor eliminado; gateway permanente y DNS sin cambios"
