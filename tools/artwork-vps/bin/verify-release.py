#!/usr/bin/env python3
"""Verify byte-exact releases; atomically promote an isolated incoming snapshot.

Verification: Python 3.10+, standard library, Linux or Windows.
Publishing: Linux, root, regular local filesystem with dir_fd/O_NOFOLLOW support.
"""
import argparse
import datetime
import hashlib
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import unicodedata
import uuid

RELEASE_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,63}\Z")
HASH = re.compile(r"[0-9a-f]{64}\Z")
PUBLIC_EXTENSIONS = {".webp", ".png", ".jpg", ".jpeg", ".avif", ".gif", ".ico", ".woff", ".woff2", ".mp3", ".ogg", ".wav", ".ttf", ".otf", ".svg", ".css", ".json", ".txt", ".md", ".html"}
BLOCKED_DIRS = {".git", ".ssh", ".aws", ".azure", ".codex", ".agents", "node_modules", "__pycache__", ".cache", ".venv", "venv"}
SECRET_NAMES = re.compile(r"(?:\.env(?:[.-].*)?|\.npmrc|\.pypirc|\.netrc|id_rsa(?:\.pub)?|id_ed25519(?:\.pub)?|credentials(?:\.[^.]+)?|secrets?(?:\.[^.]+)?)\Z", re.I)
KEY_EXTENSIONS = re.compile(r"\.(?:pem|p12|pfx|key|keystore)\Z", re.I)
MAX_PUBLIC_FILE_BYTES = 25 * 1024 * 1024
MAX_MANIFEST_BYTES = 64 * 1024 * 1024
MAX_SAFE_INTEGER = 9007199254740991
CHUNK = 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def safe_number(value):
    return type(value) is int and 0 <= value <= MAX_SAFE_INTEGER


