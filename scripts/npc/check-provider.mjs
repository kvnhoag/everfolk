import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import world from "../../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import { npcProviderConfiguration } from "../../server/npc/composition.ts";
import { createNpcSessionService } from "../../server/npc/service.ts";
import { memoryNpcStore } from "../../server/npc/store.ts";

// Explicit operator check: one bounded inference, no game action, award or wallet call.
if (existsSync(".dev.vars")) loadEnvFile(".dev.vars");
const options = npcProviderConfiguration(process.env);
const service = createNpcSessionService({
  world,
  store: memoryNpcStore(),
  ...options,
});
const start = await service.start("provider-preflight", "operator-preflight"),
  began = Date.now();
const checked = await service.checkProvider(
  start.id,
  start.token,
  0,
  "preflight",
);
console.log(
  JSON.stringify(
    {
      provider: checked.providerName,
      status: checked.npcProvider.status,
      reason: checked.npcProvider.reason,
      elapsedMs: Date.now() - began,
      gameChanged: checked.life.commands.length !== 0,
      nftAwards: false,
      accountCredits: false,
    },
    null,
    2,
  ),
);
if (checked.npcProvider.status !== "live") process.exitCode = 1;
