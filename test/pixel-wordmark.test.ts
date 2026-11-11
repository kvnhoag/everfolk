import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDMARK_ART,WORDMARK_GLYPHS,WORDMARK_WIDTH,WORDMARK_HEIGHT } from '../client/homepage/pixel-wordmark.ts';
import { drawMeteor,meteorPhase,METEOR_DURATION } from '../client/homepage/meteor-scene.ts';

test('custom glyph artwork stays on an integer grid inside its native canvas',()=>{
  assert.equal(WORDMARK_ART.map(g=>g.letter).join(''),'Everfolk');
  assert.equal(new Set(WORDMARK_ART.map(g=>g.palette[2])).size,8);
  for(const glyph of WORDMARK_GLYPHS) assert.ok(glyph.rows.every(row=>row.length===glyph.rows[0].length));
  for(const glyph of WORDMARK_ART)for(const cell of glyph.cells){
    assert.ok(Number.isInteger(cell.x)&&Number.isInteger(cell.y));
    assert.ok(cell.x>=1&&cell.x+2<WORDMARK_WIDTH&&cell.y>=1&&cell.y+4<WORDMARK_HEIGHT);
  }
  assert.ok(WORDMARK_ART.every(g=>g.cells.length>35));
});

test('pixel illumination cohorts span the whole word instead of revealing letters in typing order',()=>{
  for(let batch=0;batch<12;batch++)assert.ok(WORDMARK_ART.every(g=>g.cells.some(c=>c.batch===batch)));
});

test('meteor covers the entire old scene before the city is swapped and eventually completes',()=>{
  const fills:{x:number;y:number;w:number;h:number;alpha:number;color:unknown}[]=[];
  const context={globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,clearRect(){},beginPath(){},ellipse(){},stroke(){},
    fillRect(x:number,y:number,w:number,h:number){fills.push({x,y,w,h,alpha:this.globalAlpha,color:this.fillStyle});}};
  assert.equal(drawMeteor(context as unknown as CanvasRenderingContext2D,6.5,768,480),'covered');
  assert.ok(fills.some(r=>r.x<=0&&r.y<=0&&r.w>=768&&r.h>=480&&r.alpha>=.8&&r.color==='#fff6dc'));
  assert.equal(meteorPhase(2),'descent');assert.equal(meteorPhase(5.4),'impact');assert.equal(meteorPhase(8),'reveal');
  assert.equal(meteorPhase(METEOR_DURATION),'complete');
});
