import assert from "node:assert/strict";
import test from "node:test";
import { changedJobs, jobsForPaths } from "../scripts/ci-changes.mjs";

test("application code, saves, world data, research and unknown inputs retain app verification", () => {
  for (const path of ["src/engine.ts", "client/storage/save.ts", "server/api.ts", "worlds/new.json", "research/sources.json", "test/engine.test.ts", "Dockerfile", "new-feature/config.json"]) {
    assert.equal(jobsForPaths([path]).app, true, path);
  }
});

test("contract-only changes do not install or build the application", () => {
  assert.deepEqual(jobsForPaths(["contract/src/lib.rs", "contract/Cargo.lock"]), { app: false, contract: true, art: false });
});

test("documentation and manual balance audits do not start application or contract jobs", () => {
  assert.deepEqual(jobsForPaths(["README.md", ".github/README.md", "contract/README.md", "artwork/README.md", "guide/play.md", "design/evidence.json", "test/audits/paths-content.test.ts"]), { app: false, contract: false, art: false });
});

test("art tooling and delivered assets retain their own audits", () => {
  assert.deepEqual(jobsForPaths(["test/art/portrait-delivery.test.ts", "artwork/cards/frame.svg", "tools/character-creator/src/compose.mjs"]), { app: false, contract: false, art: true });
  assert.deepEqual(jobsForPaths(["public/assets/portraits/new.png"]), { app: true, contract: false, art: true });
  for (const path of ["scripts/lib/card-art-replacements.mjs", "client/models/avatar-appearance.ts", "client/models/banner-state.ts", "assets/source/frame.svg", "chain/catalog/figures.ts", "chain/ids.ts"]) assert.equal(jobsForPaths([path]).art, true, path);
});

test("workflow changes run every job and combined changes retain both application and contract tests", () => {
  assert.deepEqual(jobsForPaths([".github/workflows/ci.yml"]), { app: true, contract: true, art: true });
  assert.deepEqual(jobsForPaths(["src/engine.ts", "contract/src/lib.rs"]), { app: true, contract: true, art: false });
});

test("PRs compare against their base and pushes compare the whole before-to-HEAD range", () => {
  for (const event of [{ before: "a".repeat(40) }, { before: "b".repeat(40), pull_request: { base: { sha: "a".repeat(40) } } }]) {
    const calls: string[][] = [];
    const jobs = changedJobs("push", event, (args: string[]) => {
      calls.push(args);
      return args[0] === "diff" ? "contract/src/deleted.rs\n" : "";
    });
    assert.deepEqual(calls[1], ["diff", "--name-only", "--no-renames", "a".repeat(40), "HEAD"]);
    assert.equal(jobs.contract, true);
    assert.equal(jobs.app, false);
  }
});

test("manual runs, new branches and unavailable history run all checks", () => {
  const all = { app: true, contract: true, art: true };
  assert.deepEqual(changedJobs("workflow_dispatch", {}), all);
  assert.deepEqual(changedJobs("push", { before: "0".repeat(40) }), all);
  assert.deepEqual(changedJobs("push", { before: "a".repeat(40) }, () => { throw new Error("base no longer available"); }), all);
});
