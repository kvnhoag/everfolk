# Junior Court Official — ptolemy-common-female

**Figure family:** Ptolemy I Soter · **Type:** contribution · **Gender:** female · **Frame:** common

Look first at [approved art](../reference/portraits/ptolemy-common-female.webp) and the [framed preview](../reference/cards/ptolemy-common-female.webp). The exact card copy below supplies the profession, duty and tone. It is reference context only: do not draw any text into the illustration.

> Junior Court Official — First Duties in Ptolemy's Service
>
> A Place in the Administration. A junior court official checks names on petitions, copies routine entries, and prepares papers for review by experienced clerks. Careful work under supervision begins the administrative judgment that later supports accounts, supply, and government.

## Generation / drawing brief

Create an art-only historical card illustration for **Junior Court Official**, belonging to the Ptolemy I Soter family. Show one readable professional action that demonstrates the responsibility in the biography. Select the actual task and tool from that responsibility; keep the scene concise enough to read at card size. A clearly adult woman. A clearly adult junior official sits at a modest wooden desk in an early Ptolemaic administrative office, checking a short petition against a wax tablet with a stylus. The official's gaze follows the working task, shoulders and hands connect naturally, and the clothing is practical linen with a restrained ochre mantle. Small local duties under supervision; no courier movement, dispatch scroll held against the body, royal regalia, treasury or authority over a large office.

Keep the ancient Mediterranean setting consistent with this figure. Fit clothing, armour, status and equipment to this character and profession. Military contributors use lower-status kit than the main commander; nonmilitary contributors use work-appropriate clothes and tools. Use the supplied character reference for Alexander's armour rather than searching for another character's set. Match identity, lighting and palette to this family's approved art while translating its finish into deliberate pixel clusters.

Check shoulders, elbows, wrists and fingers before finishing. A sword grip wraps four fingers around the handle below the guard, with a believable thumb position and wrist alignment. Blade, edge, guard and pommel must share one coherent three-dimensional rotation. Preserve a plausible full-length blade and leave its tip visible. Keep the other hand naturally on reins or its own task. Ptolemy's arms must remain connected correctly to the torso with a readable hand count. Geometry tools should read as drafting tools, not a magnetic compass.

Deliver an opaque **840 × 1050 PNG** without frame, emblem, name, rank, number or watermark. For a regular grid in a standard frame, also finish **592 × 740**, or draw a **296 × 370 / 148 × 185** standard image in native-pixel mode. Native large art can be **420 × 525** or **280 × 350**, enlarged only by the tool. Review the actual standard overlay early: keep the face, grip and role-defining tool clear of the header and biography. Legendary paintings extend behind text, so concentrate important detail in the central open area.

Choose either direct native pixel drawing, or an opaque source painting followed by the actual PixelOE helpers and manual cleanup. Do not call a nearest-neighbour mosaic PixelOE. Retain the editable source, exact prompt, reference credits and conversion QA.

## Historical context sources

- Begin with the approved profession and visual reference. Label uncertain costume detail as a design choice.

## Frame command

From the kit root, after preparing the ready PNGs:

```powershell
node tools/card-art.mjs render --id ptolemy-common-female --art incoming/ptolemy-common-female.png --standard-art incoming/ptolemy-common-female-standard.png --out output/ptolemy-common-female-v1
node tools/card-art.mjs check --bundle output/ptolemy-common-female-v1
```

Use `--mode native-pixel` for logical-size sources. Omit `--standard-art` only when accepting the documented fractional standard fit. Main-portrait renderings automatically include associated runtime rarity variants.
