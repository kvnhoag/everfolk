import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { getAvatarAppearance } from "../client/models/avatar-appearance.ts";
import { avatarArtworkOrigin, AVATAR_ORIGIN_ALIASES, AVATAR_ORIGIN_IDS, AVATAR_STAGES } from "../client/models/life-background.ts";
import { bannerActorSource } from "../client/models/banner-actor.ts";
import { resolveLifeBanner } from "../client/models/banner-state.ts";
import { createActorLayers } from "../scripts/banner-art-actors.mjs";
import { createEngine, yearAtAge } from "../src/index.ts";
import world from "../worlds/alexandria-sample.json" with { type: "json" };
import actors from "../public/assets/pixel/banners/manifest.json" with { type: "json" };
import portraits from "../public/assets/pixel/avatar-manifest.json" with { type: "json" };

test("all 288 chosen portrait identities have matching real origin-specific scene poses", () => {
  assert.equal(actors.actors.filter(actor => actor.originId !== null).length, 768);
  for (const portrait of portraits.assets) {
    const appearance = getAvatarAppearance({ originId: portrait.originId, sex: portrait.sex, variant: portrait.variant, stage: portrait.stage });
    assert.deepEqual(portrait.appearance, appearance);
    const portraitSvg = readFileSync(new URL(`../public${portrait.path}`, import.meta.url), "utf8");
    for (const pose of portrait.stage === "infant" ? ["cradle"] : ["standing", "seated", "reclined"]) {
      const src = `/assets/pixel/banners/actors/${portrait.originId}/${portrait.sex}/${portrait.stage}-${portrait.variant}-${pose}.svg`;
      const record = actors.actors.find(actor => actor.asset === src)!;
      assert.ok(record, src);
      assert.deepEqual(record.appearance, appearance, src);
      const actorSvg = readFileSync(new URL(`../public${src}`, import.meta.url), "utf8");
      for (const field of ["appearance-key", "skin", "hair", "hair-style", "facial-hair", "robe", "accent"]) {
        const value = new RegExp(`data-${field}="([^"]+)"`).exec(portraitSvg)?.[1];
        assert.ok(value, `Missing portrait ${field}`);
        assert.ok(actorSvg.includes(`data-${field}="${value}"`), `${src} mismatches portrait ${field}`);
      }
      // The shared colours must actually paint the actor, beyond metadata.
      const rectangles = createActorLayers(portrait.stage, portrait.sex, portrait.variant, pose, portrait.originId).flatMap(layer => layer.rects);
      for (const color of [appearance.skin, appearance.hair, appearance.robe, appearance.accent]) {
        assert.ok(rectangles.some(rect => rect.fill === color), `${src} does not draw ${color}`);
        assert.ok(actorSvg.includes(color), `${src} export omitted ${color}`);
      }
    }
  }
});

function pixelHash(stage: string, sex: string, variant: number, pose: string, originId: string) {
  const grid = Array.from({ length: 112 }, () => Array<string>(240).fill("transparent"));
  for (const layer of createActorLayers(stage, sex, variant, pose, originId)) for (const r of layer.rects) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y][x] = r.fill;
  }
  return createHash("sha256").update(grid.flat().join("|")).digest("hex");
}

test("male and female scene artwork differs in drawn pixels at every stage and pose", () => {
  for (const stage of AVATAR_STAGES) for (let variant = 0; variant < 3; variant++) for (const pose of stage === "infant" ? ["cradle"] : ["standing", "seated", "reclined"]) {
    assert.notEqual(pixelHash(stage, "male", variant, pose, "merchant-household"), pixelHash(stage, "female", variant, pose, "merchant-household"), `${stage}/${variant}/${pose} differs only by a label`);
  }
});

test("accepted avatar selection survives replay and scene/age changes without rerolling identity", () => {
  const engine = createEngine(world);
  const selected = engine.chooseAvatar(engine.start("scene-avatar-stability"), 2);
  const restored = engine.load(engine.save(selected)), before = structuredClone(restored);
  for (const age of [0, 3, 13, 18, 40, 60]) {
    // Read-only view fixtures; these projected ages are never saved as commands.
    const view = { ...restored, age, year: yearAtAge(world.startYear, age) };
    const banner = resolveLifeBanner(view, world);
    for (const pose of age < 3 ? ["cradle"] as const : ["standing", "seated", "reclined"] as const) {
      const src = bannerActorSource(view, { ...banner, actorPose: pose })!;
      assert.ok(src.includes(`/${avatarArtworkOrigin(restored.originId)}/${restored.character!.sex}/${banner.stage}-2-${pose}.svg`));
      assert.ok(actors.actors.some(actor => actor.asset === src));
    }
  }
  assert.deepEqual(restored, before);
  assert.equal(restored.rngState, selected.rngState);
  assert.equal(restored.character!.name, selected.character!.name);
});

test("expanded household actors follow the same shipped artwork family as their portraits", () => {
  const born = createEngine(world).start("expanded-origin-actor-appearance");
  for (const [originId, artworkOrigin] of Object.entries(AVATAR_ORIGIN_ALIASES)) for (const sex of ["male", "female"] as const) for (const age of [0, 5, 15, 25, 45, 65]) {
    const life = { ...born, originId, age, character: { ...born.character!, sex, avatarVariant: 2 } };
    const banner = resolveLifeBanner(life, world);
    const poses = age < 3 ? ["cradle"] as const : ["standing", "seated", "reclined"] as const;
    for (const pose of poses) {
      const src = bannerActorSource(life, { ...banner, actorPose: pose });
      assert.equal(src, `/assets/pixel/banners/actors/${artworkOrigin}/${sex}/${banner.stage}-2-${pose}.svg`);
      const record = actors.actors.find(actor => actor.asset === src);
      assert.ok(record, src);
      assert.deepEqual(record.appearance, getAvatarAppearance({ originId, sex, variant: 2, stage: banner.stage }));
    }
  }
});

test("unsupported origins keep a shipped fallback and memorials do not invent an actor", () => {
  const life = createEngine(world).start("scene-avatar-fallback"), banner = resolveLifeBanner(life, world);
  const src = bannerActorSource({ ...life, originId: "custom-origin" }, banner)!;
  assert.ok(actors.actors.some(actor => actor.asset === src));
  assert.equal(bannerActorSource(life, { ...banner, actorVisible: false }), undefined);
});
