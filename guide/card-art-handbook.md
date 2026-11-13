# Card artwork handbook

This is the handoff contract for replacing the collection illustrations with pixel art while keeping the approved cards usable in the game. An artist supplies one illustration for an existing card ID; the card tools fit it into its existing frame and preserve the title, biography, symbol, rarity and live edition behavior.

Start with the portable kit's [artist quickstart](../artwork/card-art-handoff-v1/docs/artist-quickstart.md) and [prompt templates](../artwork/card-art-handoff-v1/docs/prompt-templates.md). The kit README contains the executable commands. No particular image generator or pixel editor is required.

## What is in the collection

There are **117 catalogue designs**: 13 historical main portraits and 52 contributor professions, each with male and female illustrations. Every figure has Common, Uncommon, Rare and Epic contributor roles. The IDs are stable: `euclid-parent`, `alexander-common-female`, `aristotle-epic-male`.

The historical main portraits keep their identities. Contributor portraits are fictional representatives of a profession, not newly identified ancient individuals. Both gender variants have equal professional standing and share the same card prose; they should have distinct faces and can use different poses and face angles.

The current v14 collection adds **34 illustrations** and reuses **83 approved v12 illustrations**. It is not a set of 117 newly generated paintings. Keep those approved versions as the visual baseline when preparing a migration.

| Figure ID | Main portrait | Base frame | Contributor progression: Common → Uncommon → Rare → Epic |
| --- | --- | --- | --- |
| `alexander` | Alexander the Great | Legendary | Camp Runner → Campaign Provisioner → Campaign Staff Officer → Trusted Commander |
| `aristotle` | Aristotle | Legendary | Lyceum Attendant → Lyceum Copyist → Lyceum Researcher → Peripatetic Scholar |
| `euclid` | Euclid | Legendary | Geometry Apprentice → Geometrical Copyist → Proof Checker → Geometer of the Circle |
| `lysippos` | Lysippos | Legendary | Workshop Apprentice → Bronze Workshop Assistant → Portrait Modeller → Master of Lysippan Form |
| `pytheas` | Pytheas of Massalia | Epic | Deckhand of Massalia → Expedition Provisioner → Navigation Observer → Keeper of the Voyage Log |
| `menander` | Menander | Legendary | Stagehand → Stage Copyist → New Comedy Collaborator → Dramatist of New Comedy |
| `demetrius` | Demetrius the Besieger | Epic | Siege Labourer → Siege Workshop Assistant → Siege Engineer → Director of Siege Works |
| `theophrastus` | Theophrastus | Epic | Garden Attendant → Plant Records Assistant → Plant Investigator → Botanical Scholar |
| `zeno` | Zeno of Citium | Epic | Listener at the Stoa → Student of the Stoa → Stoic Discussion Leader → Scholar of Stoic Ethics |
| `ptolemy` | Ptolemy I Soter | Epic | Palace Messenger → Administration Clerk → Supply Commissioner → Steward of Egypt |
| `cleomenes` | Cleomenes of Naucratis | Epic | Granary Porter → Revenue Records Assistant → Grain Supply Auditor → Egyptian Grain Steward |
| `nearchus` | Nearchus | Epic | Fleet Deckhand → Coastal Scout → Pilot of the Indus Fleet → Navigator of Nearchus |
| `eumenes` | Eumenes of Cardia | Epic | Archive Attendant → Royal Dispatch Copyist → Campaign Correspondent → Secretary of Eumenes |

The inventory is authoritative for exact card IDs, canonical titles and display titles. Short display titles fit the card face; canonical titles preserve existing gameplay names.

The original set has **16 runtime main-card frame variants**. The four retained onchain figure IDs—Alexander, Aristotle, Euclid and Cleomenes—need the other four rarity frames in addition to their catalogue base frame. These reuse the same main illustration. They are not another 16 characters or a request for 16 paintings. The saved card's rarity selects its frame; the catalogue base rank does not override a recorded rarity.

## Divide the work into layers

