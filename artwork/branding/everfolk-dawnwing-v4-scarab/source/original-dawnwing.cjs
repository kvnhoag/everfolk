'use strict';

const pair = shape => [shape, { ...shape, name: shape.name.replace('Left', 'Right'), matrix: [-1, 0, 0, 1, 256, 0] }];

module.exports = {
  name: 'Dawnwing / crown',
  meaning: 'A life opening outward into a wider world.',
  changes: [
    'Continuous wing and body contours replace the separate, stepped wing roots.',
    'Both sweeping negative-space channels end in rounded curves inside their own wing.',
    'The abdomen seam opens with a rounded cap; the lower wingcases end in soft curves.',
    'Foreleg elbows and hindleg ends retain their smooth curves.',
    'The head forms a sharp three-point crown with a taller central point and a clean, solid base.',
    'The three outer wing tips retain their pointed silhouette.',
  ],
  shapes: [
    ...pair({
      name: 'Left continuous wing and abdomen',
      // One contour draws all three lobes and the abdomen. There are no
      // internal L-shaped joins. The channel terminals are cubic U-turns.
      d: 'M132 104 C121 103 114 106 106 111 C78 90 47 75 14 66 C21 104 48 124 99 131 C105 132 109 133 109 136 C109 139 106 141 101 141 C76 139 53 131 35 119 C45 147 68 165 100 172 C104 173 107 174 107 177 C107 180 104 181 100 180 C84 177 68 169 57 158 C66 179 79 191 99 199 C105 207 113 215 119 218 C122 220 124 219 124 215 L124 150 C124 146.7 125.8 144 128 144 L132 144 Z',
    }),
    ...pair({
      name: 'Left curved foreleg',
      d: 'M111 112 C102 108 95 101 93 94 L87 73 Q85 68 88 63 L93 55 Q96 51 100 54 Q104 56 102 60 L97 69 Q95 72 97 77 L102 91 Q104 98 114 103 Q119 106 116 110 Q114 113 111 112 Z',
    }),
    ...pair({
      name: 'Left rounded hindleg',
      d: 'M107 190 C110 190 114 194 113 198 C112 202 105 207 101 214 L90 231 Q87 236 82 233 Q78 231 80 227 L91 208 Q96 201 101 194 C103 191 104 190 107 190 Z',
    }),
    {
      name: 'Sharp three-point crown head',
      d: 'M109 76 L120 84 L128 68 L136 84 L147 76 L142 98 L114 98 Z',
    },
  ],
};
