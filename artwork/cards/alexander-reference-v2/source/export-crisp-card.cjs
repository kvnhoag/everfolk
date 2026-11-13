// Keep the portrait's pixel grid exact while retaining ArtCraft vector typography.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const project = path.resolve(root, '../../..');
const projectRequire = createRequire(path.join(project, 'package.json'));
const sharp = createRequire(projectRequire.resolve('next/package.json'))('sharp');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function main() {
  const basePath = path.join(root, 'qa/card-base.png');
  const overlayPath = path.join(root, 'qa/card-overlay.png');
  const portraitPath = path.join(root, 'assets/alexander-card-pixel.png');
  const portraitHash = sha(portraitPath);
  const finalPath = path.join(root, 'review/Alexander-The-Great-card.png');
  const nativeCopy = path.join(root, 'qa/VectorCraft-native-export.png');
  if (!fs.existsSync(nativeCopy)) fs.copyFileSync(finalPath, nativeCopy);
  const base = await sharp(basePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const overlay = await sharp(overlayPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const portrait = await sharp(portraitPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (base.info.width !== 900 || base.info.height !== 1260 || overlay.info.width !== 900 || overlay.info.height !== 1260 || portrait.info.width !== 840 || portrait.info.height !== 1050) throw new Error('Unexpected export geometry');
  // Native artwork window is an 840×1050 rounded rectangle, radius10.
  // Apply its corner clipping only; never interpolate any interior art pixel.
  const masked = Buffer.from(portrait.data), radius = 10;
  for (let y = 0; y < 1050; y++) for (let x = 0; x < 840; x++) {
    const cx = Math.max(radius, Math.min(840 - radius, x + 0.5));
    const cy = Math.max(radius, Math.min(1050 - radius, y + 0.5));
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > radius ** 2) masked[(y * 840 + x) * 4 + 3] = 0;
  }
  const png = await sharp(base.data, { raw: { width: 900, height: 1260, channels: 4 } })
    .composite([{ input: masked, raw: { width: 840, height: 1050, channels: 4 }, left: 30, top: 30 },
      { input: overlay.data, raw: { width: 900, height: 1260, channels: 4 }, left: 0, top: 0 }]).png().toBuffer();
  const final = await sharp(png).ensureAlpha().raw().toBuffer();
  let checked = 0, differences = 0, maxDifference = 0;
  for (let y = 0; y < 1050; y++) for (let x = 0; x < 840; x++) {
    const sourceOffset = (y * 840 + x) * 4, destination = ((y + 30) * 900 + x + 30) * 4;
    if (masked[sourceOffset + 3] !== 255 || overlay.data[destination + 3] !== 0) continue;
    checked++;
    for (let c = 0; c < 3; c++) { const difference = Math.abs(final[destination + c] - portrait.data[sourceOffset + c]); if (difference) differences++; maxDifference = Math.max(maxDifference, difference); }
  }
  if (differences || checked < 700000) throw new Error(`Crisp export failed: ${checked} pixels, ${differences} differing channels`);
  const corners = [0, 899 * 4, 1259 * 900 * 4, (1260 * 900 - 1) * 4].map(i => final[i + 3]);
  if (corners.some(alpha => alpha)) throw new Error('Outer corners must stay transparent');
  fs.writeFileSync(finalPath, png);
  const thumbnail = path.join(root, 'review/Alexander-The-Great-card-450.png');
  await sharp(png).resize(450, 630, { kernel: 'nearest' }).png().toFile(thumbnail);
  const qa = { method: 'ArtCraft base + original pixel art at100% + ArtCraft transparent vector/text overlay',
    final: finalPath, finalSha256: sha(finalPath), portraitSha256: sha(portraitPath),
    nativeIntermediate: nativeCopy, nativeIntermediateSha256: sha(nativeCopy),
    portraitPixelsChecked: checked, differingChannels: differences, maxChannelDifference: maxDifference,
    transparentCornerAlpha: corners, artPosition: [30, 30], artSize: [840, 1050], clippingRadius: radius,
    interpolatingResize: false, thumbnailKernel: 'nearest', sourcePortraitUnchanged: sha(portraitPath) === portraitHash };
  fs.writeFileSync(path.join(root, 'qa/final-crisp-export.json'), JSON.stringify(qa, null, 2));
  console.log(JSON.stringify({ final: finalPath, checked, differences, maxDifference, corners }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
