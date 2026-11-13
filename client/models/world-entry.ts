import { contentFingerprint } from "../../src/random.ts";
import demo1 from "../../worlds/demo/alexandria-demo-1.json" with { type: "json" };
import demo2 from "../../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import lives1 from "../../worlds/demo/alexandria-lives-1.json" with { type: "json" };
import lives2 from "../../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import lives3 from "../../worlds/demo/alexandria-lives-3.json" with { type: "json" };
import lives4 from "../../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import lives5 from "../../worlds/demo/alexandria-lives-5.json" with { type: "json" };
import lives6 from "../../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import lives7 from "../../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import lives8 from "../../worlds/demo/alexandria-lives-8.json" with { type: "json" };

export interface WorldPackIdentity {
  id?: string;
  demo?: unknown;
  version?: string;
  events?: unknown;
  origins?: unknown;
}

export interface ActiveWorldSummary {
  id: string;
  pack: WorldPackIdentity;
}

const OFFICIAL_DEFAULT_WORLD_IDS = new Set(["alexandria", "alexandria-demo"]);
const OFFICIAL_DEMO_PACK_ID = "alexandria";
const OFFICIAL_DEMO_PACKS = new Map<string, unknown>(
  [demo1, demo2, lives1, lives2, lives3, lives4, lives5, lives6, lives7, lives8]
    .map(pack => [pack.version, pack] as const),
);
const officialFingerprints = new Map<string, string>();

function officialFingerprintFor(version: string): string | undefined {
  let cached = officialFingerprints.get(version);
  if (cached) return cached;
  const pack = OFFICIAL_DEMO_PACKS.get(version);
  if (!pack) return undefined;
  cached = contentFingerprint(pack);
  officialFingerprints.set(version, cached);
  return cached;
}

function isOfficialDemoPack(pack: WorldPackIdentity | undefined): boolean {
  if (!pack || !pack.demo) return false;
  if (pack.id !== undefined && pack.id !== OFFICIAL_DEMO_PACK_ID) return false;
  if (typeof pack.version !== "string" || !OFFICIAL_DEMO_PACKS.has(pack.version)) return false;
  if ("events" in pack || "origins" in pack) {
    return contentFingerprint(pack) === officialFingerprintFor(pack.version);
  }
  return true;
}

/**
 * Determines whether entering a world should load the default bundled official demo lives.
 * Direct selection of an official default world or restarting an active official demo loads default demo lives;
 * classic (e.g. alexandria-sample) and custom household worlds stay on their selected world.
 */
export function entryUsesDefaultLives(
  targetId: string,
  fresh: boolean,
  activeWorld?: ActiveWorldSummary | null,
): boolean {
  if (OFFICIAL_DEFAULT_WORLD_IDS.has(targetId)) {
    return true;
  }
  if (
    fresh &&
    activeWorld &&
    targetId === activeWorld.id &&
    OFFICIAL_DEFAULT_WORLD_IDS.has(activeWorld.id) &&
    isOfficialDemoPack(activeWorld.pack)
  ) {
    return true;
  }
  return false;
}

/**
 * Determines whether an unbegun life in an older official demo world pack should be refreshed
 * to the latest default demo world revision at startup. Custom household worlds are preserved.
 */
export function startupRefreshesToDefault(
  pack: WorldPackIdentity | undefined,
  hasBegunLife: boolean,
  defaultVersion: string,
  worldId?: string,
): boolean {
  if (hasBegunLife) return false;
  if (worldId !== undefined && !OFFICIAL_DEFAULT_WORLD_IDS.has(worldId)) return false;
  if (!isOfficialDemoPack(pack)) return false;
  return pack!.version !== defaultVersion;
}
