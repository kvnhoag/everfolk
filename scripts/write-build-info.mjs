import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const branch = process.env.EVERFOLK_BUILD_BRANCH?.trim() || "unknown";
const commit = process.env.EVERFOLK_BUILD_COMMIT?.trim() || "unknown";

if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(branch)) {
  throw new Error("EVERFOLK_BUILD_BRANCH must be a branch name.");
}
if (commit !== "unknown" && !/^[a-f0-9]{40}$/i.test(commit)) {
  throw new Error("EVERFOLK_BUILD_COMMIT must be a full Git SHA-1 commit.");
}

const output = resolve(projectRoot, process.argv[2] ?? "public/build-info.json");
const info = { schemaVersion: 1, version, branch, commit: commit.toLowerCase() };
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(info, null, 2) + "\n");
console.log(`Build metadata written for ${branch}@${info.commit}.`);
