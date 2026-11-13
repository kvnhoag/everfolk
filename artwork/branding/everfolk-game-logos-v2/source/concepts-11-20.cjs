const p=(d,fill='none',stroke='gold',strokeWidth=3)=>({d,fill,stroke,strokeWidth,join:'round',cap:'round'});
const star=(x,y,r)=>p(`M${x} ${y-r}L${x+r*.22} ${y-r*.22}L${x+r} ${y}L${x+r*.22} ${y+r*.22}L${x} ${y+r}L${x-r*.22} ${y+r*.22}L${x-r} ${y}L${x-r*.22} ${y-r*.22}Z`,'bronze','dark',2);
const circle=(x,y,r)=>`M${x+r} ${y}A${r} ${r} 0 1 1 ${x-r} ${y}A${r} ${r} 0 1 1 ${x+r} ${y}Z`;
const rays=(x,y,r,R,n=16)=>Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n;return `M${x+Math.cos(a)*r} ${y+Math.sin(a)*r}L${x+Math.cos(a)*R} ${y+Math.sin(a)*R}`;}).join('');
module.exports=[
 {id:'11',slug:'legacy-crest',name:'Legacy Crest',layout:'bookends',metal:'bronze',font:'Palatino Linotype',tagY:451,back:[
  p('M370 105Q500 65 630 105L613 355Q570 412 500 438Q430 412 387 355Z','dark','bronze',10),
  p('M392 121Q500 89 608 121L593 341Q550 392 500 413Q450 392 407 341Z','none','gold',2),
  p('M500 126V407M453 160L500 201L547 160','none','gold',3),
  p('M124 357Q270 390 384 369M876 357Q730 390 616 369','none','bronze',7)
 ],front:[star(500,113,20)]},
 {id:'12',slug:'atlas-of-lives',name:'Atlas of Lives',layout:'wide',metal:'silver',font:'Times New Roman',tagY:442,back:[
  p('M500 65L724 160L814 330L500 421L186 330L276 160Z','none','bronze',5),
  p('M500 84L703 173L786 319L500 400L214 319L297 173Z','none','gold',1.5),
  p('M500 67V423M276 160H724M224 363Q500 280 776 363','none','#59706b',2),
  p(circle(500,240,155),'none','#4e635d',2),
  p('M500 89L509 127L500 151L491 127Z','bronze','none',0),
 ],front:[star(500,120,18),p('M100 380H362L385 394H615L638 380H900','none','silver',3)]},
 {id:'13',slug:'the-living-tome',name:'The Living Tome',layout:'stacked',metal:'bronze',font:'Georgia',tagY:473,back:[
  p('M174 107Q332 66 500 113Q668 66 826 107V410Q660 378 500 442Q340 378 174 410Z','dark','bronze',9),
  p('M192 123Q339 88 486 130V417Q339 365 192 392ZM808 123Q661 88 514 130V417Q661 365 808 392Z','none','gold',2.5),
  p('M219 151L219 365M781 151L781 365M500 119V428','none','#725e3b',3),
  p('M474 99H526V448L500 430L474 448Z','#783f34','gold',2)
 ],front:[star(500,89,17)]},
 {id:'14',slug:'iron-epoch',name:'Iron Epoch',layout:'wide',metal:'silver',font:'Georgia',tagY:425,back:[
  p('M102 165H898L935 201V365L898 402H102L65 365V201Z','dark','silver',7),
  p('M119 182H881L916 215V351L881 385H119L84 351V215Z','none','#758d88',2),
  p('M347 164L379 143H621L653 164','none','bronze',8),
  p('M111 211H139M125 197V225M861 211H889M875 197V225M111 356H139M125 342V370M861 356H889M875 342V370','none','bronze',4),
 ],front:[star(500,155,15),p('M226 424H359M641 424H774','none','silver',2)]},
 {id:'15',slug:'age-rings',name:'Age Rings',layout:'arch',metal:'copper',font:'Book Antiqua',tagY:451,back:[
  p(circle(500,252,172),'dark','bronze',8),p(circle(500,252,153),'none','gold',2),
  p(rays(500,252,139,149,36),'none','#ba9c65',3),
  p('M434 130Q500 102 566 130M420 372Q500 411 580 372','none','copper',5),
  p('M485 79H515V102H485ZM485 402H515V425H485Z','bronze','dark',2)
 ],front:[star(500,115,22)]},
 {id:'16',slug:'the-sundial',name:'The Sundial',layout:'bookends',metal:'bronze',font:'Times New Roman',tagY:452,back:[
  p('M180 358A320 260 0 0 1 820 358','none','bronze',9),
  p('M198 355A302 240 0 0 1 802 355','none','gold',2),
  p('M500 95V144M340 130L361 166M660 130L639 166M223 249L262 257M777 249L738 257','none','gold',5),
  p('M500 165L532 365H472Z','copper','dark',3),
  p('M175 367H825L800 387H200Z','bronze','dark',2),
 ],front:[p('M340 409H660','none','bronze',4),star(500,408,12)]},
 {id:'17',slug:'many-beginnings',name:'Many Beginnings',layout:'wide',metal:'bronze',font:'Palatino Linotype',tagY:450,back:[
  p('M102 356Q152 370 188 340V165H297V118H703V165H812V340Q848 370 898 356','none','bronze',8),
  p('M208 173V233M792 173V233M322 139H678','none','gold',2),
  p('M350 210V185C350 145 410 145 410 185V210M470 210V173C470 128 530 128 530 173V210M590 210V185C590 145 650 145 650 185V210','none','gold',5),
  p('M260 370Q500 395 740 370','none','copper',7),
 ],front:[star(500,112,17),p('M300 421H700','none','gold',2)]},
 {id:'18',slug:'golden-thread',name:'Golden Thread',layout:'arch',metal:'silver',font:'Palatino Linotype',tagY:455,back:[
  p('M119 351C30 173 230 102 351 150C475 200 495 420 650 383C797 348 871 150 743 132C613 113 644 205 759 197','none','dark',17),
  p('M119 351C30 173 230 102 351 150C475 200 495 420 650 383C797 348 871 150 743 132C613 113 644 205 759 197','none','bronze',10),
  p('M118 345C35 178 233 110 348 156M652 378C792 346 864 153 744 138','none','gold',2),
 ],front:[star(759,197,17),p('M332 432H668','none','bronze',3)]},
 {id:'19',slug:'heirloom-medallion',name:'Heirloom Medallion',layout:'stacked',metal:'copper',font:'Book Antiqua',tagY:520,back:[
  p(circle(500,260,212),'dark','bronze',10),p(circle(500,260,192),'none','gold',2),
  p('M315 103L329 118M671 118L685 103M286 135L301 147M699 147L714 135M300 402L316 386M684 386L700 402','none','copper',8),
  p('M283 261H304M696 261H717M500 47V75M500 445V472','none','gold',6),
 ],front:[star(500,105,23),p('M401 435H599','none','bronze',3)]},
 {id:'20',slug:'everlasting-horizon',name:'Everlasting Horizon',layout:'bookends',metal:'bronze',font:'Georgia',tagY:456,back:[
  p('M298 218C298 30 702 30 702 218','none','dark',20),
  p('M298 218C298 30 702 30 702 218','none','bronze',9),
  p('M323 209C323 59 677 59 677 209','none','gold',2),
  p('M500 57V27M392 74L379 45M608 74L621 45M303 135L278 115M697 135L722 115','none','gold',5),
  p('M100 371Q300 336 500 377Q700 336 900 371L871 392Q684 364 500 405Q316 364 129 392Z','bronze','dark',3),
 ],front:[p('M360 420Q500 447 640 420','none','gold',2),star(500,426,14)]},
];
