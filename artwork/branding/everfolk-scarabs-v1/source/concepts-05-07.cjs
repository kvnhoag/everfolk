/* Original filled geometry; all coordinates use the shared 256-unit square. */
const mirror = shapes => shapes.concat(shapes.map(shape => ({
  ...shape,
  name: shape.name.replace('Left', 'Right'),
  matrix: [-1, 0, 0, 1, 256, 0],
})));

module.exports = [
  {
    number: 5,
    slug: 'dawnwing',
    name: 'Dawnwing',
    meaning: 'A life opening outward into a wider world.',
    notes: 'Wide ceremonial silhouette with three broad wing lobes on each side. The restrained divisions are genuine transparent spaces. A compact paired abdomen and six bent legs preserve the beetle reading.',
    shapes: [
      ...mirror([
        {
          name: 'Left great wing',
          d: 'M107 111 C77 89 48 75 14 66 C18 89 27 105 41 116 C59 125 79 130 107 132 Z',
        },
        {
          name: 'Left middle wing',
          d: 'M108 142 C74 139 52 130 35 119 C43 141 61 160 100 173 L110 158 Z',
        },
        {
          name: 'Left lower wing',
          d: 'M109 179 C81 175 68 168 57 158 C67 180 83 193 110 200 Z',
        },
        {
          name: 'Left foreleg',
          d: 'M110 111 L95 99 L87 70 L96 53 L105 59 L98 73 L104 92 L117 101 Z',
        },
        {
          name: 'Left middle leg',
          d: 'M111 156 L101 166 L101 179 L113 170 Z',
        },
        {
          name: 'Left hind leg',
          d: 'M106 188 L89 207 L78 228 L87 233 L98 214 L116 199 Z',
        },
        {
          name: 'Left closed wingcase',
          d: 'M123 141 C111 138 101 145 99 160 C96 179 106 203 123 216 Z',
        },
      ]),
      {
        name: 'Scalloped head',
        d: 'M112 88 L116 77 L123 80 L128 75 L133 80 L140 77 L144 88 L140 98 L116 98 Z',
      },
      {
        name: 'Broad thorax',
        d: 'M107 107 Q128 101 149 107 L155 127 Q128 136 101 127 Z',
      },
    ],
  },
  {
    number: 6,
    slug: 'upward',
    name: 'Upward',
    meaning: 'Potential, effort and the possibility of becoming.',
    notes: 'Tall, curved wings rise independently like two unfurling blades. The rounded twin peaks and U-shaped opening are deliberately distinct from a pointed hood or triangular crest. Lower legs keep the mark rooted and recognisably insect-like.',
    shapes: [
      ...mirror([
        {
          name: 'Left raised wing',
          d: 'M102 149 C81 132 64 109 55 81 C48 59 48 37 56 18 C72 37 87 51 95 76 C104 100 106 125 102 149 Z',
        },
        {
          name: 'Left foreleg',
          d: 'M108 117 L88 99 L82 75 L69 65 L63 74 L73 83 L78 106 L100 128 Z',
        },
        {
          name: 'Left middle leg',
          d: 'M104 155 L82 146 L62 163 L69 172 L84 159 L102 169 Z',
        },
        {
          name: 'Left hind leg',
          d: 'M105 186 L91 207 L74 226 L81 234 L100 215 L115 198 Z',
        },
        {
          name: 'Left elongated wingcase',
          d: 'M123 141 C111 138 103 144 102 158 C101 181 109 203 123 216 Z',
        },
      ]),
      {
        name: 'Crowned head',
        d: 'M113 87 L118 77 L124 80 L128 75 L132 80 L138 77 L143 87 L139 97 L117 97 Z',
      },
      {
        name: 'Sculpted thorax',
        d: 'M108 106 Q128 101 148 106 L155 125 Q128 134 101 125 Z',
      },
    ],
  },
  {
    number: 7,
    slug: 'unfolding',
    name: 'Unfolding',
    meaning: 'A living possibility revealed and protected as a story unfolds.',
    notes: 'Two open shell wings frame a central seed-shaped abdomen. Its interior opening is a true reversed-winding cutout. The six legs and toothed head anchor the abstract germ motif in the scarab form.',
    shapes: [
      ...mirror([
        {
          name: 'Left open shell',
          d: 'M116 109 C94 113 78 133 76 156 C74 181 86 207 108 220 L116 202 C101 189 95 175 97 159 C99 142 108 128 122 117 Z',
        },
        {
          name: 'Left foreleg',
          d: 'M108 96 L88 79 L84 54 L74 44 L67 52 L74 62 L78 86 L100 107 Z',
        },
        {
          name: 'Left middle leg',
          d: 'M80 131 L57 122 L37 134 L42 145 L58 135 L77 144 Z',
        },
        {
          name: 'Left hind leg',
          d: 'M79 177 L57 189 L52 216 L62 219 L67 197 L88 188 Z',
        },
      ]),
      {
        name: 'Scalloped head',
        d: 'M112 59 L116 47 L123 50 L128 44 L133 50 L140 47 L144 59 L140 70 L116 70 Z',
      },
      {
        name: 'Open shoulder thorax',
        d: 'M107 81 Q128 75 149 81 L157 99 Q128 108 99 99 Z',
      },
      {
        name: 'Seed abdomen with transparent heart',
        d: 'M128 125 C113 142 108 158 112 175 C115 191 122 204 128 211 C134 204 141 191 144 175 C148 158 143 142 128 125 Z M128 151 C136 163 139 176 128 190 C117 176 120 163 128 151 Z',
      },
    ],
  },
];
