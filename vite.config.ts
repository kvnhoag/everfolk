import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./scripts/vite/sites-vite-plugin";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";

export default defineConfig(async () => {
  configureToolEnvironment(process.cwd());
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                // Retain every save-compatible pack without combining their data
                // into a browser asset above Cloudflare's 25 MiB size limit.
                groups: [{
                  test: /[\\/]worlds[\\/].+\.json(?:\?.*)?$/,
                  priority: 20,
                  name(moduleId: string) {
                    const world = /[\\/]worlds[\\/](.+)\.json(?:\?.*)?$/.exec(moduleId);
                    return world ? `world-${world[1].replace(/[\\/]/g, "-")}` : null;
                  },
                }],
              },
            },
          },
        },
      },
    },
    plugins: [vinext(), sites({ mockAuth: true }), cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
      config: {
        main: "./worker/index.ts",
        compatibility_flags: ["nodejs_compat"],
        d1_databases: [{ binding: "DB", database_name: "everfolk-content", database_id: "00000000-0000-4000-8000-000000000000" }],
        // Public ranked-life settings. The verifier secret RANKED_VERIFIER_SECRET is a secret (.dev.vars locally).
        vars: { RANKED_CONTRACT_ID: "everfolk-cards-11140224.testnet", NEAR_RPC_URL: "https://test.rpc.fastnear.com" },
      },
    })],
  };
});
