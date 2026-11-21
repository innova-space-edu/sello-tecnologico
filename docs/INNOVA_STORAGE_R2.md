# INNOVA Storage — fase 1: CreaLab

## Estado
Inventario del 19-11-2026: 137 objetos y 775589118 bytes en el bucket evidencias.
La rama no cambia la aplicación, no cambia URLs, no modifica políticas ni elimina archivos.
El destino privado es innova-crealab, prefijo evidencias/. El script usa S3 y verifica cada copia leyendo los bytes de R2.

## Preparación (administrador)
- Cloudflare > R2 > Create bucket: innova-crealab, Standard. No habilitar r2.dev ni dominio público. Crear credenciales S3 Object Read & Write limitadas al bucket.
- Supabase CreaLab > Storage > Configuration > S3: habilitar protocolo y crear credenciales S3 temporales. Estas claves evitan RLS: solo servidor, revocar al terminar.
- Preparar directorio de respaldo exclusivo con permisos 0700 en un volumen protegido/cifrado del Dell. No usar NTFS sin verificar permisos y cifrado.
- Asegurar que la cuenta R2 puede utilizar el plan gratuito y controlar facturación.
- Inyectar variables de entorno desde un gestor de secretos o archivo local 0600 fuera del repositorio. Nunca subir las claves a GitHub ni introducirlas en chat.

