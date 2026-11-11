/** Fictional prestige stages for artwork, not a dated biography or mint result. */
export const HISTORICAL_STAGES = {
 alexander:[
  {title:'Field camp',description:'A modest campaign tent, supplies and a small campfire.'},
  {title:'Officer quarters',description:'An organized camp with a timber shelter and a planning table.'},
  {title:'Command pavilion',description:'A substantial command pavilion with a campaign map and stone defenses.'},
  {title:'General headquarters',description:'A fortified residence with a broad courtyard and an imposing command hall.'},
  {title:'Royal palace',description:'A lavish palace with monumental gold-trimmed columns and a ceremonial dais.'}
 ],
 aristotle:[
  {title:'Humble study',description:'A simple reading desk beneath an olive tree.'},
  {title:'Private study',description:'A small scholar’s room with manuscript shelves and a writing table.'},
  {title:'Teaching courtyard',description:'An established teaching court with benches and a stone colonnade.'},
  {title:'Lyceum complex',description:'An extensive scholarly garden with multiple lecture colonnades.'},
  {title:'Court library',description:'A magnificent royal library with carved columns and illuminated manuscript cabinets.'}
 ],
 euclid:[
  {title:'Sand-tray courtyard',description:'A small courtyard with a sand tray for simple geometric demonstrations.'},
  {title:'Geometry workroom',description:'A dedicated workroom with a diagram board and a few book rolls.'},
  {title:'Geometry school',description:'A flourishing school with large diagrams and demonstration tables.'},
  {title:'Museum hall',description:'An imposing scholarly hall with tall shelves and geometric instruments.'},
  {title:'Grand library',description:'A monumental library with gilded arches and a ceremonial geometry floor.'}
 ],
 cleomenes:[
  {title:'Market storehouse',description:'A modest grain stall, a small storehouse and a trade balance.'},
  {title:'Merchant warehouse',description:'An expanded warehouse with organized grain sacks and shipping records.'},
  {title:'Revenue office',description:'A formal accounts office overlooking the granary quay.'},
  {title:'Administrator residence',description:'A grand official residence with a courtyard overlooking the grain harbor.'},
  {title:'Treasury hall',description:'A lavish treasury and administrative palace with gilded architecture and grain reliefs.'}
 ]
};
export function stageIndex(rarity=0){const value=Number(rarity??0);return Number.isInteger(value)&&value>=0&&value<=4?value:0;}
export function historicalStage(figure,rarity=0){return HISTORICAL_STAGES[figure]?.[stageIndex(rarity)]??null;}

