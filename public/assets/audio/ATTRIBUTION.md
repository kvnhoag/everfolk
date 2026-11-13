# Audio Asset Sources and Redistribution Notices

Every bundled audio file in `public/assets/audio/` was verified byte-for-byte by SHA-256 against its upstream download on 2026-11-13. Individual license terms and full license text references live alongside these files in [`LICENSES.txt`](LICENSES.txt), and machine-checked checksums live in [`manifest.json`](manifest.json).

If an audio asset fails to load or play at runtime, [`AudioManager`](../../../client/lib/audio-manager.ts) falls back cleanly: button click feedback switches to Web Audio oscillator synthesis (`synthesizeClickFallback()`), and failing background tracks advance past unavailable files or pause without hanging playback state.

## Summary Table

| Bundled file | In-game title | Upstream source title | Creator | License | SHA-256 |
|---|---|---|---|---|---|
| `egyptian-meditation.ogg` | Egyptian Meditation | Egyptian meditation music (`v312.ogg`) | brandon75689 (submitted by HaelDB) | CC0 1.0 / OGA-BY 3.0 | `e180b3990ef5bf86382d19a47183fc66d71a9cfbe5614a7877169c0b7ccf89b5` |
| `temple-of-the-mystics.mp3` | Temple of the Mystics | Temple of the Mystics (`Temple of the Mystics.mp3`) | Jason Dagenet (jdagenet) | CC-BY-SA 3.0 | `9bace906a13155d72224da81c87fa7e8f8c2f58d75f71744195ca3832bac3012` |
| `hidden-oasis.mp3` | Hidden Oasis | Hidden Oasis (`Hidden Oasis_4.mp3`) | Trevor Lentz | CC-BY-SA 3.0 | `a5b41116e678666925ce7fab0a18b13c57deb80c06aca9393b1d5b21c3d2dae8` |
| `mediterranean-breeze.ogg` | Mediterranean Breeze | Mediterranean Breeze (Looping) (`Mediterranean-Breeze.ogg`) | Eric Matyas | Soundimage International Public License | `16876332a3a1fdf6c0ecca855b88a75e24b067854094bcd97a516f95ae0314e4` |
| `desert-caravan.ogg` | Desert Caravan | Desert theme (`caravan.ogg.ogg`) | yd | CC0 1.0 | `086f52dc18e1db9a51831708295ae6e758f2f5edf79a0241b390d72bfb858c01` |
| `medieval-minstrel-dance.mp3` | Medieval: Minstrel Dance | Medieval: Minstrel Dance (`Minstrel_Dance.mp3`) | RandomMind | CC0 1.0 | `b01ff311b30a6cba5c12220d2171d903c73ba463e2ba45400223175ea00b8296` |
| `button-click.mp3` | UI Click Sound | Menu Selection Click (`Menu Selection Click (preview).mp3`) | NenadSimic | CC-BY 3.0 | `569c6235097fd8d71c82f963f7eca51fc8473af667761487a4b474a177c2d425` |

## Per-Asset Provenance & Redistribution Notes