Variables:
```text
SUPABASE_ENDPOINT=https://xfleqorozycfdmefdejs.storage.supabase.co/storage/v1/s3
SUPABASE_REGION=us-west-2
SUPABASE_ACCESS_KEY_ID
SUPABASE_SECRET_ACCESS_KEY
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Desde la raíz del repositorio, en el Dell:
```bash
python3 -m venv ~/.venvs/innova-storage
source ~/.venvs/innova-storage/bin/activate
pip install boto3==1.40.76
python scripts/innova-storage-copy.py
# Si el inventario es correcto, y las variables R2 están configuradas:
python scripts/innova-storage-copy.py --copy --backup-dir "$HOME/innova-storage-backup/crealab-20261119"
```
El directorio de ejemplo debe estar en un volumen protegido y ser accesible solo por el operador. El manifiesto contiene nombres de objetos (posibles datos personales); mantenerlo privado. No almacenar el manifiesto en el repositorio. Si falla el proceso, investigar la causa antes de repetir. Si se modificaron objetos, usar un nuevo directorio y no sobrescribir objetos R2 sin revisión. No ejecutar dos migraciones simultáneas.

## Antes de cambiar producción (fase 2)
- Inventariar todas las referencias a las URLs históricas en tablas y JSON, incluidos portafolios, informes, publicaciones y mensajes. Mantener un mapeo estable del objeto.
- Identificar permisos para el acceso a cada evidencia y adjunto, verificar autorizaciones de publicación por separado. No convertir evidencias en archivos públicos de R2.
- Implementar acceso a través de endpoints de aplicación que comprueben autorización (incluida RLS), emitan URLs firmadas de vida corta y mantengan compatibilidad con referencias históricas. Implementar carga directa firmada, límites y verificación al finalizar. No exponer credenciales S3 al navegador.
- Probar estudiante propietario, docente autorizado, administrador, usuario no autorizado y visitante público, incluyendo portafolio, vista previa de espacio creativo, mensajes, descarga, vídeo y edición.
- Guardar exportación de registros y referencias de base de datos además del respaldo binario. Realizar prueba de restauración. Confirmar la coincidencia de inventarios y hashes, detener escrituras en el origen durante el corte final y repetir verificación.
- Solo tras aprobación explícita del corte y prueba de rollback, eliminar originales mediante Storage API (nunca DELETE SQL sobre storage.objects). Verificar cuota en el panel. No hay eliminación automatizada en esta fase.

## Hallazgo
El bucket es público y las políticas actuales admiten lectura pública y eliminación por cualquier autenticado. La aplicación usa ese bucket para evidencias y adjuntos de mensajería. El inventario del día no contiene objetos con prefijo mensajes/. El corte de acceso requiere revisar autorización por registro; no basta con cambiar el dominio.

## Presupuesto cero y límites de seguridad

R2 Standard: 10 GB-mes, 1 millón de operaciones A y 10 millones B mensuales, compartidos por la cuenta. No es un límite duro de facturación. Bucket privado innova-crealab creado el 19-11-2026. Alerta de presupuesto proyectado USD 0.01 creada y verificada. No activar Infrequent Access, R2 SQL, Data Catalog ni Workers de pago para esta migración.

El script de fase 1 rechaza la copia antes de escribir si el inventario de origen más el destino supera 2.000.000.000 bytes o si el origen supera 1000 objetos. No controla otras aplicaciones o credenciales ni el consumo real de facturación. Ejecutar sin otros escritores concurrentes. Para la fase 2, aplicar un límite global de 8 GB (propuesta: CreaLab 3 GB, EduAI 4 GB y otros 1 GB), 500.000 A y 5.000.000 B por ciclo de facturación, mediante contabilidad central, reserva atómica de capacidad, límites de tamaño y frecuencia, expiración de enlaces, rechazo de escrituras y derivación al Dell. No habilitar carga real en producción hasta probar estas medidas. Monitorear métricas oficiales y mantener margen adicional frente a retraso de medición, concurrencia y accesos externos. No borrar documentos para cumplir una cuota sin respaldo verificado y autorización.

## Preflight real (19-11-2026)
- PUT/GET/DELETE de objeto sintético en R2 mediante API: PASS, objeto eliminado; inventario R2 vacío después.
- Supabase: 137 objetos, 775589118 bytes; mayor objeto 51317925 bytes; 17 objetos mayores a 8 MiB.
- Auditoría de referencias por URL pública/firmada en 412 columnas text/array/json de 87 tablas base: evidences, 133 filas; portfolio_archive_items, 129 filas. No asumir que toda referencia indirecta o histórica fue localizada. No cambiar referencias hasta tener gateway y autorización por registro.
- El MCP del Dell solo admite ejecución aislada sin red ni secretos; no puede iniciar la migración externa. Usar terminal SSH real. Crear credenciales temporales S3 y revocarlas tras verificar copia. Antes de copiar revisar cuota egress de Supabase y facturación R2.
- Lanzador interactivo: desde la rama de este PR, con boto3 instalado, ejecutar `python scripts/innova-storage-run.py --backup-dir "$HOME/innova-storage-backup/crealab-20261119"` en un volumen local protegido. Pide las cuatro claves sin eco y confirma antes de copiar; no las persiste en disco ni las registra en GitHub. No iniciar si el directorio no está protegido o se desconoce la capacidad/egress disponible. No eliminar originales.

## Verificación posterior a la copia
- Comparación remota de inventarios por clave y tamaño: Supabase 137 objetos / 775589118 bytes; R2 137 objetos / 775589118 bytes; 137 coincidencias, 0 faltantes, 0 diferencias de tamaño, 0 adicionales.
- La comprobación remota no demuestra por sí sola la igualdad SHA-256 ni la existencia del respaldo local. Antes del corte, comprobar el manifiesto privado del Dell y el mensaje de finalización del ejecutor. No imprimir nombres ni contenido del manifiesto.
- Políticas de lectura observadas: evidences permite miembros del curso, colaboradores del proyecto, coordinador/admin según RLS; portfolio_archive_items permite lectura al propietario. La nueva ruta privada debe comprobar la autorización sobre registros concretos con el cliente del usuario (no service role para decidir acceso); los permisos de publicación se comprueban por separado.
- Originales intactos. No cambiar referencias ni borrar archivos hasta probar autorización y rollback.

## Respaldo local y piloto de lectura
- El operador confirmó 137 registros, 137 respaldos SHA-256 verificados y 775589118 bytes desde el Dell. La copia se conserva en los tres destinos.
- Ruta experimental: GET /api/admin/innova-storage/pilot, desactivada por defecto. Exige sesión administrativa válida, perfil no bloqueado y lectura RLS del registro. Solo lee una evidencia preseleccionada de hasta 1 MB, no recibe claves de objeto del cliente, no entrega URL firmada ni contenido del archivo y devuelve tamaño y hash SHA-256. Firma S3 de 60 segundos, fetch sin caché ni redirección, timeout de 15 segundos.
- Prueba de firma SigV4 con clave ficticia, caracteres especiales y comparación independiente contra botocore 1.43.18: PASS; rechazo de claves inválidas: PASS. No se ha ejecutado el build completo ni se ha probado el endpoint con una sesión real.
- Configurar únicamente en preview de la rama, con protección de acceso y sin habilitar en producción: INNOVA_R2_PILOT_ENABLED=true; INNOVA_R2_PILOT_EVIDENCE_ID=cb497fe7-f927-401c-81e2-bf09d4256cc6 (65468 bytes); INNOVA_R2_READ_ACCESS_KEY_ID e INNOVA_R2_READ_SECRET_ACCESS_KEY (token R2 Object Read Only restringido a innova-crealab). Nunca usar NEXT_PUBLIC_ ni credenciales de migración con escritura.
- Verificar respuesta 200 y SHA-256 contra manifiesto local; probar 401 sin sesión, 403 con usuario no admin, 404 con flag apagado. Desactivar el piloto tras la prueba. No es un control duradero de cuota ni integración de producción. Para el corte faltan gateway general con contabilidad persistente, referencias de portafolio, vistas y exportaciones, cargas y compatibilidad con publicación y acceso RLS, pruebas de roles y restauración. Mantener los originales.

## Piloto real aprobado y fase de acceso controlado
- Preview dpl_CX6WteEr4EUGAQAxQvxMKLoGWmXX READY. El operador autenticado recibió ok=true, backend=r2, bytes=65468 y SHA-256 coincidente con la lectura directa R2. Sin cambios a producción.
- Auditoría: evidences permite INSERT autenticado amplio y UPDATE de referencias por autor/colaborador; existe un trigger que protege campos sensibles de profiles. No confiar en file_url mutable para autorizar una clave privada. Además el archivo histórico se genera mediante triggers y requiere revisión de procedencia/propiedad antes de habilitar lecturas.
- Registro de migración y contabilidad: borrador scripts/innova-storage-read-registry.review.sql, no aplicado. Tabla RLS y permisos exclusivos de service_role, entrada por evidencia con identidad del autor/proyecto, URL original, clave R2, MIME, tamaño y SHA-256. Entradas deshabilitadas por defecto. Solo operador de migración puede importar registros a partir de manifiesto verificado y revisión de procedencia; nunca desde URLs aportadas por usuarios sin comprobación.
- Ruta /api/innova-storage/evidence/[id]: desactivada por defecto, solo Preview de esta rama, requiere sesión y RLS, perfil no bloqueado y coincidencia estricta con registro privado. Inicialmente autor original o admin; no autoriza todavía colaboradores/docentes ajenos al autor ni archivos de portafolio histórico. Límite de 1 MB, 20 solicitudes por usuario/día, 100 globales/día y 1000 globales/mes, con 100 MB/día y 1 GB/mes globales; períodos UTC, reservas atómicas antes de contactar R2, también contabiliza fallos de origen. Los límites son del piloto, no límites de facturación de Cloudflare/Vercel.
- La ruta compara SHA-256 del contenido antes de entregarlo, no devuelve la URL firmada, no admite HTML/SVG en línea, no hace fallback a URL pública. Guard unit tests ejecutados en Dell aislado: PASS. Falta validar SQL en base de pruebas, importación privada del registro, prueba de concurrencia/roles, build de la nueva ruta y despliegue de preview. No activar INNOVA_R2_READ_PREVIEW_ENABLED hasta completar estas pruebas. No se ha modificado ninguna referencia o archivo original.

## Prueba de cuotas sin servicios de pago
- El SQL calcula el período UTC después de obtener el bloqueo transaccional y mantiene un bloqueo compartido sobre el registro durante la reserva.
- Pruebas de PostgreSQL con registros ficticios y roles anon/authenticated/service_role: scripts/test-innova-storage-quota.sql. Verifican RLS, ausencia de permisos públicos, rechazo de registros deshabilitados/inexistentes/grandes, 20 operaciones por usuario, 100 diarias globales, 1000 mensuales y contabilización de bytes.
- Ejecutar desde la raíz del clon local en el Dell: `bash scripts/test-innova-storage-quota.sh`. Requiere Docker local y una imagen PostgreSQL 17 ya instalada (`INNOVA_TEST_PG_IMAGE` permite especificar otra etiqueta local de la misma versión). No descarga imágenes, no expone puertos, utiliza red none, tmpfs, límites CPU/RAM, nombres aleatorios y elimina solo el contenedor de prueba al salir. Prueba simultánea: 30 solicitudes, exactamente 20 aprobadas y 10 rechazadas.
- El conector aislado carece de PostgreSQL y Docker; comprobación de sintaxis Bash PASS, prueba SQL real pendiente de ejecutar en terminal del Dell. No crear branch Supabase con costo ni aplicar el SQL a producción todavía.

## Validación PostgreSQL aprobada e instalación aditiva
- Operador ejecutó el runner con postgres:17-alpine existente en Dell. PASS: RLS, grants, invalid objects, user/day/month limits and byte accounting. PASS concurrency: accepted=20 rejected=10. PASS disposable database; no production changes from test.
- Posteriormente, en Supabase CreaLab se aplicó la migración aditiva innova_r2_private_registry_preview_quota (SQL verificado en commit cd8fe0d17892d6b8958e5676ed271f668a254dbe). No se alteraron tablas existentes ni políticas anteriores. RLS activa en ambas tablas; anon/authenticated sin lectura de registro ni escritura de uso ni EXECUTE; service_role tiene EXECUTE; llamada inválida devuelve false. Advisor informa RLS sin políticas deliberadamente, porque solo service_role debe acceder.
- Se registró únicamente el piloto de 65468 bytes con SHA-256 validado por R2 y la aplicación; se comprobó coincidencia de URL, tamaño, MIME, titular de objeto y prefijo de propietario con evidencia y proyecto. Entrada deshabilitada; total 1 registro, 0 habilitados. No se han activado nuevas rutas, cambiado vistas ni eliminado originales. El siguiente preview debe usar registro y cuotas, probar acceso admin y propietario, negar usuarios ajenos y retirar el piloto anterior antes de ampliar el registro. Revisar procedencia de archivos restantes y portafolios antes de permitir acceso.

## Punto de control de migración (21 de noviembre de 2026)

**Fase de lectura privada (piloto)**
- El gateway Dell se encuentra corriendo en el contenedor independiente `innova-storage-dell-prod`, host local `127.0.0.1:8789`, visible en la red de `intranet-tunnel` como `http://innova-storage-prod:8080`. El contenedor piloto `127.0.0.1:8788` sigue desactivado.
- Prueba con administrador real: JWT validado, operación registrada, presign R2 de 60 s, descarga del archivo piloto de 65.468 B con SHA-256 coincidente. Prueba con docente real no autor: HTTP 404, sin enlace ni reserva de cuota. Pruebas de evidencias deshabilitadas/inexistentes: HTTP 404. No compartir tokens ni contraseñas en tickets.
- Migración de evidencia 100 % registrada: **133 evidencias con URL → 133 filas verificadas en registro R2**, de las cuales **1 habilitada y 132 deshabilitadas**. Se verificaron 10 vídeos de 393.781.996 bytes y se insertaron en una sola transacción deshabilitada. Total registrado 757.932.612 B.
- Inventario de Storage origen: **137 objetos / 775.589.118 B**. Diferencia **4 objetos / 17.656.506 B** sin registro ni referencias encontradas en `evidences.file_url` y `portfolio_archive_items.snapshot`: 1 QuickTime, 1 JPEG, 1 ZIP, 1 PNG. Mantener originales: la ausencia de referencias en esas dos tablas no garantiza que no estén usados en otras superficies.
- Portafolios: 129 filas del archivo histórico de `evidences` incluyen URL original del bucket. Se deben respetar y migrar por identificador del recurso, incluyendo casos de evidencia borrada o archivada; no cambiar JSON por sustitución de cadenas sin una tabla de correspondencia verificable.
- Cloudflare: se añadió el hostname `storage-api.innova-space-edu.cl` al túnel **ya existente** y CNAME proxied al túnel. Preservadas las seis rutas existentes y la regla final 404. Todavía se requiere verificación HTTP HTTPS remota desde Dell, por ejemplo:
```bash
cd ~/innova-storage/crealab
git pull --ff-only origin feat/innova-storage-r2-migration
bash services/innova-storage-dell/sync-preview-origins.sh
```
El comando ejecuta primero el smoke HTTPS externo, añade los orígenes del Preview de Vercel a la lista CORS privada de Dell, recrea exclusivamente el contenedor nuevo y revalida HTTPS/CORS.
- Vercel: variables de función activadas **solo para Preview y rama** `feat/innova-storage-r2-migration`. Compilación READY de `https://sello-tecnologico-9xgipzoem-innova-space-edu.vercel.app`, despliegue `dpl_5wL4msYRCzBeSNboZps4xLubZZS2`. Producción `main` sin cambios.
- **Pendiente antes de fase definitiva:** implementar PUT directo R2 firmado y finalización con verificación, autorización por colaborador/proyecto, manejo de multimedia con reproducción/range y expiración, permisos para otros módulos, mapeo y lectura de portafolios históricos, verificación de adjuntos de mensajería, protección contra abuso, revocación de enlaces, restauración de backup, pruebas E2E y procedimiento formal de rollback. No habilitar las otras 132 evidencias ni cerrar el origen Supabase Storage todavía.
