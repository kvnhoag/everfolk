'use strict';
const mirror = shapes => shapes.concat(shapes.map(s => ({ ...s, name: s.name.replace('Left', 'Right'), matrix: [-1, 0, 0, 1, 256, 0] })));

module.exports = mirror([
  {
    name: 'Left clay wing fan / short shoulder root', role: 'wing',
    d: 'M108 125 C79 112 49 91 18 65 C19 88 25 106 41 121 C34 118 25 110 16 98 C19 125 34 144 54 151 C46 149 37 144 29 137 C43 165 66 177 93 174 C105 171 111 153 111 137 Q111 129 108 125 Z',
  },
  {
    name: 'Left upper wing feather / warm gold', role: 'feather',
    d: 'M27 85 C42 102 65 120 92 133 Q97 135 95 139 Q93 142 88 139 C61 127 40 109 27 85 Z',
  },
  {
    name: 'Left middle wing feather / warm gold', role: 'feather',
    d: 'M31 121 C46 136 64 147 87 151 Q92 152 90 156 Q89 159 85 157 C63 153 45 141 31 121 Z',
  },
  {
    name: 'Left lower wing feather / clay light', role: 'featherShade',
    d: 'M48 151 C62 160 73 164 86 163 Q91 163 89 167 Q88 170 83 169 C69 168 58 162 48 151 Z',
  },
]);
