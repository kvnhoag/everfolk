"""Bounded tests for the destructive boundaries of branch deployment preparation."""
import copy
import importlib.util
import io
import json
from pathlib import Path
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
