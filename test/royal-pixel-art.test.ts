import test from 'node:test';
import assert from 'node:assert/strict';
import {ROYAL_GLYPHS,ROYAL_LETTERS,ROYAL_PIXELS,ROYAL_SIZE} from '../client/homepage/royal-pixel-art.ts';

test('royal capitals share a complete native grid with bounded opaque cells',()=>{
  assert.equal(ROYAL_LETTERS.map(g=>g.letter).join(''),'EVERFOLK');
  for(const glyph of ROYAL_GLYPHS){
    assert.equal(glyph.rows.length,31);
    assert.ok(glyph.rows.every(row=>row.length===glyph.rows[0].length&&/^[01]+$/.test(row)));
  }
  for(const p of ROYAL_PIXELS){
    assert.ok(Number.isInteger(p.x)&&Number.isInteger(p.y));
    assert.ok(p.x>=0&&p.y>=0&&p.x<ROYAL_SIZE.width&&p.y<ROYAL_SIZE.height);
  }
  const patina=ROYAL_PIXELS.filter(p=>p.shade===8||p.shade===9).length/ROYAL_PIXELS.length;
  assert.ok(patina>0&&patina<.05,'weathering must leave the central metal readable');
});

test('every assembly cohort spans the entire inscription rather than typing letters in order',()=>{
  for(let batch=0;batch<16;batch++)assert.ok(ROYAL_LETTERS.every(g=>g.pixels.some(p=>p.batch===batch)));
});
