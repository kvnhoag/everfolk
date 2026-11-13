import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./scripts/vite/sites-vite-plugin";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";

export default defineConfig(async () => {
  configureToolEnvironment(process.cwd());
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    // Each world pack gets its own browser chunk: together they exceed the Workers 25 MiB per-asset limit.
    environments: {
      client: { build: { rolldownOptions: { output: { codeSplitting: { groups: [{
        name: (id: string) => /[\\/]worlds[\\/].+\.json$/.test(id) ? `world-${id.split(/[\\/]/).pop()!.replace(/\.json$/, "")}` : null,
        test: /[\\/]worlds[\\/].+\.json$/,
        priority: 20,
      }] } } } } },
    },
    plugins: [vinext(), sites({ mockAuth: true }), cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
      config: {
        main: "./worker/index.ts",
        compatibility_flags: ["nodejs_compat"],
        d1_databases: [{ binding: "DB", database_name: "everfolk-content", database_id: "00000000-0000-4000-8000-000000000000" }],
        // Public ranked-life settings. The verifier secret RANKED_VERIFIER_SECRET is a secret (.dev.vars locally).
        vars: { RANKED_CONTRACT_ID: "everfolk-albums-11121956.testnet", NEAR_RPC_URL: "https://test.rpc.fastnear.com" },
      },
    })],
  };
});
