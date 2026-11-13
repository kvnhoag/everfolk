# Illustration briefs and prompt templates

Use these as editable briefs in any generator, or give them directly to a pixel artist. The exact card ID selects the existing copy and frame. Generated text, symbols and borders do not belong in the illustration.

## Shared brief

Fill in this record before making a replacement:

```text
Card ID:
Main figure or contributor profession:
Gender, if a contributor:
Frame rarity and standard/full-art layout:
Approved face/scene reference:
Correct character equipment reference:
Historical object reference and credit, if used:
Supported forms / interpreted details / deliberate exaggeration:
Face angle and gaze, chosen to vary the roster:
Primary action and visible hand/tool relationship:
Pixel finish: native 280x350 x3 / native 420x525 x2 / actual PixelOE / mixed PixelOE
Version and output folder:
```

Keep the actual reference image and source credit. Use a supplied modern game character for that character's requested design continuity; do not call it a historical object record. Never ask a generator to invent a “reference photo.” Where evidence is uncertain, preserve that uncertainty in the handoff notes.

Append one of these finish instructions to a scene template:

**For a pixel artist or a native-pixel workflow:**

> Render the illustration at [280 × 350 / 420 × 525] with intentional pixel clusters, clear silhouette, controlled highlights, visible pupils and readable hands. Use the selected grid throughout unless a mixed-grid finish is explicitly agreed. Enlarge only by [3 / 2] with nearest neighbor to an opaque 840 × 1050 PNG. Keep the editable native-resolution file. Supply the illustration alone, without a card frame, words, symbols, rarity labels, serial numbers or watermark.

**For an AI-assisted painterly source:**

> Make a clean 4:5 painterly illustration with coherent anatomy, clear pupils, readable hands and reference-based materials. Preserve the approved historical-game art direction and strong light/shadow hierarchy. Keep detail economical enough to survive a later pixel conversion. This is a source painting, not a finished pixel export. Supply only the illustration, without a card frame, words, symbols, rarity labels, serial numbers or watermark.

A source painting needs a real conversion or manual pixel pass before it is labelled pixel art. Nearest enlargement is correct for ready native pixel art; nearest reduction of a painting is not evidence of a PixelOE finish.

For the final standard frame, prepare a matching **592 × 740** fitting asset as well. A pixel artist can work at **296 × 370 ×2** or **148 × 185 ×4** for that version. Preserve the same character, action and composition. The main 840 × 1050 art and standard 592 × 740 art cannot both keep the same ordinary regular logical grid through a simple resize. Passing the dedicated image as `--standard-art` keeps its intended clusters intact; omitting it accepts a reported nearest-neighbor resample.

## 1. Euclid main portrait — `euclid-parent`

> Euclid, interpreted consistently with the approved main portrait, a calm geometer of Alexandria explaining one geometric construction. Preserve his approved face rather than borrowing a modern celebrity likeness. Three-quarter view, gaze focused on the construction, one hand using simple dividers and the other indicating a clean circle on an ancient drawing surface. Show a natural thumb and finger relationship to each tool. Quiet architectural shade and restrained warm light give reason and authority to the scene. His personal appearance is an artistic interpretation. Legendary full-art composition: keep the face, dividers and working hand away from the top title and lower biography; leave the lower painting quiet. Do not generate written propositions or a symbol in the corner. Follow the shared finish instruction.

**Frame/copy check:** Legendary; “Geometer of Alexandria”; “The Architecture of Proof.” The frame supplies the drafting-compass emblem.

## 2. Alexander, female Common — `alexander-common-female`

> A capable adult female Camp Runner in Alexander's campaigning host, carrying a sealed dispatch between Macedonian tents. She is a fictional contributor, not a female portrait of Alexander. Give her a distinct face and a turned three-quarter angle unlike Alexander's main portrait, eyes tracking the path ahead. Plain linen, practical cloak, belt and satchel; no royal diadem or ornate command armour. The hand closes naturally around the dispatch while the free arm balances her movement. Dust, tents and distant troops establish the larger host without crowding her silhouette. Her dependable speed carries the order. Standard portrait composition: keep the complete head, dispatch hand and body action inside the 4:5 image. Follow the shared finish instruction.

