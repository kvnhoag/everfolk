const p = (d, fill = 'ink', extra = {}) => ({ d, fill, ...extra });
const line = (d, color = 'ink', width = 4.5, extra = {}) => p(d, 'none', { stroke: color, strokeWidth: width, cap: 'round', join: 'round', ...extra });
const star = (x, y, r, color = 'gold') => p(`M${x} ${y-r}Q${x+r*.18} ${y-r*.18} ${x+r} ${y}Q${x+r*.18} ${y+r*.18} ${x} ${y+r}Q${x-r*.18} ${y+r*.18} ${x-r} ${y}Q${x-r*.18} ${y-r*.18} ${x} ${y-r}Z`, color);
module.exports = [
  { id:'01',slug:'guiding-book',name:'Guiding Book',family:'Chronicle',rationale:'The existing book and star, refined into a clear signature.',font:'Courier New',fontStyle:'Bold',layout:'horizontal',shapes:[
    star(50,23,16),
    line('M12 46Q30 41 50 53Q70 41 88 46V81Q70 76 50 89Q30 76 12 81Z','ink',4.5),
    line('M50 53V89','ink',3.5),
    line('M23 57Q33 57 41 62M23 67Q33 67 41 72M77 57Q67 57 59 62M77 67Q67 67 59 72','ink',3),
  ]},
  { id:'02',slug:'turning-leaf',name:'Turning Leaf',family:'Chronicle',rationale:'A page opening toward the next life.',font:'Source Serif 4',fontStyle:'Regular',layout:'horizontal',shapes:[
    line('M24 14H60L80 35V85H24Z','ink',5),
    p('M60 14V36H80Z','gold'),
    line('M37 49H64M37 61H64M37 73H53','ink',4),
    p('M14 21H18V91H71V95H14Z','ink'),
  ]},
  { id:'03',slug:'story-door',name:'Story Door',family:'Chronicle',rationale:'Step through a story and inhabit another world.',font:'Georgia',fontStyle:'Regular',layout:'stacked',shapes:[
    line('M11 47Q27 41 41 49M59 49Q73 41 89 47V83Q74 78 59 85M41 85Q27 78 11 83V47','ink',4.5),
    line('M33 88V38C33 14 67 14 67 38V88','ink',6),
    p('M45 40L60 34V88L45 82Z','gold'),
    line('M26 92H74','ink',4.5),
  ]},
  { id:'04',slug:'chronicle-ribbon',name:'Chronicle Ribbon',family:'Chronicle',rationale:'A kept place in the record of a life.',font:'Source Serif 4',fontStyle:'Regular',layout:'horizontal',shapes:[
    p('M12 24Q29 20 44 30V82Q29 72 12 76Z','ink'),
    p('M88 24Q71 20 56 30V82Q71 72 88 76Z','ink'),
    p('M45 20H55V89L50 84L45 89Z','clay'),
    star(50,10,5,'gold'),
  ]},
  { id:'05',slug:'chapter-e',name:'Chapter E',family:'Chronicle',rationale:'An initial assembled from the edges of a chronicle.',font:'Courier New',fontStyle:'Bold',layout:'horizontal',shapes:[
    p('M18 14H77V26H32V44H65V56H32V76H79V88H18Z','ink'),
    p('M39 32H73V37H39ZM39 63H70V68H39Z','gold'),
  ]},
  { id:'06',slug:'forked-path',name:'Forked Path',family:'Possibility',rationale:'One beginning, many possible lives.',font:'Courier New',fontStyle:'Bold',layout:'horizontal',shapes:[
    line('M50 89V59C50 43 28 43 20 26','ink',8),
    line('M50 59C50 41 73 41 81 24','ink',8),
    line('M50 59V22','ink',8),
    star(50,12,7),
    p('M13 13L22 10L27 19L18 22Z','olive'),
    p('M75 13L83 9L88 17L80 21Z','gold'),
  ]},
  { id:'07',slug:'woven-lives',name:'Woven Lives',family:'Possibility',rationale:'Lives meet, separate and become part of each other.',font:'Source Serif 4',fontStyle:'Regular',layout:'stacked',shapes:[
    line('M39 64C19 78 5 58 17 38C25 24 41 14 54 22C69 31 76 49 84 60C94 74 79 89 63 77L49 63','ink',8),
    line('M40 37C29 28 24 43 32 52L61 79','gold',8),
    line('M56 26C70 12 87 25 78 41L59 65','gold',8),
  ]},
  { id:'08',slug:'life-rings',name:'Life Rings',family:'Possibility',rationale:'A personal history gathered one year at a time.',font:'Georgia',fontStyle:'Regular',layout:'horizontal',shapes:[
    line('M82 29C68 7 32 7 17 30C3 53 16 82 42 88C62 92 80 82 88 64','ink',5.5),
    line('M74 38C65 20 39 20 29 37C17 56 31 76 50 76C64 76 74 68 78 55','ink',5.5),
    line('M65 47C60 36 44 35 39 45C34 54 40 65 50 65C58 65 63 61 65 55','gold',5.5),
  ]},
  { id:'09',slug:'sprouting-story',name:'Sprouting Story',family:'Possibility',rationale:'Every life grows from its own starting page.',font:'Source Serif 4',fontStyle:'Regular',layout:'horizontal',shapes:[
    line('M13 62Q33 55 50 67Q67 55 87 62V83Q67 77 50 89Q33 77 13 83Z','ink',4.5),
    line('M50 35V88','ink',4.5),
    p('M48 44C28 47 18 34 21 19C40 18 49 28 48 44Z','olive'),
    p('M53 33C51 14 64 6 79 10C80 27 67 36 53 33Z','gold'),
  ]},
  { id:'10',slug:'returning-dawn',name:'Returning Dawn',family:'Possibility',rationale:'Another beginning beyond the horizon.',font:'Georgia',fontStyle:'Regular',layout:'stacked',shapes:[
    line('M29 48C29 20 71 20 71 48','gold',6),
    line('M50 12V7M21 25L17 21M79 25L83 21','gold',4),
    line('M11 51Q31 43 50 56Q69 43 89 51','ink',6),
    line('M15 65Q33 58 50 70Q67 58 85 65M21 79Q36 74 50 84Q64 74 79 79','ink',5),
  ]},
];
