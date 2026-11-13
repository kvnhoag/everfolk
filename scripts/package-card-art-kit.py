"""Package the reviewed portable artist kit using only Python's standard library.

Run `node scripts/prepare-card-art-kit.mjs` first. No local dependency trees or
artist outputs are included. Every source and ZIP entry is checked against SHA256.
"""
import hashlib
import json
from pathlib import Path
import zipfile

repo = Path(__file__).resolve().parent.parent
kit = repo / "artwork" / "card-art-handoff-v1"
manifest = json.loads((kit / "package-manifest.json").read_text(encoding="utf-8"))
target = kit.with_suffix(".zip")
temporary = target.with_suffix(".zip.tmp")
files = manifest["files"] + [{"path": name} for name in ["package-manifest.json", "package-checksums.sha256"]]

with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for record in files:
        path = (kit / record["path"]).resolve(strict=True)
        if not path.is_relative_to(kit.resolve()) or not path.is_file():
            raise ValueError(f"File escapes kit: {record['path']}")
        data = path.read_bytes()
        if "sha256" in record and hashlib.sha256(data).hexdigest() != record["sha256"]:
            raise ValueError(f"File changed after inventory: {record['path']}")
        info = zipfile.ZipInfo("card-art-handoff-v1/" + record["path"], date_time=(2026, 11, 13, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)

with zipfile.ZipFile(temporary) as archive:
    if len(archive.infolist()) != len(files) or archive.testzip() is not None:
        raise ValueError("ZIP entry count or CRC verification failed")
    for record in manifest["files"]:
        if hashlib.sha256(archive.read("card-art-handoff-v1/" + record["path"])).hexdigest() != record["sha256"]:
            raise ValueError(f"ZIP hash mismatch: {record['path']}")

temporary.replace(target)
digest = hashlib.sha256(target.read_bytes()).hexdigest()
target.with_suffix(".zip.sha256").write_text(f"{digest}  {target.name}\n", encoding="utf-8")
print(json.dumps({"zip": str(target.relative_to(repo)), "files": len(files), "bytes": target.stat().st_size, "sha256": digest, "readbackVerified": True}))