**Frame/copy check:** Common; “Camp Runner”; “Messenger of the Host”; “The Order Arrives.”

## 3. Aristotle, male Epic — `aristotle-epic-male`

> An adult male Peripatetic Scholar of Aristotle's Lyceum, confidently guiding a small discussion in a shaded Athenian teaching court. He is an independent fictional scholar, not a clone of Aristotle. Distinct brow and nose, measured side-facing three-quarter view, eyes meeting a listener outside the foreground. A practical, well-kept tunic and cloak suggest responsibility without royal ornament. One open hand makes a clear, anatomically natural teaching gesture; the other steadies a papyrus roll at the waist. Give the scene intellectual authority through posture, attentive listeners and warm light. Keep the main hands separated from the drapery and readable at card size. Standard portrait composition. Follow the shared finish instruction.

**Frame/copy check:** Epic; “Peripatetic Scholar”; “A Voice of the Lyceum”; “Inquiry Carried Forward.”

## 4. Alexander main portrait, sword correction — `alexander-parent`

> Revise the approved mounted Alexander composition while preserving the recognizable face, dark horse, commanding gaze, red cloak and dramatic sky. Replace the generic kit with the components in the supplied reference for this character; do not import another named character's armour. Give the raised sword a longer, clear blade as a deliberate aura choice while keeping the full point inside the image. Rebuild the grip from a visible-hand pose reference: four fingers close around the handle, thumb opposes them, knuckles and palm follow the cylinder, guard separates hand from blade, wrist connects naturally to the forearm. Align the guard, blade plane, visible cutting edge and pommel with that wrist rotation and perspective. The other hand holds the reins with equal anatomical clarity. Legendary full-art layout: preserve space around the raised weapon and keep face and grip clear of the title. Follow the shared finish instruction.

**Review priority:** longer blade is creative exaggeration; actual armour forms come from this character's reference. Do not solve a wrong grip by hiding it.

## 5. Euclid, female Rare — `euclid-rare-female`

> An adult female Proof Checker working through a geometric argument in Euclid's teaching circle. A distinct face in a near-profile view, visible eye intent on a construction rather than facing the viewer. She compares a diagram on an ancient drawing surface with a papyrus roll, marking a point with an appropriate stylus. Show separated fingers and a stable wrist; make the working point readable without tiny generated lettering. Practical linen and restrained drapery, modest courtyard light, precise tools. Authority comes from disciplined attention and the clear construction. Standard portrait composition with a clean silhouette and both hands visible. Follow the shared finish instruction.

**Frame/copy check:** Rare; “Proof Checker”; “Keeper of Euclid's Reasoning”; “No Step Unexamined.”

## 6. Lysippos, male Uncommon — `lysippos-uncommon-male`

> An adult male Bronze Workshop Assistant in the workshop associated with Lysippos, carefully preparing mould material and tools for casting. Give him an original face in a downward three-quarter angle, visible pupils, and a practical tied-back hairstyle. Rolled or work-ready clothing, material dust and restrained firelight; the tools and mould, not lavish clothing, explain his role. Both hands handle the preparation with clear finger placement and believable weight. Use the approved period-workshop reference for casting forms; do not invent a modern welding torch, powered tool or industrial foundry. Standard portrait composition. Follow the shared finish instruction.

**Frame/copy check:** Uncommon; “Bronze Workshop Assistant”; “Hand of the Lysippan Workshop”; “Ready for the Casting.”

## 7. Pytheas, female Rare — `pytheas-rare-female`

> An adult female Navigation Observer aboard the northern expedition associated with Pytheas. She is a fictional crew specialist, with a distinctive face turned over one shoulder toward a distant coast, wind moving a practical cloak. One hand steadies a simple observation record while the other indicates a coastal feature; keep her fingers and the deck's spatial perspective coherent. Rope, wooden rail, changing daylight and the shoreline communicate navigation by observed signs. No magnetic compass, sextant, modern chart grid or imagined precise route to Thule. Let cool sea light contrast with a warm readable face. Standard portrait composition. Follow the shared finish instruction.

