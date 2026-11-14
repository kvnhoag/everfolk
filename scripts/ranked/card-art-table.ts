// Prints the contract's card table (set_card_art): every v14 collection card a Weave life can earn
// (chain/earned-cards.ts), with its absolute footerless image so minted NFTs show in wallets (chain/card-art.ts).
//   CARD_MEDIA_BASE_URL=https://everfolk.life node scripts/ranked/card-art-table.ts
import { readFileSync } from "node:fs";
import { buildCardArtTable } from "../../chain/card-art.ts";
import type { WorldPack } from "../../src/types.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const manifest = read("../../public/assets/cards/collection-v14/manifest.json");
const world = read("../../worlds/demo/alexandria-lives-11.json") as WorldPack;
const base = process.env.CARD_MEDIA_BASE_URL?.trim() || "https://everfolk.life";
process.stdout.write(JSON.stringify(buildCardArtTable(manifest, base, world)));