| Layer | Owner and source | Artist's replacement scope |
| --- | --- | --- |
| Illustration | Art-only source PNG, prompt/reference record, pixel source and QA | Replace this for the chosen ID |
| Frame and ornaments | Approved vector geometry and rarity treatment | Reuse; no painted border in the illustration |
| Profession symbol | Sourced SVG and its attribution/license | Reuse; no generated substitute |
| Title and biography | `framed-collection-v14/source/card-copy.json` | Reuse unless copy revision is separately requested |
| Identity and mapping | Catalogue, registry and stable card IDs | Keep figure, role, gender and ID mappings intact |
| Example edition | Preview export, such as `001/025` | Visual example only |
| Actual edition, ownership and rarity | Saved game / contract record, rendered live | Never infer or bake into replacement art |
| Awards and promotions | Gameplay rules and historical milestone gates | Outside an art migration |

New Common art and the lower Nearchus/Eumenes tiers are editorial collection coverage. Their existence does not grant a player an award, add a playable route, resolve a historical milestone or promote a main figure. Nearchus and Eumenes use an editorial Epic base frame; this does not establish a new gameplay rarity policy.

Modern saves with a custom portrait must keep that portrait. Older saves without a recorded gender use a stable representative-art fallback; do not guess gender from a name or rewrite the saved identity.

## Illustration file contract

Deliver an **opaque 840 × 1050 PNG** in a 4:5 portrait ratio, with the illustration alone. For strict pixel-grid preservation in standard frames, also provide a separately finished **592 × 740 PNG** with the same character and composition. Use 8-bit RGB, or RGBA with every pixel fully opaque. Keep the editable pixel source, its native logical size, any palette, and reference/provenance notes alongside it.

Do not include a card frame, title, subtitle, rarity label, symbol, biography, serial number, watermark or invented readable writing. Those are separate layers. A scroll or wax tablet may appear as a prop, but card copy must never be painted onto it.

Choose one deliberate finish per replacement series:

| Finish | Working grid | Final art | Use |
| --- | --- | --- | --- |
| Native pixel art, coarse | 280 × 350 | Nearest-neighbor enlargement ×3 to 840 × 1050 | Strong clusters and a chunkier migration style |
| Native pixel art, finer | 420 × 525 | Nearest-neighbor enlargement ×2 to 840 × 1050 | More room for pupils, hands and fine tools |
| Existing mixed PixelOE | Coarse 3 px body / finer 2 px face on the final canvas | 840 × 1050 | Match the approved current finish |

Native pixel art can be drawn in any suitable editor and supplied as a ready PNG. It does **not** need a PixelOE pass. Choose the working grid by the actual card-size result; integer enlargement cannot recover a lost eye or ambiguous grip. Keep diagonal edges, light/shadow clusters and facial features intentional. Avoid smoothing or bilinear resizing.

The kit also accepts native-resolution PNGs with explicit `--mode native-pixel`: 420 × 525, 280 × 350, 168 × 210 or 140 × 175 for the main `--art` image. It enlarges these by exact integer factors to 840 × 1050. A separate `--standard-art` can be 296 × 370 or 148 × 185 in that mode, enlarged exactly to 592 × 740. In default `finished` mode, supply the final 840 × 1050 and optional final 592 × 740 images. Arbitrary source sizes are rejected rather than stretched into the contract.

For an AI-assisted route, generate or edit a clean painterly source first, approve its anatomy and equipment, then apply a real PixelOE conversion if that finish is wanted. PixelOE is an outline- and contrast-aware conversion. A nearest-neighbor mosaic of a painting is only a nearest preview; label it accordingly. Never claim that it passed through PixelOE when it did not.

An optional mixed finish needs the original painting, a verified 3 px coarse conversion, a 2 px detail conversion and a face-region configuration measured for that particular image. Aligned whole-cell selection preserves the coarse body while restoring face detail. Copying another portrait's face coordinates can alter its neck, shoulder or background instead. Record the mask, settings, dimensions, input/output hashes and actual conversion provenance. Do not describe a mixed-grid result as one uniform logical grid.

## Fit the art into the existing frame

The final card is **900 × 1260**. The illustration remains separate from the frame and live type.

| Layout | Art placement on the card | Composition consequence |
| --- | --- | --- |
| Standard: Common–Epic | Full 4:5 portrait at 592 × 740, position `(154,190)`, inside an 800 × 740 chamfered opening starting `(50,190)` | Coloured side inlays fill the extra width. Keep the complete portrait; do not stretch a body to fill the opening. |
| Legendary full art | Original 840 × 1050 illustration at native size, position `(30,140)` | The title and lower biography overlay the painting. Low-detail atmospheric edge extensions fill the surrounding canvas. |

