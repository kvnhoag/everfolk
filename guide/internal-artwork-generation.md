# Inner artwork generation guide and required artwork list

Create **117 unique illustrations**: **13 historical main portraits** and **104 contributor portraits**. Each figure has four contributor professions, each requiring a separate adult male and adult female illustration. The existing 16 alternate rarity frames reuse main portraits; they require no additional paintings.

This brief covers the illustration itself. Deliver art without card borders, titles, biographies, emblems, rarity labels, edition numbers or watermarks.

## Generate each illustration

1. Read the subject or profession in the list below. Choose one action that makes their identity or responsibility immediately understandable: measuring a construction, checking grain, carrying a dispatch, preparing a casting, or commanding troops.
2. Use the approved artwork as the identity and collection reference. Match armour to the actual character reference; do not borrow another named character's armour. Use the supplied lower military equipment reference for appropriate contributor roles. Common workers wear practical clothing; higher responsibility can show through equipment, posture and setting without dressing everyone as royalty.
3. Make several small composition sketches before finishing. Choose a strong silhouette, a clear face and one readable action. Keep the role-defining hands and tools visible and avoid crowding the scene with competing props.
4. Give contributors individual faces, ages, hair and expressions. Both gender versions must look competent at the same profession. Change the action or staging as well as the face angle. Alexander's contributors must use a different face angle from his main portrait. Vary other contributors across frontal, three-quarter and profile views.
5. Correct anatomy before the pixel finish. Check continuous shoulder–elbow–wrist connections, exactly two arms, natural fingers and believable weight. For Alexander, retain the mounted composition and longer blade, with the sword point inside the image. Fingers close around the handle below the guard; wrist, guard and blade plane agree in perspective. The other hand grips the reins naturally. Review Ptolemy's arm anatomy especially carefully.
6. Produce deliberate pixel art with readable clusters, eyes, hands and tools. Draw natively in a pixel editor, or generate a clean source painting, correct it, then use the actual PixelOE conversion and manual cleanup. A generic mosaic or nearest-neighbour reduction is not a PixelOE finish. Keep one consistent finish across the collection.
7. Review at actual card size, with the intended frame visible as a temporary guide. Return the clean artwork with that guide hidden, plus the editable source and reference notes.

## Output sizes

| Artwork | Delivery | Native pixel option |
| --- | --- | --- |
| Main art master / full-art illustration | Opaque 840 × 1050 PNG, RGB or fully opaque RGBA, 8-bit | Draw 420 × 525 and enlarge ×2, or 280 × 350 and enlarge ×3 |
| Standard-window fitting artwork | Matching 592 × 740 PNG | Draw 296 × 370 and enlarge ×2, or 148 × 185 and enlarge ×4 |

Keep the same character, action and scene in both sizes. These are fitting exports of one illustration, not two new concepts. Enlarge native pixels with nearest-neighbour only. Keep the editable master so the standard version can be finished at its own grid: resizing 840 × 1050 to 592 × 740 is fractional and can produce uneven pixel blocks.

## Advice from working TCG artists

