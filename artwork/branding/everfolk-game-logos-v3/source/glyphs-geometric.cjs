// Original cut-stone capitals. Broad verticals, clipped corners and open counters.
// Each compound counter runs opposite to its outer contour.
const face = d => ({ d, fill: 'face' });

module.exports = {
  name: 'Threshold Capitals',
  case: 'EVERFOLK',
  glyphs: {
    E: {
      w: 59,
      shapes: [face('M0 7L7 0H59V12H13V43H48V55H13V88H59V100H0Z')],
    },
    V: {
      w: 64,
      shapes: [face('M0 0H14L32 76L50 0H64L39 100H25Z')],
    },
    R: {
      w: 64,
      shapes: [face('M0 100V0H36L58 18V42L40 58L64 100H49L27 60H13V100Z M13 12V48H31L45 37V24L31 12Z')],
    },
    F: {
      w: 58,
      shapes: [face('M0 7L7 0H58V12H13V45H48V57H13V100H0Z')],
    },
    O: {
      w: 61,
      shapes: [face('M14 0H47L61 14V86L47 100H14L0 86V14Z M13 19V81L20 88H41L48 81V19L41 12H20Z')],
    },
    L: {
      w: 56,
      shapes: [face('M0 0H13V88H56V93L49 100H0Z')],
    },
    K: {
      w: 64,
      shapes: [face('M0 0H13V45H21L47 0H62L32 51L64 100H48L22 59H13V100H0Z')],
    },
  },
};
