# V3 verification records

Read [library-audit.json](library-audit.json) for independent readback of the complete 240 exports and [anatomy-visual-review.json](anatomy-visual-review.json) for the actual visual inspection scope. User acceptance is recorded separately in the manifest; a machine or agent review is not user approval.

The authoritative current skin mask paths are in [model-annotations.json](../model-annotations.json). The manifest records the mask hashes used in the actual build. `model-preservation.json` records the body/neck/alpha protection checks for each assembly.

`mixed/`, `regions/` and `regional-masks/` preserve each final portrait's pixel-selection evidence. Every mixed output must equal the exact coarse pass outside its face region and the exact fine pass inside, using whole aligned 6px cells. The individual PixelOE pass QA records include repeat rendering, integer pixel blocks, PNG readback and source integrity.

Candidate directories retain development comparisons. The initial hard polygon masks and `segmented-skin-candidates/` trial were rejected for visible colour boundaries. Their existence is not approval or evidence that those masks were used in the final library. Continuous-contour candidates are accepted only when published to the paths in the annotations and covered by the final visual review.

All source PNGs are immutable. Source-generation audits distinguish complete canonical model paintings from full-frame raw face edits, whose incidental changes outside the face are discarded by the builder.
