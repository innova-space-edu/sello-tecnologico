# INNOVA Storage — Backend en Dell (prototipo seguro, SIN DESPLEGAR)

## Objetivo
- CreaLab / Vercel: solo interfaz, no transfiere bytes de archivo.
- Dell: servicio HTTP pequeño para verificar sesión de Supabase, autorización RLS, registro privado y cuota; firma GET de R2 con credenciales de solo lectura.
- Cloudflare Tunnel: conduce ÚNICAMENTE pequeñas solicitudes de autorización y respuestas JSON. **Nunca transmite videos ni archivos grandes**. En Free/Pro/Business Cloudflare restringe el servicio de videos y grandes archivos mediante Tunnel; usar presigned GET del endpoint R2 S3 directamente.
- Navegador: abre URL privada R2 con firma SigV4 válida 60 segundos. GET, Range y download se realizan directamente con R2. Bucket sigue siendo privado, sin r2.dev ni dominio público. Los enlaces se pueden reutilizar/compartir durante su corta vigencia.
- Supabase: mantiene auth, RLS de evidences, perfiles, registro inmutable y contador atómico. No hace falta mover Supabase PostgreSQL al Dell en esta fase.
- Backup Dell: mantiene respaldos originales, pero no actúa como servidor público de multimedia.

## Situación real
- Los 137 objetos se copiaron a R2 y respaldaron en Dell. 133 evidencias tienen referencia directa; cuatro objetos necesitan revisión por posibles referencias indirectas/históricas.
- Primera prueba de Next.js 65.468 bytes aprobada; el gateway Dell es nuevo y NO se ha probado contra Supabase ni R2 reales.
- Código en rama feat/innova-storage-r2-migration / PR #52. No merge, Docker no instalado, no Cloudflare DNS ni Tunnel nuevos, ninguna variable Dell escrita.
- API protegida por INNOVA_STORAGE_DELL_ENABLED=false (valor por defecto). Cliente de CreaLab por NEXT_PUBLIC_INNOVA_STORAGE_DELL_ENABLED=false (no configurado).
- Las rutas Next.js anteriores siguen disponibles únicamente en sus previews existentes. No tocar originales de Supabase ni conceder acceso a 133 archivos hasta validar roles.
- Registro de R2: los nuevos archivos verificados siguen deshabilitados; el piloto previo permanece habilitado solo en la ruta anterior.
- *La cuota limita autorizaciones emitidas, NO peticiones reales a R2.* Una URL de 60 segundos puede ser reutilizada durante ese período. No asegura costo cero ni constituye límite duro de facturación.
- Antes de lanzar: crear y probar la función SQL `scripts/innova-storage-dell-quota.review.sql`, solo tras test en base descartable y revisión. No aplicar SQL desde este servicio por sí mismo.

## API
`GET /healthz`: estado básico sin secretos.
`POST /v1/evidences/{uuid}/authorize`: requiere Bearer access token auténtico de Supabase. Sin cuerpo. Comprueba usuario con auth/v1/user, perfil no bloqueado, lectura de evidencia bajo RLS con JWT del usuario, registro protegido con service_role (solo para comprobar metadatos), correspondencia fuerte entre filas, propietario o administrador, y reserva atómica de cuota. Devuelve `{url,expires_in:60,size_bytes,mime_type}` o error genérico.
- CORS de autorización limitado a orígenes exactos desde ALLOWED_ORIGINS; nunca usar comodín.
- La ruta NO permite leer directamente snapshots históricos, mensajes ni publicaciones públicas; se desarrollarán reglas independientes para esos casos.
- R2 no recibe credenciales a través del navegador. Un token GET temporal sí puede compartirse hasta expirar.
- La ruta no transmite bytes ni recibe uploads, no contiene endpoint DELETE y solo usa credenciales R2 Object Read Only.
- La función SQL de Dell añade límites: 40 autorizaciones/usuario/día, 200 globales/día, 5.000/mes, 200 MB/usuario/día, 500 MB/día y 4 GB/mes para el gateway; reservas globales en UTC y lock compartido con el piloto existente. No contabiliza transferencias exactas de R2.

## Pruebas SIN desplegar
En el Dell, desde la raíz del clon:
```bash
git pull --ff-only origin feat/innova-storage-r2-migration
INNOVA_TEST_PG_IMAGE=postgres:17-alpine bash scripts/test-innova-storage-dell-quota.sh
bash services/innova-storage-dell/setup-local-disabled.sh
```
El instalador usa **Node.js dentro de la imagen Docker**, sin instalar Node en Debian. Compila la imagen local, ejecuta las pruebas del gateway y la firma con `docker run --network none` y solo entonces inicia el contenedor con `enabled:false`. Puede descargar `node:22-alpine` si la imagen base no está almacenada localmente. No escribe credenciales reales.
La última prueba crea un PostgreSQL temporal de Docker sin red ni puertos, con datos ficticios; no toca intranet ni Supabase. Esperar 40 solicitudes aceptadas y 20 rechazadas bajo concurrencia.

