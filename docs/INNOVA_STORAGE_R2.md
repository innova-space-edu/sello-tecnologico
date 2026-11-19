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
