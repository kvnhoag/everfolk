// Original hand-drawn lettering for Everfolk. These paths do not derive from
// an installed font or a traced reference logo. The broad curves and flared
// terminals are intended to feel cut from warm stone at small display sizes.
// Outer and inner contours of e/o deliberately use opposite winding.
const face = (d, name) => ({ d, fill: 'face', name });

module.exports = {
  name: 'Living Stone',
  case: 'everfolk',
  glyphs: {
    e: {
      w: 68,
      shapes: [face(
        'M61 62C64 44 52 27 34 27C13 27 3 42 3 64C3 88 17 101 38 101C50 101 59 96 64 88L56 79C51 86 45 89 37 89C25 89 18 82 17 69L61 69Z ' +
        'M18 57C19 45 25 38 35 38C45 38 50 45 50 57Z',
        'e / broad bowl and open stone-cut mouth'
      )],
    },
    v: {
      w: 68,
      shapes: [face(
        'M2 29Q11 34 21 29L34 79Q36 86 38 78L52 31Q60 34 66 28L64 39L43 98Q35 104 26 98L6 42Z',
        'v / curved wedge with flared upper cuts'
      )],
    },
    r: {
      w: 55,
      shapes: [face(
        'M5 31Q15 34 24 29L25 42C32 29 42 25 51 31L48 48C39 43 30 48 25 60V87Q25 94 31 98L3 100Q9 91 9 83V46Q9 36 5 31Z',
        'r / rounded shoulder and tapered open terminal'
      )],
    },
    f: {
      w: 56,
      shapes: [face(
        'M12 101V47H3L6 34H12V24C12 9 22 1 37 1Q48 1 55 7L48 19Q43 13 36 13C29 13 27 17 27 27V34H47L43 47H27V86Q27 96 34 101Z',
        'f / rising curved crook and chisel-cut crossbar'
      )],
    },
    o: {
      w: 74,
      shapes: [face(
        'M38 26C60 26 70 40 70 63C70 86 57 101 35 101C13 101 3 85 3 64C3 42 17 26 38 26Z ' +
        'M36 39C24 39 18 50 18 65C18 80 25 89 37 89C49 89 55 79 55 63C55 48 49 39 36 39Z',
        'o / asymmetric stone ring with transparent counter'
      )],
    },
    l: {
      w: 36,
      shapes: [face(
        'M6 5L25 0V81Q25 91 34 97L5 100Q11 92 11 80V23Q11 12 6 5Z',
        'l / long upright with a swept foot'
      )],
    },
    k: {
      w: 70,
      shapes: [face(
        'M6 5L24 1V57L45 34Q50 31 60 31L60 36L36 63L56 87Q61 94 67 98L43 101L24 76V87Q24 95 28 100H4Q10 90 10 81V24Q10 12 6 5Z',
        'k / branching diagonals and flared lower leg'
      )],
    },
  },
};
