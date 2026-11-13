'use strict';

const pair = shape => [shape, { ...shape, name: shape.name.replace('Left', 'Right'), matrix: [-1, 0, 0, 1, 256, 0] }];

module.exports = {
  name: 'Dawnwing / crowned scarab',
  meaning: 'A life opening outward into a wider world.',
  changes: [
    'The central body is a substantial oval with two convex wing cases and a clear centre seam.',
    'A distinct broad thorax separates the head from the abdomen.',
    'The three-point crown is integrated into a rounded beetle head.',
    'Three pairs of legs are visible: raised forelegs, outward middle legs and descending hindlegs.',
    'The sweeping outer wings sit behind the beetle, separated by curved transparent channels.',
    'The inner wing channels retain rounded terminals and the outer wing tips remain pointed.',
  ],
  shapes: [
    ...pair({
      name: 'Left swept ceremonial wing',
      d: 'M103 116 C76 92 45 77 14 66 C20 103 43 122 78 129 C84 130 88 132 88 135 C88 138 85 140 81 139 C62 136 46 128 35 119 C43 143 58 158 73 165 C76 167 77 169 77 172 C77 175 74 176 71 174 C66 170 61 164 57 158 C63 175 73 186 86 192 C84 176 86 158 92 143 C97 132 100 122 103 116 Z',
    }),
    ...pair({
      name: 'Left raised digging foreleg',
      d: 'M103 120 C90 114 81 102 78 88 L74 68 C73 62 75 56 80 51 L88 43 Q92 40 95 44 Q99 47 95 51 L88 59 Q85 62 86 67 L91 84 C93 96 99 103 110 110 Q115 114 112 118 Q109 123 103 120 Z',
    }),
    ...pair({
      name: 'Left outward jointed middle leg',
      d: 'M99 188 Q104 192 100 196 L80 212 Q77 214 73 213 L55 208 Q50 206 52 202 Q54 198 59 200 L74 204 Q75 204 77 202 L91 190 Q95 187 99 188 Z',
    }),
    ...pair({
      name: 'Left descending hindleg',
      d: 'M110 211 Q115 213 113 218 L102 236 L96 248 Q93 253 88 250 Q84 248 87 243 L93 231 L102 214 Q105 210 110 211 Z',
    }),
    {
      name: 'Crowned beetle head with rounded cheeks',
      d: 'M106 72 L117 80 L128 62 L139 80 L150 72 L147 94 C145 100 139 102 128 102 C117 102 111 100 109 94 Z',
    },
    {
      name: 'Broad scarab thorax',
      d: 'M103 111 Q128 103 153 111 C158 116 160 122 161 129 Q128 139 95 129 C96 122 98 116 103 111 Z',
    },
    ...pair({
      name: 'Left convex oval wing case',
      d: 'M123 143 C107 136 94 151 92 176 C90 203 105 225 120 234 Q124 236 124 230 L124 149 Q124 145 123 143 Z',
    }),
  ],
};
