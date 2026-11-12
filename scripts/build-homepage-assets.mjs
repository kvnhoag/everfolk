// Derive small, independently animated sprites from Everfolk's editable pixel masters.
// No flattened hero image and no external artwork are used.
import { createBannerLayers } from './banner-art-scenes.mjs';
import { createActorLayers } from './banner-art-actors.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const harbor = createBannerLayers('harbor');
const music = createBannerLayers('music');

const crop = rects => {
  const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y));
  return {
    width: Math.max(...rects.map(r => r.x + r.w)) - x,
    height: Math.max(...rects.map(r => r.y + r.h)) - y,
    pixels: rects.map(r => [r.x - x, r.y - y, r.w, r.h, r.fill]),
  };
};

const ship = harbor[3].rects.filter(r => r.x >= 184 && r.y < 97);
const shipFrames = Array.from({ length: 4 }, (_, frame) => crop(ship.map(r => ({
  ...r,
  // Sail cloth changes in discrete frames; the mast and hull retain their anchors.
  x: r.y >= 26 && r.y < 77 && r.w > 2 ? r.x + [0, 1, 0, -1][frame] : r.x,
}))));

const actors = ['male', 'female'].map((sex, variant) => {
  const layers = createActorLayers('adult', sex, variant, 'standing', 'fishing-household');
  const rects = layers.slice(1).flatMap(l => l.rects);
  const baseline = Math.max(...rects.map(r => r.y + r.h));
  const frames = Array.from({ length: 4 }, (_, frame) => {
    const moving = layers.slice(1).flatMap((layer, index) => layer.rects.map((r, i) => ({
      ...r,
      x: r.x + (r.y > baseline - 7 && (index === 0 || index === 4) ? [0, i % 2 ? 1 : -1, 0, i % 2 ? -1 : 1][frame] : 0),
    })));
    // Use a fixed frame box, so movement never shifts the pivot or silhouette volume.
    const original = crop(rects);
    const minX = Math.min(...rects.map(r => r.x)), minY = Math.min(...rects.map(r => r.y));
    return {
      width: original.width + 4,
      height: original.height + 2,
      pixels: moving.map(r => [r.x - minX + 2, r.y - minY + 1, r.w, r.h, r.fill]),
    };
  });
  return { id: `coastal-${sex}`, frames };
});

const jarPixels = harbor[3].rects.filter(r => r.x >= 127 && r.x < 146 && r.y >= 84 && r.w <= 7);
const festival = {
  garland: crop(music[3].rects.filter(r => r.x >= 133 && r.x < 218 && r.y >= 20 && r.y + r.h <= 28)),
};

const data = {
  version: 2,
  festival,
  shipFrames,
  actors,
  cargo: crop(jarPixels),
  provenance: [
    'scripts/banner-art-scenes.mjs:harbor',
    'scripts/banner-art-scenes.mjs:music',
    'scripts/banner-art-actors.mjs:adult standing',
    'client/PaperScene.tsx:PixelAtmosphere',
  ],
};

await mkdir(new URL('../client/homepage/', import.meta.url), { recursive: true });
await writeFile(new URL('../client/homepage/scene-assets.json', import.meta.url), JSON.stringify(data) + '\n');
console.log(`Homepage assets: ${shipFrames.length} sail frames, ${actors.length * 4} character frames.`);
