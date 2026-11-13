'use strict';

// Original monochrome scarab constructions. All coordinates are in a 256-square.
// Reflections are kept explicit so the native master retains editable parts.
const reflected = shapes => shapes.concat(shapes.map(shape => ({
  ...shape,
  name: shape.name.replace('left', 'right'),
  matrix: [-1, 0, 0, 1, 256, 0],
})));

module.exports = [
  {
    number: 1,
    slug: 'becoming',
    name: 'Becoming',
    meaning: 'A life coming into being; a small creature lifting a new beginning.',
    notes: 'A compact solar scarab with an independent disc, lifted forelegs, broad wingcases and a clear central seam. The disc belongs to the emblem rather than the lettering.',
    shapes: [
      { name: 'Solar disc', d: 'M128 12 C140 12 150 22 150 34 C150 47 140 57 128 57 C115 57 105 47 105 34 C105 22 115 12 128 12 Z' },
      ...reflected([
        { name: 'Lifted left foreleg', d: 'M89 119 L62 102 C46 79 58 52 91 40 L99 52 C73 65 68 83 79 96 L101 109 Z' },
        { name: 'Left middle leg', d: 'M79 145 L48 139 L25 153 L18 143 L45 125 L87 132 Z' },
        { name: 'Left hind leg', d: 'M78 177 L49 188 L43 211 L28 215 L34 178 L77 162 Z' },
      ]),
      { name: 'Head and broad clypeus', d: 'M111 69 Q128 61 145 69 L151 87 Q144 98 128 100 Q112 98 105 87 Z' },
      { name: 'Thorax', d: 'M95 111 Q128 101 161 111 L173 128 Q128 143 83 128 Z' },
      ...reflected([
        { name: 'Left wingcase', d: 'M122 141 C102 133 84 143 77 163 C69 202 90 228 122 238 Z' },
      ]),
    ],
  },
  {
    number: 2,
    slug: 'quiet-amulet',
    name: 'Quiet Amulet',
    meaning: 'The value of a single ordinary life, held in a simple enduring form.',
    notes: 'The pure beetle: softly rounded shell, short bent legs and no external ornament. A dense silhouette with generous transparent gaps survives small sizes.',
    shapes: [
      ...reflected([
        { name: 'Left foreleg', d: 'M96 98 L75 83 L62 50 Q57 43 49 48 L42 56 L59 94 L85 113 Z' },
        { name: 'Left middle leg', d: 'M77 139 L47 127 Q39 125 35 131 L30 141 L69 158 Z' },
        { name: 'Left hind leg', d: 'M74 179 L47 185 L37 207 Q35 214 43 219 L52 221 L62 201 L87 194 Z' },
      ]),
      { name: 'Rounded head', d: 'M107 52 Q114 39 128 40 Q142 39 149 52 L153 68 Q143 81 128 82 Q113 81 103 68 Z' },
      { name: 'Rounded thorax', d: 'M95 94 Q128 84 161 94 Q171 101 173 114 Q128 127 83 114 Q85 101 95 94 Z' },
      ...reflected([
        { name: 'Left oval wingcase', d: 'M122 134 C96 121 74 140 70 169 C68 203 86 225 122 234 Z' },
      ]),
    ],
  },
  {
    number: 3,
    slug: 'crossroads',
    name: 'Crossroads',
    meaning: 'A life takes one course while other possibilities branch away.',
    notes: 'A branching transparent channel is built into the shell itself. A small central plate and two heavy wingcases form the Y without added decoration or a background-coloured cutout.',
    shapes: [
      ...reflected([
        { name: 'Left foreleg', d: 'M91 115 L62 99 L51 66 L38 72 L47 111 L80 131 Z' },
        { name: 'Left middle leg', d: 'M70 151 L38 145 L18 160 L27 172 L45 160 L68 169 Z' },
        { name: 'Left hind leg', d: 'M72 190 L48 203 L41 231 L56 236 L62 213 L87 207 Z' },
      ]),
      { name: 'Head', d: 'M107 52 Q128 43 149 52 L153 73 Q144 84 128 85 Q112 84 103 73 Z' },
      { name: 'Thorax', d: 'M95 96 Q128 86 161 96 L171 111 L156 120 L128 107 L100 120 L85 111 Z' },
      { name: 'Central shell plate', d: 'M109 121 Q128 114 147 121 L128 141 Z' },
      ...reflected([
        { name: 'Left branching wingcase', d: 'M91 129 C76 137 66 153 65 173 C65 205 85 228 119 239 L119 161 Z' },
      ]),
    ],
  },
  {
    number: 4,
    slug: 'earth-seal',
    name: 'Earth Seal',
    meaning: 'An individual life leaves its own imperfect imprint on the world.',
    notes: 'A broad, deliberately uneven scarab with shovel-like front legs and a hand-carved shell. Its asymmetry is structural and remains editable filled geometry, not a distressed raster effect.',
    shapes: [
      { name: 'Left shovel foreleg', d: 'M92 110 L62 95 L43 73 L27 65 L35 48 L57 57 L64 77 L107 95 Z' },
      { name: 'Right shovel foreleg', d: 'M164 111 L194 94 L212 73 L230 64 L222 46 L200 55 L192 77 L149 96 Z' },
      { name: 'Left middle leg', d: 'M73 148 L46 138 L23 145 L20 160 L45 156 L70 170 Z' },
      { name: 'Right middle leg', d: 'M183 148 L211 136 L234 145 L236 161 L211 158 L185 170 Z' },
      { name: 'Left hind leg', d: 'M72 188 L49 199 L40 225 L55 233 L63 211 L91 203 Z' },
      { name: 'Right hind leg', d: 'M184 188 L208 201 L217 226 L202 234 L193 212 L165 203 Z' },
      { name: 'Uneven clypeus and head', d: 'M103 46 L115 39 L129 42 L142 39 L154 52 L150 73 Q127 85 104 73 L99 58 Z' },
      { name: 'Broad carved thorax', d: 'M85 94 Q103 84 128 87 Q151 84 172 97 L179 116 Q152 125 129 122 Q102 127 78 117 Z' },
      { name: 'Left carved wingcase', d: 'M78 133 Q101 124 121 137 L119 232 C83 225 62 202 63 174 Q65 149 78 133 Z' },
      { name: 'Right carved wingcase', d: 'M134 136 Q156 123 180 134 C206 177 183 222 134 233 Z' },
    ],
  },
];
