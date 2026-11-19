#!/usr/bin/env python3
"""Copy CreaLab evidence objects to private R2 and a local backup. Never deletes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
from urllib.parse import urlparse

SOURCE_BUCKET = "evidencias"
TARGET_BUCKET = "innova-crealab"
PREFIX = "evidencias/"
CHUNK = 1024 * 1024

def digest(stream, output=None):
    sha = hashlib.sha256()
    size = 0
    while True:
        chunk = stream.read(CHUNK)
        if not chunk:
            break
        sha.update(chunk)
        size += len(chunk)
        if output is not None:
            output.write(chunk)
    return sha.hexdigest(), size

def client(prefix, region):
    import boto3
    from botocore.config import Config
    endpoint = os.environ[prefix + "_ENDPOINT"]
    parsed = urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Se requiere un endpoint HTTPS sin credenciales en URL")
    if prefix == "SUPABASE":
        if parsed.hostname not in {"xfleqorozycfdmefdejs.supabase.co", "xfleqorozycfdmefdejs.storage.supabase.co"} or parsed.path.rstrip("/") != "/storage/v1/s3":
            raise ValueError("El endpoint no pertenece al proyecto CreaLab esperado")
    elif not parsed.hostname.endswith(".r2.cloudflarestorage.com"):
        raise ValueError("El endpoint no corresponde a R2")
    return boto3.client("s3", endpoint_url=endpoint, region_name=region,
        aws_access_key_id=os.environ[prefix + "_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ[prefix + "_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4", s3={"addressing_style":"path"},
            retries={"max_attempts":5,"mode":"standard"},
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required"))

def objects(source):
    return [obj for page in source.get_paginator("list_objects_v2").paginate(Bucket=SOURCE_BUCKET)
            for obj in page.get("Contents", [])]

def remote_digest(target, key):
    response = target.get_object(Bucket=TARGET_BUCKET, Key=key)
    try:
        return digest(response["Body"])
    finally:
        response["Body"].close()

def copy_one(source, target, obj, directory):
    from botocore.exceptions import ClientError
    key = obj["Key"]
    if len((PREFIX + key).encode("utf-8")) > 1024:
        raise ValueError("Una clave supera el límite de S3")
    local = directory / (hashlib.sha256(key.encode("utf-8")).hexdigest() + ".bin")
    source_response = source.get_object(Bucket=SOURCE_BUCKET, Key=key, IfMatch=obj["ETag"])
    content_type = source_response.get("ContentType", "application/octet-stream")
    metadata = source_response.get("Metadata", {})
    fd, tmp = tempfile.mkstemp(dir=directory)
    try:
        with os.fdopen(fd, "wb") as out:
            sha, size = digest(source_response["Body"], out)
            out.flush()
            os.fsync(out.fileno())
        if size != obj["Size"] or size != source_response["ContentLength"]:
            raise RuntimeError("El tamaño de origen cambió")
        if local.exists():
            with local.open("rb") as old:
                if digest(old) != (sha, size):
                    raise RuntimeError("El respaldo existente no coincide; usa otro directorio")
        else:
            os.replace(tmp, local)
        target_key = PREFIX + key
        try:
            head = target.head_object(Bucket=TARGET_BUCKET, Key=target_key)
        except ClientError as exc:
            if str(exc.response.get("Error", {}).get("Code")) not in {"404", "NoSuchKey", "NotFound"}:
                raise
            head = None
        if head is None:
            # Dedicated private destination, no concurrent writers during migration.
            extra = {"ContentType": content_type, "Metadata": {"sha256": sha}}
            if source_response.get("ContentDisposition"):
                extra["ContentDisposition"] = source_response["ContentDisposition"]
            target.upload_file(str(local), TARGET_BUCKET, target_key, ExtraArgs=extra)
        if remote_digest(target, target_key) != (sha, size):
            raise RuntimeError("R2 no coincide con el respaldo")
        verified_head = target.head_object(Bucket=TARGET_BUCKET, Key=target_key)
        if verified_head.get("ContentType") != content_type:
            raise RuntimeError("Content-Type de R2 no coincide")
        return {"source_key": key, "target_key": target_key, "backup_file": local.name,
                "bytes": size, "sha256": sha, "content_type": content_type,
                "source_etag": obj["ETag"], "source_metadata": metadata, "verified": True}
    finally:
        source_response["Body"].close()
        if os.path.exists(tmp):
            os.unlink(tmp)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--copy", action="store_true", help="Copia y verifica; sin este flag solo inventario")
    parser.add_argument("--backup-dir", type=Path, help="Directorio privado en disco cifrado o protegido")
    args = parser.parse_args()
    os.umask(0o077)
    source = client("SUPABASE", os.environ.get("SUPABASE_REGION", "us-west-2"))
    items = objects(source)
    total = sum(obj["Size"] for obj in items)
    print(json.dumps({"source_bucket": SOURCE_BUCKET, "objects": len(items), "bytes": total, "mode": "copy" if args.copy else "plan"}))
    if not args.copy:
        return
    if not args.backup_dir:
        parser.error("--copy requiere --backup-dir")
    directory = args.backup_dir
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.is_symlink() or directory.stat().st_mode & 0o077:
        raise PermissionError("Directorio de respaldo debe tener permisos 0700 y no ser enlace")
    if shutil.disk_usage(directory).free < total:
        raise RuntimeError("Espacio insuficiente para respaldo completo")
    target = client("R2", "auto")
    target.head_bucket(Bucket=TARGET_BUCKET)
    # Never publish the manifest. File names and metadata may be personal data.
    manifest = directory / "manifest.jsonl"
    with manifest.open("w", encoding="utf-8") as log:
        for index, obj in enumerate(items, 1):
            record = copy_one(source, target, obj, directory)
            log.write(json.dumps(record, ensure_ascii=False) + "\n")
            log.flush()
            os.fsync(log.fileno())
            print(f"Verificados {index}/{len(items)}", flush=True)
    before = sorted((x["Key"], x["Size"], x["ETag"]) for x in items)
    after = sorted((x["Key"], x["Size"], x["ETag"]) for x in objects(source))
    if before != after:
        raise RuntimeError("Origen cambió durante la copia; repetir antes de cualquier corte")
    print(json.dumps({"verified": len(items), "bytes": total, "source_deleted": False}))

if __name__ == "__main__":
    main()
