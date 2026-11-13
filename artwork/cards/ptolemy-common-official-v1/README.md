# Ptolemy Common — Junior Court Official

This focused revision replaces the former messenger-like Common depiction with a junior administrative official, in both male and female variants. Routine petitions, names and copied entries establish a supervised role below the established Administration Clerk, then Supply Commissioner and Steward of Egypt. Both new paintings show a seated official working at a modest desk with a tablet and papers.

Canonical copy lives in the collection's `source/card-copy.json` and `source/framing-map.json`. The versioned pipeline backs up the originals, rebuilds only these two native cards through VectorCraft, composites exact pixel artwork beneath native frames and live type, and updates the delivery records and artist kit. It retains the latest contributor subtitle spacing. It preserves all other card/template records, all parent variants and both active custom illustration overrides.

The three display-alias source/test files normalize legacy Palace Messenger and Court Records Apprentice names. A Common-only stage rule maps the older Egyptian Administration Clerk stage to Junior Court Official; the retained Uncommon stage keeps its established label. Saved worlds and records remain unchanged.

Root-authored painting sources, prompts, PixelOE configuration and QA, and authentic museum reference material are retained in `source/`, `assets/`, `references/` and `qa/`. Native source and pixel-compositing reports are also retained in the collection's QA folder. The previous subtitle-spacing bundle's real kit and protected frames are archived under `backup/bundle-kit-ddf06ea43ab7/`, so that immutable bundle remains independently verifiable.

`source/apply-portable-migration.cjs --repo TARGET` performs a guarded dry run; add `--apply` to install the reviewed payload. The helper validates original/new hashes, patches only selected metadata rows, preserves target parent variants and active overrides, skips unsupported bodyless assets, and backs up changed target files. Source and payload must retain their repository-relative layout.

Windows validation passed: all 117 source/export checks, the editorial audit, all 16 delivery/kit/replacement tests and 21 display-label/progress/UI tests. The bodyless builder regenerated these two cards and reused 134; exact pixels outside its body-removal region were preserved. The prior two-card subtitle-spacing bundle also passed independent recomposition against its archived kit. Every native document and task-owned worker closed after its work.