**Frame/copy check:** Rare; “Navigation Observer”; “Eyes of the Northern Voyage”; “A Course Through Signs.” The exact historical voyage route remains uncertain.

## 8. Theophrastus, female Common — `theophrastus-common-female`

> An adult female Garden Attendant tending living specimens in the scholarly garden associated with Theophrastus. Give her a distinct near-front face with an attentive, practical expression, a simple tunic and work-ready drapery. She gently waters a plant with one hand while the other steadies the vessel or pot; show natural grasp, weight and wrist alignment. Several recognizable plant shapes and a quiet Greek courtyard establish daily care without an elaborate collection of scholarly instruments. Warm morning light, clear foreground leaves, no modern greenhouse, plastic labels or laboratory glassware. Standard portrait composition. Follow the shared finish instruction.

**Frame/copy check:** Common; “Garden Attendant”; “Tending the Scholar's Garden”; “Care Before Discovery.”

## 9. Ptolemy main portrait, anatomy repair — `ptolemy-parent`

> Preserve the approved identity and overall direction of Ptolemy I Soter's main portrait, while rebuilding the arm anatomy from a coherent pose reference. Make each shoulder, upper arm, elbow, forearm, wrist and hand form one continuous plausible chain. Keep exactly two arms; no duplicated forearm, fused elbow, floating hand, stretched palm or extra limb concealed in cloth. If a hand carries a roll, let the thumb oppose naturally wrapped fingers and give the prop believable weight. Use the correct supplied Ptolemy equipment and clothing reference; do not copy Alexander's kit or invent later royal regalia as proof of an earlier game status. Give the face and near hand clear light and unobstructed silhouette. Standard Epic portrait composition. Follow the shared finish instruction.

**Frame/copy check:** Epic; “Ptolemy I Soter”; “Founder of a Dynasty”; “A Kingdom Secured.” The biography is retrospective and does not award a live royal milestone.

## 10. Eumenes, female Uncommon — `eumenes-uncommon-female`

> An adult female Royal Dispatch Copyist working in Eumenes' service, a fictional office professional with a face and angle distinct from other scholars. Slight downward three-quarter view with eyes visible; simple, well-kept clothing and a practical seated posture. She copies a dispatch with a reed pen beside a sealed papyrus roll on a modest desk. Make the fingers hold the pen precisely and the supporting hand rest naturally against the writing surface. Tied scroll bundles and an orderly royal office explain the responsibility without modern bound books or a feather quill. Emphasize focused care and dependable precision through quiet light and uncluttered composition. Standard portrait composition. Follow the shared finish instruction.

**Frame/copy check:** Uncommon; “Royal Dispatch Copyist”; “Scribe in Eumenes' Service”; “The King's Words Intact.”

## Reference and composition check

- Attach the real approved art and the correct equipment/object references. Credit them and explain what each controls: face, pose, kit, material or setting.
- Keep main identities consistent. Vary contributor faces, ages, hair and front/three-quarter/profile angles deliberately across the roster; both genders receive the same professional dignity.
- Match lower military professions to plainer kit and practical work. Reserve command cues for appropriate roles; a higher frame rarity alone does not justify fantasy armour.
- Verify shoulder–elbow–wrist continuity, both thumbs, finger count and physical grip before pixel conversion. Check the sword's edge, guard and blade plane together.
- Use the actual standard or Legendary overlay to check the face, hands, blade point and key prop. Never stretch anatomy to fill the frame.
- Keep the art free of card text, borders, icons and edition numbers. Avoid tiny simulated writing that becomes noise at pixel scale.
- Review the finished pixel image and framed card at intended size. If pupils or grip fail, revise the source or grid rather than smoothing the final image.
- Retain exact prompt, source images, native pixel file or actual conversion settings, reference credits, final PNG and preview. Mark uncertain historical details and deliberate exaggeration plainly.
