module.exports = [
  {
    id: '11', slug: 'common-hearth', name: 'Common Hearth', family: 'Belonging',
    rationale: 'A guiding spark makes an ordinary home the beginning of an extraordinary life.',
    font: 'Source Serif 4', fontStyle: 'Regular', layout: 'horizontal',
    shapes: [
      { name: 'Welcoming roof', d: 'M12 46L50 15L88 46', fill: 'none', stroke: 'ink', strokeWidth: 6, cap: 'round', join: 'round' },
      { name: 'Open hearth doorway', d: 'M25 43V84H41V65Q50 55 59 65V84H75V43', fill: 'none', stroke: 'ink', strokeWidth: 6, cap: 'round', join: 'round' },
      { name: 'Hearth spark', d: 'M50 31L53.5 41.5L64 45L53.5 48.5L50 59L46.5 48.5L36 45L46.5 41.5Z', fill: 'gold' }
    ]
  },
  {
    id: '12', slug: 'village-sun', name: 'Village Sun', family: 'Belonging',
    rationale: 'Different homes share a single dawn across Everfolk’s historical worlds.',
    font: 'Georgia', fontStyle: 'Bold', layout: 'stacked',
    shapes: [
      { name: 'Common sun', d: 'M64 28A14 14 0 1 1 36 28A14 14 0 1 1 64 28Z', fill: 'gold' },
      { name: 'Three homes', d: 'M12 64L29 48L44 62L60 43L88 65V85H71V70H60V85H46V72H34V85H12Z', fill: 'ink' },
      { name: 'Dawn ray left', d: 'M24 31L18 28M29 18L25 12M76 31L82 28M71 18L75 12', fill: 'none', stroke: 'gold', strokeWidth: 4, cap: 'round' }
    ]
  },
  {
    id: '13', slug: 'gathering', name: 'Gathering', family: 'Belonging',
    rationale: 'Three equal figures celebrate the relationships that shape every personal story.',
    font: 'Courier New', fontStyle: 'Bold', layout: 'horizontal',
    shapes: [
      { name: 'First figure head', d: 'M58 22A8 8 0 1 1 42 22A8 8 0 1 1 58 22Z', fill: 'gold' },
      { name: 'First figure shoulders', d: 'M34 49V47C34 32 66 32 66 47V49', fill: 'none', stroke: 'gold', strokeWidth: 6, cap: 'round' },
      { name: 'Two companion heads', d: 'M35 59A8 8 0 1 1 19 59A8 8 0 1 1 35 59ZM81 59A8 8 0 1 1 65 59A8 8 0 1 1 81 59Z', fill: 'ink' },
      { name: 'Two companion shoulders', d: 'M11 86V84C11 68 43 68 43 84V86M57 86V84C57 68 89 68 89 84V86', fill: 'none', stroke: 'ink', strokeWidth: 6, cap: 'round' }
    ]
  },
  {
    id: '14', slug: 'open-window', name: 'Open Window', family: 'Belonging',
    rationale: 'An opening in a familiar window offers a glimpse into another possible life.',
    font: 'Source Serif 4', fontStyle: 'Regular', layout: 'horizontal',
    shapes: [
      { name: 'Arched window frame', d: 'M22 86V43C22 26 34 14 50 14C66 14 78 26 78 43V86H22ZM50 16V86M22 50H78', fill: 'none', stroke: 'ink', strokeWidth: 5.5, join: 'round' },
      { name: 'Open casement', d: 'M50 50L88 42V77L50 86Z', fill: 'none', stroke: 'gold', strokeWidth: 5, join: 'round' },
      { name: 'Distant light', d: 'M63 25L65.5 32.5L73 35L65.5 37.5L63 45L60.5 37.5L53 35L60.5 32.5Z', fill: 'gold' }
    ]
  },
  {
    id: '15', slug: 'shared-table', name: 'Shared Table', family: 'Belonging',
    rationale: 'A simple meeting across a table places everyday human connection at the centre.',
    font: 'Georgia', fontStyle: 'Regular', layout: 'stacked',
    shapes: [
      { name: 'Two equal companions', d: 'M36 28A9 9 0 1 1 18 28A9 9 0 1 1 36 28ZM82 28A9 9 0 1 1 64 28A9 9 0 1 1 82 28Z', fill: 'ink' },
      { name: 'Seated conversation', d: 'M16 62V58C16 45 33 43 40 55L47 66M84 62V58C84 45 67 43 60 55L53 66M16 68C18 91 82 91 84 68', fill: 'none', stroke: 'ink', strokeWidth: 6.5, cap: 'round', join: 'round' },
      { name: 'Common table', d: 'M31 66H69M50 66V80', fill: 'none', stroke: 'gold', strokeWidth: 6, cap: 'round' }
    ]
  },
  {
    id: '16', slug: 'ef-ligature', name: 'EF Ligature', family: 'Continuity',
    rationale: 'Interlocking initials create a compact printer’s mark for a growing collection of stories.',
    font: 'Courier New', fontStyle: 'Bold', layout: 'horizontal',
    shapes: [
      { name: 'Everfolk E', d: 'M13 18H52V28H24V45H47V55H24V72H52V82H13Z', fill: 'ink' },
      { name: 'Everfolk F', d: 'M59 18H88V28H70V45H85V55H70V82H59Z', fill: 'ink' },
      { name: 'Shared headline', d: 'M42 18H70V28H42Z', fill: 'gold' }
    ]
  },
  {
    id: '17', slug: 'archive-seal', name: 'Archive Seal', family: 'Continuity',
    rationale: 'A bookplate seal gives every remembered life a place in the Everfolk archive.',
    font: 'Source Serif 4', fontStyle: 'Regular', layout: 'stacked',
    shapes: [
      { name: 'Archive ring', d: 'M88 50A38 38 0 1 1 12 50A38 38 0 1 1 88 50Z', fill: 'none', stroke: 'ink', strokeWidth: 4 },
      { name: 'Open chronicle', d: 'M27 41Q39 36 50 44Q61 36 73 41V66Q61 62 50 70Q39 62 27 66ZM50 44V70', fill: 'none', stroke: 'ink', strokeWidth: 4.5, cap: 'round', join: 'round' },
      { name: 'Guiding star', d: 'M50 17L53 25L61 28L53 31L50 39L47 31L39 28L47 25Z', fill: 'gold' },
      { name: 'Archive punctuation', d: 'M53 80A3 3 0 1 1 47 80A3 3 0 1 1 53 80Z', fill: 'gold' }
    ]
  },
  {
    id: '18', slug: 'ever-knot', name: 'Ever Knot', family: 'Continuity',
    rationale: 'An unbroken woven loop connects one lived story to the next.',
    font: 'Georgia', fontStyle: 'Bold', layout: 'horizontal',
    shapes: [
      { name: 'Continuous life loop', d: 'M28 75C10 75 10 25 28 25C45 25 55 75 72 75C90 75 90 25 72 25C55 25 45 75 28 75Z', fill: 'none', stroke: 'ink', strokeWidth: 8, cap: 'round', join: 'round' },
      { name: 'Woven golden crossing', d: 'M44 39L56 61', fill: 'none', stroke: 'gold', strokeWidth: 8, cap: 'round' }
    ]
  },
  {
    id: '19', slug: 'wayfinder', name: 'Wayfinder', family: 'Continuity',
    rationale: 'A compass-like guiding star points toward possibilities between the pages of history.',
    font: 'Source Serif 4', fontStyle: 'Regular', layout: 'stacked',
    shapes: [
      { name: 'Left page bracket', d: 'M32 16C18 27 12 42 15 59C17 73 26 83 38 88', fill: 'none', stroke: 'ink', strokeWidth: 5.5, cap: 'round' },
      { name: 'Right page bracket', d: 'M68 16C82 27 88 42 85 59C83 73 74 83 62 88', fill: 'none', stroke: 'ink', strokeWidth: 5.5, cap: 'round' },
      { name: 'Four-way guiding light', d: 'M50 22L57 43L78 50L57 57L50 78L43 57L22 50L43 43Z', fill: 'gold' }
    ]
  },
  {
    id: '20', slug: 'quill-flame', name: 'Quill Flame', family: 'Continuity',
    rationale: 'A feather and a small spark suggest the story that each new life can write.',
    font: 'Georgia', fontStyle: 'Bold', layout: 'horizontal',
    shapes: [
      { name: 'Story feather', d: 'M29 87L34 67C30 50 43 26 74 14C79 32 75 47 64 58L49 61L56 66L39 74Z', fill: 'ink' },
      { name: 'Golden quill spine', d: 'M28 87Q40 63 64 34', fill: 'none', stroke: 'gold', strokeWidth: 4.5, cap: 'round' },
      { name: 'Life spark', d: 'M79 8L81.5 15.5L89 18L81.5 20.5L79 28L76.5 20.5L69 18L76.5 15.5Z', fill: 'gold' }
    ]
  }
];
