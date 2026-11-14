import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const allJobs = () => ({ app: true, contract: true, art: true });

/** Unknown paths deliberately run app verification; only known independent inputs skip it. */
export function jobsForPaths(paths) {
  const jobs = { app: false, contract: false, art: false };
  for (const path of paths) {
    if (/\.md$/i.test(path) || /^(?:design|\.githooks)\//.test(path)) continue;
    if (path.startsWith(".github/") || path === "scripts/ci-changes.mjs") return allJobs();
    if (path.startsWith("contract/")) { jobs.contract = true; continue; }
    if (path.startsWith("test/audits/")) continue;
    if (path.startsWith("test/art/") || path.startsWith("tools/character-creator/") || path.startsWith("artwork/")) {
      jobs.art = true;
      continue;
    }
    jobs.app = true;
    if (/^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/.test(path) ||
        (path.startsWith("public/") || path.startsWith("assets/") || path.startsWith("chain/catalog/") || path === "chain/ids.ts") || /^(?:scripts\/.*(?:art|portrait|avatar|pixel)|client\/models\/(?:card-art|portrait-|avatar-|banner-|life-background))/.test(path)) jobs.art = true;
  }
  return jobs;
}

export function changedJobs(eventName, event, git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })) {
  const base = event.pull_request?.base?.sha ?? event.before;
  if (eventName === "workflow_dispatch" || !/^[a-f0-9]{40}$/i.test(base ?? "") || /^0+$/.test(base)) return allJobs();
  try {
    // Compare the entire push or PR, including deletions. Fetch no historical art blobs.
    git(["fetch", "--no-tags", "--depth=1", "--filter=blob:none", "origin", base]);
    return jobsForPaths(git(["diff", "--name-only", "--no-renames", base, "HEAD"]).trim().split("\n").filter(Boolean));
  } catch (error) {
    console.warn("Could not establish the changed paths; running all verification jobs.", error.message);
    return allJobs();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const jobs = changedJobs(process.env.GITHUB_EVENT_NAME, event);
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(jobs).map(([name, run]) => `${name}=${run}\n`).join(""));
  console.log("Required verification:", jobs);
}
