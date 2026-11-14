#!/usr/bin/env python3
"""Build immutable branch images and deploy isolated Everfolk applications."""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request

EXCLUDED_TOP_LEVEL = {"artwork", "artifacts", ".git", "node_modules", "dist", ".wrangler", ".dev.vars", ".env", ".env.local", ".env.production"}
BRANCH_HOSTS = {"main": "everfolk.life", "dev": "beta.everfolk.life"}
NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\Z")
SHA = re.compile(r"[0-9a-f]{40}\Z")


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def run(args, *, cwd=None, capture=False, check=True):
    env = os.environ.copy()
    env.update(GIT_TERMINAL_PROMPT="0", GIT_LFS_SKIP_SMUDGE="1", DOCKER_BUILDKIT="1")
    return subprocess.run([str(x) for x in args], cwd=cwd, env=env, text=True,
                          stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.PIPE if capture else None, check=check)


def json_read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def json_write(path, value, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".new")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.chmod(mode)
    temporary.replace(path)


def validate_config(config):
    root = Path(config["root"])
    if not root.is_absolute() or root.resolve() != root or str(root) in {"/", "/opt", "/opt/everfolk"}:
        raise ValueError("root must be an absolute dedicated deployment directory")
    url = urllib.parse.urlsplit(config["repository"])
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError("repository must be a credential-free HTTPS Git URL")
    asset = urllib.parse.urlsplit(config["assetBaseUrl"])
    if asset.scheme != "https" or asset.netloc != "everfolk.life" or asset.username or asset.password or not asset.path.startswith("/releases/") or not asset.path.endswith("/payload/") or asset.query or asset.fragment:
        raise ValueError("assetBaseUrl must name a versioned Everfolk HTTPS payload")
    if not NAME.fullmatch(config["network"]):
        raise ValueError("invalid external network")
    if set(config["branches"]) != set(BRANCH_HOSTS):
        raise ValueError("configure exactly main and dev")
    ports, volumes, projects, containers = set(), set(), set(), set()
    for branch, host in BRANCH_HOSTS.items():
        item = config["branches"][branch]
        if item["hostname"] != host:
            raise ValueError(f"{branch} must map to {host}")
        for key, values in [("project", projects), ("container", containers), ("volume", volumes)]:
            if not NAME.fullmatch(item[key]) or item[key] in values:
                raise ValueError(f"{key} must be safe and distinct for each branch")
            values.add(item[key])
        port = item["port"]
        if not isinstance(port, int) or isinstance(port, bool) or not 1024 <= port <= 65535 or port in ports:
            raise ValueError("health ports must be distinct unprivileged ports")
        ports.add(port)
        env = Path(item["envFile"])
        if not env.is_absolute() or env.resolve() != env or not env.is_relative_to(root):
            raise ValueError("envFile must be inside the dedicated deployment root")
        if item.get("legacyContainer") and (branch != "main" or item["legacyContainer"] != "app-everfolk-1"):
            raise ValueError("only the known legacy production container may be adopted")
    return config


def allowed_top_level(paths):
    return [name for name in paths if name not in EXCLUDED_TOP_LEVEL and not name.startswith(".env") or name == ".env.production.example"]


def safe_extract(archive, destination):
    """Extract regular repository files only; reject traversal, links and device files."""
    destination = destination.resolve()
    seen = set()
    with tarfile.open(archive, "r:") as source:
        for member in source:
            relative = PurePosixPath(member.name)
            if relative.is_absolute() or not relative.parts or ".." in relative.parts or relative.parts[0] in EXCLUDED_TOP_LEVEL:
                raise ValueError(f"unsafe archive entry: {member.name}")
            if member.name in seen:
                raise ValueError("duplicate archive entry")
            seen.add(member.name)
            target = destination.joinpath(*relative.parts)
            if not target.resolve().is_relative_to(destination):
                raise ValueError("archive path escaped context")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                stream = source.extractfile(member)
                if stream is None:
                    raise ValueError("missing archive payload")
                with target.open("wb") as output:
                    while block := stream.read(1024 * 1024):
                        output.write(block)
                target.chmod(member.mode & 0o777)
            else:
                raise ValueError(f"archive links/special files are unsupported: {member.name}")


