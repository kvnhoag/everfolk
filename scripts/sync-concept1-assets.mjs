/** Verify delivered Concept 1 384x480 portrait and 480x224 scene PNGs and emit compact runtime metadata. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const v3RegistryPath = resolve(repo, "client/models/portrait-asset-registry.json");
const portraitDir = resolve(repo, "public/assets/portraits/concept1-v4");
const portraitRegistryPath = resolve(repo, "client/models/portrait-concept1-registry.json");
const sceneDir = resolve(repo, "public/assets/pixel/banners-concept1");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function need(ok, message) {
  if (!ok) throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeChanged(path, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
  if (existsSync(path) && readFileSync(path).equals(bytes)) return false;
  writeFileSync(path, bytes);
  return true;
}

function verifyPng(path, width, height) {
  need(existsSync(path), `Missing Concept 1 PNG: ${path}`);
  const bytes = readFileSync(path);
  need(bytes.subarray(0, 8).equals(PNG_SIGNATURE) && bytes.toString("ascii", 12, 16) === "IHDR", `Invalid PNG: ${path}`);
  need(
    bytes.readUInt32BE(16) === width && bytes.readUInt32BE(20) === height && bytes[24] === 8 && bytes[25] === 2,
    `Concept 1 asset must be an unmodified ${width}x${height} RGB PNG: ${path}`,
  );
  return { sha256: sha256(bytes), bytes: bytes.length };
}

const PORTRAIT_SPECS = [
  { id: "merchant-heron", sex: "male", stages: ["adult", "middle"], file: "merchant-heron.png", role: "Harbor merchant Heron / male adult commerce" },
  { id: "banker-syros", sex: "male", stages: ["middle", "elder"], file: "banker-syros.png", role: "Harbor banker Syros / moneylender / elder male commerce" },
  { id: "pakhom-grower", sex: "male", stages: ["adult", "middle"], file: "pakhom-grower.png", role: "Nile grower Pakhom / male farm and craft work" },
  { id: "ptolemaios-military", sex: "male", stages: ["adult", "middle"], file: "ptolemaios-military.png", role: "Army quartermaster Ptolemaios / military" },
  { id: "teacher-scholar", sex: "female", stages: ["middle"], file: "teacher-scholar.png", role: "Female philosophy teacher / scholarly / mentor NPC" },
  { id: "scholar-clerk-m01", sex: "male", stages: ["adult", "middle"], file: "scholar-clerk-m01.png", role: "Male scholar and clerk / scientist / scholarly" },
  { id: "citizen-mother-f01", sex: "female", stages: ["adult", "middle"], file: "citizen-mother-f01.png", role: "Adult female citizen and mother / caregiver-a" },
  { id: "citizen-adult-m02", sex: "male", stages: ["adult", "middle"], file: "citizen-adult-m02.png", role: "Adult male citizen / caregiver-b / peer" },
  { id: "merchant-woman-f03", sex: "female", stages: ["middle"], file: "merchant-woman-f03.png", role: "Adult female merchant / commerce" },
  { id: "elite-citizen-m02", sex: "male", stages: ["middle", "elder"], file: "elite-citizen-m02.png", role: "Noble citizen / politician / aristocrat / royalty / elite" },
  { id: "youth-student", sex: "male", stages: ["youth"], file: "youth-student.png", role: "Male youth student" },
  { id: "youth-girl-f02", sex: "female", stages: ["youth"], file: "youth-girl-f02.png", role: "Female youth" },
  { id: "child-boy-m01", sex: "male", stages: ["child"], file: "child-boy-m01.png", role: "Male child" },
  { id: "child-girl-f01", sex: "female", stages: ["child"], file: "child-girl-f01.png", role: "Female child" },
  { id: "infant-c1", sex: "any", stages: ["infant"], file: "infant-c1.png", role: "Infant" },
  { id: "elder-woman-f01", sex: "female", stages: ["elder"], file: "elder-woman-f01.png", role: "Elder woman" },
  { id: "elder-man-m01", sex: "male", stages: ["elder"], file: "elder-man-m01.png", role: "Elder man" },
];

const EXPANDED_JOBS = [
  { id: "farmhand", title: "Farmhand", wardrobeId: "work", minAge: 12 },
  { id: "tenant-farmer", title: "Tenant farmer", wardrobeId: "work", minAge: 16 },
  { id: "master-cultivator", title: "Master cultivator", wardrobeId: "work", minAge: 18 },
  { id: "master-household-farmer", title: "Master household farmer", wardrobeId: "work", minAge: 18 },
  { id: "tailor", title: "Tailor", wardrobeId: "work", minAge: 18 },
  { id: "master-tailor", title: "Master tailor", wardrobeId: "work", minAge: 18 },
  { id: "master-potter", title: "Master potter", wardrobeId: "work", minAge: 18 },
  { id: "master-sculptor", title: "Master sculptor", wardrobeId: "work", minAge: 18 },
  { id: "grain-dealer", title: "Grain dealer", wardrobeId: "commerce", minAge: 20 },
  { id: "trading-house-manager", title: "Trading-house manager", wardrobeId: "commerce", minAge: 18 },
  { id: "scientist", title: "Scientist", wardrobeId: "scholarly", minAge: 18 },
  { id: "politician", title: "Politician", wardrobeId: "elite", minAge: 18 },
  { id: "banker", title: "Harbor moneylender", wardrobeId: "banker", minAge: 18 },
  { id: "moneylender", title: "Moneylender", wardrobeId: "banker", minAge: 18 },
];

const OCCUPATION_ALIASES = [
  { title: "Artisan apprentice", wardrobeId: "work", minAge: 12 },
  { title: "Philosopher and tutor", wardrobeId: "scholarly", minAge: 18 },
  { title: "Astrologer", wardrobeId: "scholarly", minAge: 18 },
  { title: "Trading house manager", wardrobeId: "commerce", minAge: 18 },
  { title: "Banker", wardrobeId: "banker", minAge: 18 },
  { title: "Syros the Banker", wardrobeId: "banker", minAge: 18 },
];

const PERSON_OVERRIDES = {
  "town:moneylender": { file: "banker-syros.png", wardrobeId: "banker" },
  "town:merchant": { file: "merchant-heron.png", wardrobeId: "commerce" },
  "town:grower": { file: "pakhom-grower.png", wardrobeId: "work" },
  "town:army": { file: "ptolemaios-military.png", wardrobeId: "military" },
};

function selectPortraitFile(sex, stage, wardrobeId) {
  if (wardrobeId === "banker") return "banker-syros.png";
  if (stage === "infant") return "infant-c1.png";
  if (stage === "child") return sex === "female" ? "child-girl-f01.png" : "child-boy-m01.png";
  if (stage === "youth") {
    if (sex === "male" && (wardrobeId === "royalty" || wardrobeId === "aristocrat")) return "elite-citizen-m02.png";
    return sex === "female" ? "youth-girl-f02.png" : "youth-student.png";
  }
  if (wardrobeId === "military") return sex === "male" ? "ptolemaios-military.png" : stage === "elder" ? "elder-woman-f01.png" : "citizen-mother-f01.png";
  if (wardrobeId === "scholarly") return sex === "female" ? "teacher-scholar.png" : "scholar-clerk-m01.png";
  if (wardrobeId === "commerce") {
    if (sex === "female") return "merchant-woman-f03.png";
    return stage === "elder" ? "banker-syros.png" : "merchant-heron.png";
  }
  if (wardrobeId === "elite" || wardrobeId === "aristocrat" || wardrobeId === "royalty") {
    if (sex === "male") return "elite-citizen-m02.png";
    return stage === "elder" ? "elder-woman-f01.png" : "merchant-woman-f03.png";
  }
  if (wardrobeId === "work" || wardrobeId === "maritime") {
    if (sex === "female") return stage === "elder" ? "elder-woman-f01.png" : "citizen-mother-f01.png";
    return stage === "elder" ? "elder-man-m01.png" : "pakhom-grower.png";
  }
  if (wardrobeId === "performance") {
    if (sex === "female") return stage === "elder" ? "elder-woman-f01.png" : "merchant-woman-f03.png";
    return stage === "elder" ? "elder-man-m01.png" : "citizen-adult-m02.png";
  }
  if (stage === "elder") return sex === "female" ? "elder-woman-f01.png" : "elder-man-m01.png";
  return sex === "female" ? "citizen-mother-f01.png" : "citizen-adult-m02.png";
}

const v3 = JSON.parse(readFileSync(v3RegistryPath, "utf8"));
const stageWardrobes = {
  ...v3.stageWardrobes,
  adult: [...v3.stageWardrobes.adult, "banker"],
  middle: [...v3.stageWardrobes.middle, "banker"],
  elder: [...v3.stageWardrobes.elder, "banker"],
};

const actualPortraitPngs = new Set(readdirSync(portraitDir).filter(name => name.endsWith(".png")));
need(actualPortraitPngs.size === PORTRAIT_SPECS.length, `Expected ${PORTRAIT_SPECS.length} Concept 1 PNGs, got ${actualPortraitPngs.size}`);

const portraits = {};
for (const spec of PORTRAIT_SPECS) {
  need(actualPortraitPngs.has(spec.file), `Missing expected Concept 1 portrait: ${spec.file}`);
  const meta = verifyPng(resolve(portraitDir, spec.file), 384, 480);
  portraits[spec.file] = {
    id: spec.id,
    file: spec.file,
    src: `/assets/portraits/concept1-v4/${spec.file}`,
    width: 384,
    height: 480,
    nativeGrid: { width: 64, height: 80, scale: 6 },
    role: spec.role,
    sex: spec.sex,
    stages: spec.stages,
    sha256: meta.sha256,
  };
}

for (const override of Object.values(PERSON_OVERRIDES)) {
  need(portraits[override.file], `Person override references unknown portrait ${override.file}`);
}

function compatiblePortrait(file, sex, stage) {
  const portrait = portraits[file];
  return portrait && (portrait.sex === "any" || portrait.sex === sex) && portrait.stages.includes(stage);
}

/** A profession never overrides the visible age or sex of the complete model. */
function selectCompatiblePortraitFile(sex, stage, wardrobeId) {
  const preferred = selectPortraitFile(sex, stage, wardrobeId);
  if (compatiblePortrait(preferred, sex, stage)) return preferred;
  // Young/female bankers can use commerce artwork without inheriting Syros's face.
  if (wardrobeId === "banker") {
    const commerce = selectPortraitFile(sex, stage, "commerce");
    if (compatiblePortrait(commerce, sex, stage)) return commerce;
  }
  // The small delivered library has no young variant for every outfit. Keep the
  // existing age-specific complete person rather than aging them to fit a role.
  const fallback = selectPortraitFile(sex, stage, v3.defaultWardrobes[stage]);
  need(compatiblePortrait(fallback, sex, stage), `Missing age-appropriate Concept 1 portrait: ${sex}:${stage}`);
  return fallback;
}

