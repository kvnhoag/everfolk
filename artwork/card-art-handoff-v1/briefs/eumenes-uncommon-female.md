# Royal Dispatch Copyist — eumenes-uncommon-female

**Figure family:** Eumenes of Cardia · **Type:** contribution · **Gender:** female · **Frame:** uncommon

Look first at [approved art](../reference/portraits/eumenes-uncommon-female.webp) and the [framed preview](../reference/cards/eumenes-uncommon-female.webp). The exact card copy below supplies the profession, duty and tone. It is reference context only: do not draw any text into the illustration.

> Royal Dispatch Copyist — Scribe in Eumenes' Service
>
> The King's Words Intact. A dispatch copyist preserves the wording of orders before they travel far from court. Exact attention keeps authority from changing with each retelling, giving officials a shared instruction they can read and answer.

## Generation / drawing brief

Create an art-only historical card illustration for **Royal Dispatch Copyist**, belonging to the Eumenes of Cardia family. Show one readable professional action that demonstrates the responsibility in the biography. Select the actual task and tool from that responsibility; keep the scene concise enough to read at card size. A clearly adult woman; left three-quarter view from just above eye level. Give this contributor an individual face, hair, age, expression and silhouette. Do not reuse the main figure's face or copy a neighbouring contributor's pose.

Keep the ancient Mediterranean setting consistent with this figure. Fit clothing, armour, status and equipment to this character and profession. Military contributors use lower-status kit than the main commander; nonmilitary contributors use work-appropriate clothes and tools. Use the supplied character reference for Alexander's armour rather than searching for another character's set. Match identity, lighting and palette to this family's approved art while translating its finish into deliberate pixel clusters.

Check shoulders, elbows, wrists and fingers before finishing. A sword grip wraps four fingers around the handle below the guard, with a believable thumb position and wrist alignment. Blade, edge, guard and pommel must share one coherent three-dimensional rotation. Preserve a plausible full-length blade and leave its tip visible. Keep the other hand naturally on reins or its own task. Ptolemy's arms must remain connected correctly to the torso with a readable hand count. Geometry tools should read as drafting tools, not a magnetic compass.

Deliver an opaque **840 × 1050 PNG** without frame, emblem, name, rank, number or watermark. For a regular grid in a standard frame, also finish **592 × 740**, or draw a **296 × 370 / 148 × 185** standard image in native-pixel mode. Native large art can be **420 × 525** or **280 × 350**, enlarged only by the tool. Review the actual standard overlay early: keep the face, grip and role-defining tool clear of the header and biography. Legendary paintings extend behind text, so concentrate important detail in the central open area.

Choose either direct native pixel drawing, or an opaque source painting followed by the actual PixelOE helpers and manual cleanup. Do not call a nearest-neighbour mosaic PixelOE. Retain the editable source, exact prompt, reference credits and conversion QA.

## Historical context sources

- Begin with the approved profession and visual reference. Label uncertain costume detail as a design choice.

## Frame command

From the kit root, after preparing the ready PNGs:

```powershell
node tools/card-art.mjs render --id eumenes-uncommon-female --art incoming/eumenes-uncommon-female.png --standard-art incoming/eumenes-uncommon-female-standard.png --out output/eumenes-uncommon-female-v1
node tools/card-art.mjs check --bundle output/eumenes-uncommon-female-v1
```

Use `--mode native-pixel` for logical-size sources. Omit `--standard-art` only when accepting the documented fractional standard fit. Main-portrait renderings automatically include associated runtime rarity variants.
