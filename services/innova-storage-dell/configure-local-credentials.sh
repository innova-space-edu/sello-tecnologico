#!/usr/bin/env bash
# Operator-only, interactive secret capture on Dell. No secrets in Git, shell history or chat.
# Does not enable, restart, expose or deploy the service.
set +x
set -euo pipefail
umask 077

[[ -t 0 && -t 1 ]] || { echo "Ejecutar directamente en la terminal SSH, sin redirecciones." >&2; exit 1; }
dir="${HOME}/.config/innova-storage-dell"
file="$dir/storage.env"
[[ -d "$dir" && ! -L "$dir" ]] || { echo "Directorio de configuración no encontrado o inválido." >&2; exit 1; }
[[ -f "$file" && ! -L "$file" ]] || { echo "Archivo privado no encontrado o inválido. Primero ejecuta setup-local-disabled.sh." >&2; exit 1; }
if grep -Eq '^INNOVA_STORAGE_DELL_ENABLED=true([[:space:]]*)$' "$file"; then
  echo "El archivo ya tiene el servicio habilitado. Cancelado." >&2
  exit 1
fi

read_secret() {
  local prompt="$1" variable="$2" input
  IFS= read -r -s -p "$prompt: " input
  printf '\n' >&2
  printf -v "$variable" '%s' "$input"
}
echo "Las claves SOLO se ingresan en esta terminal. Nunca pegarlas en ChatGPT."
echo "Supabase: proyecto CreaLab -> Settings -> API Keys -> claves publishable y secret nuevas."
echo "R2: credenciales Object Read exclusivas del bucket innova-crealab."
read_secret "SUPABASE_PUBLISHABLE_KEY (sb_publishable_...)" pub
read_secret "SUPABASE_SECRET_KEY (sb_secret_...)" secret
read_secret "R2_ACCESS_KEY_ID (solo lectura)" r2id
read_secret "R2_SECRET_ACCESS_KEY (solo lectura)" r2secret

[[ "$pub" == sb_publishable_* && ${#pub} -gt 25 ]] || { echo "Clave publishable incorrecta." >&2; exit 1; }
[[ "$secret" == sb_secret_* && ${#secret} -gt 20 ]] || { echo "Clave secret incorrecta." >&2; exit 1; }
[[ "$r2id" =~ ^[A-Za-z0-9_+=./-]+$ && ${#r2id} -ge 16 ]] || { echo "R2 access key inválida." >&2; exit 1; }
[[ "$r2secret" =~ ^[A-Za-z0-9_+=./-]+$ && ${#r2secret} -ge 20 ]] || { echo "R2 secret inválido." >&2; exit 1; }

default_origins="https://sello-tecnologico.vercel.app,https://sello-tecnologico-nqeg57o81-innova-space-edu.vercel.app"
printf 'Orígenes autorizados (separados por coma; sin rutas):\n'
IFS= read -r -p "[$default_origins]: " origins
origins="${origins:-$default_origins}"
IFS=',' read -ra origins_array <<< "$origins"
[[ ${#origins_array[@]} -gt 0 && ${#origins_array[@]} -le 5 ]] || { echo "Orígenes inválidos." >&2; exit 1; }
for origin in "${origins_array[@]}"; do
  [[ "$origin" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{2,5})?$ && "$origin" != *..* ]] ||
    { echo "Debe usar HTTPS con hostname explícito, sin comodines." >&2; exit 1; }
done

tmp="$(mktemp "$dir/storage.env.new.XXXXXXXX")"
trap 'rm -f -- "$tmp"' EXIT
chmod 600 "$tmp"
{
  printf 'INNOVA_STORAGE_DELL_ENABLED=false\n'
  printf 'SUPABASE_URL=https://xfleqorozycfdmefdejs.supabase.co\n'
  printf 'SUPABASE_PUBLISHABLE_KEY=%s\n' "$pub"
  printf 'SUPABASE_SECRET_KEY=%s\n' "$secret"
  printf 'R2_ACCOUNT_ID=84ed45de70a021c365e93b960c406d48\n'
  printf 'R2_ACCESS_KEY_ID=%s\n' "$r2id"
  printf 'R2_SECRET_ACCESS_KEY=%s\n' "$r2secret"
  printf 'ALLOWED_ORIGINS=%s\n' "$origins"
} > "$tmp"
mv -f -- "$tmp" "$file"
trap - EXIT
unset pub secret r2id r2secret
chmod 600 "$file"
echo "PASS: configuración privada guardada con permisos 0600."
echo "INNOVA_STORAGE_DELL_ENABLED=false. Contenedor sin reiniciar. Sin DNS/túnel modificados."