By default, the standard fit uses nearest-neighbor sampling to keep edges crisp. Because 840→592 is not an integer scale, that fitted result is not a uniform copy of the original logical grid. The kit reports this noninteger resample in its QA. For the pixel migration, prefer a separately finished `--standard-art` PNG at 592 × 740, or its native 296 × 370 / 148 × 185 source. That artwork is placed directly in the existing standard opening; the 840 × 1050 version remains the portrait and Legendary source. These two fitting assets preserve the approved geometry without pretending one regular logical grid survives both dimensions. Review both at actual card size.

Compose using the appropriate frame preview from the start. Keep the head, pupils, sword point, wrists and the important tool clear of the title and biography areas. For full-art cards, put readable facial and hand detail in the upper and middle image, and quieter atmosphere under the lower text. A weapon can be long and commanding without leaving the canvas or passing through the title. Confirm visibility with the actual overlay; a generic “safe area” cannot account for every pose.

The approved native masters are `.vectorcraft`; self-contained SVG cards and separate SVG overlays retain editable text, paths and symbols. Final PNG production compositing preserves the fitted art underneath the transparent overlay. A native editor export may resample an image, so compare the final uncovered illustration pixels with the fitted source instead of assuming every export is crisp.

## References, identity and anatomy

Use the approved illustration for continuity of the character and atmosphere. Use the correct character's supplied equipment reference for the requested armour silhouette and components. A modern game render is a design reference, not archaeological evidence. If authenticity requires another source, record an actual object or museum reference appropriate to the time and place; do not borrow a different named character's armour as a shortcut.

Separate three decisions in the notes: **supported form** (the referenced equipment or object), **interpretation** (unrecorded material, colour, setting or portrait likeness), and **creative exaggeration** (for example a longer blade or heightened cloak movement). Keep the actual reference image and credit. A generated imitation of a museum photograph is not a reference.

Main portraits should preserve the approved face, visible pupils and gaze. Where historical appearance is uncertain, describe the image as an artistic interpretation. Contributor faces should vary across gender variants, professions and figures: use distinct brow, nose, jaw, hair and age, with front, three-quarter, profile and turned views distributed across the roster. Alexander's contributors must not all repeat his main-card face angle. Do not copy the parent's face onto a whole profession ladder.

For the requested military art, use plainer, lower-status kit on the lower contributor tiers and richer responsibility/command cues at higher tiers. Keep both genders practically dressed for the same job. Do not turn “female” into exposed armour or reduce the character's authority. A professional difference should read through work, equipment, posture and setting, not just through extra jewellery.

Review hands before pixel conversion. Fingers wrap around the handle, the thumb opposes the fingers, the wrist follows the forearm, and the guard separates hand from blade. The blade plane, edge, guard and pommel must agree with the wrist rotation and perspective. Use a pose reference with a visible grip, then preserve the physical relationship when lengthening a blade. The other hand must hold reins or a tool with the same care. Check Ptolemy's full shoulder–elbow–wrist chain explicitly; reject duplicated, fused or detached limbs rather than hiding them in the finish.

Use plausible props for each brief: papyrus rolls, wax tablets and appropriate writing implements; geometry dividers rather than a navigation compass; rope and coast observations rather than a magnetic compass or sextant. Avoid modern bound books and feather quills unless a separately checked brief calls for them.

## Card language and symbols

A main portrait has a proper name, a profession/identity subtitle, a relevant symbol, a short epithet and a short biography. Euclid is **Geometer of Alexandria** with a drafting-compass symbol and **The Architecture of Proof** as the biography heading.

A contributor card has a profession title, a relational subtitle and a short paragraph that brings duty and importance together. It does not use its main figure's bare name as the subtitle. For example, `alexander-common-female` is **Camp Runner**, **Messenger of the Host**, with **The Order Arrives** above a paragraph about making distant orders reach the army. `aristotle-epic-male` is **Peripatetic Scholar**, **A Voice of the Lyceum**, with **Inquiry Carried Forward** above a paragraph about independent inquiry and teaching.

Do not put “Historical Figure,” “Player Contribution,” “Art Preview,” or a gender label onto card faces. Contributor biographies describe the profession and its value as connected prose, not a list of job duties. Male and female variants use the same prose.

| Rarity | Identifying frame traits | Preview footer |
| --- | --- | --- |
| Common | Plain iron, single border, square joints | `001/∞` |
| Uncommon | Forest green, antique bronze, paired borders, leaf corners | `001/∞` |
| Rare | Silver-blue, faceted gems, chamfered brackets | `001/100` |
| Epic | Amethyst and gold, interlaced corners, jewel rails | `001/025` |
| Legendary | Full art, gilded perimeter, radiant rank cartouche, larger emblem | `001/010` |

