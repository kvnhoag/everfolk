# Reviewed card source metadata

The reviewed v14 catalog and portable-kit index are retained byte-for-byte to preserve provenance fingerprints, biography checks and card identities. Image paths in these records describe the optional private artwork archive; they do not cause the game to download the source library. Runtime images remain in `public/assets/` or its pinned CDN release.

Card authoring commands accept `EVERFOLK_ARTWORK_DIR` pointing to the restored artwork root. The small approved frame fixture in `test/fixtures/card-art-kit/` lets default rendering tests run without that archive.
