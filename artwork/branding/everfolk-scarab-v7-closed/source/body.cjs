'use strict';

// Original compact scarab core. Coordinates use the shared 256-unit square.
// The three leg pairs attach near y118, y146 and y170. A continuous dark
// underbody connects the head, pronotum and elytra beneath the coloured plates.
const pair = shape => [
  shape,
  { ...shape, name: shape.name.replace('Left', 'Right'), matrix: [-1, 0, 0, 1, 256, 0] },
];

module.exports = [
  ...pair({
    name: 'Left compact forward digging leg / root y118',
    role: 'limb',
    d: 'M105 124 C97 122 90 115 85 107 L78 91 Q76 86 79 81 L85 74 Q88 70 92 73 Q96 77 93 80 L88 86 Q86 89 88 93 L94 103 Q98 109 111 115 Q116 118 113 122 Q111 126 105 124 Z',
  }),
  ...pair({
    name: 'Left outward jointed middle leg / root y146',
    role: 'limb',
    d: 'M98 141 C103 143 104 148 100 152 L83 164 Q79 167 74 165 L58 159 Q52 157 54 152 Q56 147 61 149 L75 154 Q77 155 79 153 L90 143 Q94 140 98 141 Z',
  }),
  ...pair({
    name: 'Left backward jointed hind leg / root y170',
    role: 'limb',
    d: 'M102 165 C106 167 107 171 103 175 L89 187 Q86 189 85 193 L79 208 Q77 213 73 210 Q68 208 70 203 L77 184 Q79 180 83 177 L95 167 Q99 164 102 165 Z',
  }),
  {
    name: 'Continuous head thorax and oval underbody',
    role: 'core',
    d: 'M111 89 Q128 84 145 89 C148 96 146 101 152 105 C162 113 164 123 161 134 C171 145 175 160 173 177 C171 200 152 219 132 222 Q128 224 124 222 C104 219 85 200 83 177 C81 160 85 145 95 134 C92 123 94 113 104 105 C110 101 108 96 111 89 Z',
  },
  {
    name: 'Three-point crown integrated into broad beetle head',
    role: 'crown',
    d: 'M106 76 L117 83 L128 65 L139 83 L150 76 L147 97 C143 103 137 105 128 105 C119 105 113 103 109 97 Z',
  },
  {
    name: 'Broad rounded pronotum / overlaps continuous core',
    role: 'thorax',
    d: 'M107 107 Q128 100 149 107 C155 112 158 119 158 126 Q128 138 98 126 C98 119 101 112 107 107 Z',
  },
  {
    name: 'Left full convex elytron / central dark seam',
    role: 'shell',
    d: 'M123 136 C111 131 101 137 95 149 C88 162 87 175 90 187 C94 201 107 213 120 218 Q124 220 124 215 L124 143 Q124 138 123 136 Z',
  },
  {
    name: 'Right full convex elytron / central dark seam',
    role: 'shellShade',
    matrix: [-1, 0, 0, 1, 256, 0],
    d: 'M123 136 C111 131 101 137 95 149 C88 162 87 175 90 187 C94 201 107 213 120 218 Q124 220 124 215 L124 143 Q124 138 123 136 Z',
  },
];