def validate_path(value, kind):
    require(isinstance(value, str) and 0 < len(value) <= 4096, "Invalid payload path")
    require(unicodedata.normalize("NFC", value) == value, "Path must use NFC Unicode")
    require(not value.startswith("/") and "\\" not in value and not re.search(r'[\x00-\x1f\x7f<>:"|?*]', value), "Unsafe payload path: " + value)
    for part in value.split("/"):
        require(part and part not in {".", ".."} and not part.endswith((".", " ")), "Unsafe path segment: " + value)
        require(not re.match(r"(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)", part, re.I), "Non-portable path: " + value)
        require(part.lower() not in BLOCKED_DIRS and not SECRET_NAMES.fullmatch(part) and not KEY_EXTENSIONS.search(part), "Secret or local-only path rejected: " + value)
        if kind == "public":
            require(not part.startswith("."), "Hidden public path rejected: " + value)
    if kind == "public":
        require(all(re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_.@-]*", segment) is not None for segment in value.split("/")), "Public paths must use safe ASCII with no leading dots or @: " + value)
        require(Path(value).suffix.lower() in PUBLIC_EXTENSIONS, "Unsupported public file type: " + value)
    return value


def no_symlink_ancestors(target):
    target = Path(os.path.abspath(target))
    for component in reversed((target, *target.parents)):
        if component.exists() or component.is_symlink():
            require(not component.is_symlink(), "Symlink/junction is not allowed: " + str(component))
            if hasattr(os.path, "isjunction"):
                require(not os.path.isjunction(component), "Junction is not allowed: " + str(component))



# This validates trusted, pinned web exports; it is not an arbitrary upload sanitizer.
TEXT_EXPORT_EXTENSIONS = {".svg", ".css", ".json", ".txt", ".md", ".html"}
SVG_TAGS = {"svg", "title", "rect", "path", "g", "defs", "mask", "ellipse", "linearGradient", "stop", "clipPath", "circle", "desc", "pattern", "text", "tspan"}
HTML_TAGS = {"html", "head", "meta", "title", "style", "body", "main", "header", "section", "article", "div", "h1", "h2", "h3", "h4", "p", "a", "img", "footer", "ul", "ol", "li", "span", "br", "strong", "em", "code", "pre", "table", "thead", "tbody", "tr", "th", "td", "small", "hr", "b", "i"}


def export_uri(value, allow_https=False, fragment_only=False):
    require(isinstance(value, str) and value != "", "Empty public export URI")
    require(not re.search(r"[\x00-\x20\x7f\\]", value), "Control whitespace or escape in public export URI")
    if fragment_only:
        require(re.fullmatch(r"#[A-Za-z0-9_.:-]+", value) is not None, "SVG may reference local fragments only")
    elif value.startswith("https://"):
        require(allow_https, "External URI is not allowed in this export")
    else:
        require(not value.startswith("//") and not re.match(r"[A-Za-z][A-Za-z0-9+.-]*:", value), "Unsafe public export URI scheme")
        require(not any(char in value for char in '<>\"\''), "Invalid public export URI")


def validate_css(text, fragment_only=False):
    plain = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    require("\\" not in plain, "CSS escapes are outside the reviewed export policy")
    require(not re.search(r"@import\b|expression\s*\(|(?:^|[;{\s])(?:behavior|-moz-binding)\s*:", plain, re.I), "Executable or imported CSS is not allowed")
    pattern = re.compile(r"url\(\s*(?:\"([^\"]*)\"|'([^']*)'|([^)]*))\s*\)", re.I)
    for match in pattern.finditer(plain):
        value = next(group for group in match.groups() if group is not None).strip()
        export_uri(value, allow_https=not fragment_only, fragment_only=fragment_only)
    require(not re.search(r"url\s*\(", pattern.sub("", plain), re.I), "Malformed CSS URL")


class StaticHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_style = False

    def handle_decl(self, decl):
        require(decl.lower().strip() == "doctype html", "Only the HTML doctype is allowed")

    def handle_pi(self, data):
        raise ValueError("HTML processing instructions are not allowed")

    def handle_starttag(self, tag, attrs):
        require(tag in HTML_TAGS, "Unsupported static HTML element: " + tag)
        seen = set()
        for name, value in attrs:
            require(name not in seen, "Duplicate HTML attribute")
            seen.add(name)
            require(not name.startswith("on") and name not in {"srcdoc", "srcset", "formaction", "http-equiv"}, "Active HTML attribute rejected")
            if name == "style":
                validate_css(value or "")
            if name in {"href", "src"}:
                export_uri(value or "", allow_https=tag == "a" and name == "href")
        if tag == "style":
            self.in_style = True

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        require(tag in HTML_TAGS, "Unsupported static HTML closing element")
        if tag == "style":
            self.in_style = False

    def handle_data(self, data):
        if self.in_style:
            validate_css(data)


def invalid_json_constant(value):
    raise ValueError("Non-finite JSON constant: " + value)


def validate_public_content(target):
    extension = target.suffix.lower()
    if extension not in TEXT_EXPORT_EXTENSIONS:
        return
    text = target.read_bytes().decode("utf-8")
    require("\x00" not in text, "NUL byte in public text export")
    if extension == ".json":
        json.loads(text, object_pairs_hook=unique_json_pairs, parse_constant=invalid_json_constant)
    elif extension == ".css":
        validate_css(text)
    elif extension == ".html":
        parser = StaticHTML()
        parser.feed(text)
        parser.close()
    elif extension == ".svg":
        require(not re.search(r"<!DOCTYPE|<!ENTITY", text, re.I), "SVG declarations/entities are not allowed")
        without_declaration = re.sub(r"^\ufeff?\s*<\?xml\s+[^?]*\?>", "", text, count=1, flags=re.I)
        require("<?" not in without_declaration, "SVG processing instructions are not allowed")
        document = ET.fromstring(text)
        require(document.tag in {"svg", "{http://www.w3.org/2000/svg}svg"}, "Expected SVG root")
        for element in document.iter():
            namespace, _, name = element.tag.rpartition("}")
            require(not namespace or namespace == "{http://www.w3.org/2000/svg", "Foreign SVG namespace rejected")
            name = name or element.tag
            require(name in SVG_TAGS, "Unsupported SVG element: " + name)
            for attribute, value in element.attrib.items():
                local = attribute.rsplit("}", 1)[-1].lower()
                require(not attribute.startswith("{") and not local.startswith("on") and local not in {"href", "src", "style", "base"}, "Active or external SVG attribute rejected")
                if re.search(r"url\s*\(", value, re.I) or "\\" in value:
                    validate_css(value, fragment_only=True)


def inventory(root, kind):
    files = []
    keys = set()
    directories = {}
    for directory, dirs, names in os.walk(root, followlinks=False):
        for name in dirs:
            target = Path(directory) / name
            require(stat.S_ISDIR(target.lstat().st_mode) and not target.is_symlink(), "Symlink/special directory rejected: " + str(target))
            if hasattr(os.path, "isjunction"):
                require(not os.path.isjunction(target), "Junction rejected: " + str(target))
            relative = target.relative_to(root).as_posix()
            validate_path(relative + "/placeholder.png", kind)
            key = relative.lower()
            require(key not in directories or directories[key] == relative, "Case-insensitive directory collision")
            directories[key] = relative
        for name in names:
            target = Path(directory) / name
            info = target.lstat()
            require(stat.S_ISREG(info.st_mode) and not target.is_symlink(), "Symlink/special file rejected: " + str(target))
            relative = target.relative_to(root).as_posix()
            validate_path(relative, kind)
            require(safe_number(info.st_size), "Unsupported file size")
            if kind == "public":
                require(info.st_size <= MAX_PUBLIC_FILE_BYTES, "Public file exceeds 25 MiB: " + relative)
                validate_public_content(target)
            require(relative.lower() not in keys, "Case-insensitive path collision")
            keys.add(relative.lower())
            files.append((relative, target))
    return sorted(files, key=lambda item: item[0].encode("utf-8"))


def checksum(target):
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0)
    fd = os.open(target, flags)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode), "Expected regular file")
        hasher = hashlib.sha256()
        size = 0
        while True:
            chunk = os.read(fd, CHUNK)
            if not chunk:
                break
            hasher.update(chunk)
            size += len(chunk)
        after = os.fstat(fd)
        require((before.st_size, before.st_mtime_ns, before.st_ctime_ns) == (after.st_size, after.st_mtime_ns, after.st_ctime_ns) and size == after.st_size, "File changed while hashing")
        return size, hasher.hexdigest()
    finally:
        os.close(fd)