The professionally drawn symbols come from Game-icons.net (Lorc/Delapouite, CC BY 3.0) and, for Euclid's drafting compass, Google Material Icons (Apache 2.0). Preserve original SVGs, credits and licenses. These symbols are visual associations, not claims to ancient personal insignia. Icons remain vector layers and are not put through PixelOE with the painting.

## Replacement and review workflow

1. Choose the exact ID from the kit inventory. Open the current art, copy and corresponding frame. Agree on the target pixel finish before doing the full roster.
2. Save a new versioned working folder. Keep the current baseline intact. Add the correct approved references, source/credit notes and, for AI work, the exact prompt and source painting.
3. Make the art-only PNG. Use the native pixel path or the painterly-source/conversion path above. Fix face, anatomy, sword geometry and equipment before framing.
4. Run `node tools/card-art.mjs render --id alexander-common-female --art incoming/alexander-common-female.png --out output/first-pass` from the kit root, substituting your ID and PNG. Add `--standard-art incoming/alexander-common-female-standard.png` for a dedicated standard fit, and `--mode native-pixel` if supplying logical-resolution art. Review the full card and footerless card. Use batch rendering only after a small set covers both frame layouts and difficult hand/tool poses.
5. Check at intended display size, then at 100%: identity, distinct contributor face, pupils, hands, period kit, readable silhouette, pixel finish and frame occlusion. Compare the exact original references beside the result.
6. Hand over the source art, ready PNGs, provenance and render output. From the game repository, a maintainer runs `node scripts/import-card-art.mjs --bundle PATH_TO_OUTPUT --version pixel-v1` to prepare the production change, reviews it, then adds `--apply` to install the versioned outputs and active manifest. Review the change before publishing.

Do not replace individual files in `public/assets/cards/collection-v14/` by hand. That folder contains generated, hashed WebP derivatives. A production replacement must keep the full card, thumbnail, footerless card, portrait, registry hashes and any applicable runtime frame variants in agreement.

Preview cards intentionally show numerator **001**. In a live owned-card view, use the **footerless** image and draw the actual recorded edition on top. Never treat the painted preview number as an issued token, an owner record or a fallback edition. Missing edition data stays unknown rather than becoming 001.

## Source map for maintainers

| Repository source | Purpose |
| --- | --- |
| `artwork/cards/framed-collection-v14/source/framing-map.json` | Complete ID, identity, gender, rank, copy and source-art mapping |
| `artwork/cards/framed-collection-v14/source/card-copy.json` | Figure biographies and the 52 profession copy records |
| `artwork/cards/framed-collection-v14/catalog.json` | Fit geometry, export paths, source hashes and card QA |
| `artwork/cards/framed-collection-v14/source/research.md` | Historical claims, uncertainties and gameplay boundaries |
| `artwork/cards/framed-collection-v14/source/icon-sources.json` | Icon provenance, licenses and source hashes |
| `artwork/cards/framed-collection-v14/source/overlays/` | Editable frame/type/symbol SVG layers without illustration |
| `artwork/cards/framed-collection-v14/masters/` | Native editable VectorCraft cards |
| `artwork/cards/figure-inner-art-v12/` | Existing 83 approved illustrations |
| `artwork/cards/figure-inner-art-v14/` | 34 newer illustrations, prompts, references and pixel QA |
| `client/models/card-art-registry.json` | Production asset registry, including runtime main-card frame variants |
| `client/models/card-art.ts` | Artwork lookup, saved-rarity frame selection and live edition formatting |
| `scripts/sync-card-assets.mjs` | Production derivative/registry pipeline |

An artist can use the portable kit without the game source, a wallet, VectorCraft or an image-generation API. The kit supplies editable SVG layers for optional layout work; the original native VectorCraft masters remain in the repository. Replacing an illustration only needs art-only PNGs and the kit's render tools. Keep the exported handoff portable: use relative paths, retain the relevant credits, and do not include machine-local skill instructions, secrets or dependency installations.

The runtime set now includes 19 alternate parent frames: the 16 retained onchain variants plus full-art Legendary promotions for Demetrius, Zeno and Ptolemy. Each promotion reuses its approved main portrait; no additional illustration is required.
