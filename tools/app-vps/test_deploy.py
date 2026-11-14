"""Bounded tests for the destructive boundaries of branch deployment preparation."""
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("everfolk_app_deploy", ROOT / "deploy.py")
deploy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deploy)


class DeploymentPreparationTests(unittest.TestCase):
    def config(self):
        return json.loads((ROOT / "config.example.json").read_text())

    def make_archive(self, directory, entries):
        path = directory / "source.tar"
        with tarfile.open(path, "w") as archive:
            for name, kind, value in entries:
                member = tarfile.TarInfo(name)
                if kind == "file":
                    payload = value.encode()
                    member.size = len(payload)
                    member.mode = 0o755 if name.endswith(".sh") else 0o644
                    archive.addfile(member, io.BytesIO(payload))
                else:
                    member.type = {"directory": tarfile.DIRTYPE, "symlink": tarfile.SYMTYPE,
                                   "hardlink": tarfile.LNKTYPE, "device": tarfile.CHRTYPE}[kind]
                    if kind in {"symlink", "hardlink"}:
                        member.linkname = value
                    archive.addfile(member)
        return path

    def test_export_omits_sources_builds_dependencies_and_private_env(self):
        names = ["artwork", "artifacts", ".git", "node_modules", "dist", ".wrangler",
                 ".dev.vars", ".env", ".env.local", ".env.production", ".env.staging",
                 ".env.production.example", "Dockerfile", "package.json", "public", "src"]
        self.assertEqual(deploy.allowed_top_level(names),
                         [".env.production.example", "Dockerfile", "package.json", "public", "src"])

    def test_valid_archive_preserves_bytes_and_executable_mode(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            context = directory / "context"
            context.mkdir()
            archive = self.make_archive(directory, [("docker/", "directory", ""),
                ("docker/entrypoint.sh", "file", "#!/bin/sh\necho ready\n"),
                ("package.json", "file", '{"name":"everfolk"}')])
            deploy.safe_extract(archive, context)
            self.assertEqual((context / "docker/entrypoint.sh").read_bytes(), b"#!/bin/sh\necho ready\n")
            self.assertEqual((context / "docker/entrypoint.sh").stat().st_mode & 0o777, 0o755)

    def test_archive_rejects_traversal_absolute_paths_and_excluded_roots(self):
        for name in ["../escape.txt", "src/../../escape.txt", "/tmp/escape.txt",
                     "artwork/private.png", "artifacts/release.tar", ".env.production"]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                context = directory / "context"
                context.mkdir()
                archive = self.make_archive(directory, [(name, "file", "private")])
                with self.assertRaises(ValueError):
                    deploy.safe_extract(archive, context)
                self.assertFalse((directory / "escape.txt").exists())

    def test_archive_rejects_symbolic_hard_links_and_devices(self):
        for kind in ["symlink", "hardlink", "device"]:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                context = directory / "context"
                context.mkdir()
                archive = self.make_archive(directory, [("src/escape", kind, "/etc/passwd")])
                with self.assertRaises(ValueError):
                    deploy.safe_extract(archive, context)

    def test_archive_rejects_duplicate_member_overwrites(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            context = directory / "context"
            context.mkdir()
            archive = self.make_archive(directory, [("package.json", "file", "first"),
                                                    ("package.json", "file", "second")])
            with self.assertRaises(ValueError):
                deploy.safe_extract(archive, context)
            self.assertEqual((context / "package.json").read_text(), "first")

    def test_legacy_main_dockerfile_gets_build_configuration_once(self):
        source = "FROM node:24 AS build\nCOPY . .\nRUN pnpm build\nFROM node:24\nCOPY --from=build /app/dist ./dist\n"
        overlaid = deploy.overlay_dockerfile(source)
        self.assertIn("ARG VITE_EVERFOLK_ASSET_BASE_URL=", overlaid)
        self.assertLess(overlaid.index("ENV VITE_EVERFOLK_ASSET_BASE_URL"), overlaid.index("RUN pnpm build"))
        self.assertEqual(deploy.overlay_dockerfile(overlaid), overlaid)
        self.assertEqual(overlaid.split("FROM node:24\n")[-1], source.split("FROM node:24\n")[-1])

    def test_current_dev_dockerfile_is_not_rewritten(self):
        source = (ROOT.parent.parent / "Dockerfile").read_text()
        self.assertIn("ARG VITE_EVERFOLK_ASSET_BASE_URL", source)
        self.assertEqual(deploy.overlay_dockerfile(source), source)

    def test_unrecognized_legacy_build_boundary_fails_closed(self):
        for source in ["FROM node:24\nRUN pnpm build\n", "COPY . .\nCOPY . .\nRUN pnpm build\n"]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                deploy.overlay_dockerfile(source)

    def test_expected_branch_host_mapping_is_accepted(self):
        config = self.config()
        self.assertIs(deploy.validate_config(config), config)
        self.assertEqual(config["branches"]["dev"]["hostname"], "beta.everfolk.life")
        self.assertEqual(config["branches"]["main"]["hostname"], "everfolk.life")

    def test_wrong_hosts_missing_branch_and_shared_state_are_rejected(self):
        mutations = [
            lambda c: c["branches"]["dev"].update(hostname="dev.everfolk.life"),
            lambda c: c["branches"].pop("main"),
            lambda c: c["branches"]["dev"].update(volume=c["branches"]["main"]["volume"]),
            lambda c: c["branches"]["dev"].update(port=c["branches"]["main"]["port"]),
            lambda c: c["branches"]["dev"].update(project=c["branches"]["main"]["project"]),
            lambda c: c["branches"]["dev"].update(container=c["branches"]["main"]["container"]),
            lambda c: c["branches"]["dev"].update(legacyContainer="app-everfolk-1"),
        ]
        for mutation in mutations:
            config = self.config()
            mutation(config)
            with self.subTest(config=config), self.assertRaises(ValueError):
                deploy.validate_config(config)

    def test_unsafe_names_ports_roots_and_external_env_paths_are_rejected(self):
        mutations = [
            lambda c: c.update(root="/"),
            lambda c: c.update(root="/opt/everfolk"),
            lambda c: c.update(root="relative/deploy"),
            lambda c: c.update(network="app_default; echo unsafe"),
            lambda c: c["branches"]["dev"].update(container="../app"),
            lambda c: c["branches"]["dev"].update(port=True),
            lambda c: c["branches"]["dev"].update(port=80),
            lambda c: c["branches"]["dev"].update(envFile="/etc/private.env"),
            lambda c: c["branches"]["dev"].update(envFile="/opt/everfolk/deploy/env/../../private.env"),
        ]
        for mutation in mutations:
            config = self.config()
            mutation(config)
            with self.subTest(config=config), self.assertRaises(ValueError):
                deploy.validate_config(config)

    def test_credentials_in_repository_or_public_asset_url_are_rejected(self):
        mutations = [
            lambda c: c.update(repository="https://user:secret@github.com/kvnhoag/everfolk.git"),
            lambda c: c.update(assetBaseUrl="https://user:secret@everfolk.life/releases/v1/payload/"),
        ]
        for mutation in mutations:
            config = self.config()
            mutation(config)
            with self.subTest(config=config), self.assertRaises(ValueError):
                deploy.validate_config(config)

    @unittest.skipUnless(shutil.which("git"), "Git is required for the filtered export integration")
    def test_real_filtered_git_export_fetches_only_permitted_blobs(self):
        # Exercise the actual upload-pack protocol, including more than one
        # prefetch batch; source artwork is a distinct, incompressible 1 MiB blob.
        with tempfile.TemporaryDirectory(prefix="everfolk-export-test-") as temporary:
            directory = Path(temporary)
            source, remote, cache = [directory / name for name in ["source", "remote.git", "cache.git"]]
            source.mkdir()
            environment = os.environ.copy()
            environment.update(GIT_TERMINAL_PROMPT="0", GIT_NO_LAZY_FETCH="1")

            def git(*arguments, cwd=None):
                return subprocess.run(["git", *map(str, arguments)], cwd=cwd, env=environment,
                    check=True, text=True, capture_output=True).stdout

            git("init", "--initial-branch=main", source)
            git("config", "user.name", "Everfolk test fixture", cwd=source)
            git("config", "user.email", "fixture@example.invalid", cwd=source)
            (source / "package.json").write_text('{"name":"fixture","version":"0.1.0"}\n')
            (source / "Dockerfile").write_text("FROM node:24 AS build\nCOPY . .\nRUN pnpm build\n")
            (source / "public").mkdir()
            for number in range(270):
                (source / "public" / f"asset-{number:03d}.txt").write_text(f"public fixture {number}\n")
            (source / "artwork").mkdir()
            private_master = os.urandom(1024 * 1024)
            (source / "artwork" / "private-master.bin").write_bytes(private_master)
            # Repacking can delta this permitted preview against the private master.
            # The server must still return only the explicitly requested blobs.
            (source / "public" / "preview.bin").write_bytes(private_master[:65536])
            (source / "entrypoint.sh").write_text("#!/bin/sh\necho ready\n")
            (source / "entrypoint.sh").chmod(0o755)
            (source / ".env.production").write_text("FIXTURE_ONLY=excluded-value\n")
            git("add", ".", cwd=source)
            git("commit", "-m", "Create bounded export fixture", cwd=source)
            commit = git("rev-parse", "HEAD", cwd=source).strip()
            git("clone", "--bare", source, remote)
            git("--git-dir", remote, "config", "uploadpack.allowFilter", "true")
            git("--git-dir", remote, "config", "uploadpack.allowAnySHA1InWant", "true")
            git("--git-dir", remote, "repack", "-adf", "--write-bitmap-index")
            git("init", "--bare", cache)
            git("--git-dir", cache, "remote", "add", "origin", remote.as_uri())
            git("--git-dir", cache, "config", "remote.origin.promisor", "true")
            git("--git-dir", cache, "config", "remote.origin.partialclonefilter", "blob:none")
            git("--git-dir", cache, "fetch", "--no-tags", "--depth=1", "--filter=blob:none", "origin", "main")

            def cached_blobs():
                output = git("--git-dir", cache, "cat-file", "--batch-all-objects",
                             "--batch-check=%(objecttype) %(objectsize) %(objectname)")
                return {fields[2]: int(fields[1]) for line in output.splitlines()
                        if (fields := line.split())[0] == "blob"}

            self.assertEqual(cached_blobs(), {}, "initial partial fetch must contain no blobs")
            expected = {}
            excluded = set()
            for record in git("ls-tree", "-rlz", "HEAD", cwd=source).split("\0"):
                if not record:
                    continue
                metadata, path = record.split("\t", 1)
                _, kind, oid, size = metadata.split()
                if path.startswith("artwork/") or path == ".env.production":
                    excluded.add(oid)
                elif kind == "blob":
                    expected[oid] = int(size)
            config = self.config()
            config["root"] = str(directory / "deployment")
            context = deploy.prepare_context(config, cache, "main", commit)
            received = cached_blobs()
            self.assertEqual(received, expected, "every received blob must belong to the allowed application export")
            self.assertTrue(excluded.isdisjoint(received), "private artwork/env blobs must not reach the deployment cache")
            self.assertLess(sum(received.values()), 100_000)
            self.assertEqual((context / "public/preview.bin").read_bytes(), private_master[:65536])
            self.assertEqual((context / "entrypoint.sh").stat().st_mode & 0o777, 0o755)
            self.assertFalse((context / "artwork").exists())
            self.assertFalse((context / ".env.production").exists())
            self.assertEqual((context / "public/asset-269.txt").read_text(), "public fixture 269\n")
            self.assertEqual(json.loads((context / "public/build-info.json").read_text())["commit"], commit)

    def test_compose_has_separate_external_data_and_loopback_only_port(self):
        config = self.config()
        for branch, expected_volume in [("main", "app_everfolk-data"), ("dev", "everfolk-beta-data")]:
            with self.subTest(branch=branch):
                item = config["branches"][branch]
                spec = deploy.compose_spec(config, item, "everfolk-app:test")
                app = spec["services"]["app"]
                self.assertEqual(app["ports"], [f"127.0.0.1:{item['port']}:8787"])
                self.assertEqual(app["env_file"], [item["envFile"]])
                self.assertNotIn("environment", app)
                self.assertEqual(spec["volumes"]["data"], {"external": True, "name": expected_volume})
                self.assertEqual(spec["networks"]["proxy"], {"external": True, "name": "app_default"})
                self.assertEqual(app["mem_limit"], "4g")
                self.assertEqual(app["cpus"], 2)


if __name__ == "__main__":
    unittest.main()
