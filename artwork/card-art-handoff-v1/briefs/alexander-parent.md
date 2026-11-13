# Alexander the Great — alexander-parent

**Figure family:** Alexander the Great · **Type:** parent · **Gender:** male · **Frame:** legendary

Look first at [approved art](../reference/portraits/alexander-parent.webp) and the [framed preview](../reference/cards/alexander-parent.webp). The exact card copy below supplies the profession, duty and tone. It is reference context only: do not draw any text into the illustration.

> Alexander the Great — King of Macedon
>
> An Empire Unbound. King of Macedon from 336 to 323 BCE, Alexander overthrew the Persian Empire and led his army into India. His conquests reshaped the ancient world and opened the Hellenistic age.

## Generation / drawing brief

Create an art-only historical card illustration for **Alexander the Great**, belonging to the Alexander the Great family. Show one readable professional action that demonstrates the responsibility in the biography. Select the actual task and tool from that responsibility; keep the scene concise enough to read at card size. Preserve the approved figure's identity and recognizeable features; choose a clear face angle that preserves the individual character.

Keep the ancient Mediterranean setting consistent with this figure. Fit clothing, armour, status and equipment to this character and profession. Military contributors use lower-status kit than the main commander; nonmilitary contributors use work-appropriate clothes and tools. Use the supplied character reference for Alexander's armour rather than searching for another character's set. Match identity, lighting and palette to this family's approved art while translating its finish into deliberate pixel clusters.

Check shoulders, elbows, wrists and fingers before finishing. A sword grip wraps four fingers around the handle below the guard, with a believable thumb position and wrist alignment. Blade, edge, guard and pommel must share one coherent three-dimensional rotation. Preserve a plausible full-length blade and leave its tip visible. Keep the other hand naturally on reins or its own task. Ptolemy's arms must remain connected correctly to the torso with a readable hand count. Geometry tools should read as drafting tools, not a magnetic compass.

Deliver an opaque **840 × 1050 PNG** without frame, emblem, name, rank, number or watermark. For a regular grid in a standard frame, also finish **592 × 740**, or draw a **296 × 370 / 148 × 185** standard image in native-pixel mode. Native large art can be **420 × 525** or **280 × 350**, enlarged only by the tool. Review the actual legendary overlay early: keep the face, grip and role-defining tool clear of the header and biography. Legendary paintings extend behind text, so concentrate important detail in the central open area.

Choose either direct native pixel drawing, or an opaque source painting followed by the actual PixelOE helpers and manual cleanup. Do not call a nearest-neighbour mosaic PixelOE. Retain the editable source, exact prompt, reference credits and conversion QA.

## Historical context sources

- [The Rise of Macedon and the Conquests of Alexander the Great — Metropolitan Museum of Art](https://www.metmuseum.org/essays/the-rise-of-macedonia-and-the-conquests-of-alexander-the-great)

## Frame command

From the kit root, after preparing the ready PNGs:

```powershell
node tools/card-art.mjs render --id alexander-parent --art incoming/alexander-parent.png --standard-art incoming/alexander-parent-standard.png --out output/alexander-parent-v1
node tools/card-art.mjs check --bundle output/alexander-parent-v1
```

Use `--mode native-pixel` for logical-size sources. Omit `--standard-art` only when accepting the documented fractional standard fit. Main-portrait renderings automatically include associated runtime rarity variants.
