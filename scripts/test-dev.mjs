import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Development checks cover state integrity, access control and reward boundaries.
// Main and explicit full-regression runs retain the complete test suite.
export const DEV_TEST_FILES = Object.freeze([
  "test/ci-changes.test.ts",
  "test/engine.test.ts",
  "test/validation.test.ts",
  "test/regression.test.ts",
  "test/session.test.ts",
  "test/seeded-play.test.ts",
  "test/seeded-play-api.test.ts",
  "test/admin-identity.test.ts",
  "test/signin-routes.test.ts",
  "test/economy.test.ts",
  "test/market.test.ts",
  "test/dangerous-loan.test.ts",
  "test/loan-validation.test.ts",
  "test/life-stage-engine.test.ts",
  "test/paths-definition.test.ts",
  "test/paths-content.test.ts",
  "test/deep-capability-core.test.ts",
  "test/capability-runtime.test.ts",
  "test/figure-path-progress.test.ts",
  "test/earned-cards.test.ts",
  "test/demo-household.test.ts",
  "test/demo-market.test.ts",
  "test/chain-contract-client.test.ts",
  "test/chain-ranked-rules.test.ts",
  "test/chain-ranked-session.test.ts",
  "test/chain-validate-ranked.test.ts",
  "test/chain-email-session.test.ts",
  "test/chain-play-key.test.ts",
  "test/ranked-routes.test.ts",
  "test/ranked-signer.test.ts",
  "test/ranked-verifier.test.ts",
  "test/ranked-verify-e2e.test.ts",
  "test/npc-account-proof.test.ts",
  "test/npc-engine-opt-in.test.ts",
  "test/npc-provider.test.ts",
  "test/npc-session.test.ts",
  "test/npc-ranked-reward.test.ts",
]);

const root = fileURLToPath(new URL("../", import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, ["--test", ...args], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Development safety suite: ${DEV_TEST_FILES.length} files and admin access checks.`);
run(["--test-concurrency=3", ...process.argv.slice(2), ...DEV_TEST_FILES]);

// Exercise actual admin routes without replaying every archived publication.
const adminChecks = [
  "admin APIs deny anonymous",
  "admin authorization requires",
  "explicit additional admins",
  "cross-site, missing-origin",
];
const adminSource = readFileSync(new URL("../test/admin-api.test.ts", import.meta.url), "utf8");
for (const prefix of adminChecks) {
  if (!adminSource.includes(`test("${prefix}`)) throw new Error(`Missing development admin check: ${prefix}`);
}
run(["--test-name-pattern", adminChecks.join("|"), "test/admin-api.test.ts"]);
