# Runtime portrait state and asset convention

The game now uses the 240 ordinary-v3 portraits for the player, encountered NPCs, natal family, spouses and children. `LifeEngine` remains the saved-state authority. `client/models/portrait-state.ts` projects its recorded facts into an immutable `PortraitState`; `PixelPortrait` renders that descriptor.

Portraits are assigned randomly by the existing seeded birth/encounter identity engine and appear naturally in the character and relationship views. The birth dialog contains starting stats only, without a portrait announcement, age-preview gallery or selection controls. Rendering never draws gameplay RNG, appends a command or writes a new identity to a save.

## Data convention

| Field | Meaning / authority |
| --- | --- |
| `schemaVersion` | Descriptor contract version, currently `1` |
| `libraryId` | `everfolk-ordinary-portraits-v3` |
| `subjectKey` | Stable JSON tuple of world ID, immutable world fingerprint, life seed, subject kind and recorded person ID |
| `identityId` | `m01`–`m03` / `f01`–`f03`, mapped from recorded sex and zero-based `avatarVariant` |
| `identityKey` | Subject key plus identity ID; independent of age, job, displayed name and relationship labels |
| `bodyTemplate` | M/F artwork template. For missing sex this is a cosmetic fallback, not a recorded biographical fact |
| `identitySource` | `recorded` or `presentation-fallback` |
| `stage` | Infant 0–2; child 3–12; youth 13–17; adult 18–39; middle 40–59; elder 60+ |
| `wardrobeId` | Age-eligible clothing selected from explicit household role, current job, recorded occupation, or age default |
| `selectionReason` | `royalty`, `aristocrat`, `job`, `occupation` or `age-default` |
| `combinationKey` | **`{identityId}:{stage}:{wardrobeId}`**, e.g. `f02:youth:royalty` |
| `assetId` | **`ef-p-{identityId}-{stage}-{wardrobeId}-v3`** |
| `src` | `/assets/portraits/ordinary-v3/{assetId}.png` |
| `width` / `height` | Native 384 × 480; display with 4:5 containment and pixel rendering |

The generated [runtime registry](../../client/models/portrait-asset-registry.json) lists every valid combination and its actual URL. Unavailable age/clothing pairs fall back to the stage default, keeping the same identity.

```ts
const portrait = playerPortraitState(world, life);
// portrait.combinationKey: "f02:youth:royalty"
// portrait.src: "/assets/portraits/ordinary-v3/ef-p-f02-youth-royalty-v3.png"
```

## State ownership and selection

The simulation already stores player `character.sex` / `character.avatarVariant` and encountered people's own appearance. It saves seed and accepted commands, then reconstructs and checks the entire life on replay. Do not persist this derived descriptor or add portrait fields while rendering: that would create a second state authority and invalidate canonical saves.

Missing family variants and missing child appearance use deterministic cosmetic hashes of the stable subject key. Names, age, profession and relationship labels never enter that hash. A child without recorded sex receives a stable visual body template; its simulation biography remains unchanged. Future recorded appearance takes precedence.

The selection order is:

1. An explicitly enabled royal/aristocratic player household route, from the life's own world revision, selects role clothing from age 16. The same known household context is used for natal relatives and children.
2. A recorded current player job selects its mapped clothing only when the job's minimum age is met.
3. NPC/family recorded occupation is matched against exact authored job titles, encounter labels and the explicit family-occupation aliases in the model. Unknown occupations use the age default.
4. Missing or unsupported combinations use the original age-appropriate everyday outfit or infant wrap.

An encountered NPC's randomly generated origin is upbringing, not an active royal/aristocratic role. A royal-origin porter keeps maritime work clothes. Changing friend, spouse, teacher or enemy labels never changes a person's identity. Remembered relatives use `familyMemberAge`, so their portrait stops aging at death.

## Owning modules and consumers

| Responsibility | Module |
| --- | --- |
| Persisted identity and canonical replay | `src/people.ts`, `src/engine.ts`, `src/types.ts` |
| Pure portrait state / clothing resolver | `client/models/portrait-state.ts` |
| Generated 240-combination lookup | `client/models/portrait-asset-registry.json` |
| Descriptor renderer | `client/components/PixelPortrait.tsx` |
| Player portrait | `client/screens/App.tsx` |
| Starting stats only; no portrait introduction | `client/components/BirthRollPopover.tsx` |
| Stable family / social rows | `client/models/relationship-table.ts` |
| Family, NPC and household views | `CharacterPanel.tsx`, `RelationshipTable.tsx`, `HouseholdSummary.tsx` |
| Source-to-public asset delivery | `scripts/sync-portrait-assets.mjs` |

The old `life-background.ts` / `avatar-appearance.ts` SVG APIs remain for existing scene actors and retained source artwork. New portrait consumers should call the portrait-state model. Legacy avatar-selection commands remain readable for old replay compatibility; the client exposes no chooser.

## Delivery and validation

```powershell
node scripts/sync-portrait-assets.mjs
node --test test/portrait-state.test.ts test/portrait-delivery.test.ts test/portrait-ui.test.ts
node scripts/check-structure.mjs
node node_modules/typescript/bin/tsc --noEmit
```

The sync script validates the reviewed authoring manifest and all 240 source PNG hashes before delivery. It copies exact finished PNGs, preserves the source artwork, generates browser-safe lookup data and is idempotent. Do not reapply filters or rebuild head/body layers at runtime.

The source authoring manifest and its QA hashes remain immutable historical evidence. Runtime integration is recorded separately in `runtime-integration.json` and the library registry.