**Cole Eastburn — Hearthstone illustration.** In his first-person process tutorial, Eastburn recommends solving mood, story and large light/dark shapes in thumbnails before detailed drawing. He offers meaningfully different staging options, checks anatomy in the rough, organizes a few dominant colours, and balances focal detail with quieter areas. Apply this by approving the scene and its value structure before spending time on pixel polish. [Artist's tutorial: How those epic Hearthstone cards are made](https://www.creativebloq.com/3d/how-those-epic-hearthstone-cards-are-made).

**Cynthia Sheppard — Magic illustrator and art director.** In her interview, Sheppard explains that assignments include frame information or templates. Full-art compositions must account for cropping and areas covered by text or frame elements, with essential storytelling placed in the surviving visible area. Apply this by testing the real overlay during sketching, not after completing the painting. [Artist interview: Creating the Look — The Art of Magic Arena](https://www.mmorpg.com/interviews/creating-the-look-the-art-of-magic-arena-2000108746?amp=true).

The following directions are our application of those principles to this collection, not specifications quoted from either artist.

| Decision | Normal / standard-window artwork | Full-art artwork |
| --- | --- | --- |
| Main story | A compact, self-contained scene: one professional action reads immediately | A larger scene with a strong main figure, depth and atmosphere |
| Focal hierarchy | Face, working hand and identifying tool form a clear visual group | Preserve that group in the unobstructed area; extra canvas supports it |
| Framing | Keep essential anatomy and the full identifying tool inside the portrait; leave breathing room at edges | Check the title, emblem, rarity and biography overlays; avoid placing faces, grips or sword tips behind them |
| Background | Simplify clutter and separate the subject through value and silhouette | Extend meaningful setting, light and atmosphere; use quieter detail behind text |
| Drama | Use expression, gesture and purposeful work rather than tiny decorative detail | Use scale, perspective and depth without making every corner equally bright or busy |
| Review | Judge the scene at card size; verify it still reads when reduced | Judge with all overlays visible; a beautiful hidden focal point does not help the card |

For this collection, standard art appears at **592 × 740** inside an **800 × 740** opening with side inlays. Full-art source imagery is **840 × 1050**; the title and lower biography overlay it. Do not import another TCG's landscape art ratio or full-art text positions into these templates.

Alexander, Aristotle, Euclid and Cleomenes also appear in alternate recorded-rarity frames. Compose their main illustrations to work in both standard and full-art treatments; they still need only one illustration concept each.

## Reusable generation prompt

```text
Create an art-only historical pixel-art illustration for [EXACT SUBJECT / PROFESSION],
associated with [FIGURE]. Show [ONE SPECIFIC PROFESSIONAL ACTION] in [SETTING].

Identity: [historical main figure's approved appearance OR a distinct adult male/female
contributor]. Face angle: [ANGLE]. Expression and posture: [INTENT].
Use [CORRECT CHARACTER / CLOTHING / EQUIPMENT REFERENCES]. Keep lower military ranks
in appropriately simpler kit. Give hands natural grips and tools coherent perspective.

Composition: [STANDARD WINDOW OR FULL ART]. Establish a readable silhouette, face,
working hand and role-defining tool. Use a clear light/dark hierarchy, controlled
palette and quieter background. Keep critical features clear of the supplied overlay.
For full art, extend the environment and atmosphere without moving essential story
elements behind the title or biography.

Finish: purposeful pixel clusters and readable anatomy at card size; consistent with
the collection. Portrait 4:5. No frame, lettering, emblem, number or watermark.
```

If using a painterly-source workflow, replace the finish instruction with “clean source painting for a separate PixelOE pass.” Keep the source painting and the real conversion settings.

## Required artwork roster

Each row needs **nine artworks**: one main portrait plus male and female versions of all four contributor professions. Contributors are fictional professional representatives, not additional named historical people. The tier describes responsibility and visual status, not a different frame to paint.

| Main figure | Common — male + female | Uncommon — male + female | Rare — male + female | Epic — male + female |
| --- | --- | --- | --- | --- |
| Alexander the Great | Camp Runner | Campaign Provisioner | Campaign Staff Officer | Trusted Campaign Commander |
| Aristotle | Lyceum Attendant | Lyceum Copyist | Lyceum Researcher | Peripatetic Scholar |
| Euclid | Geometry Apprentice | Geometrical Copyist | Proof Checker | Geometer of the Teaching Circle |
| Lysippos | Workshop Apprentice | Bronze Workshop Assistant | Portrait Modeller | Master of Lysippan Form |
| Pytheas of Massalia | Deckhand of Massalia | Expedition Provisioner | Navigation Observer | Keeper of the Northern Voyage Log |
| Menander | Stagehand | Stage Copyist | New Comedy Collaborator | Dramatist of New Comedy |
| Demetrius the Besieger | Siege Labourer | Siege Workshop Assistant | Siege Engineer | Director of Siege Works |
| Theophrastus | Garden Attendant | Plant Records Assistant | Comparative Plant Investigator | Peripatetic Botanical Scholar |
| Zeno of Citium | Listener at the Stoa | Student of the Stoa | Stoic Discussion Leader | Scholar of Stoic Ethics |
| Ptolemy I Soter | Palace Messenger | Egyptian Administration Clerk | Ptolemaic Supply Commissioner | Steward of Egyptian Government |
| Cleomenes of Naucratis | Granary Porter | Revenue Records Assistant | Grain Supply Auditor | Steward of Egyptian Grain Accounts |
| Nearchus | Fleet Deckhand | Coastal Scout | Pilot of the Indus Fleet | Navigator of Nearchus |
| Eumenes of Cardia | Archive Attendant | Royal Dispatch Copyist | Campaign Correspondent | Secretary of Eumenes |

**Default full-art main portraits:** Alexander the Great, Aristotle, Euclid, Lysippos, Menander.

**Default standard-window main portraits:** Pytheas of Massalia, Demetrius the Besieger, Theophrastus, Zeno of Citium, Ptolemy I Soter, Cleomenes of Naucratis, Nearchus, Eumenes of Cardia. All contributor illustrations use standard windows.

## Exact delivery checklist — 117 artworks

Use these filenames so every image can be matched to its intended artwork. Main figures retain their historical identity; male/female labels apply to the separate contributor designs.

### Alexander the Great

- [ ] `alexander-parent.png` — Alexander the Great, King of Macedon; main portrait.
- [ ] `alexander-common-male.png` — Camp Runner; adult male; common.
- [ ] `alexander-common-female.png` — Camp Runner; adult female; common.
- [ ] `alexander-uncommon-male.png` — Campaign Provisioner; adult male; uncommon.
- [ ] `alexander-uncommon-female.png` — Campaign Provisioner; adult female; uncommon.
- [ ] `alexander-rare-male.png` — Campaign Staff Officer; adult male; rare.
- [ ] `alexander-rare-female.png` — Campaign Staff Officer; adult female; rare.
- [ ] `alexander-epic-male.png` — Trusted Campaign Commander; adult male; epic.
- [ ] `alexander-epic-female.png` — Trusted Campaign Commander; adult female; epic.

### Aristotle

- [ ] `aristotle-parent.png` — Aristotle, Philosopher of the Lyceum; main portrait.
- [ ] `aristotle-common-male.png` — Lyceum Attendant; adult male; common.
- [ ] `aristotle-common-female.png` — Lyceum Attendant; adult female; common.
- [ ] `aristotle-uncommon-male.png` — Lyceum Copyist; adult male; uncommon.
- [ ] `aristotle-uncommon-female.png` — Lyceum Copyist; adult female; uncommon.
- [ ] `aristotle-rare-male.png` — Lyceum Researcher; adult male; rare.
- [ ] `aristotle-rare-female.png` — Lyceum Researcher; adult female; rare.
- [ ] `aristotle-epic-male.png` — Peripatetic Scholar; adult male; epic.
- [ ] `aristotle-epic-female.png` — Peripatetic Scholar; adult female; epic.

### Euclid

- [ ] `euclid-parent.png` — Euclid, Geometer of Alexandria; main portrait.
- [ ] `euclid-common-male.png` — Geometry Apprentice; adult male; common.
- [ ] `euclid-common-female.png` — Geometry Apprentice; adult female; common.
- [ ] `euclid-uncommon-male.png` — Geometrical Copyist; adult male; uncommon.
- [ ] `euclid-uncommon-female.png` — Geometrical Copyist; adult female; uncommon.
- [ ] `euclid-rare-male.png` — Proof Checker; adult male; rare.
- [ ] `euclid-rare-female.png` — Proof Checker; adult female; rare.
- [ ] `euclid-epic-male.png` — Geometer of the Teaching Circle; adult male; epic.
- [ ] `euclid-epic-female.png` — Geometer of the Teaching Circle; adult female; epic.

### Lysippos

- [ ] `lysippos-parent.png` — Lysippos, Master Sculptor of Sikyon; main portrait.
- [ ] `lysippos-common-male.png` — Workshop Apprentice; adult male; common.
- [ ] `lysippos-common-female.png` — Workshop Apprentice; adult female; common.
- [ ] `lysippos-uncommon-male.png` — Bronze Workshop Assistant; adult male; uncommon.
- [ ] `lysippos-uncommon-female.png` — Bronze Workshop Assistant; adult female; uncommon.
- [ ] `lysippos-rare-male.png` — Portrait Modeller; adult male; rare.
- [ ] `lysippos-rare-female.png` — Portrait Modeller; adult female; rare.
- [ ] `lysippos-epic-male.png` — Master of Lysippan Form; adult male; epic.
- [ ] `lysippos-epic-female.png` — Master of Lysippan Form; adult female; epic.

### Pytheas of Massalia

- [ ] `pytheas-parent.png` — Pytheas of Massalia, Explorer of the Northern Seas; main portrait.
- [ ] `pytheas-common-male.png` — Deckhand of Massalia; adult male; common.
- [ ] `pytheas-common-female.png` — Deckhand of Massalia; adult female; common.
- [ ] `pytheas-uncommon-male.png` — Expedition Provisioner; adult male; uncommon.
- [ ] `pytheas-uncommon-female.png` — Expedition Provisioner; adult female; uncommon.
- [ ] `pytheas-rare-male.png` — Navigation Observer; adult male; rare.
- [ ] `pytheas-rare-female.png` — Navigation Observer; adult female; rare.
- [ ] `pytheas-epic-male.png` — Keeper of the Northern Voyage Log; adult male; epic.
- [ ] `pytheas-epic-female.png` — Keeper of the Northern Voyage Log; adult female; epic.

### Menander

- [ ] `menander-parent.png` — Menander, Master of New Comedy; main portrait.
- [ ] `menander-common-male.png` — Stagehand; adult male; common.
- [ ] `menander-common-female.png` — Stagehand; adult female; common.
- [ ] `menander-uncommon-male.png` — Stage Copyist; adult male; uncommon.
- [ ] `menander-uncommon-female.png` — Stage Copyist; adult female; uncommon.
- [ ] `menander-rare-male.png` — New Comedy Collaborator; adult male; rare.
- [ ] `menander-rare-female.png` — New Comedy Collaborator; adult female; rare.
- [ ] `menander-epic-male.png` — Dramatist of New Comedy; adult male; epic.
- [ ] `menander-epic-female.png` — Dramatist of New Comedy; adult female; epic.

### Demetrius the Besieger

- [ ] `demetrius-parent.png` — Demetrius the Besieger, King of Siegecraft; main portrait.
- [ ] `demetrius-common-male.png` — Siege Labourer; adult male; common.
- [ ] `demetrius-common-female.png` — Siege Labourer; adult female; common.
- [ ] `demetrius-uncommon-male.png` — Siege Workshop Assistant; adult male; uncommon.
- [ ] `demetrius-uncommon-female.png` — Siege Workshop Assistant; adult female; uncommon.
- [ ] `demetrius-rare-male.png` — Siege Engineer; adult male; rare.
- [ ] `demetrius-rare-female.png` — Siege Engineer; adult female; rare.
- [ ] `demetrius-epic-male.png` — Director of Siege Works; adult male; epic.
- [ ] `demetrius-epic-female.png` — Director of Siege Works; adult female; epic.

### Theophrastus

- [ ] `theophrastus-parent.png` — Theophrastus, Scholar of the Living World; main portrait.
- [ ] `theophrastus-common-male.png` — Garden Attendant; adult male; common.
- [ ] `theophrastus-common-female.png` — Garden Attendant; adult female; common.
- [ ] `theophrastus-uncommon-male.png` — Plant Records Assistant; adult male; uncommon.
- [ ] `theophrastus-uncommon-female.png` — Plant Records Assistant; adult female; uncommon.
- [ ] `theophrastus-rare-male.png` — Comparative Plant Investigator; adult male; rare.
- [ ] `theophrastus-rare-female.png` — Comparative Plant Investigator; adult female; rare.
- [ ] `theophrastus-epic-male.png` — Peripatetic Botanical Scholar; adult male; epic.
- [ ] `theophrastus-epic-female.png` — Peripatetic Botanical Scholar; adult female; epic.

### Zeno of Citium

- [ ] `zeno-parent.png` — Zeno of Citium, Founder of the Stoa; main portrait.
- [ ] `zeno-common-male.png` — Listener at the Stoa; adult male; common.
- [ ] `zeno-common-female.png` — Listener at the Stoa; adult female; common.
- [ ] `zeno-uncommon-male.png` — Student of the Stoa; adult male; uncommon.
- [ ] `zeno-uncommon-female.png` — Student of the Stoa; adult female; uncommon.
- [ ] `zeno-rare-male.png` — Stoic Discussion Leader; adult male; rare.
- [ ] `zeno-rare-female.png` — Stoic Discussion Leader; adult female; rare.
- [ ] `zeno-epic-male.png` — Scholar of Stoic Ethics; adult male; epic.
- [ ] `zeno-epic-female.png` — Scholar of Stoic Ethics; adult female; epic.

### Ptolemy I Soter

- [ ] `ptolemy-parent.png` — Ptolemy I Soter, Founder of a Dynasty; main portrait.
- [ ] `ptolemy-common-male.png` — Palace Messenger; adult male; common.
- [ ] `ptolemy-common-female.png` — Palace Messenger; adult female; common.
- [ ] `ptolemy-uncommon-male.png` — Egyptian Administration Clerk; adult male; uncommon.
- [ ] `ptolemy-uncommon-female.png` — Egyptian Administration Clerk; adult female; uncommon.
- [ ] `ptolemy-rare-male.png` — Ptolemaic Supply Commissioner; adult male; rare.
- [ ] `ptolemy-rare-female.png` — Ptolemaic Supply Commissioner; adult female; rare.
- [ ] `ptolemy-epic-male.png` — Steward of Egyptian Government; adult male; epic.
- [ ] `ptolemy-epic-female.png` — Steward of Egyptian Government; adult female; epic.

### Cleomenes of Naucratis

- [ ] `cleomenes-parent.png` — Cleomenes of Naucratis, Financier of Alexander's Egypt; main portrait.
- [ ] `cleomenes-common-male.png` — Granary Porter; adult male; common.
- [ ] `cleomenes-common-female.png` — Granary Porter; adult female; common.
- [ ] `cleomenes-uncommon-male.png` — Revenue Records Assistant; adult male; uncommon.
- [ ] `cleomenes-uncommon-female.png` — Revenue Records Assistant; adult female; uncommon.
- [ ] `cleomenes-rare-male.png` — Grain Supply Auditor; adult male; rare.
- [ ] `cleomenes-rare-female.png` — Grain Supply Auditor; adult female; rare.
- [ ] `cleomenes-epic-male.png` — Steward of Egyptian Grain Accounts; adult male; epic.
- [ ] `cleomenes-epic-female.png` — Steward of Egyptian Grain Accounts; adult female; epic.

### Nearchus

- [ ] `nearchus-parent.png` — Nearchus, Admiral of Alexander's Fleet; main portrait.
- [ ] `nearchus-common-male.png` — Fleet Deckhand; adult male; common.
- [ ] `nearchus-common-female.png` — Fleet Deckhand; adult female; common.
- [ ] `nearchus-uncommon-male.png` — Coastal Scout; adult male; uncommon.
- [ ] `nearchus-uncommon-female.png` — Coastal Scout; adult female; uncommon.
- [ ] `nearchus-rare-male.png` — Pilot of the Indus Fleet; adult male; rare.
- [ ] `nearchus-rare-female.png` — Pilot of the Indus Fleet; adult female; rare.
- [ ] `nearchus-epic-male.png` — Navigator of Nearchus; adult male; epic.
- [ ] `nearchus-epic-female.png` — Navigator of Nearchus; adult female; epic.

### Eumenes of Cardia

- [ ] `eumenes-parent.png` — Eumenes of Cardia, Secretary and Strategist; main portrait.
- [ ] `eumenes-common-male.png` — Archive Attendant; adult male; common.
- [ ] `eumenes-common-female.png` — Archive Attendant; adult female; common.
- [ ] `eumenes-uncommon-male.png` — Royal Dispatch Copyist; adult male; uncommon.
- [ ] `eumenes-uncommon-female.png` — Royal Dispatch Copyist; adult female; uncommon.
- [ ] `eumenes-rare-male.png` — Campaign Correspondent; adult male; rare.
- [ ] `eumenes-rare-female.png` — Campaign Correspondent; adult female; rare.
- [ ] `eumenes-epic-male.png` — Secretary of Eumenes; adult male; epic.
- [ ] `eumenes-epic-female.png` — Secretary of Eumenes; adult female; epic.

The runtime set now includes 19 alternate parent frames: the 16 retained onchain variants plus full-art Legendary promotions for Demetrius, Zeno and Ptolemy. Each promotion reuses its approved main portrait; no additional illustration is required.
