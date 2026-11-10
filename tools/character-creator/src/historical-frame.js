/** Historical identity is independent of rarity; NPCs never use these frames. */
export const FIGURE_DESIGN = Object.freeze({
 alexander:{frame:'royal-laurel',scene:'alexander-city',motif:'spear-and-laurel'},
 aristotle:{frame:'lyceum-scroll',scene:'aristotle-lyceum',motif:'scroll-and-ionic-capital'},
 euclid:{frame:'museum-geometry',scene:'euclid-museum',motif:'triangle-and-circle'},
 cleomenes:{frame:'granary-wheat',scene:'cleomenes-granary',motif:'wheat-and-granary'}
});
export function drawHistoricalFrame(ctx,figure,accent){
 if(!FIGURE_DESIGN[figure])return;
 const r=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);},gold='#d6aa52',light='#f1d889',shade='#8b5d35';
 // Architectural picture frame: carved gold uprights and a stepped pediment.
 for(const x of [18,444]){r(x,81,18,405,shade);r(x+3,83,12,400,gold);r(x+3,83,3,400,light);r(x+13,83,2,400,shade);r(x-5,76,28,8,gold);r(x-7,72,32,4,light);r(x-4,484,26,7,shade);r(x-6,491,30,5,gold);}
 r(32,66,416,6,shade);r(39,62,402,5,gold);r(53,59,374,3,light);r(31,494,418,5,gold);r(35,499,410,2,shade);
 // Each figure's silhouette and carved relief is a separate design rule.
 for(const x of [25,451])for(let y=104;y<465;y+=36){
  if(figure==='alexander'){r(x,y,3,17,shade);r(x-3,y+2,3,4,light);r(x+3,y+8,3,4,light);r(x-3,y+13,3,4,light);}
  if(figure==='aristotle'){r(x-3,y,9,3,light);r(x-4,y+3,3,5,shade);r(x+4,y+3,3,5,shade);r(x-1,y+7,4,13,shade);}
  if(figure==='euclid'){r(x-4,y,11,12,shade);r(x-2,y+2,7,8,gold);r(x,y+4,3,4,light);r(x,y+12,3,9,shade);}
  if(figure==='cleomenes'){r(x,y,2,22,shade);for(let n=0;n<3;n++){r(x-4,y+n*6,4,3,light);r(x+2,y+3+n*6,4,3,light);}}
 }
 // Crest sits above the portrait, leaving face and props unobscured.
 r(217,56,46,31,shade);r(220,58,40,27,gold);r(224,61,32,21,'#29252a');
 if(figure==='alexander'){r(239,61,2,20,light);r(236,64,8,4,light);for(let i=0;i<3;i++){r(228-i,65+i*5,3,3,gold);r(249+i,65+i*5,3,3,gold);}}
 if(figure==='aristotle'){r(229,65,22,14,light);r(226,63,5,18,gold);r(249,63,5,18,gold);r(234,69,12,2,shade);r(234,73,10,2,shade);}
 if(figure==='euclid'){for(let y=0;y<15;y++){r(239-Math.floor(y/2),64+y,2,1,light);r(239+Math.floor(y/2),64+y,2,1,light);}r(232,78,16,2,light);r(238,69,4,4,gold);}
 if(figure==='cleomenes'){r(239,64,2,17,light);for(let n=0;n<3;n++){r(234,64+n*5,5,3,gold);r(241,66+n*5,5,3,gold);}r(230,80,20,2,gold);}
 // Rarity can recolor the inset seam, never erase the historical gold structure.
 r(39,87,2,400,accent);r(439,87,2,400,accent);
}