/** Integer-pixel architecture changes at every tier; the character is drawn separately. */
export function drawHistoricalLifeStage(p,figure,rarity=0){
 if(!HISTORICAL_STAGES[figure])return false;
 const tier=stageIndex(rarity),{rect:r,line:l,poly:poly,oval:o}=p;
 const theme={alexander:['#1b2945','#4c6174','#d6aa52'],aristotle:['#2b263e','#776078','#c6ad83'],euclid:['#163643','#507e85','#a8d6c6'],cleomenes:['#203d35','#668169','#d6bd75']}[figure];
 const sky=tier<2?'#e5dfc3':theme[0],stone=tier<2?'#cbbb94':theme[1],light=tier<2?'#efe3be':'#cbbf9a',ground=tier<2?'#d9c59d':theme[0],trim=tier<2?'#9b8460':theme[2];
 r(0,0,240,190,sky);o(183,18,18+tier*2,18+tier*2,tier<2?'#e8cc88':theme[2]);
 if(tier<2)poly([[0,102],[36,85],[78,98],[133,82],[183,98],[240,83],[240,143],[0,143]],'#acb79a');
 r(0,135,240,55,ground);
 if(tier>0){for(let y=143;y<190;y+=12)l(0,y,239,y,tier<2?'#bdab84':theme[1]);for(let x=-60;x<300;x+=40)l(120,127,x,190,tier<2?'#bdab84':theme[1]);}
 const column=(x,y,height,width=9)=>{r(x,y,width,height,stone);r(x+2,y+2,2,height-3,light);r(x-3,y-4,width+6,5,trim);r(x-2,y+height,width+4,4,trim);};
 const room=(x,y,w,h,arched=false)=>{r(x,y,w,h,stone);r(x+5,y+5,w-10,h-5,tier<2?'#a79876':theme[0]);r(x-4,y-5,w+8,6,trim);if(arched)poly([[x-5,y-5],[x+w/2,y-22],[x+w+5,y-5]],light);};
 const scrolls=(x,y,cols,rows)=>{r(x-3,y-3,cols*10+5,rows*14+3,'#695140');for(let row=0;row<rows;row++){for(let col=0;col<cols;col++){r(x+col*10,y+row*14,7,10,'#d8c8a0');r(x+col*10+1,y+row*14+2,5,2,'#f4e8c6');}r(x-2,y+row*14+11,cols*10+3,2,trim);}};
 const desk=(x,y,w=35)=>{r(x,y,w,5,trim);r(x+3,y+5,3,17,'#695140');r(x+w-6,y+5,3,17,'#695140');r(x+5,y-5,w-10,5,'#e8d9b2');};
 const sack=(x,y)=>{o(x,y,15,22,tier<2?'#b69c6c':'#9aa878');r(x+4,y-2,7,4,'#695140');r(x+3,y+5,2,11,light);};
 const diagram=(x,y,w=35)=>{r(x-3,y-3,w+6,39,trim);r(x,y,w,33,tier<2?'#6c8272':'#183b46');l(x+4,y+26,x+w/2,y+5,'#d8c8a0');l(x+w/2,y+5,x+w-4,y+26,'#d8c8a0');l(x+4,y+26,x+w-4,y+26,'#d8c8a0');};
 const grandHall=()=>{
  if(tier===4){
   r(0,16,240,119,stone);r(8,27,224,108,theme[0]);
   for(const x of [12,45,183,216])column(x,30,105,12);
   r(3,17,234,8,trim);r(7,25,226,3,light);
   poly([[65,57],[65,43],[84,18],[120,7],[156,18],[175,43],[175,57]],trim);
   poly([[73,55],[73,45],[90,25],[120,15],[150,25],[167,45],[167,55]],theme[0]);r(73,55,94,79,theme[0]);
   for(const x of [65,172]){l(x,55,x,77,trim,2);o(x-5,73,12,12,trim);o(x-2,76,6,6,'#f1d889');}
   for(let x=17;x<230;x+=13)r(x,20,4,3,light);
   for(let y=136;y<157;y+=5)r(56-(y-136),y,128+(y-136)*2,4,y%2?trim:stone);
  }else{
   room(15,49,210,89,true);for(const x of [21,47,184,210])column(x,54,83,9);r(70,49,100,7,trim);r(78,56,84,79,theme[0]);poly([[78,56],[120,36],[162,56]],trim);for(let y=142;y<157;y+=5)r(64-(y-142),y,112+(y-142)*2,4,stone);
  }
 };

 if(figure==='alexander'){
  if(tier===0){for(const [x,y,w]of [[10,82,61],[172,91,54]]){poly([[x,y+45],[x+w/2,y],[x+w,y+45]],'#8f886c');poly([[x+5,y+42],[x+w/2,y+6],[x+w-5,y+42]],'#d8c8a0');poly([[x+w/2-6,y+20],[x+w/2+9,y+43],[x+w/2-7,y+43]],'#695140');}r(29,155,23,12,'#9b7852');r(32,151,17,5,'#c7a66c');o(189,158,17,5,'#8b633b');poly([[194,158],[197,145],[202,158]],'#c39b59');}
  if(tier===1){for(let x=5;x<240;x+=8){r(x,85,5,47,'#a18b63');poly([[x,85],[x+2,79],[x+5,85]],'#a18b63');}room(12,69,61,64,true);desk(178,135,42);l(181,133,209,133,'#958467');}
  if(tier===2){poly([[14,123],[31,64],[119,37],[215,66],[231,123]],stone);poly([[29,119],[43,71],[119,47],[203,73],[215,119]],'#997b65');r(104,66,30,66,theme[0]);column(25,76,55);column(206,77,54);desk(173,131,46);r(177,126,36,1,'#695140');l(182,122,200,128,'#9b7852');}
  if(tier>=3){grandHall();if(tier===3){for(const x of [4,224]){r(x,70,12,69,stone);r(x-2,65,16,7,trim);}desk(169,126,48);}else{r(80,140,80,39,'#69424e');for(let y=144;y<180;y+=7)r(86,y,68,1,'#b78c5d');r(99,88,42,31,'#a48449');r(104,81,32,9,trim);r(104,93,32,19,theme[0]);}}
 }
 if(figure==='aristotle'){
  if(tier===0){room(172,85,50,46,true);desk(16,132,53);for(const x of [23,39,54]){r(x,125,10,5,'#e8d9b2');}l(30,119,30,68,'#9b7852',3);for(const [x,y]of [[6,58],[23,45],[36,61]])o(x,y,30,24,'#879b70');}
  if(tier===1){room(11,49,217,86);r(83,59,64,65,'#a9b798');scrolls(20,75,4,3);desk(176,131,42);}
  if(tier===2){for(const x of [15,51,180,216])column(x,64,71);r(9,57,222,8,trim);poly([[12,57],[120,32],[229,57]],stone);for(const x of [21,173]){r(x,137,44,5,trim);r(x+5,142,3,13,'#695140');r(x+36,142,3,13,'#695140');}scrolls(184,99,3,2);}
  if(tier===3){grandHall();for(const [x,y]of [[3,91],[219,88]]){l(x+9,y+16,x+9,y+58,'#9b7852',3);o(x-2,y-8,29,29,'#547363');o(x+3,y-4,20,20,'#8ba077');}scrolls(18,97,3,2);desk(172,128,48);}
  if(tier===4){grandHall();scrolls(18,70,5,4);scrolls(174,70,5,4);r(86,144,68,36,'#5e3c58');for(let y=147;y<180;y+=8)r(92,y,56,2,trim);desk(170,145,49);}
 }
 if(figure==='euclid'){
  if(tier===0){room(174,87,49,45);r(13,134,60,6,'#9b7852');r(18,140,4,17,'#695140');r(63,140,4,17,'#695140');r(18,127,50,7,'#e4cfa2');l(23,131,38,128,'#958467');l(38,128,51,132,'#958467');o(193,145,18,15,'#b4a17a');}
  if(tier===1){room(10,48,220,86);diagram(174,72,39);scrolls(20,80,3,3);desk(168,137,52);}
  if(tier===2){for(const x of [19,56,177,214])column(x,60,77);r(13,53,220,8,trim);diagram(172,85,47);desk(16,136,49);desk(171,136,49);r(78,53,84,6,stone);}
  if(tier===3){grandHall();scrolls(13,65,5,5);diagram(175,78,47);desk(174,131,46);o(179,112,28,28,trim);o(182,115,22,22,theme[0]);l(193,112,193,140,trim);}
  if(tier===4){grandHall();scrolls(9,64,5,5);scrolls(183,64,5,5);diagram(16,118,43);diagram(181,118,43);l(77,174,120,144,trim);l(120,144,164,174,trim);l(77,174,164,174,trim);}
 }
 if(figure==='cleomenes'){
  if(tier===0){room(168,79,59,55,true);r(12,102,61,5,'#9b7852');for(const x of [16,65])r(x,107,3,28,'#695140');poly([[10,102],[18,88],[70,88],[77,102]],'#b9a575');sack(19,141);sack(40,147);}
  if(tier===1){room(8,58,80,78,true);room(159,46,73,90,true);for(const [x,y]of [[14,139],[32,146],[54,137],[186,142],[205,149]])sack(x,y);desk(169,120,44);}
  if(tier===2){room(12,47,216,89,true);column(21,59,75);column(210,59,75);scrolls(25,78,3,3);desk(172,125,48);sack(176,146);sack(203,149);}
  if(tier===3){grandHall();r(0,114,14,22,'#426e69');r(228,114,12,22,'#426e69');room(3,90,37,45);room(200,90,37,45);sack(14,146);sack(207,146);desk(173,128,47);}
  if(tier===4){grandHall();for(const x of [18,195]){r(x,91,27,43,'#8f7950');r(x+3,94,21,36,trim);for(let y=100;y<129;y+=9)r(x+7,y,13,2,'#efd99c');}r(83,142,74,38,'#4d6044');for(let y=147;y<180;y+=8)r(90,y,60,2,trim);desk(171,144,50);sack(12,149);sack(213,149);}
  if(tier<4){l(189,107,189,128,'#695140',2);l(178,109,202,109,'#695140');l(178,109,174,120,'#9b7852');l(202,109,207,120,'#9b7852');l(170,121,183,121,trim,2);l(201,121,213,121,trim,2);}
 }
 if(tier>=2){
  const ring=(radius,color)=>{for(let i=0;i<48;i++){const a=i*Math.PI/24,b=(i+1)*Math.PI/24;l(Math.round(119+Math.cos(a)*radius),Math.round(65+Math.sin(a)*radius),Math.round(119+Math.cos(b)*radius),Math.round(65+Math.sin(b)*radius),color);}};
  ring(37,theme[1]);if(tier>=3)ring(43,trim);
  for(const [x,y]of [[15,25],[221,31],[43,113],[204,154]]){r(x,y-2,1,5,trim);r(x-2,y,5,1,trim);}
 }
 return true;
}
