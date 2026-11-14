import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { biographyFor } from "../../chain/catalog/figure-biographies.ts";
import { figureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import promotions from "../../chain/catalog/figure-promotions.json" with { type: "json" };
import { getFigureCardArt } from "../../client/models/card-art.ts";

const promotedIds = ["demetrius", "ptolemy", "zeno"] as const;
const figure = (id: string) => { const entry = figureRosterEntry(id); assert.ok(entry, id); return entry; };

test("promotion copy does not overwrite the reviewed Epic card copy or historical research", () => {
  const reviewed = JSON.parse(readFileSync(new URL("../../artwork/cards/framed-collection-v14/catalog.json", import.meta.url), "utf8"));
  for (const id of promotedIds) {
    const epic = getFigureCardArt(id, "Epic");
    const baseline = reviewed.assets.find((card: { figureId: string; kind: string }) => card.figureId === id && card.kind === "parent");
    assert.ok(epic && baseline, id);
    assert.equal(epic.bodyText, baseline.bodyText);
    assert.equal(figure(id).biography, biographyFor(id));
    assert.doesNotMatch(biographyFor(id).biography, /\bEpic\b|\bLegendary\b|alternate[ -]history/i);
  }
  assert.match(biographyFor("demetrius").biography, /negotiated peace/i);
  assert.match(getFigureCardArt("demetrius", "Epic")!.bodyText, /ended in negotiation/i);
});

test("portable Legendary templates render the promotion biography in both SVG overlays", () => {
  const root = new URL("../../artwork/card-art-handoff-v1/", import.meta.url);
  const kit = JSON.parse(readFileSync(new URL("data/cards.json", root), "utf8"));
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  const decode = (value: string) => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) =>
    entity.startsWith("#") ? String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase() === "x" ? 2 : 1), entity[1].toLowerCase() === "x" ? 16 : 10)) : entities[entity.toLowerCase()]);
  for (const id of promotedIds) {
    const variant = kit.parentVariants.find((card: { figureId: string; rarity: string }) => card.figureId === id && card.rarity === "legendary");
    assert.ok(variant, `${id}'s portable Legendary template`);
    const expected = promotions[id].biography;
    assert.equal(variant.bodyText, expected, `${id}'s portable biography`);
    assert.equal(variant.copy.bodyText, expected, `${id}'s renderer copy`);
    for (const path of [variant.overlaySvg, variant.footerlessOverlaySvg]) {
      const svg = readFileSync(new URL(path, root), "utf8");
      const match = svg.match(/<text\b[^>]*\bid="Biography_live"[^>]*>([\s\S]*?)<\/text>/);
      assert.ok(match, `${path} contains the live biography`);
      const rendered = decode(match[1].replace(/<[^>]+>/g, " "));
      assert.equal(normalize(rendered), normalize(expected), `${path} renders the promoted story`);
    }
  }
});