const combinationRoutes = {};
const usedFiles = new Set();
for (const sex of ["male", "female"]) {
  for (const [stage, wardrobes] of Object.entries(stageWardrobes)) {
    for (const wardrobeId of wardrobes) {
      const file = selectCompatiblePortraitFile(sex, stage, wardrobeId);
      need(portraits[file], `Route ${sex}:${stage}:${wardrobeId} points to missing portrait ${file}`);
      usedFiles.add(file);
      combinationRoutes[`${sex}:${stage}:${wardrobeId}`] = {
        id: portraits[file].id,
        file,
        src: portraits[file].src,
      };
    }
  }
}
for (const override of Object.values(PERSON_OVERRIDES)) usedFiles.add(override.file);
need(usedFiles.size === PORTRAIT_SPECS.length, `Unused Concept 1 portrait files: ${PORTRAIT_SPECS.filter(s => !usedFiles.has(s.file)).map(s => s.file).join(", ")}`);

const jobs = [...v3.jobs, ...EXPANDED_JOBS];
const roles = [
  ...v3.roles.slice(0, 2),
  { roleAlias: "banker", wardrobeId: "banker", minAge: 18 },
  ...v3.roles.slice(2),
];

const concept1Registry = {
  schemaVersion: 1,
  libraryId: "everfolk-concept1-portraits-v4",
  assetVersion: "c1-v4",
  publicPrefix: "/assets/portraits/concept1-v4/",
  dimensions: { width: 384, height: 480 },
  nativeGrid: { width: 64, height: 80, scale: 6 },
  identities: v3.identities,
  defaultWardrobes: v3.defaultWardrobes,
  stageWardrobes,
  jobs,
  occupationAliases: OCCUPATION_ALIASES,
  encounters: v3.encounters,
  roles,
  personOverrides: PERSON_OVERRIDES,
  portraits,
  combinationRoutes,
};

