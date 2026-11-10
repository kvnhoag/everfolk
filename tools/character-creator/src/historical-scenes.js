/** Jewel-toned twilight settings; only the four historical backdrops use this treatment. */
const PALETTES={
 'alexander-city':{'#d9d7b9':'#111b32','#d7c69d':'#192744','#e8c985':'#d4a84f','#a8b493':'#2b3d58','#7caaa0':'#23495e','#b0c7b0':'#577e86','#b7a37b':'#34445b','#d6c39b':'#57657b','#c7b586':'#9f895c','#a18e6b':'#263249','#8e7954':'#a8824b','#a8664b':'#803b51','#cbb58b':'#1c3047','#b39d76':'#3b536a','#dcc99e':'#7d7c78'},
 'aristotle-lyceum':{'#dfe0c1':'#211b36','#bbc39d':'#2d3147','#cbbd95':'#65516e','#b8a47a':'#9e7e62','#efe2ba':'#d9c28d','#b4a17a':'#584663','#e2d5b0':'#aa8e97','#eadfbc':'#d7bb89','#ad9b76':'#6a5467','#a5b18a':'#282d44','#c7cfaa':'#4b5666','#8e7954':'#98704e','#8da47b':'#344b48','#b0bd90':'#738466','#d8c8a0':'#483b55','#bfaf87':'#756282','#b7a37b':'#80654e','#958467':'#4e4351','#f4e8c6':'#d2bb8b'},
 'euclid-museum':{'#29494e':'#0d202d','#527d79':'#173b4b','#c3bc98':'#355569','#9ba98c':'#466e76','#769b91':'#244554','#c6d0a4':'#bbd9be','#b4c494':'#809f92','#bac3a5':'#688b8f','#e0d9b8':'#aec1aa','#9b7852':'#b08e50','#695140':'#735a3b','#395756':'#18333f','#d8c8a0':'#e2c98c','#95b8a3':'#94d1c4','#608b85':'#345b69','#f4e8c6':'#d6c79f'},
 'cleomenes-granary':{'#ded1a7':'#142d2d','#e8c985':'#c9a152','#7d9d8b':'#214f49','#baa376':'#465a4c','#cdb687':'#88906a','#d8c397':'#6a7a5d','#8e7954':'#203b33','#b7a37b':'#a28d59','#c6af81':'#223d36','#e0cca3':'#8d9568','#b39d76':'#3f6153','#a78c5e':'#4e644c','#d8c8a0':'#9fa57a','#e8d5ac':'#c3ba86','#695140':'#aa8647','#9b7852':'#a88c4e','#d6aa52':'#d1b967'}
};
export function drawHistoricalScene(paint,scene){
 if(!['alexander-city','aristotle-lyceum','euclid-museum','cleomenes-granary'].includes(scene))return false;
 const colors=PALETTES[scene],color=c=>colors[c]??c;
 const r=(x,y,w,h,c)=>paint.rect(x,y,w,h,color(c)),l=(x,y,x2,y2,c,w)=>paint.line(x,y,x2,y2,color(c),w),p=(points,c)=>paint.poly(points,color(c)),o=(x,y,w,h,c)=>paint.oval(x,y,w,h,color(c));
 if(scene==='alexander-city'){
  r(0,0,240,190,'#d9d7b9');r(0,0,240,65,'#d7c69d');o(167,18,23,23,'#e8c985');
  p([[0,87],[42,58],[75,77],[123,50],[178,80],[240,64],[240,130],[0,130]],'#a8b493');
  r(0,103,240,45,'#7caaa0');for(let y=110;y<143;y+=9)l(0,y,239,y,'#b0c7b0');
  for(const [x,y,w,h]of [[7,72,42,36],[57,82,28,29],[170,67,57,44]]){r(x,y,w,h,'#b7a37b');r(x+3,y+3,w-6,h-3,'#d6c39b');r(x-3,y-4,w+6,5,'#c7b586');for(let xx=x+8;xx<x+w-3;xx+=11)r(xx,y+8,4,h-8,'#a18e6b');}
  for(const x of [179,198,217]){l(x,46,x,115,'#8e7954',2);l(x-6,53,x+5,53,'#a18e6b');}l(173,53,226,53,'#8e7954',2);l(179,81,217,81,'#8e7954');
  l(29,42,29,110,'#8e7954',2);p([[31,43],[56,43],[50,54],[56,64],[31,64]],'#a8664b');r(36,48,4,11,'#d6aa52');r(33,51,11,4,'#d6aa52');
  r(0,143,240,47,'#cbb58b');for(let y=151;y<190;y+=13)l(0,y,239,y,'#b39d76');for(let x=-50;x<290;x+=40)l(120,135,x,189,'#b39d76');
  r(7,153,47,17,'#c7b586');r(12,149,34,5,'#dcc99e');r(177,155,48,13,'#b7a37b');r(184,150,36,6,'#d6c39b');
 }
 if(scene==='aristotle-lyceum'){
  r(0,0,240,190,'#dfe0c1');r(0,94,240,96,'#bbc39d');
  r(39,32,163,89,'#cbbd95');p([[27,33],[120,11],[214,33]],'#b8a47a');l(39,34,202,34,'#efe2ba',3);
  for(const x of [47,82,151,186]){r(x,43,10,79,'#b4a17a');r(x+2,44,5,76,'#e2d5b0');r(x-4,39,18,5,'#eadfbc');r(x-3,120,16,4,'#ad9b76');}
  r(99,44,41,61,'#a5b18a');r(105,50,29,49,'#c7cfaa');
  for(const x of [15,219]){l(x,83,x+2,148,'#8e7954',4);for(const [dx,dy]of [[-10,0],[9,-10],[-6,-20],[12,11]]){o(x+dx-10,68+dy,25,20,'#8da47b');o(x+dx-6,70+dy,15,12,'#b0bd90');}}
  p([[82,123],[157,123],[211,190],[27,190]],'#d8c8a0');for(let y=136;y<190;y+=16)l(63,y,185,y,'#bfaf87');
  r(171,135,51,7,'#b7a37b');r(177,141,5,19,'#958467');r(211,141,5,19,'#958467');for(const x of [181,192,203]){r(x,125,8,9,'#958467');r(x+1,126,6,7,'#f4e8c6');r(x+2,129,4,1,'#b7a37b');}
 }
 if(scene==='euclid-museum'){
  r(0,0,240,190,'#29494e');r(16,16,208,129,'#527d79');r(52,26,136,107,'#c3bc98');
  p([[76,130],[76,55],[87,37],[120,24],[153,37],[164,55],[164,130]],'#9ba98c');p([[86,130],[86,58],[95,45],[120,36],[145,45],[154,58],[154,130]],'#769b91');
  o(105,49,29,29,'#c6d0a4');r(116,48,5,33,'#b4c494');r(104,61,32,4,'#b4c494');
  for(const x of [28,198]){r(x,30,14,113,'#bac3a5');r(x+3,32,5,108,'#e0d9b8');r(x-4,27,22,6,'#9b7852');r(x-4,138,22,7,'#9b7852');}
  r(170,63,50,46,'#695140');r(174,67,42,38,'#395756');l(180,96,190,73,'#d8c8a0');l(190,73,209,96,'#d8c8a0');l(180,96,209,96,'#d8c8a0');o(181,80,17,17,'#95b8a3');o(183,82,13,13,'#395756');
  r(6,66,45,58,'#695140');for(let y=75;y<120;y+=17){r(9,y,39,3,'#9b7852');for(let x=13;x<45;x+=10){r(x,y-10,7,10,'#d8c8a0');r(x+1,y-8,5,1,'#f4e8c6');}}
  r(0,145,240,45,'#395756');for(let y=151;y<190;y+=12)l(0,y,239,y,'#608b85');for(let x=-60;x<300;x+=38)l(120,138,x,190,'#608b85');
  r(176,133,48,7,'#9b7852');r(180,140,4,22,'#695140');r(215,140,4,22,'#695140');r(181,126,35,7,'#f4e8c6');l(185,130,208,130,'#958467');
 }
 if(scene==='cleomenes-granary'){
  r(0,0,240,190,'#ded1a7');o(187,15,18,18,'#e8c985');r(0,104,240,41,'#7d9d8b');
  for(const [x,y,w,h]of [[4,54,48,75],[58,68,38,61],[169,49,62,81]]){r(x,y,w,h,'#baa376');p([[x-3,y],[x+w/2,y-15],[x+w+3,y]],'#cdb687');r(x+4,y+6,w-8,h-6,'#d8c397');r(x+w/2-7,y+h-31,14,31,'#8e7954');r(x+5,y+8,w-10,3,'#b7a37b');}
  r(0,140,240,50,'#c6af81');l(0,145,239,145,'#e0cca3',3);for(let y=160;y<190;y+=13)l(0,y,239,y,'#b39d76');
  for(const [x,y]of [[12,143],[28,148],[44,140],[189,145],[207,151]]){o(x,y,18,26,'#a78c5e');o(x+2,y+2,14,22,'#d8c8a0');r(x+5,y,8,3,'#8e7954');r(x+5,y+7,2,12,'#e8d5ac');}
  l(188,108,188,133,'#695140',2);l(175,111,201,111,'#695140',2);l(176,111,172,123,'#9b7852');l(176,111,181,123,'#9b7852');l(200,111,195,123,'#9b7852');l(200,111,205,123,'#9b7852');l(170,124,183,124,'#d6aa52',2);l(194,124,207,124,'#d6aa52',2);
  for(let x=59;x<86;x+=5){l(x,155,x,130,'#9b7852');for(let y=132;y<147;y+=5){r(x-3,y,3,2,'#e8c985');r(x+1,y+2,3,2,'#d6aa52');}}
 }
 // Etched celestial halo and sparse luminous dust are behind the sprite.
 // Draw outlines rather than a solid disk, retaining the authored environment.
 const aura={
  'alexander-city':{dim:'#716046',light:'#c8a45e',star:'#efd49a'},
  'aristotle-lyceum':{dim:'#715e87',light:'#bfa8d6',star:'#e4c8f1'},
  'euclid-museum':{dim:'#3f7d87',light:'#8ac6c0',star:'#d1eee0'},
  'cleomenes-granary':{dim:'#64794e',light:'#b6bf7b',star:'#e7d7a1'}
 }[scene];
 const ring=(cx,cy,radius,c)=>{for(let i=0;i<64;i++){const a=i*Math.PI/32,b=(i+1)*Math.PI/32;paint.line(Math.round(cx+Math.cos(a)*radius),Math.round(cy+Math.sin(a)*radius),Math.round(cx+Math.cos(b)*radius),Math.round(cy+Math.sin(b)*radius),c);}};
 ring(119,65,38,aura.dim);ring(119,65,43,aura.dim);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.round(119+Math.cos(a)*43),y=Math.round(65+Math.sin(a)*43);paint.rect(x-1,y-1,3,3,aura.light);}
 for(const [x,y]of [[17,22],[43,41],[202,26],[223,58],[58,99],[190,118],[25,133],[214,153]]){paint.rect(x,y-2,1,5,aura.star);paint.rect(x-2,y,5,1,aura.star);}
 for(let i=0;i<18;i++)paint.rect(9+(i*47)%221,19+(i*31)%138,1,1,aura.dim);
 if(scene==='euclid-museum'){paint.line(85,88,119,23,aura.light);paint.line(119,23,153,88,aura.light);paint.line(85,88,153,88,aura.light);}
 return true;
}
