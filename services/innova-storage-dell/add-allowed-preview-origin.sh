#!/usr/bin/env bash
# Safely append an exact HTTPS Vercel preview origin to the 0600 Dell env file.
# Never echo or print the contents of the file; no container restart.
set -euo pipefail
set +x
umask 077
[[ "$#" -eq 1 ]] || { echo "Uso: $0 https://<hostname>.vercel.app"; exit 2; }
origin="$1"
if [[ ! "$origin" =~ ^https://sello-tecnologico[-a-zA-Z0-9]*\.vercel\.app$ || ${#origin} -gt 240 ]]; then
  echo "FAIL: origen no coincide exactamente con la aplicación CreaLab en Vercel"
  exit 1
fi
dir="$HOME/.config/innova-storage-dell"
file="$dir/storage.env"
[[ -f "$file" && ! -L "$file" && -r "$file" ]] || { echo "FAIL: configuración no encontrada"; exit 1; }
[[ "$(stat -c %a "$file")" == "600" && "$(stat -c %u "$file")" == "$(id -u)" ]] || { echo "FAIL: permisos de configuración incorrectos"; exit 1; }
grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=false([[:space:]]*)$' "$file" || { echo "FAIL: gateway original debe seguir desactivado"; exit 1; }
[[ "$(grep -c '^ALLOWED_ORIGINS=' "$file")" == 1 ]] || { echo "FAIL: ALLOWED_ORIGINS debe aparecer exactamente una vez"; exit 1; }
old="$(grep '^ALLOWED_ORIGINS=' "$file")"
value="${old#ALLOWED_ORIGINS=}"
[[ -n "$value" ]] || { echo "FAIL: sin orígenes existentes"; exit 1; }
case ",$value," in
  *",$origin,"*) echo "PASS: el origen ya estaba permitido; no se modificó la configuración"; exit 0 ;;
esac
tmp="$(mktemp "$dir/.storage-env.XXXXXXXX")"
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" == ALLOWED_ORIGINS=* ]]; then
    printf 'ALLOWED_ORIGINS=%s,%s\n' "$value" "$origin" >> "$tmp"
  else
    printf '%s\n' "$line" >> "$tmp"
  fi
done < "$file"
mv -f "$tmp" "$file"
trap - EXIT
chmod 600 "$file"
echo "PASS: origen de Preview permitido sin imprimir credenciales."
echo "La configuración del gateway permanente continúa desactivada; reinicia solo la instancia nueva si ya estaba corriendo."
