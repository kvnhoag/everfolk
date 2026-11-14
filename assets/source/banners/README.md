# Banner provenance

`native-provenance.json` records machine-verified native master hashes, editable layer names, zero embedded-image counts and delivered SVG hashes for all24 scenes and864 actor poses. It is tied to the exact shipped banner manifest and the verified private source archive in `assets/storage/media-lock.json`.

This is provenance and structural evidence; it does not assert human approval. Normal delivery tests verify every public SVG against this record. When native sources are materialized locally or selected with `EVERFOLK_ARTWORK_DIR`, the same test also verifies their original hashes and editable structure. Full native masters remain in private storage outside Git.
