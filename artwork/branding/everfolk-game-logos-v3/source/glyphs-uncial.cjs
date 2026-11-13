// Original hand-drawn lettering. Coordinates are design units, baseline y=100.
// Closed counters use the opposite winding to the outside contour.
const face = d => ({ d, fill: 'face', stroke: 'none' });

module.exports = {
  name: 'Chisel Uncial',
  case: 'Everfolk',
  glyphs: {
    E: {
      w: 73,
      shapes: [
        face('M69 6L65 24C54 15 42 14 30 22C20 29 16 43 17 58C18 80 31 92 48 88L68 78L64 97C46 106 24 101 12 85C1 70 1 45 10 26C20 5 45 -1 69 6Z'),
        face('M16 48L60 44L55 57L18 60Z'),
      ],
    },
    v: {
      w: 65,
      shapes: [
        face('M2 32L20 28C20 47 25 68 34 87C43 72 49 52 49 35L63 27C65 48 51 83 35 103L23 97C14 80 7 55 6 40Z'),
      ],
    },
    e: {
      w: 63,
      shapes: [
        face('M59 66H19C20 82 28 93 41 92C47 92 53 88 59 83L55 98C46 104 36 104 27 100C10 93 2 79 3 62C4 42 17 29 35 29C53 28 63 44 59 66ZM20 56H46C45 43 38 37 30 41C24 44 21 49 20 56Z'),
      ],
    },
    r: {
      w: 54,
      shapes: [
        face('M6 37L20 28L22 46C29 32 39 26 52 31L46 48C36 40 28 45 24 54C21 60 22 69 22 75L24 96L10 103L9 54C9 45 8 41 6 37Z'),
      ],
    },
    f: {
      w: 51,
      shapes: [
        face('M48 5L43 19C34 13 27 15 27 27V35H49L42 48H27V100L13 105V48H2L7 35H13V27C13 8 29 -1 48 5Z'),
      ],
    },
    o: {
      w: 68,
      shapes: [
        face('M35 28C53 26 64 40 64 61C64 84 52 102 33 103C14 105 3 91 3 70C3 47 15 30 35 28ZM33 41C23 42 17 53 17 68C17 83 23 92 33 91C44 89 50 77 50 63C50 47 44 39 33 41Z'),
      ],
    },
    l: {
      w: 36,
      shapes: [
        face('M7 13L24 2L23 78C23 88 26 93 34 90L29 102C16 106 9 98 9 84L10 30C10 22 9 18 7 13Z'),
      ],
    },
    k: {
      w: 67,
      shapes: [
        face('M6 12L23 2L22 64L43 41L59 28L61 42L38 63L64 97L48 103L25 74L22 79V98L9 103L10 30C10 22 9 17 6 12Z'),
      ],
    },
  },
};