def overlay_dockerfile(source):
    if "ARG VITE_EVERFOLK_ASSET_BASE_URL" in source:
        return source
    anchor = "COPY . .\n"
    if source.count(anchor) != 1:
        raise ValueError("Dockerfile no longer has the expected build-stage COPY boundary")
    overlay = ("# VPS deployment overlay: public build configuration only.\n"
               "ARG VITE_EVERFOLK_ASSET_BASE_URL=\n"
               "ARG EVERFOLK_BUILD_BRANCH=unknown\n"
               "ARG EVERFOLK_BUILD_COMMIT=unknown\n"
               "ENV VITE_EVERFOLK_ASSET_BASE_URL=${VITE_EVERFOLK_ASSET_BASE_URL}\n")
    return source.replace(anchor, anchor + overlay)


def prepare_context(config, repo, branch, commit):
    root = Path(config["root"])
    release = root / "releases" / branch / commit
    context = release / "context"
    if (release / "context-ready.json").exists():
        return context
    if context.exists():
        raise RuntimeError(f"partial context requires operator review: {context}")
    release.mkdir(parents=True, exist_ok=True)
    paths = run(["git", "--git-dir", repo, "ls-tree", "--name-only", "-z", commit], capture=True).stdout.split("\0")
    paths = allowed_top_level([p for p in paths if p])
    if "Dockerfile" not in paths or "package.json" not in paths:
        raise RuntimeError("ref lacks an application build")
    # Batch the permitted blob wants. Lazy archive reads otherwise fetch missing
    # objects individually, while an ordinary full checkout fetches source artwork.
    records = run(["git", "--git-dir", repo, "ls-tree", "-r", "-z", commit, "--", *paths], capture=True).stdout.split("\0")
    wanted = {record.split("\t", 1)[0].split()[2] for record in records if record and record.split()[1] == "blob"}
    present = set(run(["git", "--git-dir", repo, "cat-file", "--batch-all-objects", "--batch-check=%(objectname)"], capture=True).stdout.splitlines())
    missing = sorted(wanted - present)
    if missing:
        print(f"{branch}: fetching {len(missing)} application blobs; artwork excluded", flush=True)
        env = os.environ.copy()
        env.update(GIT_TERMINAL_PROMPT="0", GIT_LFS_SKIP_SMUDGE="1")
        subprocess.run(["git", "--git-dir", str(repo), "-c", "fetch.negotiationAlgorithm=noop", "fetch", "--no-tags", "--no-write-fetch-head", "--recurse-submodules=no", "--no-filter", "origin", "--stdin"], input="\n".join(missing) + "\n", text=True, env=env, check=True)
    archive = release / "context.tar"
    with archive.open("wb") as output:
        subprocess.run(["git", "--git-dir", str(repo), "archive", "--format=tar", commit, "--", *paths], stdout=output, check=True)
    context.mkdir()
    safe_extract(archive, context)
    archive.unlink()
    dockerfile = context / "Dockerfile"
    dockerfile.write_text(overlay_dockerfile(dockerfile.read_text()))
    ignore = context / ".dockerignore"
    with ignore.open("a") as output:
        output.write("\n# VPS deployment boundary\nartwork\nartifacts\n.git\nnode_modules\ndist\n.wrangler\n.env*\n!.env.production.example\n")
    package = json_read(context / "package.json")
    metadata = {"schemaVersion": 1, "version": package["version"], "branch": branch, "commit": commit}
    json_write(context / "public" / "build-info.json", metadata, 0o644)
    json_write(release / "context-ready.json", metadata)
    return context


def fetch_commit(config, branch):
    repo = Path(config["root"]) / "repo.git"
    if not repo.exists():
        run(["git", "init", "--bare", repo])
        run(["git", "--git-dir", repo, "remote", "add", "origin", config["repository"]])
        run(["git", "--git-dir", repo, "config", "remote.origin.promisor", "true"])
        run(["git", "--git-dir", repo, "config", "remote.origin.partialclonefilter", "blob:none"])
    actual = run(["git", "--git-dir", repo, "remote", "get-url", "origin"], capture=True).stdout.strip()
    if actual != config["repository"]:
        raise RuntimeError("existing repository has a different origin")
    ref = f"refs/remotes/origin/{branch}"
    run(["git", "--git-dir", repo, "fetch", "--no-tags", "--depth=1", "--filter=blob:none", "origin", f"+refs/heads/{branch}:{ref}"])
    commit = run(["git", "--git-dir", repo, "rev-parse", ref], capture=True).stdout.strip()
    if not SHA.fullmatch(commit):
        raise RuntimeError("Git returned an invalid commit ID")
    return repo, commit


