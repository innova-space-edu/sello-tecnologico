#!/usr/bin/env bash
# Read-only HTTPS smoke after DNS + Tunnel ingress; no JWT or secrets required.
set -euo pipefail
set +x
url="https://storage-api.innova-space-edu.cl"
id="cb497fe7-f927-401c-81e2-bf09d4256cc6"
command -v curl >/dev/null || { echo "FAIL: curl no disponible"; exit 1; }

health="$(curl -fSs --proto '=https' --max-time 15 "$url/healthz")" || {
 echo "FAIL: endpoint HTTPS no disponible"; exit 1;
}
if [[ "$health" != *'"ok":true'* || "$health" != *'"enabled":true'* ]]; then
 echo "FAIL: gateway público no responde healthz habilitado"; exit 1
fi
echo "PASS: Cloudflare Tunnel dirige correctamente a gateway habilitado"
http_status() {
 curl -sS --proto '=https' --max-time 15 -o /dev/null -w '%{http_code}' "$@"
}
status="$(http_status -X POST "$url/v1/evidences/$id/authorize")"
[[ "$status" == 401 ]] || { echo "FAIL: sin JWT HTTP $status (esperado 401)"; exit 1; }
echo "PASS: sin JWT rechazado HTTP 401"
status="$(http_status -X POST -H 'Origin: https://untrusted.invalid' "$url/v1/evidences/$id/authorize")"
[[ "$status" == 403 ]] || { echo "FAIL: origen no permitido HTTP $status (esperado 403)"; exit 1; }
echo "PASS: origen no autorizado HTTP 403"
status="$(http_status -X OPTIONS -H 'Origin: https://sello-tecnologico.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization' \
  "$url/v1/evidences/$id/authorize")"
[[ "$status" == 204 ]] || { echo "FAIL: CORS de CreaLab HTTP $status (esperado 204)"; exit 1; }
echo "PASS: CORS de CreaLab HTTP 204"
echo "PASS: exposición HTTPS validada sin entregar archivos ni consumir cuotas"