const SCENE_SPECS = [
  { id: "event_alexander_332bce", file: "event_alexander_332bce_480x224.png", mode: "event", bakedActor: true, events: ["classical-alexander-egypt", "classical-alexander-shore-work", "classical-alexandria-founded"] },
  { id: "event_euclid_300bce", file: "event_euclid_300bce_480x224.png", mode: "event", bakedActor: true, events: ["classical-euclid-teaching", "classical-euclid-demonstration"] },
  { id: "event_ptolemy_305bce", file: "event_ptolemy_305bce_480x224.png", mode: "event", bakedActor: true, events: ["classical-ptolemy-kingship", "classical-alexander-death", "classical-persian-reconquest"] },
  { id: "event_pharos_280bce", file: "event_pharos_280bce_480x224.png", mode: "event", bakedActor: true, events: ["classical-pharos-completed", "era-pharos-stone"] },
  { id: "event_library_museum", file: "event_library_museum_480x224.png", mode: "event", bakedActor: true, events: ["classical-scholarly-households", "era-museum-scholar", "era-museum-steward", "era-library-copyists", "classical-aristotle-death", "classical-aristotle-journey"] },
  { id: "event_succession_guard", file: "event_succession_guard_480x224.png", mode: "event", bakedActor: true, events: ["classical-succession-guard", "classical-garrison-account", "royal-general-supply-order", "era-cleruch-serving", "era-cleruch-veteran"] },
  { id: "event_royal_harvest_tax", file: "event_royal_harvest_tax_480x224.png", mode: "event", bakedActor: true, events: ["era-royal-land-lease", "era-royal-rent-due", "era-royal-linen", "era-royal-oil", "era-royal-licence-trade"] },
  { id: "event_vessel_packing", file: "event_vessel_packing_480x224.png", mode: "event", bakedActor: true, events: ["early-training-potters-bench", "inspire-ceramics-child", "inspire-ceramics-young", "inspire-ceramics-adult", "inspire-ceramics-elder", "holdings-gift-of-tools-ceramics"] },
  { id: "bg_harbor_quay", file: "bg_harbor_quay_480x224.png", mode: "backdrop", bakedActor: false, situations: ["harbor", "market", "business", "debt"] },
  { id: "bg_nile_farm", file: "bg_nile_farm_480x224.png", mode: "backdrop", bakedActor: false, situations: ["farming"] },
  { id: "bg_military_garrison", file: "bg_military_garrison_480x224.png", mode: "backdrop", bakedActor: false, situations: ["military", "war", "danger"] },
  { id: "bg_mouseion_study", file: "bg_mouseion_study_480x224.png", mode: "backdrop", bakedActor: false, situations: ["study", "philosophy", "astronomy", "civic"] },
  { id: "bg_home_courtyard", file: "bg_home_courtyard_480x224.png", mode: "backdrop", bakedActor: false, situations: ["home", "courtyard", "parenthood", "illness", "recovery", "retirement"] },
  { id: "bg_craft_workshop", file: "bg_craft_workshop_480x224.png", mode: "backdrop", bakedActor: false, situations: ["workshop", "sculpture"] },
  { id: "bg_pottery_kiln", file: "bg_pottery_kiln_480x224.png", mode: "backdrop", bakedActor: false, situations: ["pottery"] },
  { id: "bg_temple_shrine", file: "bg_temple_shrine_480x224.png", mode: "backdrop", bakedActor: false, situations: ["shrine", "memorial"] },
  { id: "bg_festival_feast", file: "bg_festival_feast_480x224.png", mode: "backdrop", bakedActor: false, situations: ["feast", "music", "marriage", "courtship", "friendship"] },
];

const sceneManifest = {
  schemaVersion: 1,
  libraryId: "everfolk-concept1-banners-v1",
  dimensions: { width: 480, height: 224 },
  scenes: SCENE_SPECS.map(spec => {
    const meta = verifyPng(resolve(sceneDir, spec.file), 480, 224);
    return { ...spec, src: `/assets/pixel/banners-concept1/${spec.file}`, width: 480, height: 224, sha256: meta.sha256 };
  }),
};

const registryChanged = writeChanged(portraitRegistryPath, concept1Registry);
const portraitManifestChanged = writeChanged(resolve(portraitDir, "manifest.json"), concept1Registry);
const sceneManifestChanged = writeChanged(resolve(sceneDir, "manifest.json"), sceneManifest);

console.log(JSON.stringify({
  portraits: PORTRAIT_SPECS.length,
  jobs: jobs.length,
  scenes: SCENE_SPECS.length,
  registryChanged,
  portraitManifestChanged,
  sceneManifestChanged,
  registry: relative(repo, portraitRegistryPath).replaceAll("\\", "/"),
}));
