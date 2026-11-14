import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import ts from "typescript";
import { createEngine, yearAtAge } from "../src/index.ts";
import { createNpcState } from "../src/npc/runtime.ts";
import type { WorldPack } from "../src/types.ts";
import { demoScreen } from "../client/demo/screen.ts";
import { resolveLifeBanner } from "../client/models/banner-state.ts";
import {
  moneylenderPortraitState,
  npcPortraitState,
  playerPortraitState,
  resolvePortraitState,
  townFigurePortraitState,
} from "../client/models/portrait-state.ts";
import type { SceneContext } from "../client/models/scene-model.ts";
import { boosterArtwork } from "../client/chain/nft-card-view.ts";
import concept1Registry from "../client/models/portrait-concept1-registry.json" with { type: "json" };
import sceneManifest from "../public/assets/pixel/banners-concept1/manifest.json" with { type: "json" };
import samplePack from "../worlds/alexandria-sample.json" with { type: "json" };
import lives11Pack from "../worlds/demo/alexandria-lives-11.json" with { type: "json" };

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) {
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
          fileName: new URL(url).pathname,
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
const { default: PixelPortrait } = await import("../client/components/PixelPortrait.tsx");
const { default: PaperScene } = await import("../client/components/PaperScene.tsx");
const { default: DecisionDialog } = await import("../client/components/DecisionDialog.tsx");
const { LifePage } = await import("../client/components/HowToPlayPages.tsx");
const { default: EverfolkCard } = await import("../client/chain/EverfolkCard.tsx");
hooks.deregister();

const sampleWorld = samplePack as unknown as WorldPack;
const lives11World = lives11Pack as unknown as WorldPack;
const sampleEngine = createEngine(sampleWorld);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function outcomeScene(eventId: string, scene: SceneContext["scene"]): SceneContext {
  return {
    id: `ctx-${eventId}`,
    key: `ctx-${eventId}`,
    eventId,
    kind: "outcome",
    scene,
    motion: scene === "learning" ? "write" : "city",
    title: eventId,
    caption: "Recorded event outcome.",
    alt: "Recorded scene",
  };
}

test("all 17 Concept 1 portrait PNGs and 17 Concept 1 480x224 scene PNGs match their manifests", () => {
  const portraits = Object.values(concept1Registry.portraits);
  assert.equal(portraits.length, 17);
  for (const portrait of portraits) {
    const bytes = readFileSync(new URL(`../public${portrait.src}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), 384, portrait.file);
    assert.equal(bytes.readUInt32BE(20), 480, portrait.file);
    assert.equal(bytes[25], 2, portrait.file);
    assert.equal(sha(bytes), portrait.sha256, portrait.file);
  }
  assert.equal(sceneManifest.scenes.length, 17);
  for (const scene of sceneManifest.scenes) {
    const bytes = readFileSync(new URL(`../public${scene.src}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), 480, scene.file);
    assert.equal(bytes.readUInt32BE(20), 224, scene.file);
    assert.equal(bytes[25], 2, scene.file);
    assert.equal(sha(bytes), scene.sha256, scene.file);
  }
});

test("young adult and youth portraits cannot inherit older faces from professional or household roles", () => {
  const prefix = "/assets/portraits/concept1-v4/";
  for (const role of ["royalty", "aristocrat"] as const) {
    assert.equal(resolvePortraitState({ age: 16, sex: "male", role }).src, prefix + "youth-student.png");
    for (const age of [18, 25, 39]) {
      const state = resolvePortraitState({ age, sex: "male", avatarVariant: 1, role });
      assert.equal(state.src, prefix + "citizen-adult-m02.png", `${role}, age ${age}`);
      assert.equal(state.wardrobeId, role, "age-appropriate art must preserve the recorded household role");
      assert.equal(state.identityId, "m02");
    }
    assert.equal(resolvePortraitState({ age: 40, sex: "male", role }).src, prefix + "elite-citizen-m02.png");
  }
  assert.equal(resolvePortraitState({ age: 25, sex: "male", jobId: "politician" }).src, prefix + "citizen-adult-m02.png");
  assert.equal(resolvePortraitState({ age: 25, sex: "male", jobId: "banker" }).src, prefix + "merchant-heron.png");
  assert.equal(resolvePortraitState({ age: 25, sex: "female", jobId: "banker" }).src, prefix + "citizen-mother-f01.png");
  assert.equal(resolvePortraitState({ age: 25, sex: "female", jobId: "scientist" }).src, prefix + "citizen-mother-f01.png");
  assert.equal(resolvePortraitState({ age: 25, sex: "female", jobId: "merchant" }).src, prefix + "citizen-mother-f01.png");
  assert.equal(resolvePortraitState({ age: 25, sex: "female", role: "royalty" }).src, prefix + "citizen-mother-f01.png");
  assert.equal(resolvePortraitState({ age: 25, sex: "male", personKey: "town:moneylender" }).src, prefix + "merchant-heron.png");
  assert.equal(resolvePortraitState({ age: 52, sex: "female", personKey: "town:moneylender" }).src, prefix + "merchant-woman-f03.png");
  assert.equal(resolvePortraitState({ age: 70, sex: "male", jobId: "scientist" }).src, prefix + "elder-man-m01.png");
  assert.equal(resolvePortraitState({ age: 70, sex: "female", jobId: "banker" }).src, prefix + "elder-woman-f01.png");
});

test("every Concept 1 role route and named override uses a compatible age and sex", () => {
  const portraits = new Map(Object.values(concept1Registry.portraits).map(portrait => [portrait.src, portrait]));
  for (const [key, route] of Object.entries(concept1Registry.combinationRoutes)) {
    const [sex, stage] = key.split(":");
    const portrait = portraits.get(route.src)!;
    assert.ok(portrait.stages.includes(stage), `${key} must not use ${portrait.file}'s older or younger model`);
    assert.ok(portrait.sex === "any" || portrait.sex === sex, `${key} must not change sex for a job`);
  }
  for (const personKey of Object.keys(concept1Registry.personOverrides)) {
    for (const sex of ["male", "female"] as const) for (const age of [0, 7, 16, 25, 39, 40, 52, 60, 70]) {
      const state = resolvePortraitState({ age, sex, personKey });
      const portrait = portraits.get(state.src)!;
      assert.ok(portrait.stages.includes(state.stage), `${personKey}, ${sex}, ${age}`);
      assert.ok(portrait.sex === "any" || portrait.sex === sex, `${personKey}, ${sex}, ${age}`);
    }
  }
});

test("Gap 1 & Gap 2: DecisionDialog and portrait mapping resolve Heron, Pakhom, Ptolemaios, and Syros to Concept 1", () => {
  const demoWorld = lives11World;
  const demoEngine = createEngine(demoWorld);
  const life = structuredClone(demoEngine.start("gap-1-2-fixture"));
  life.age = 26;
  life.year = yearAtAge(demoWorld.startYear, 26);
  const screen = demoScreen(demoWorld, life)!;

  assert.equal(townFigurePortraitState(screen.townFigures.find(f => f.role === "merchant")!).src, "/assets/portraits/concept1-v4/merchant-heron.png");
  assert.equal(townFigurePortraitState(screen.townFigures.find(f => f.role === "grower")!).src, "/assets/portraits/concept1-v4/pakhom-grower.png");
  assert.equal(townFigurePortraitState(screen.townFigures.find(f => f.role === "army")!).src, "/assets/portraits/concept1-v4/ptolemaios-military.png");

  for (const input of [
    { age: 52, sex: "male" as const, occupation: "Harbor moneylender" },
    { age: 52, sex: "male" as const, jobId: "banker" },
    { age: 52, sex: "male" as const, role: "banker" as const },
    { age: 52, sex: "male" as const, personKey: "town:moneylender" },
  ]) {
    const syros = resolvePortraitState(input);
    assert.equal(syros.wardrobeId, "banker");
    assert.equal(syros.src, "/assets/portraits/concept1-v4/banker-syros.png");
    assert.match(syros.fallbackSrc, /-commerce-v3\.png$/);
  }
  assert.equal(moneylenderPortraitState(demoWorld).src, "/assets/portraits/concept1-v4/banker-syros.png");

  const baseEvent = demoWorld.events[0];
  for (const [role, expectedSrc] of [
    ["merchant", "/assets/portraits/concept1-v4/merchant-heron.png"],
    ["grower", "/assets/portraits/concept1-v4/pakhom-grower.png"],
    ["army", "/assets/portraits/concept1-v4/ptolemaios-military.png"],
  ] as const) {
    const html = renderToStaticMarkup(createElement(DecisionDialog, {
      open: true,
      event: baseEvent,
      life,
      world: demoWorld,
      choices: baseEvent.choices,
      demoView: { ...screen, activeOffer: { role, item: "grain", side: "buy", price: 10, maxQuantity: 5, text: "Offer" } as unknown as NonNullable<typeof screen.activeOffer> },
      onChoose() {},
      onSetAside() {},
      onEnableAuto() {},
    }));
    assert.ok(html.includes(expectedSrc), `${role} decision portrait should be ${expectedSrc}`);
  }

  const syrosHtml = renderToStaticMarkup(createElement(DecisionDialog, {
    open: true,
    event: baseEvent,
    life,
    world: demoWorld,
    choices: baseEvent.choices,
    isLoanOffer: true,
    onChoose() {},
    onSetAside() {},
    onEnableAuto() {},
  }));
  assert.ok(syrosHtml.includes("/assets/portraits/concept1-v4/banker-syros.png"));
});

test("Gap 3: all 45 alexandria-lives-11 job IDs and HowToPlayPages resolve to proper Concept 1 wardrobes", () => {
  const expectedNewJobs = {
    farmhand: { age: 16, wardrobe: "work", maleSrc: "/assets/portraits/concept1-v4/youth-student.png" },
    "tenant-farmer": { age: 18, wardrobe: "work", maleSrc: "/assets/portraits/concept1-v4/pakhom-grower.png" },
    "master-cultivator": { age: 24, wardrobe: "work", maleSrc: "/assets/portraits/concept1-v4/pakhom-grower.png" },
    "master-household-farmer": { age: 24, wardrobe: "work", maleSrc: "/assets/portraits/concept1-v4/pakhom-grower.png" },
    tailor: { age: 24, wardrobe: "work", maleSrc: "/assets/portraits/concept1-v4/pakhom-grower.png" },
    "master-tailor": { age: 24, wardrobe: "work", maleSrc: "/assets/portraits/concept1-v4/pakhom-grower.png" },
    "master-potter": { age: 24, wardrobe: "work", maleSrc: "/assets/portraits/concept1-v4/pakhom-grower.png" },
    "master-sculptor": { age: 24, wardrobe: "work", maleSrc: "/assets/portraits/concept1-v4/pakhom-grower.png" },
    "grain-dealer": { age: 24, wardrobe: "commerce", maleSrc: "/assets/portraits/concept1-v4/merchant-heron.png" },
    "trading-house-manager": { age: 24, wardrobe: "commerce", maleSrc: "/assets/portraits/concept1-v4/merchant-heron.png" },
    scientist: { age: 24, wardrobe: "scholarly", maleSrc: "/assets/portraits/concept1-v4/scholar-clerk-m01.png" },
    politician: { age: 24, wardrobe: "elite", maleSrc: "/assets/portraits/concept1-v4/citizen-adult-m02.png" },
  } as const;

  const allJobs = new Map<string, { id: string; title: string; minAge: number }>();
  for (const job of [...sampleWorld.character!.jobs, ...lives11World.character!.jobs]) {
    if (!allJobs.has(job.id)) allJobs.set(job.id, job);
  }
  assert.equal(lives11World.character!.jobs.length, 35);
  assert.equal(allJobs.size, 45);
  for (const job of allJobs.values()) {
    const age = Math.max(job.minAge, 22);
    const maleState = resolvePortraitState({ age, sex: "male", avatarVariant: 0, jobId: job.id });
    assert.equal(maleState.selectionReason, "job", job.id);
    assert.match(maleState.src, /^\/assets\/portraits\/concept1-v4\/.+\.png$/);
  }

  for (const [jobId, expected] of Object.entries(expectedNewJobs)) {
    const state = resolvePortraitState({ age: expected.age, sex: "male", avatarVariant: 0, jobId });
    assert.equal(state.wardrobeId, expected.wardrobe, jobId);
    assert.equal(state.src, expected.maleSrc, jobId);
  }

  const roadmapHtml = renderToStaticMarkup(createElement(LifePage, {
    stages: [
      { id: "infancy", title: "Infancy", fromAge: 0, toAge: 2, todo: "Stay fed.", state: "done", unlocks: [] },
      { id: "adulthood", title: "Adulthood", fromAge: 18, toAge: 39, todo: "Establish work.", state: "current", unlocks: [] },
    ],
    guides: [],
    selected: "adulthood",
    onSelect() {},
    portrait: { seed: "howtoplay-seed", name: "Alexandros", sex: "male", avatarVariant: 0, jobId: "scientist" },
  }));
  assert.ok(roadmapHtml.includes("/assets/portraits/concept1-v4/infant-c1.png"));
  assert.ok(roadmapHtml.includes("/assets/portraits/concept1-v4/scholar-clerk-m01.png"));
});

test("Gap 4: NpcSessionLab NPC portrait helper maps all 5 NPC roles cleanly to Concept 1", () => {
  const npcEngine = createEngine(lives11World);
  const baseLife = structuredClone(npcEngine.start("npc-session-portraits"));
  baseLife.age = 24;
  baseLife.year = yearAtAge(lives11World.startYear, 24);
  const session = createNpcState(lives11World, "npc-portrait-seed", baseLife);

  const caregiverA = npcPortraitState(lives11World, session.player, session.people[session.slots["caregiver-a"]]);
  const caregiverB = npcPortraitState(lives11World, session.player, session.people[session.slots["caregiver-b"]]);
  const mentor = npcPortraitState(lives11World, session.player, { ...session.people[session.slots.mentor], name: "Thais" });
  const merchant = npcPortraitState(lives11World, session.player, { ...session.people[session.slots.merchant], name: "Damon" });
  const peer = npcPortraitState(lives11World, session.player, { ...session.people[session.slots.peer], name: "Sostratos", born: session.player.year - 25 });

  assert.equal(caregiverA.bodyTemplate, "female");
  assert.match(caregiverA.src, /^\/assets\/portraits\/concept1-v4\/.+\.png$/);
  assert.equal(caregiverB.bodyTemplate, "male");
  assert.match(caregiverB.src, /^\/assets\/portraits\/concept1-v4\/.+\.png$/);
  assert.equal(mentor.wardrobeId, "scholarly");
  assert.equal(mentor.stage, "adult");
  assert.equal(mentor.src, "/assets/portraits/concept1-v4/citizen-mother-f01.png");
  const olderMentor = npcPortraitState(lives11World, session.player, { ...session.people[session.slots.mentor], name: "Thais", born: session.player.year - 52 });
  assert.equal(olderMentor.src, "/assets/portraits/concept1-v4/teacher-scholar.png");
  assert.equal(merchant.wardrobeId, "commerce");
  assert.equal(merchant.src, "/assets/portraits/concept1-v4/merchant-heron.png");
  assert.equal(peer.wardrobeId, "everyday");
  assert.equal(peer.src, "/assets/portraits/concept1-v4/citizen-adult-m02.png");
});

test("NFT citizen fallbacks and collectible card art stay untouched on ordinary-v3", () => {
  const life = structuredClone(sampleEngine.start("nft-fallback-isolation"));
  life.age = 30;
  life.character!.sex = "female";
  life.character!.avatarVariant = 1;
  life.character!.jobId = "potter";

  assert.match(playerPortraitState(sampleWorld, life).src, /^\/assets\/portraits\/concept1-v4\//);
  assert.match(playerPortraitState(sampleWorld, life, { portraitSet: "ordinary-v3" }).src, /^\/assets\/portraits\/ordinary-v3\/ef-p-f02-adult-work-v3\.png$/);

  for (const group of ["letters", "military", "commerce", "craft", "sky", "performance", "farming"] as const) {
    const view = boosterArtwork(null, 1, null, `nft-seed-${group}`, undefined, group);
    assert.match(view.art, /^\/assets\/portraits\/ordinary-v3\/ef-p-[mf]\d\d-adult-[a-z]+-v3\.png$/, group);
  }

  const nftCardHtml = renderToStaticMarkup(createElement(EverfolkCard, {
    title: "Citizen",
    rarity: 1,
    actionName: "Bake bread",
    pixelSeed: "nft-card-citizen",
  }));
  assert.match(nftCardHtml, /src="\/assets\/portraits\/ordinary-v3\/ef-p-[mf]0[123]-adult-everyday-v3\.png"/);
});

test("Mixed Concept 1 480x224 banners suppress duplicate actors on baked events and preserve swappable actors on generic plates", () => {
  const life = structuredClone(sampleEngine.start("concept1-banners"));
  life.age = 24;
  life.year = yearAtAge(sampleWorld.startYear, 24);
  life.phase = "ready";
  life.pendingEventId = null;
  life.health!.conditions = [];

  for (const [eventId, expectedFile] of [
    ["classical-alexander-egypt", "event_alexander_332bce_480x224.png"],
    ["classical-alexander-shore-work", "event_alexander_332bce_480x224.png"],
    ["classical-alexandria-founded", "event_alexander_332bce_480x224.png"],
    ["classical-euclid-teaching", "event_euclid_300bce_480x224.png"],
    ["classical-euclid-demonstration", "event_euclid_300bce_480x224.png"],
  ] as const) {
    const banner = resolveLifeBanner(life, sampleWorld, outcomeScene(eventId, "history-city"));
    assert.equal(banner.assetSrc, `/assets/pixel/banners-concept1/${expectedFile}`);
    assert.equal(banner.assetWidth, 480);
    assert.equal(banner.assetHeight, 224);
    assert.equal(banner.actorVisible, false, `${eventId} has baked actor`);
  }

  const alexanderLife = structuredClone(life);
  alexanderLife.journal = [{ type: "event", id: "classical-alexander-egypt", title: "Alexander arrives in Egypt", text: "Alexander arrived.", age: life.age, year: life.year }];
  const alexanderHtml = renderToStaticMarkup(createElement(PaperScene, { life: alexanderLife, world: sampleWorld, compact: true, dashboard: true }));
  assert.ok(alexanderHtml.includes('src="/assets/pixel/banners-concept1/event_alexander_332bce_480x224.png"'));
  assert.ok(alexanderHtml.includes('width="480" height="224"'));
  assert.doesNotMatch(alexanderHtml, /paper-character-layer/);

  for (const [jobId, expectedFile] of [
    ["sailor", "bg_harbor_quay_480x224.png"],
    ["grain-dealer", "bg_harbor_quay_480x224.png"],
    ["farmhand", "bg_nile_farm_480x224.png"],
    ["tenant-farmer", "bg_nile_farm_480x224.png"],
    ["soldier", "bg_military_garrison_480x224.png"],
    ["scientist", "bg_mouseion_study_480x224.png"],
    ["politician", "bg_mouseion_study_480x224.png"],
  ] as const) {
    const worker = { ...life, character: { ...life.character!, jobId } };
    const banner = resolveLifeBanner(worker, lives11World);
    assert.equal(banner.assetSrc, `/assets/pixel/banners-concept1/${expectedFile}`, jobId);
    assert.equal(banner.assetWidth, 480);
    assert.equal(banner.assetHeight, 224);
    assert.equal(banner.actorVisible, true, `${jobId} keeps swappable modular actor`);
  }

  const farmer = { ...life, character: { ...life.character!, jobId: "farmhand" } };
  const farmerHtml = renderToStaticMarkup(createElement(PaperScene, { life: farmer, world: lives11World, compact: true, dashboard: true }));
  assert.ok(farmerHtml.includes('src="/assets/pixel/banners-concept1/bg_nile_farm_480x224.png"'));
  assert.ok(farmerHtml.includes("paper-character-layer"));

  const potter = { ...life, character: { ...life.character!, jobId: "master-potter" } };
  const potterBanner = resolveLifeBanner(potter, lives11World);
  assert.equal(potterBanner.assetSrc, "/assets/pixel/banners-concept1/bg_pottery_kiln_480x224.png");
  assert.equal(potterBanner.assetWidth, 480);
  assert.equal(potterBanner.assetHeight, 224);
  assert.equal(potterBanner.actorVisible, true);

  for (const [jobId, expectedFile] of [
    ["tailor", "bg_craft_workshop_480x224.png"],
    ["master-tailor", "bg_craft_workshop_480x224.png"],
    ["sculptor", "bg_craft_workshop_480x224.png"],
    ["performer", "bg_festival_feast_480x224.png"],
  ] as const) {
    const crafter = { ...life, character: { ...life.character!, jobId } };
    const banner = resolveLifeBanner(crafter, lives11World);
    assert.equal(banner.assetSrc, `/assets/pixel/banners-concept1/${expectedFile}`, jobId);
    assert.equal(banner.actorVisible, true, `${jobId} keeps swappable modular actor`);
  }

  assert.equal(
    resolveLifeBanner(life, lives11World, { id: "infant-home", key: "infant-home", kind: "birth", scene: "birth", motion: "gather", title: "Birth", caption: "Born.", alt: "Birth" }, { birthReveal: true }).assetSrc,
    "/assets/pixel/banners-concept1/bg_home_courtyard_480x224.png",
  );
  assert.equal(
    resolveLifeBanner(life, lives11World, outcomeScene("later-temple-visit", "history-city")).assetSrc,
    "/assets/pixel/banners-concept1/bg_temple_shrine_480x224.png",
  );
  assert.equal(
    resolveLifeBanner(life, lives11World, outcomeScene("later-temple-visit", "history-city")).actorVisible,
    true,
  );

  for (const [eventId, expectedFile] of [
    ["classical-ptolemy-kingship", "event_ptolemy_305bce_480x224.png"],
    ["classical-pharos-completed", "event_pharos_280bce_480x224.png"],
    ["era-pharos-stone", "event_pharos_280bce_480x224.png"],
    ["era-museum-scholar", "event_library_museum_480x224.png"],
    ["era-library-copyists", "event_library_museum_480x224.png"],
    ["classical-succession-guard", "event_succession_guard_480x224.png"],
    ["era-cleruch-veteran", "event_succession_guard_480x224.png"],
    ["era-royal-land-lease", "event_royal_harvest_tax_480x224.png"],
    ["inspire-ceramics-adult", "event_vessel_packing_480x224.png"],
  ] as const) {
    const banner = resolveLifeBanner(life, lives11World, outcomeScene(eventId, "history-city"));
    assert.equal(banner.assetSrc, `/assets/pixel/banners-concept1/${expectedFile}`, eventId);
    assert.equal(banner.assetWidth, 480);
    assert.equal(banner.assetHeight, 224);
    assert.equal(banner.actorVisible, false, `${eventId} has baked actor`);
  }
});
