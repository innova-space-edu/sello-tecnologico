#!/usr/bin/env python3
"""Run migration on Dell with ephemeral credentials, entered in a private TTY."""
import argparse
import getpass
import os
from pathlib import Path
import runpy
import sys

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--backup-dir", required=True, type=Path)
    args = p.parse_args()
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        p.error("Ejecutar en una terminal SSH interactiva; no pegar claves en chat")
    if not args.backup_dir.is_absolute():
        p.error("La ruta de respaldo debe ser absoluta y estar en un volumen protegido")
    os.umask(0o077)
    os.environ["SUPABASE_ENDPOINT"] = "https://xfleqorozycfdmefdejs.storage.supabase.co/storage/v1/s3"
    os.environ["SUPABASE_REGION"] = "us-west-2"
    os.environ["R2_ENDPOINT"] = "https://84ed45de70a021c365e93b960c406d48.r2.cloudflarestorage.com"
    for name in ("SUPABASE_ACCESS_KEY_ID", "SUPABASE_SECRET_ACCESS_KEY", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"):
        value = getpass.getpass(name + ": ").strip()
        if not value:
            p.error("Credencial vacía")
        os.environ[name] = value
    print("Copia privada verificada. No se eliminarán los originales.")
    if input("Escribe COPIAR para confirmar: ") != "COPIAR":
        print("Cancelado sin escribir archivos en R2.")
        return
    path = Path(__file__).with_name("innova-storage-copy.py")
    sys.argv = [str(path), "--copy", "--backup-dir", str(args.backup_dir)]
    runpy.run_path(str(path), run_name="__main__")

if __name__ == "__main__":
    main()
