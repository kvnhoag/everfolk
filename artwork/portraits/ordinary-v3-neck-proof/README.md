# Face-only model preservation proof

Two bounded proofs replace the rejected v2 head/neck assembly method. The original complete male and female models already have the correct continuous jaw, neck, shoulders, collar and torso. Their anatomy is the immutable baseline. Only internal facial features are changed.

- [Original model versus face edit: male](review/male-model-preservation.png)
- [Original model versus face edit: female](review/female-model-preservation.png)
- [Agreed pixel-finished two-model proof](review/face-only-proof.png)
- [Exact preservation checks](qa/model-preservation.json)

Built-in ImageGen made two facial-feature edits using the original complete models as edit targets and earlier face designs as feature references. The resulting facial feature patches are composited only inside an internal face oval; the original model is restored everywhere outside it. The original silhouette alpha is retained throughout. The complete original jaw/neck/body pixels below native row 455 for male and 480 for female remain byte-identical. No jaw separation, neck cut, narrowing, cap replacement or independent body fitting is applied.

Both models retain their original hair, jaw contour, skin shade and complete body for this proof. Face identity and body palette expansion are not claimed by these two samples. The agreed PixelOE finish follows opaque assembly: coarse 3px body and finer 2px face, selected through whole aligned 6px cells.

Original models: `../ordinary-v2/source/body-references/ef-r-{male,female}-waist-v2.png`. Generated edits, exact ignored prompts and provenance live in `source/`. [scripts/build-proof.py](scripts/build-proof.py) creates the preserved model composites; [scripts/finish-proof.py](scripts/finish-proof.py) combines the verified PixelOE passes. Sources and rejected v1/v2 exports remain preserved.

**Status:** two-model proof only. The old 192-image v2 set was rejected by the user for neck anatomy and has not been replaced by a new full library. Do not use the old fit-review pass as anatomical approval. Do not bulk-rebuild from this proof without settling the whole-model/face-only design first.
