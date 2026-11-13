// Prints the contract's card table (set_card_art): every v14 collection card a pack can draw, with its
// absolute footerless image, so minted NFTs carry the card a wallet can show (chain/card-art.ts).
//   CARD_MEDIA_BASE_URL=https://everfolk.life node scripts/ranked/card-art-table.ts
import { readFileSync } from "node:fs";
import { buildCardArtTable } from "../../chain/card-art.ts";

const manifest = JSON.parse(readFileSync(new URL("../../public/assets/cards/collection-v14/manifest.json", import.meta.url), "utf8"));
const base = process.env.CARD_MEDIA_BASE_URL?.trim() || "https://everfolk.life";
process.stdout.write(JSON.stringify(buildCardArtTable(manifest, base)));