### 1. `egyptian-meditation.ogg`
- **Source page:** https://opengameart.org/content/egyptian-meditation-music
- **Exact upstream file:** https://opengameart.org/sites/default/files/v312.ogg
- **Creator:** brandon75689 (submitted by HaelDB)
- **License:** Dual-licensed CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/) and OGA-BY 3.0 (https://opengameart.org/content/oga-by-30-faq)
- **File details:** 1,849,596 bytes, 124.000s Ogg Vorbis (`Xiph.Org libVorbis I 20100325 (Everywhere)`).
- **Required notice:** No mandatory attribution under CC0 1.0; playlist credits attribute `brandon75689`.
- **Changes made:** Renamed locally from `v312.ogg` to `egyptian-meditation.ogg`; audio stream unmodified. (Corrected earlier playlist misattribution.)

### 2. `temple-of-the-mystics.mp3`
- **Source page:** https://opengameart.org/content/temple-of-the-mystics
- **Exact upstream file:** https://opengameart.org/sites/default/files/Temple%20of%20the%20Mystics.mp3
- **Creator:** Jason Dagenet (jdagenet)
- **License:** Creative Commons Attribution-ShareAlike 3.0 Unported (https://creativecommons.org/licenses/by-sa/3.0/)
- **File details:** 4,428,403 bytes, 184.346s MP3 (embedded `TSS=Logic 10.0.2` / iTunNORM metadata).
- **Required attribution notice:** `"Please credit me as jdagenet or Jason Dagenet."` Must retain this attribution, indicate if modified, link CC-BY-SA 3.0, and distribute adaptations under CC-BY-SA 3.0 or compatible ShareAlike terms.
- **Changes made:** Renamed locally from `Temple of the Mystics.mp3` to `temple-of-the-mystics.mp3`; audio stream unmodified. (Corrected earlier playlist misattribution.)

### 3. `hidden-oasis.mp3`
- **Source page:** https://opengameart.org/content/hidden-oasis
- **Exact upstream file:** https://opengameart.org/sites/default/files/Hidden%20Oasis_4.mp3
- **Creator:** Trevor Lentz
- **License:** Creative Commons Attribution-ShareAlike 3.0 Unported (https://creativecommons.org/licenses/by-sa/3.0/)
- **File details:** 4,239,286 bytes, 105.979s MP3 (embedded tags: `title=Hidden Oasis`, `artist=Trevor Lentz`, `genre=Orchestral`, `date=2015`, `TBPM=98`, `encoded_by=LAME in FL Studio 8`).
- **Required attribution notice:** `"Please credit me \"Trevor Lentz\" if you choose to use this."` Must retain attribution, license link, modification disclosure, and ShareAlike obligations on adaptations.
- **Changes made:** Renamed locally from `Hidden Oasis_4.mp3` to `hidden-oasis.mp3`; audio stream unmodified.

### 4. `mediterranean-breeze.ogg`
- **Source page:** https://soundimage.org/world/
- **Exact upstream file:** https://soundimage.org/wp-content/uploads/2026/06/Mediterranean-Breeze.ogg
- **Creator:** Eric Matyas
- **License:** Soundimage International Public License (https://soundimage.org/sample-page/, attribution instructions at https://soundimage.org/attribution-info/)
- **File details:** 3,521,273 bytes, 59.994s Ogg Vorbis (`Xiph.Org libVorbis I 20200704 (Reducing Environment)`, `ENCODER=libsndfile`).
- **Required attribution & terms:** `"Mediterranean Breeze" by Eric Matyas · www.soundimage.org` must be credited inside the actual game/credits screen when used with other artists' tracks. Equivalent to CC-BY 4.0 with one added restriction prohibiting use in obscene or pornographic media (full license text included in [`LICENSES.txt`](LICENSES.txt)).
- **Changes made:** Renamed locally from `Mediterranean-Breeze.ogg` to `mediterranean-breeze.ogg`; audio stream unmodified.

### 5. `desert-caravan.ogg`
- **Source page:** https://opengameart.org/content/desert-theme
- **Exact upstream file:** https://opengameart.org/sites/default/files/caravan.ogg.ogg
- **Creator:** yd
- **License:** CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
- **File details:** 1,990,821 bytes, 98.400s Ogg Vorbis (`Xiph.Org libVorbis I 20100325 (Everywhere)`, Vorbis tag `Cool=This song has been made using Linux MultiMedia Studio`).
- **Required notice:** No mandatory attribution under CC0 1.0; playlist credits attribute `yd` and note the upstream title `Desert theme`.
- **Changes made:** Renamed locally from `caravan.ogg.ogg` to `desert-caravan.ogg`; audio stream unmodified. (Corrected earlier playlist misattribution.)

### 6. `medieval-minstrel-dance.mp3`
- **Source page:** https://opengameart.org/content/medieval-minstrel-dance
- **Exact upstream file:** https://opengameart.org/sites/default/files/Minstrel_Dance.mp3
- **Creator:** RandomMind
- **License:** CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
- **File details:** 5,548,500 bytes, 138.606s MP3 (embedded tags: `title=Minstrel Dance`, `artist=RandomMind`, `album=Forgotten Ballads vol. I`, `track=6`, `date=2018`, `TBPM=72.6330032348633`, `encoded_by=LAME in FL Studio 12`).
- **Required notice:** No mandatory attribution under CC0 1.0; playlist credits attribute `RandomMind`.
- **Changes made:** Renamed locally from `Minstrel_Dance.mp3` to `medieval-minstrel-dance.mp3`; audio stream unmodified.

### 7. `button-click.mp3`
- **Source page:** https://opengameart.org/content/menu-selection-click
- **Exact upstream file:** https://opengameart.org/sites/default/files/Menu%20Selection%20Click%20%28preview%29.mp3
- **Creator:** NenadSimic
- **License:** Creative Commons Attribution 3.0 Unported (https://creativecommons.org/licenses/by/3.0/)
- **File details:** 11,562 bytes, 0.287s MP3 (embedded ID3v2 tags: `TYER=2012`, `TENC=LAME in FL Studio 9`, `TBPM=140`, LAME trailer `LAME3.98.2`).
- **Required attribution notice:** Credit `Menu Selection Click` by `NenadSimic` (`CC-BY 3.0`), retain license link, and note file rename if redistributed.
- **Changes made:** Renamed locally from `Menu Selection Click (preview).mp3` to `button-click.mp3`; audio stream unmodified. Web Audio click synthesis provides automatic fallback when playback or loading is unavailable.
