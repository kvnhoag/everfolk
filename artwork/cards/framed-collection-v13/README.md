# Everfolk framed collection v13

83 framed cards: 13 historical figures and 35 contributor roles, each with male and female artwork. Uses the revised v12 library, including Ptolemy's corrected main portrait and the varied contributor face angles.

Open `review/index.html` for the complete offline gallery. Production PNGs are in `exports/`, at 900 × 1260 with transparent rounded corners. Each card has a native editable `masters/<slug>.vectorcraft` and a self-contained SVG in `source/cards/`. Typography uses Source Serif 4 and Inter.

The approved jade/bronze v5 rarity frames are preserved. Legendary cards use the full-art layout, with the original 840 × 1050 pixel portrait retained at native size and atmospheric edge extensions. Standard frames retain the full portrait at 592 × 740 using nearest-neighbour sampling. Fine bronze rules and jade inlays accommodate the wider 800 × 740 artwork opening, preserving the portrait's proportions and all original hands and tools. The inlay rules, frame paths, and labels are editable; the illustration is a bitmap, not individually editable clothing or anatomy.

Use the PNG exports for the crisp production finish. Each PNG composites the fitted bitmap with a transparent overlay exported from VectorCraft; uncovered fitted-art pixels are verified unchanged. Every native master is saved, closed, reopened and exported again, with identical native render pixels. The original v12 files are unchanged.

Five cards use Legendary, 34 Epic, 22 Rare and 22 Uncommon styling. Nearchus/Eumenes and their four contributor variants use Epic as an editorial default because their gameplay rarity is unspecified. Current intended limits are Legendary 10, Epic 25, Rare 100, and Uncommon unlimited. These are art previews without assigned copy serials.

`catalog.json` records the fit, source hashes, export hashes, rarity provenance and QA for every card. `qa/collection-verification.json` contains the independent collection check. `source/build-cards.cjs` rebuilds cards through the local VectorCraft MCP CLI, and `source/build-review.cjs` rebuilds the gallery. The builders expect the original project and installed fonts/VectorCraft. The supplied SVGs and native masters are self-contained.
