#!/usr/bin/env bash
# Local rollback ONLY. Does not modify DNS or tunnel ingress; remove those separately if published.
set -euo pipefail
set +x
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
file="$HOME/.config/innova-storage-dell/storage.env"
[[ -f "$file" && ! -L "$file" ]] || { echo "FAIL: configuración privada no encontrada"; exit 1; }
export INNOVA_STORAGE_ENV_FILE="$file"
# Production compose network is external; name is just for variable interpolation.
# Recover the actual network from the dedicated production container.
network="$(docker inspect -f '{{range $n, $_ := .NetworkSettings.Networks}}{{println $n}}{{end}}' innova-storage-dell-prod 2>/dev/null | head -n 1 || true)"
[[ -n "$network" ]] || { echo "FAIL: no se encontró el contenedor de producción"; exit 1; }
export INNOVA_SHARED_TUNNEL_NETWORK="$network"
docker compose --project-name innova-storage-dell-production -f services/innova-storage-dell/compose.production.yml down
echo "PASS: gateway de producción candidato detenido y retirado."
echo "El piloto 127.0.0.1:8788, las claves y los archivos permanecen intactos."
echo "Si ya publicaste Cloudflare Tunnel, retira la ruta antes de considerar completo el rollback."