def compose_spec(config, item, image):
    return {"services": {"app": {
        "image": image, "container_name": item["container"], "restart": "unless-stopped",
        "env_file": [item["envFile"]], "ports": [f"127.0.0.1:{item['port']}:8787"],
        "volumes": ["data:/data"], "networks": ["proxy"], "mem_limit": "4g", "cpus": 2,
        "logging": {"driver": "json-file", "options": {"max-size": "10m", "max-file": "3"}}
    }}, "volumes": {"data": {"external": True, "name": item["volume"]}},
        "networks": {"proxy": {"external": True, "name": config["network"]}}}


def inspect_container(name):
    p = run(["docker", "inspect", name], capture=True, check=False)
    return json.loads(p.stdout)[0] if p.returncode == 0 else None


def managed_container(item):
    current = inspect_container(item["container"])
    if current and current["Config"].get("Labels", {}).get("com.docker.compose.project") != item["project"]:
        raise RuntimeError("existing application container belongs to another project")
    return current


def stop_if_running(name):
    current = inspect_container(name)
    active = bool(current and current["State"]["Running"])
    if active:
        run(["docker", "stop", "--time", "30", name])
    return active


def backup_volume(config, item, branch, commit):
    p = run(["docker", "volume", "inspect", item["volume"]], capture=True, check=False)
    if p.returncode:
        run(["docker", "volume", "create", "--label", "io.everfolk.deployment=branch", item["volume"]])
        p = run(["docker", "volume", "inspect", item["volume"]], capture=True)
    mount = Path(json.loads(p.stdout)[0]["Mountpoint"]).resolve()
    docker_root = Path(run(["docker", "info", "--format", "{{.DockerRootDir}}"], capture=True).stdout.strip()).resolve()
    if not mount.is_relative_to(docker_root / "volumes") or not mount.is_dir():
        raise RuntimeError("unexpected Docker volume location")
    directory = Path(config["root"]) / "backups" / branch
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup = directory / f"{stamp}-before-{commit[:12]}.tar.gz"
    with tarfile.open(backup, "w:gz") as archive:
        archive.add(mount, arcname="data")
    backup.chmod(0o600)
    return str(backup)


def health(item, commit, timeout=120):
    deadline = time.monotonic() + timeout
    last = "application not ready"
    while True:
        try:
            for path in ["/", "/api/session", "/api/worlds", "/api/signin/config", "/build-info.json"]:
                request = urllib.request.Request(f"http://127.0.0.1:{item['port']}{path}", headers={"Host": item["hostname"], "User-Agent": "Everfolk-Deployment-Health/1"})
                with urllib.request.urlopen(request, timeout=10) as response:
                    if response.status != 200:
                        raise RuntimeError(f"{path} status {response.status}")
                    if path != "/":
                        value = json.load(response)
                        if path == "/build-info.json" and value.get("commit") != commit:
                            raise RuntimeError("served commit does not match requested Git ref")
            return
        except (OSError, ValueError, RuntimeError, urllib.error.URLError) as error:
            last = str(error)
        if time.monotonic() >= deadline:
            raise RuntimeError(f"health check failed: {last}")
        time.sleep(2)