def unique_json_pairs(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON key: " + key)
        result[key] = value
    return result


def verify(directory, expected_kind=None, expected_release=None, expected_manifest_hash=None):
    root = Path(os.path.abspath(directory))
    no_symlink_ancestors(root)
    require(root.is_dir(), "Release must be a directory")
    require(sorted(item.name for item in root.iterdir()) == ["manifest.json", "payload"], "Release root must contain only manifest.json and payload/")
    manifest_path = root / "manifest.json"
    info = manifest_path.lstat()
    require(stat.S_ISREG(info.st_mode) and not manifest_path.is_symlink() and info.st_size <= MAX_MANIFEST_BYTES, "Invalid manifest file")
    raw = manifest_path.read_bytes()
    manifest_hash = hashlib.sha256(raw).hexdigest()
    if expected_manifest_hash is not None:
        require(isinstance(expected_manifest_hash, str) and HASH.fullmatch(expected_manifest_hash), "Invalid expected manifest SHA-256")
        require(manifest_hash == expected_manifest_hash, "Manifest SHA-256 does not match the pinned revision")
    manifest = json.loads(raw, object_pairs_hook=unique_json_pairs)
    require(isinstance(manifest, dict) and type(manifest.get("schemaVersion")) is int and manifest["schemaVersion"] == 1 and manifest.get("kind") in {"public", "private"}, "Unsupported manifest schema/kind")
    kind = manifest["kind"]
    release_id = manifest.get("releaseId")
    require(isinstance(release_id, str) and RELEASE_ID.fullmatch(release_id), "Invalid release ID")
    if expected_kind is not None:
        require(kind == expected_kind, "Manifest kind does not match requested kind")
    if expected_release is not None:
        require(release_id == expected_release, "Manifest release does not match requested release")
    require(isinstance(manifest.get("createdAt"), str), "Invalid createdAt")
    datetime.datetime.fromisoformat(manifest["createdAt"].replace("Z", "+00:00"))
    records = manifest.get("files")
    require(isinstance(records, list) and records, "Manifest must contain files")
    payload = root / "payload"
    require(stat.S_ISDIR(payload.lstat().st_mode) and not payload.is_symlink(), "Invalid payload directory")
    actual = inventory(payload, kind)
    require(len(actual) == len(records), "Payload file count differs from manifest")
    previous = b""
    total = 0
    for index, record in enumerate(records):
        require(isinstance(record, dict), "Invalid manifest record")
        relative = validate_path(record.get("path"), kind)
        encoded = relative.encode("utf-8")
        require(encoded > previous, "Manifest paths must be unique and sorted by UTF-8 bytes")
        previous = encoded
        require(safe_number(record.get("bytes")) and isinstance(record.get("sha256"), str) and HASH.fullmatch(record["sha256"]), "Invalid file size/hash")
        require(actual[index][0] == relative, "Unexpected or missing payload file: " + relative)
        size, digest = checksum(actual[index][1])
        require(size == record["bytes"] and digest == record["sha256"], "Integrity mismatch: " + relative)
        total += size
        require(safe_number(total), "Release total exceeds safe integer range")
    totals = manifest.get("totals")
    require(isinstance(totals, dict) and type(totals.get("files")) is int and type(totals.get("bytes")) is int and totals["files"] == len(actual) and totals["bytes"] == total, "Manifest totals do not match")
    return {"passed": True, "kind": kind, "releaseId": release_id, "files": len(actual), "bytes": total, "manifestSha256": manifest_hash}


def open_dir(name, parent_fd=None):
    return os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)


