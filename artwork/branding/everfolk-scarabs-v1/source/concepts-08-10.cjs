'use strict';

// Original monochrome path geometry. Each paired set reflects about x = 128.
// Open space is genuine transparency; no painted cut-outs or live strokes.
const paired = (name, d) => [
  { name: `${name} / left`, d },
  { name: `${name} / right`, d, matrix: [-1, 0, 0, 1, 256, 0] },
];

module.exports = [
  {
    number: 8,
    slug: 'heart-of-a-life',
    name: 'Heart of a Life',
    meaning: 'A life has a human centre: attachment, belonging and the people who give it meaning.',
    notes: 'Two substantial wing-cases create a restrained heart-shaped shell. The head, broad thorax and three pairs of folded legs keep the mark unmistakably a scarab. Its centre seam remains open.',
    shapes: [
      ...paired('Raised foreleg', 'M101 79 L85 88 L68 72 L61 49 L49 43 L43 53 L51 81 L79 105 L101 94 Z'),
      ...paired('Middle leg', 'M69 132 L48 124 L27 135 L22 148 L33 153 L43 141 L66 146 Z'),
      ...paired('Grounded hindleg', 'M79 169 L56 184 L48 207 L35 214 L42 225 L59 217 L67 194 L91 183 Z'),
      { name: 'Broad clypeus and head', d: 'M107 57 Q108 43 119 40 L122 31 L134 31 L137 40 Q148 43 149 57 L145 65 L111 65 Z' },
      { name: 'Carved thorax', d: 'M102 74 Q128 64 154 74 L163 87 L151 96 Q128 89 105 96 L93 87 Z' },
      ...paired('Heart-shaped wing case', 'M120 108 C104 90 77 91 63 111 C45 139 71 177 124 215 L124 124 C124 116 123 112 120 108 Z'),
    ],
  },
  {
    number: 9,
    slug: 'another-beginning',
    name: 'Another Beginning',
    meaning: 'Every new life opens into circumstances and possibilities of its own.',
    notes: 'The negative space between the elytra becomes an open threshold. The opening reaches the outside rather than sitting inside an enclosing badge. Square-ended legs and a tall shell give this scarab an architectural stance.',
    shapes: [
      ...paired('Uplifted foreleg', 'M98 87 L75 93 L54 74 L49 52 L36 53 L40 81 L68 108 L92 101 Z'),
      ...paired('Braced middle leg', 'M71 140 L44 134 L25 148 L28 161 L47 148 L68 154 Z'),
      ...paired('Descending hindleg', 'M83 191 L61 200 L53 226 L38 229 L41 242 L64 238 L73 211 L91 204 Z'),
      { name: 'Blunt scarab head', d: 'M108 57 L112 44 L120 40 L123 31 L133 31 L136 40 L144 44 L148 57 L143 66 L113 66 Z' },
      { name: 'Threshold crown thorax', d: 'M106 76 Q128 68 150 76 L162 90 L148 97 L108 97 L94 90 Z' },
      ...paired('Threshold wing case', 'M124 105 C89 101 65 126 65 164 C65 193 80 215 105 227 L105 163 C105 145 114 134 124 132 Z'),
    ],
  },
  {
    number: 10,
    slug: 'toward-the-horizon',
    name: 'Toward the Horizon',
    meaning: 'A small life reaches forward into an open future.',
    notes: 'A low, generous pair of wing-cases rests beneath long, rising forelegs. The arms hold open space rather than a solar disc. Its broad base and open upper silhouette distinguish it from the compact amulet and spread-wing directions.',
    shapes: [
      ...paired('Sweeping raised foreleg', 'M101 128 L83 122 C61 108 48 93 48 71 C48 50 60 36 77 29 L83 41 C67 47 61 58 61 72 C61 88 73 99 93 110 L109 117 Z'),
      ...paired('Lateral middle leg', 'M73 153 L44 147 L20 157 L16 171 L29 177 L37 165 L66 169 Z'),
      ...paired('Outward hindleg', 'M81 184 L60 199 L44 216 L33 215 L25 227 L47 232 L70 214 L93 199 Z'),
      { name: 'Rounded scarab head', d: 'M110 97 Q110 82 128 82 Q146 82 146 97 L141 110 L115 110 Z' },
      { name: 'Broad horizon thorax', d: 'M91 125 C109 114 147 114 165 125 L158 139 C139 134 117 134 98 139 Z' },
      ...paired('Low horizon wing case', 'M123 143 C104 132 78 136 65 153 C57 169 64 192 82 199 C93 204 109 208 123 210 Z'),
    ],
  },
];