def deploy(config, branch, force=False, build_only=False):
    item = config["branches"][branch]
    root = Path(config["root"])
    state_path = root / "state" / f"{branch}.json"
    previous = json_read(state_path)
    repo, commit = fetch_commit(config, branch)
    current = managed_container(item)
    if not build_only and not force and previous and previous.get("commit") == commit and previous.get("assetBaseUrl") == config["assetBaseUrl"] and current and current["State"]["Running"]:
        try:
            health(item, commit, timeout=10)
            print(f"{branch}: unchanged and healthy at {commit}", flush=True)
            return previous
        except RuntimeError:
            print(f"{branch}: running ref failed health; reapplying {commit}", flush=True)
    context = prepare_context(config, repo, branch, commit)
    version = json_read(context / "package.json")["version"]
    image = f"everfolk-app:{branch}-{commit}"
    existing = run(["docker", "image", "inspect", image], capture=True, check=False)
    if existing.returncode:
        print(f"{branch}: building {commit} ({version})", flush=True)
        run(["docker", "build", "--tag", image,
             "--label", f"org.opencontainers.image.revision={commit}",
             "--label", f"org.opencontainers.image.ref.name={branch}",
             "--label", f"org.opencontainers.image.version={version}",
             "--label", f"io.everfolk.asset-base-url={config['assetBaseUrl']}",
             "--build-arg", f"VITE_EVERFOLK_ASSET_BASE_URL={config['assetBaseUrl']}",
             "--build-arg", f"EVERFOLK_BUILD_BRANCH={branch}",
             "--build-arg", f"EVERFOLK_BUILD_COMMIT={commit}", context])
    else:
        labels = json.loads(existing.stdout)[0]["Config"].get("Labels", {})
        if labels.get("org.opencontainers.image.revision") != commit or labels.get("io.everfolk.asset-base-url") != config["assetBaseUrl"]:
            raise RuntimeError("existing immutable image has incompatible build metadata")
    if build_only:
        result = {"branch": branch, "commit": commit, "version": version, "image": image, "context": str(context), "buildOnly": True}
        print(json.dumps(result), flush=True)
        return result
    env_file = Path(item["envFile"])
    if not env_file.is_file() or env_file.stat().st_mode & 0o077:
        raise RuntimeError(f"private env file missing or too permissive: {env_file}")
    run(["docker", "network", "inspect", config["network"]], capture=True)
    runtime = root / "runtime" / branch
    runtime.mkdir(parents=True, exist_ok=True)
    compose = runtime / "compose.json"
    prefix = ["docker", "compose", "--project-name", item["project"], "--file", str(compose)]
    json_write(compose, compose_spec(config, item, image))
    run([*prefix, "config", "--quiet"])
    legacy_was_running = False
    backup = None
    stopped_current = False
    try:
        if item.get("legacyContainer"):
            legacy = inspect_container(item["legacyContainer"])
            if legacy and legacy["State"]["Running"]:
                labels = legacy["Config"].get("Labels", {})
                volumes = {m.get("Name") for m in legacy.get("Mounts", []) if m.get("Destination") == "/data"}
                if labels.get("com.docker.compose.project") != "app" or labels.get("com.docker.compose.service") != "everfolk" or item["volume"] not in volumes:
                    raise RuntimeError("legacy container identity or data volume did not match")
                legacy_was_running = stop_if_running(item["legacyContainer"])
        stopped_current = stop_if_running(item["container"])
        backup = backup_volume(config, item, branch, commit)
        run([*prefix, "up", "--detach", "--no-deps", "app"])
        health(item, commit)
    except Exception:
        print(f"{branch}: deployment failed; persistent data backup: {backup or 'not created'}", file=sys.stderr, flush=True)
        if previous:
            json_write(compose, compose_spec(config, item, previous["image"]))
            rollback = run([*prefix, "up", "--detach", "--no-deps", "app"], check=False)
            if rollback.returncode == 0:
                try:
                    health(item, previous["commit"], timeout=45)
                    print(f"{branch}: previous image restored; database migration rollback was NOT attempted", file=sys.stderr)
                except Exception:
                    print(f"{branch}: previous image also failed health; operator must inspect database backup", file=sys.stderr)
        elif legacy_was_running:
            stop_if_running(item["container"])
            run(["docker", "start", item["legacyContainer"]], check=False)
            print("Legacy application restarted; database migration rollback was NOT attempted", file=sys.stderr)
        elif stopped_current:
            print("No successful deployment receipt exists; inspect the stopped container and backup", file=sys.stderr)
        raise
    result = {"branch": branch, "hostname": item["hostname"], "commit": commit, "version": version,
              "image": image, "assetBaseUrl": config["assetBaseUrl"], "deployedAt": now(),
              "dataVolume": item["volume"], "backup": backup, "context": str(context)}
    json_write(state_path, result)
    print(json.dumps(result), flush=True)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default="/opt/everfolk/deploy/config.json")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--branch", choices=BRANCH_HOSTS)
    group.add_argument("--all", action="store_true")
    group.add_argument("--status", action="store_true")
    parser.add_argument("--force", action="store_true", help="reapply a ref even if already deployed")
    parser.add_argument("--build-only", action="store_true", help="build immutable images without stopping or starting applications")
    args = parser.parse_args(argv)
    config = validate_config(json_read(Path(args.config)))
    root = Path(config["root"])
    if args.status:
        print(json.dumps({branch: json_read(root / "state" / f"{branch}.json") for branch in BRANCH_HOSTS}, indent=2))
        return 0
    if os.geteuid() != 0:
        raise RuntimeError("deployment requires root for the Docker data-volume backup")
    root.mkdir(parents=True, exist_ok=True)
    with (root / "deploy.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Another branch deployment is running; skipped.")
            return 0
        failures = []
        # Deploy beta first; a beta failure does not stop independent main tracking.
        for branch in (["dev", "main"] if args.all else [args.branch]):
            try:
                deploy(config, branch, args.force, args.build_only)
            except Exception as error:
                failures.append(branch)
                print(f"{branch}: {error}", file=sys.stderr, flush=True)
        return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
