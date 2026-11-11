/** A software surface shader for the Mediterranean bay of Rhakotis (350 BCE).
 * Two stage pixels per sample, nearest-neighbour output.
 * Perspective-foreshortened horizontal wave trains with organic phase undulation
 * and cross-envelope modulation produce natural scalloped 3D wave crests without
 * diagonal stripe artifacts, driving Fresnel sky reflection, subsurface wave-crest
 * jade translucency, shallow limestone shelf refraction, and dawn sun shimmer.
 */
export const DAWN_SUN = { x: 574, y: 151, horizon: 170 } as const;
export function quayEdge(y: number) {
  return y < 228 ? 501 - (y - 177) * .6 : y < 283 ? 470 + (y - 228) * .13 : 477 + (y - 283) * 1.23;
}

export function createDawnWater() {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 155;
  const c = canvas.getContext('2d')!;
  const image = c.createImageData(384, 155), pixels = image.data;
  const count = 384 * 155;
  const shallow = new Float32Array(count);
  const shoalFoam = new Float32Array(count);
  const sunMask = new Float32Array(count);
  const baseR = new Float32Array(count), baseG = new Float32Array(count), baseB = new Float32Array(count);
  const bedNoise = new Float32Array(count);
  const azimuthGlow = new Float32Array(384);
  const mod1 = new Float32Array(384), env1 = new Float32Array(384), dMod1 = new Float32Array(384);
  const mod2 = new Float32Array(384), env2 = new Float32Array(384), dMod2 = new Float32Array(384);
  const mod3 = new Float32Array(384), env3 = new Float32Array(384);

  for (let x = 0; x < 384; x++) {
    const sunDx = (x * 2 - DAWN_SUN.x) / 175;
    azimuthGlow[x] = Math.exp(-sunDx * sunDx);
  }

  for (let y = 0; y < 155; y++) {
    const depth = y / 155;
    // Perspective grazing factor: 1 at horizon, 0 at near foreground.
    const horizonMix = Math.pow(1 - depth, 2.0);
    const stageY = y * 2 + 170;
    const edge = quayEdge(stageY);
    for (let x = 0; x < 384; x++) {
      const i = y * 384 + x;
      const stageX = x * 2;
      const distance = Math.max(0, edge - stageX);
      // Smooth limestone shelf along the eastern quay and western breakwater (no hard step seams).
      const quayShelf = stageY >= 178 ? Math.exp(-distance / 30) * Math.min(1, (stageY - 174) / 14) : 0;
      const westBlend = stageY >= 240 && stageY <= 295 ? Math.exp(-Math.pow((stageY - 268) / 18, 2)) : 0;
      const westShelf = westBlend * Math.exp(-Math.max(0, stageX - 95) / 36) * 0.42;
      const northRamp = Math.max(0, Math.min(1, (stageX - 240) / 160));
      const headlandShelf = Math.exp(-y / 6.0) * northRamp * 0.36;
      const shelf = Math.min(1, quayShelf + westShelf + headlandShelf);
      shallow[i] = shelf;
      shoalFoam[i] = stageY >= 196 && distance > 0 && distance < 10 ? Math.exp(-distance / 4.2) : 0;

      // Physical occlusion of direct sun glitter by the Rhakotis peninsula:
      // The sun at x=574 shines directly across the upper horizon channel (stageY < 192)
      // and grazes diagonally into the open bay (stageX < 475), while the peninsula casts
      // a calm leeward shadow over the water immediately below its western sea-wall.
      const sunCenterX = DAWN_SUN.x - depth * 170;
      const sunWidth = 46 + y * 1.15;
      const sunDx = (stageX - sunCenterX) / sunWidth;
      const rawSunColumn = Math.exp(-sunDx * sunDx);
      const leewardOcclusion = stageY > 192
        ? Math.max(0, Math.min(1, (distance - 18) / 85)) * Math.exp(-depth * 1.35)
        : 1.0;
      sunMask[i] = rawSunColumn * leewardOcclusion;

      // Rich Mediterranean sapphire-to-turquoise depth gradient with warm golden-rose horizon Fresnel.
      const sunWarmth = azimuthGlow[x] * (0.22 + 0.62 * horizonMix);
      const deepR = 17 + (1 - depth) * 25 + horizonMix * 64 + sunWarmth * 54;
      const deepG = 60 + (1 - depth) * 48 + horizonMix * 56 + sunWarmth * 36;
      const deepB = 82 + (1 - depth) * 46 + horizonMix * 36 + sunWarmth * 12;

      baseR[i] = deepR + shelf * 24;
      baseG[i] = deepG + shelf * 38;
      baseB[i] = deepB + shelf * 18;

      // Deterministic multi-scale sandy-limestone seabed ripple pattern.
      const bx = Math.floor(stageX / 8), by = Math.floor(stageY / 5);
      const h1 = ((Math.imul(bx, 73856093) ^ Math.imul(by, 19349663)) >>> 0) % 19 - 9;
      const h2 = ((Math.imul(bx >> 1, 83492791) ^ Math.imul(by >> 1, 2971215073)) >>> 0) % 11 - 5;
      bedNoise[i] = (h1 * 0.65 + h2 * 0.35) * shelf * 0.16;
    }
  }

  function draw(time: number) {
    // Horizontal wave-crest undulation & amplitude envelopes (breaks crests into natural horizontal segments)
    for (let x = 0; x < 384; x++) {
      const a1 = x * 0.048 - time * 0.38;
      const a2 = x * 0.082 + time * 0.31;
      mod1[x] = Math.sin(a1) * 1.15 + Math.cos(a2) * 0.65;
      dMod1[x] = Math.cos(a1) * 0.55 - Math.sin(a2) * 0.42;
      env1[x] = 0.62 + 0.38 * Math.sin(x * 0.068 + time * 0.44);

      const b1 = x * 0.062 + time * 0.34;
      const b2 = x * 0.105 - time * 0.46;
      mod2[x] = Math.sin(b1) * 1.05 - Math.cos(b2) * 0.60;
      dMod2[x] = Math.cos(b1) * 0.52 + Math.sin(b2) * 0.45;
      env2[x] = 0.60 + 0.40 * Math.cos(x * 0.076 - time * 0.39);

      const c1 = x * 0.145 - time * 0.62;
      mod3[x] = Math.sin(c1) * 0.95 + Math.cos(x * 0.21 + time * 0.52) * 0.55;
      env3[x] = 0.55 + 0.45 * Math.sin(x * 0.118 + time * 0.58);
    }

    for (let y = 0; y < 155; y++) {
      const depth = y / 155;
      // Perspective foreshortening: horizontal wave crests pack tightly near the horizon and broaden in the foreground.
      const perspY = Math.pow(depth + 0.035, 0.52) * 168;
      const phase1 = perspY * 0.92 + time * 0.88;
      const phase2 = perspY * 0.68 - time * 0.64;
      const phase3 = perspY * 1.55 + time * 1.18;

      const fresnel = 0.24 + 0.66 * Math.pow(1 - depth, 1.7);
      const ampScale = 0.52 + depth * 0.58;

      for (let x = 0; x < 384; x++) {
        const i = y * 384 + x, k = i << 2;
        const shelf = shallow[i];

        // Horizontally oriented wave trains with organic undulation and segmented envelopes
        const p1 = phase1 + mod1[x];
        const p2 = phase2 + mod2[x];
        const p3 = phase3 + mod3[x];

        const swell1 = Math.sin(p1) * env1[x];
        const swell2 = Math.sin(p2) * env2[x];
        const chop = Math.sin(p3) * env3[x];

        const height = (swell1 * 0.52 + swell2 * 0.34 + chop * 0.14) * ampScale;
        // 2D surface normal slopes (dH/dx and dH/dy)
        const slopeY = (Math.cos(p1) * env1[x] * 0.54 + Math.cos(p2) * env2[x] * 0.34) * ampScale;
        const slopeX = (Math.cos(p1) * dMod1[x] * 0.48 + Math.cos(p2) * dMod2[x] * 0.36);

        // Trochoidal wave-crest sharpening: crests peak crisply while troughs stay broad and calm.
        const crestPeak = Math.max(0, height + chop * 0.18 - 0.10);
        const crestSharp = crestPeak * crestPeak * 1.35;
        const trough = Math.min(0, height - 0.06);

        // Subsurface scattering (SSS): sunlit wave crests glow warm turquoise-jade; troughs deepen to cobalt.
        const sss = (crestPeak * 0.62 + crestSharp * 0.52) * (0.56 + shelf * 0.44);

        // Refracted dawn sun shimmer (respecting peninsula occlusion via sunMask).
        const sMask = sunMask[i];
        const sunFacet = Math.max(0, (height + slopeY * 0.35 + chop * 0.22 - 0.16) * 1.75);
        const goldEnv = sMask * (0.06 + sunFacet * 0.48) * (0.55 + fresnel * 0.55);

        // Crisp pixel-art specular diamond glints on steep wave crests within the sun path.
        const steepCrest = Math.max(0, (crestPeak - 0.34) * 3.2) * Math.max(0, chop + 0.25);
        const glint = sMask * steepCrest * 42;

        // Shallow-water caustic network where horizontal wave trains converge over the limestone shelf.
        const caustic = Math.max(0, 1 - Math.abs(swell1 - swell2) * 4.5) * shelf * (10 + crestPeak * 6);

        // Gentle shoreline swash along the cut-stone quay edge.
        const swash = shoalFoam[i] * Math.max(0, swell1 + chop * 0.45) * 15;

        // Combine directional wave normal shading, SSS jade glow, seabed refraction, and caustics.
        const waveR = height * 6.8 + slopeY * 4.2 + slopeX * 2.2 + chop * 1.6 + trough * 10 + sss * 10 + crestSharp * 9;
        const waveG = height * 9.5 + slopeY * 5.4 + slopeX * 2.6 + chop * 2.1 + trough * 13 + sss * 24 + crestSharp * 15;
        const waveB = height * 8.2 + slopeY * 4.6 + slopeX * 2.2 + chop * 1.8 + trough * 11 + sss * 19 + crestSharp * 13;

        const bed = bedNoise[i];
        let r = baseR[i] + waveR + bed + caustic * 0.90 + swash * 0.85;
        let g = baseG[i] + waveG + bed * 0.95 + caustic * 0.92 + swash * 0.92;
        let b = baseB[i] + waveB + bed * 0.65 + caustic * 0.65 + swash * 0.85;

        // Golden sun reflection & champagne glints.
        r += (253 - r) * goldEnv + glint;
        g += (219 - g) * goldEnv + glint * 0.92;
        b += (152 - b) * goldEnv + glint * 0.70;

        pixels[k] = r < 0 ? 0 : r > 255 ? 255 : r;
        pixels[k + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        pixels[k + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        pixels[k + 3] = 255;
      }
    }
    c.putImageData(image, 0, 0);
    return canvas;
  }

  return {
    draw,
    dispose() {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}