## Preinstalación segura (NO ejecutar aún)
1. Auditar el PR y la función SQL; confirmar que la prueba de concurrencia supera.
2. Decidir el hostname de autorización, por ejemplo `storage-api.innova-space-edu.cl`, y examinar el Cloudflare Tunnel existente. Configurar reglas de acceso y WAF/rate limiting sin publicar el origen directamente. **El contenedor actual de cloudflared NO puede alcanzar directamente el 127.0.0.1 del anfitrión**: para conectarlo al servicio hay que aprobar una red Docker compartida privada (origen como `http://innova-storage-authorizer:8080`) o un gateway explícito en el anfitrión. La publicación local `127.0.0.1:8788` sirve solo para pruebas desde el Dell. No modificar redes del túnel existente sin revisar impacto en intranet.
3. Crear archivo secreto exclusivo en Dell, fuera del repositorio, permisos 0600, con las claves de solo lectura R2 y Supabase. Nunca copiar secretos a GitHub, mensajes o `NEXT_PUBLIC_*`. `SUPABASE_SERVICE_ROLE_KEY` tiene privilegios elevados; limitar acceso al contenedor y valorar más adelante sustituirlo por un rol dedicado.
4. Definir `INNOVA_STORAGE_ENV_FILE` como ruta absoluta de ese archivo. Adaptar ALLOWED_ORIGINS a los dominios reales de CreaLab.
5. Revisar y fijar el digest de la imagen Node 22 oficial antes de desplegar. `compose.example.yml` solo es una propuesta: puerto 127.0.0.1:8788, read_only, no-new-privileges, usuario no root, límites de memoria y CPU.
6. Crear la ruta Cloudflare Tunnel al servicio local y probar `GET /healthz`; validar con cuenta admin, propietario y usuario ajeno. Mantener la variable Dell en false hasta completar SQL, prueba real y auditoría.
7. Solo tras superar estas comprobaciones, configurar CreaLab con `NEXT_PUBLIC_INNOVA_STORAGE_DELL_URL=https://storage-api.innova-space-edu.cl` y `NEXT_PUBLIC_INNOVA_STORAGE_DELL_ENABLED=true`, primero en Preview. El helper de navegador está en `src/lib/innova-storage/dell-client.ts`; **todavía no está conectado a las vistas**.

## Pendiente
- Autorización docente/colaborador basada en proyecto y curso, en vez de solo propietario/admin.
- Visor de video: solicitud de una URL nueva al expirar antes de un Range adicional; navegación directa a R2 sin proxy por Vercel ni Tunnel.
- CORS GET/HEAD de R2 restringido a los orígenes web reales para `fetch`/visores multimedia, sin habilitar bucket público. Verificar R2 S3 endpoint.
- Cargas grandes: subir con presigned PUT solo tras antivirus, permisos, límites, moderación y verificación de finalización. No implementado.
- Portafolios: snapshots/attachment_refs con 129 registros históricos vinculados al bucket; reglas de propiedad independientes, NO usar el vínculo antiguo sin revisar.
- Eventuales cortes, borrado de originales Supabase o fusión del PR requieren autorización separada y plan de recuperación probado.

## Referencias oficiales
- Vercel Functions 4.5MB: https://vercel.com/docs/functions/limitations
- Tunnel y videos: https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/
- Presigned R2: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- CORS R2: https://developers.cloudflare.com/r2/buckets/cors/
- Supabase API/RLS: https://supabase.com/docs/guides/api/securing-your-api

## Revisión de infraestructura 19-11-2026
- Cloudflare Tunnel existente `intranet-dell` healthy, con seis hostnames configurados. El hostname propuesto `storage-api.innova-space-edu.cl` no tiene registro DNS en la zona según consulta de solo lectura; **no se creó DNS ni se modificó túnel**.
- El agente administrador del Dell no permite instalar esta nueva API directamente desde ChatGPT sin una operación aprobada por el propietario. Código y tests están preparados en GitHub para revisión previa.
- Para utilizar el túnel existente, el servicio deberá compartir una red Docker controlada con `intranet-tunnel` o emplear una ruta host explícita; nunca asumir que `127.0.0.1` de un contenedor apunta al anfitrión.

## Actualización posterior a pruebas del Dell
- 19/11/2026: el usuario ejecutó `INNOVA_TEST_PG_IMAGE=postgres:17-alpine bash scripts/test-innova-storage-dell-quota.sh` en el Dell. PASS: RLS, grants, cuotas por usuario y global, 500 MB/día, 4 GB/mes, concurrencia **40 aceptadas / 20 rechazadas** y base temporal.
- `innova_reserve_r2_gateway_read(uuid,uuid)` ya se instaló en Supabase CreaLab mediante migración `innova_r2_dell_gateway_read_quota`; verificación de lectura de metadatos: `anon` y `authenticated` sin permiso EXECUTE, `service_role` autorizado, solicitudes nulas rechazadas, sin mutar los contadores existentes.
- Suite de Node de autorización HTTP ahora pasa **7/7 pruebas** incluyendo Bearer + CORS exacto; `bash -n` del instalador local también pasó.
- Instalador local desactivado: `bash services/innova-storage-dell/setup-local-disabled.sh`. Ejecutar desde el Dell con Docker, Docker Compose, Node y curl. Crea solo contenedor `innova-storage-gateway` en Docker y env privado vacío `~/.config/innova-storage-dell/storage.env`, enlaza al puerto loopback 8788, prueba `GET /healthz` y confirma `enabled:false`. **No agregar aún claves ni habilitar el servicio.**
- Comando de parada reversible: `INNOVA_STORAGE_ENV_FILE="$HOME/.config/innova-storage-dell/storage.env" docker compose --project-name innova-storage-gateway -f services/innova-storage-dell/compose.example.yml down`. No usar `--volumes`, `docker system prune` ni tocar otros proyectos.
- El conector administrativo Dell no permitió preparar instalación de este nuevo servicio; estas acciones requieren SSH local y ejecución explícita por el propietario. No se ha hecho despliegue ni cambios en Cloudflare DNS/Tunnel o Vercel.
- Registro verificado: 123 evidencias, solo 1 habilitada, 364.150.616 bytes registrados. El resto está deshabilitado, no autorizar masivamente hasta terminar auditoría y flujo.