def ensure_owned_dir(name, parent_fd, mode):
    try:
        os.mkdir(name, mode=mode, dir_fd=parent_fd)
    except FileExistsError:
        pass
    fd = open_dir(name, parent_fd)
    info = os.fstat(fd)
    require(info.st_uid == 0 and not info.st_mode & 0o022, "Publishing directory must be root-owned and not group/world writable: " + name)
    return fd


def copy_snapshot(source_fd, destination_fd, max_bytes, state, relative="", depth=0):
    """All source opens are anchored to directory descriptors, without following links."""
    require(depth <= 64, "Incoming directory nesting exceeds 64 levels")
    for name in sorted(os.listdir(source_fd)):
        state["entries"] += 1
        require(state["entries"] <= 100000, "Incoming release exceeds 100000 filesystem entries")
        require(name not in {".", ".."} and "/" not in name and "\\" not in name, "Invalid incoming entry")
        before = os.stat(name, dir_fd=source_fd, follow_symlinks=False)
        target_relative = f"{relative}/{name}" if relative else name
        require(not stat.S_ISLNK(before.st_mode), "Incoming symlink rejected: " + target_relative)
        if stat.S_ISDIR(before.st_mode):
            child_source = open_dir(name, source_fd)
            os.mkdir(name, mode=0o700, dir_fd=destination_fd)
            child_destination = open_dir(name, destination_fd)
            try:
                copy_snapshot(child_source, child_destination, max_bytes, state, target_relative, depth + 1)
            finally:
                os.close(child_source)
                os.close(child_destination)
        else:
            require(stat.S_ISREG(before.st_mode), "Incoming special file rejected: " + target_relative)
            input_fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=source_fd)
            output_fd = None
            try:
                start = os.fstat(input_fd)
                require(stat.S_ISREG(start.st_mode) and (start.st_dev, start.st_ino) == (before.st_dev, before.st_ino), "Incoming file changed before copying")
                output_fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=destination_fd)
                count = 0
                while True:
                    chunk = os.read(input_fd, CHUNK)
                    if not chunk:
                        break
                    state["bytes"] += len(chunk)
                    count += len(chunk)
                    require(state["bytes"] <= max_bytes, "Incoming release exceeds --max-bytes")
                    view = memoryview(chunk)
                    while view:
                        written = os.write(output_fd, view)
                        require(written > 0, "Short write")
                        view = view[written:]
                end = os.fstat(input_fd)
                require((start.st_size, start.st_mtime_ns, start.st_ctime_ns) == (end.st_size, end.st_mtime_ns, end.st_ctime_ns) and count == end.st_size, "Incoming file changed while copying")
                os.fsync(output_fd)
            finally:
                os.close(input_fd)
                if output_fd is not None:
                    os.close(output_fd)


