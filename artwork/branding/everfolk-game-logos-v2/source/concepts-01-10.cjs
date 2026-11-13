const p = (d, fill, extra={}) => ({d,fill,...extra});
const l = (d, stroke='bronze', strokeWidth=5, extra={}) => p(d,'none',{stroke,strokeWidth,cap:'round',join:'round',...extra});
const diamond = (x,y,w=14,h=w,fill='gold') => p(`M${x} ${y-h}L${x+w} ${y}L${x} ${y+h}L${x-w} ${y}Z`,fill);
const circle = (x,y,r,fill='none',stroke='bronze',strokeWidth=5) => p(`M${x+r} ${y}A${r} ${r} 0 1 1 ${x-r} ${y}A${r} ${r} 0 1 1 ${x+r} ${y}Z`,fill,{stroke,strokeWidth});
module.exports = [
  {
    id:'01',slug:'dawnforged',name:'Dawnforged',layout:'wide',metal:'bronze',font:'Georgia',
    back:[
      circle(500,219,145,'dark','bronze',9),circle(500,219,125,'none','gold',2.5),
      p('M389 206A112 112 0 0 1 611 206L592 194L578 203L562 187L544 202L527 185L507 202L488 186L470 203L449 189L430 205L410 193Z','bronze'),
      l('M500 58V28M449 67L439 38M403 91L383 67M368 131L341 115M551 67L561 38M597 91L617 67M632 131L659 115','bronze',7),
      l('M373 239H627M393 262H607M421 285H579','gold',3),
    ],
    front:[
      p('M108 367H455L474 378H526L545 367H892L873 380H555L535 393H465L445 380H127Z','bronze'),
      diamond(500,380,9,9,'gold'),
    ],
  },
  {
    id:'02',slug:'chronicle-gate',name:'Chronicle Gate',layout:'arch',metal:'silver',font:'Palatino Linotype',
    back:[
      l('M172 391V237C172 28 828 28 828 237V391','bronze',14),
      l('M198 389V241C198 65 802 65 802 241V389','gold',3),
      p('M150 214H194L207 389H137Z','dark',{stroke:'bronze',strokeWidth:5,join:'round'}),
      p('M806 214H850L863 389H793Z','dark',{stroke:'bronze',strokeWidth:5,join:'round'}),
      p('M133 209H211L202 190H144ZM789 209H867L856 190H798ZM126 390H214V407H126ZM786 390H874V407H786Z','bronze'),
      l('M171 234V373M829 234V373','gold',3),
      diamond(500,96,22,33,'bronze'),diamond(500,96,7,14,'gold'),
    ],
    front:[l('M218 389H454M546 389H782','bronze',6),diamond(500,389,16,9,'bronze')],
  },
  {
    id:'03',slug:'living-standard',name:'Living Standard',layout:'wide',metal:'bronze',font:'Book Antiqua',
    back:[
      p('M68 174L235 198V357L68 382L114 276Z','#663d34',{stroke:'copper',strokeWidth:6,join:'round'}),
      p('M932 174L765 198V357L932 382L886 276Z','#663d34',{stroke:'copper',strokeWidth:6,join:'round'}),
      p('M168 184H832L855 224V331L832 370H168L145 331V224Z','dark',{stroke:'bronze',strokeWidth:8,join:'round'}),
      l('M187 204H813L835 236V319L813 349H187L165 319V236Z','gold',2.5),
      p('M168 370L234 393L234 370ZM832 370L766 393L766 370Z','copper'),
      l('M85 194L146 211M915 194L854 211M84 359L143 347M916 359L857 347','bronze',4),
    ],
    front:[
      p('M315 385H685L705 405H295Z','copper'),
      l('M330 395H464M536 395H670','gold',2.5),diamond(500,395,15,9,'gold'),
    ],
  },
  {
    id:'04',slug:'wheel-of-lives',name:'Wheel of Lives',layout:'bookends',metal:'silver',font:'Georgia',
    back:[
      circle(500,245,170,'dark','bronze',9),circle(500,245,149,'none','gold',3),circle(500,245,133,'none','bronze',5),
      l('M500 77V111M500 379V412M332 245H366M634 245H668M381 126L405 150M595 340L619 364M381 364L405 340M595 150L619 126','bronze',9),
      l('M440 90L451 120M560 90L549 120M346 186L377 198M654 186L623 198M346 304L377 292M654 304L623 292M440 400L451 370M560 400L549 370','gold',4),
      p('M484 66H516L526 83H474ZM484 407H516L526 425H474Z','bronze'),
    ],
    front:[
      p('M404 385L432 366H568L596 385L568 407H432Z','dark',{stroke:'bronze',strokeWidth:5,join:'round'}),
      l('M465 387L500 373L535 387M500 375V398','gold',4),
    ],
    tagY:460,
  },
  {
    id:'05',slug:'chronicle-plate',name:'Chronicle Plate',layout:'wide',metal:'copper',font:'Times New Roman',
    back:[
      p('M104 189H896V210H918V352H896V373H104V352H82V210H104Z','dark',{stroke:'bronze',strokeWidth:10,join:'round'}),
      l('M121 208H879V226H898V336H879V354H121V336H102V226H121Z','gold',2.5),
      p('M125 373H875L848 397H152Z','bronze'),
      circle(121,237,7,'copper','gold',2),circle(879,237,7,'copper','gold',2),
      circle(121,324,7,'copper','gold',2),circle(879,324,7,'copper','gold',2),
      l('M117 233L125 241M875 233L883 241M117 320L125 328M875 320L883 328','dark',2.5),
    ],
    front:[
      p('M350 405H650L635 419H365Z','dark',{stroke:'bronze',strokeWidth:3}),
      l('M393 411H459M541 411H607','gold',2.5),diamond(500,411,12,7,'gold'),
    ],
    tagY:462,
  },
  {
    id:'06',slug:'woven-histories',name:'Woven Histories',layout:'wide',metal:'bronze',font:'Palatino Linotype',
    back:[
      p('M72 209L160 121H432L474 163H784L868 247L826 289L754 217H448L406 175H182L114 243Z','bronze'),
      p('M928 351L840 439H568L526 397H216L132 313L174 271L246 343H552L594 385H818L886 317Z','bronze'),
      l('M84 211L168 137H423L465 179H776L846 247','gold',3),
      l('M916 349L832 423H577L535 381H224L154 313','gold',3),
      p('M446 138L472 164L495 164L469 138Z','dark'),
      p('M505 396L531 422L554 422L528 396Z','dark'),
    ],
    front:[
      l('M75 271L115 231M885 329L925 289','copper',10),
      diamond(500,126,13,13,'gold'),diamond(500,434,13,13,'gold'),
    ],
    tagY:478,
  },
  {
    id:'07',slug:'roots-of-legacy',name:'Roots of Legacy',layout:'arch',metal:'bronze',font:'Book Antiqua',
    back:[
      p('M476 216L483 164L463 141L447 146L408 123L383 129L344 102L313 108L281 83L296 75L324 94L347 88L392 113L413 108L453 132L470 124L487 142L492 100L475 77L483 66L500 86L518 61L529 71L508 102L513 143L535 121L550 130L587 107L610 112L652 85L678 91L704 72L719 82L688 107L657 102L618 128L592 124L553 147L535 140L517 166L524 216Z','bronze'),
      l('M322 95L335 70M385 115L381 91M443 136L445 111M675 93L664 69M613 114L617 91M555 137L554 111','gold',4),
      p('M332 92C308 97 294 78 300 57C325 55 340 71 332 92ZM383 109C364 101 359 82 371 66C392 73 398 92 383 109ZM445 128C428 118 429 100 445 89C462 101 460 119 445 128ZM668 92C692 97 706 78 700 57C675 55 660 71 668 92ZM617 109C636 101 641 82 629 66C608 73 602 92 617 109ZM555 128C572 118 571 100 555 89C538 101 540 119 555 128Z','bronze'),
      p('M463 330L481 356L459 380L421 389L402 411L368 412L345 432L371 433L410 420L432 400L470 394L493 372L500 401L488 430L500 441L512 430L506 401L512 374L537 394L577 402L593 421L629 432L655 431L633 412L600 410L580 389L540 379L518 355L537 330Z','bronze'),
      l('M437 398L447 418M564 398L554 418M482 376L470 404M517 376L529 406','gold',3),
    ],
    front:[diamond(500,156,10,16,'gold')],
    tagY:482,
  },
  {
    id:'08',slug:'crossroads',name:'Crossroads',layout:'bookends',metal:'silver',font:'Georgia',
    back:[
      p('M486 336L397 386L222 426L244 442L415 405L500 359L585 405L756 442L778 426L603 386L514 336Z','bronze'),
      p('M488 338L488 418L500 444L512 418V338Z','bronze'),
      l('M490 358L403 394L250 430M510 358L597 394L750 430M500 370V421','gold',3),
      p('M69 201L97 173L125 201L97 230ZM875 201L903 173L931 201L903 230Z','dark',{stroke:'bronze',strokeWidth:5,join:'round'}),
      l('M97 207V261M903 207V261','bronze',6),
      diamond(686,102,22,31,'bronze'),diamond(686,102,7,15,'gold'),
      l('M250 159H570L601 128H657','bronze',5),
    ],
    front:[l('M154 370H355M645 370H846','bronze',4),diamond(500,351,11,10,'gold')],
    tagY:480,
  },
  {
    id:'09',slug:'great-ledger',name:'The Great Ledger',layout:'stacked',metal:'copper',font:'Palatino Linotype',
    back:[
      p('M211 106Q356 76 500 109Q644 76 789 106V408Q644 375 500 413Q356 375 211 408Z','dark',{stroke:'bronze',strokeWidth:9,join:'round'}),
      l('M230 124Q361 100 486 128M514 128Q639 100 770 124M230 387Q361 364 486 393M514 393Q639 364 770 387','gold',3),
      p('M202 96L251 87V108L224 116V154H202ZM798 96L749 87V108L776 116V154H798ZM202 418L251 427V406L224 398V360H202ZM798 418L749 427V406L776 398V360H798Z','bronze'),
      p('M481 103H519V440L500 425L481 440Z','#773e34',{stroke:'copper',strokeWidth:3}),
      l('M491 116V397M509 116V397','gold',2.5),
    ],
    front:[diamond(500,452,15,16,'bronze'),diamond(500,452,5,7,'gold')],
    tagY:496,
  },
  {
    id:'10',slug:'horizon-tablet',name:'Horizon Tablet',layout:'wide',metal:'bronze',font:'Georgia',
    back:[
      p('M125 211L160 176L178 184L206 160Q500 95 794 160L822 184L840 176L875 211V354L846 374H154L125 354Z','#263a3b',{stroke:'bronze',strokeWidth:7,join:'round'}),
      l('M155 215L181 197L211 178Q500 119 789 178L819 197L845 215V340L834 351H166L155 340Z','gold',2.5),
      p('M138 375H862L833 398H167Z','bronze'),
      p('M154 349L174 339L180 350L167 363L154 362ZM831 176L815 193L825 207L848 200L845 187Z','dark'),
      p('M427 130A73 73 0 0 1 573 130L555 130A55 55 0 0 0 445 130Z','bronze'),
      l('M500 45V28M456 60L447 45M544 60L553 45M423 93L408 84M577 93L592 84','gold',5),
    ],
    front:[
      p('M288 409H457L476 420H524L543 409H712L694 422H552L531 434H469L448 422H306Z','bronze'),
      diamond(500,421,8,8,'gold'),
    ],
    tagY:472,
  },
];