def publish(args):
    require(sys.platform == "linux" and os.geteuid() == 0, "Publishing requires root on Linux; verification is portable")
    import fcntl
    require(isinstance(args.manifest_sha256, str) and HASH.fullmatch(args.manifest_sha256), "Publish requires the trusted local manifest SHA-256")
    require(RELEASE_ID.fullmatch(args.release), "Invalid --release")
    require(args.kind in {"public", "private"}, "Invalid --kind")
    require(args.max_bytes > 0 and args.reserve_bytes >= 0, "Invalid space limits")
    data = os.path.abspath(args.data_root)
    incoming = os.path.abspath(args.incoming)
    require(data != "/" and os.path.isabs(args.data_root), "--data-root must be an absolute dedicated directory")
    no_symlink_ancestors(data)
    require(incoming != "/" and os.path.isabs(args.incoming), "--incoming must be an absolute uploaded release directory")
    no_symlink_ancestors(incoming)
    # A root-controlled data path is needed for the private staging path used by
    # the portable verifier. The uploader may control the separate incoming path.
    for ancestor in (Path(data), *Path(data).parents):
        ancestor_info = ancestor.lstat()
        require(ancestor_info.st_uid == 0 and not ancestor_info.st_mode & 0o022, "DATA_ROOT ancestors must be root-owned and not group/world writable: " + str(ancestor))
    data_fd = open_dir(data)
    handles = []
    stage = None
    try:
        data_info = os.fstat(data_fd)
        require(data_info.st_uid == 0 and not data_info.st_mode & 0o022, "DATA_ROOT must be root-owned and not group/world writable")
        marker = os.stat(".everfolk-art-data-v1", dir_fd=data_fd, follow_symlinks=False)
        require(stat.S_ISREG(marker.st_mode) and marker.st_uid == 0 and not marker.st_mode & 0o022 and marker.st_size < 128, "Missing or unsafe .everfolk-art-data-v1 marker; run the VPS installer first")
        marker_fd = os.open(".everfolk-art-data-v1", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=data_fd)
        try:
            require(os.read(marker_fd, 128).strip() == b".everfolk-art-data-v1", "DATA_ROOT marker has unexpected contents")
        finally:
            os.close(marker_fd)
        lock_fd = os.open(".publish.lock", os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600, dir_fd=data_fd)
        handles.append(lock_fd)
        require(stat.S_ISREG(os.fstat(lock_fd).st_mode) and os.fstat(lock_fd).st_uid == 0, "Unsafe publish lock")
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        current = open_dir("/")
        handles.append(current)
        for component in incoming.split(os.sep)[1:]:
            require(component not in {"", ".", ".."}, "Unsafe incoming path")
            current = open_dir(component, current)
            handles.append(current)
        source_fd = current
        require(sorted(os.listdir(source_fd)) == ["manifest.json", "payload"], "Incoming root must contain only manifest.json and payload/")
        public_fd = ensure_owned_dir(args.kind, data_fd, 0o755 if args.kind == "public" else 0o700)
        handles.append(public_fd)
        releases_fd = ensure_owned_dir("releases", public_fd, 0o755 if args.kind == "public" else 0o700)
        handles.append(releases_fd)
        try:
            os.stat(args.release, dir_fd=releases_fd, follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise ValueError("Release already exists; immutable releases cannot be overwritten")
        staging_fd = ensure_owned_dir(".staging", data_fd, 0o700)
        handles.append(staging_fd)
        free = os.fstatvfs(data_fd).f_bavail * os.fstatvfs(data_fd).f_frsize
        # Incoming is already on this filesystem. Reserve space for a verified copy.
        require(free > args.reserve_bytes, "Free disk is below the requested reserve")
        allowed_copy = min(args.max_bytes, free - args.reserve_bytes)
        stage_name = "publish-" + uuid.uuid4().hex
        os.mkdir(stage_name, mode=0o700, dir_fd=staging_fd)
        stage = os.path.join(data, ".staging", stage_name)
        stage_fd = open_dir(stage)
        try:
            copy_snapshot(source_fd, stage_fd, allowed_copy, {"bytes": 0, "entries": 0})
            receipt = verify(stage, args.kind, args.release, args.manifest_sha256)
            # The snapshot is owned by root and not writable by the uploader.
            for directory, dirs, names in os.walk(stage, followlinks=False):
                os.chmod(directory, 0o755 if args.kind == "public" else 0o700)
                for name in names:
                    os.chmod(os.path.join(directory, name), 0o644 if args.kind == "public" else 0o600)
            os.fsync(stage_fd)
            os.rename(os.path.basename(stage), args.release, src_dir_fd=staging_fd, dst_dir_fd=releases_fd)
            os.fsync(releases_fd)
            stage = None
            receipt["publishedDirectory"] = os.path.join(data, args.kind, "releases", args.release)
            receipt["incomingPreserved"] = True
            receipt["payloadUrlPrefix"] = f"/releases/{args.release}/payload/" if args.kind == "public" else None
            return receipt
        finally:
            os.close(stage_fd)
    finally:
        # Only remove the unique root-owned staging directory created by this call.
        if stage is not None:
            staging_parent = os.path.join(data, ".staging")
            if os.path.dirname(stage) == staging_parent and os.path.basename(stage).startswith("publish-"):
                shutil.rmtree(stage)
        for handle in reversed(handles):
            os.close(handle)
        os.close(data_fd)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    check = commands.add_parser("verify")
    check.add_argument("--dir", required=True)
    check.add_argument("--kind", choices=("public", "private"))
    check.add_argument("--release")
    check.add_argument("--manifest-sha256")
    promote = commands.add_parser("publish")
    promote.add_argument("--incoming", required=True)
    promote.add_argument("--kind", choices=("public", "private"), required=True)
    promote.add_argument("--release", required=True)
    promote.add_argument("--data-root", default="/srv/everfolk-art")
    promote.add_argument("--max-bytes", type=int, default=20 * 1024**3)
    promote.add_argument("--reserve-bytes", type=int, default=2 * 1024**3)
    promote.add_argument("--manifest-sha256", required=True, help="Expected manifest hash from the trusted local build receipt; never compute this from an untrusted upload")
    public_check = commands.add_parser("validate-public")
    public_check.add_argument("--dir", required=True)
    args = parser.parse_args()
    if args.command == "validate-public":
        root = Path(os.path.abspath(args.dir))
        no_symlink_ancestors(root)
        require(root.is_dir(), "Public export root must be a directory")
        files = inventory(root, "public")
        result = {"passed": True, "files": len(files), "policy": "trusted-static-web-exports-v1"}
    else:
        result = verify(args.dir, args.kind, args.release, args.manifest_sha256) if args.command == "verify" else publish(args)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError, ET.ParseError) as error:
        print("verify-release: " + str(error), file=sys.stderr)
        sys.exit(1)
