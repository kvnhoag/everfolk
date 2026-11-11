/** A small software surface shader. Two stage pixels per sample, nearest-neighbour output.
 * Analytic wave slopes drive the same glints, refraction and reflection displacement.
 * Caustics are a stylized convergence mask, not a ray-traced fluid simulation.
 */
export const DAWN_SUN = { x: 574, y: 151, horizon: 170 } as const;
export function quayEdge(y: number) {
  return y < 228 ? 501 - (y - 177) * .6 : y < 283 ? 470 + (y - 228) * .13 : 477 + (y - 283) * 1.23;
}

export function createDawnWater() {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 155;
  const c = canvas.getContext('2d')!;
  const image = c.createImageData(384,155), pixels = image.data;
  const shallow = new Float32Array(384*155), red = new Float32Array(shallow.length), green = new Float32Array(shallow.length), blue = new Float32Array(shallow.length);
  const sinA = new Float32Array(384), cosA = new Float32Array(384), sinB = new Float32Array(384), cosB = new Float32Array(384);
  const sinC = new Float32Array(384), cosC = new Float32Array(384);
  for (let y=0;y<155;y++) for (let x=0;x<384;x++) {
    const i=y*384+x, depth=y/155, distance=Math.max(0,quayEdge(y*2+170)-x*2);
    const shelf=Math.exp(-distance/29); shallow[i]=shelf;
    // Cooler deep teal and a transparent turquoise shelf over a warm sandy bottom.
    red[i]=66-depth*36+shelf*22; green[i]=137-depth*47+shelf*35; blue[i]=147-depth*43+shelf*20;
  }
  function draw(time: number) {
    for(let x=0;x<384;x++) {
      const a=x*.097-time*.63,b=x*.167+time*.41;
      sinA[x]=Math.sin(a);cosA[x]=Math.cos(a);sinB[x]=Math.sin(b);cosB[x]=Math.cos(b);
      sinC[x]=Math.sin(x*.383-time*.77);cosC[x]=Math.cos(x*.383-time*.77);
    }
    for(let y=0;y<155;y++) {
      const v=y*2, depth=y/155;
      const phase=y*.48+time*.72, p2=y*.277-time*.48;
      const sy=Math.sin(phase),cy=Math.cos(phase),s2=Math.sin(p2),c2=Math.cos(p2);
      const s3=Math.sin(y*.917+time*.82),c3=Math.cos(y*.917+time*.82);
      const width=13+v*.48;
      for(let x=0;x<384;x++) {
        const i=y*384+x,k=i*4;
        const swell=sinA[x]*cy+cosA[x]*sy;
        const chop=sinB[x]*c2+cosB[x]*s2;
        const slope=(cosA[x]*cy-sinA[x]*sy)*.65+(cosB[x]*c2-sinB[x]*s2)*.35;
        const normal=swell*.65+chop*.35;
        const capillary=sinC[x]*c3+cosC[x]*s3;
        // Broken sun glitter broadens toward the viewer, rather than scrolling a texture.
        const dx=(x*2-DAWN_SUN.x+slope*(7+depth*15))/width;
        const lobe=1/(1+dx*dx*dx*dx);
        const crest=Math.max(0,(normal+capillary*.22-.32)*1.6);
        const gold=lobe*(.06+crest*.58);
        const caustic=Math.max(0,1-Math.abs(swell-chop)*6)*shallow[i]*13;
        // Refract a coarse sandy-bottom pattern using the surface slope. Only the shelf
        // transmits it; the deeper sea stays opaque and saturated.
        const bedX=Math.floor((x*2+slope*3)/10),bedY=Math.floor((y*2+normal*2)/6);
        const bed=((Math.imul(bedX,73856093)^Math.imul(bedY,19349663))>>>0)%17-8;
        const transmitted=shallow[i]*.18;
        const waveShade=normal*5+slope*2+capillary*1.8;
        const glint=lobe*(Math.max(0,(slope-.68)*3)*Math.max(0,chop)*39+Math.max(0,(capillary-.88)*8)*Math.max(0,normal)*44);
        pixels[k]=red[i]+waveShade+(247-red[i])*gold+caustic+glint+(169+bed-red[i])*transmitted;
        pixels[k+1]=green[i]+waveShade+(211-green[i])*gold+caustic+glint+(177+bed-green[i])*transmitted;
        pixels[k+2]=blue[i]+waveShade+(145-blue[i])*gold+caustic*.65+glint*.7+(128+bed-blue[i])*transmitted;
        pixels[k+3]=255;
      }
    }
    c.putImageData(image,0,0);
    return canvas;
  }
  return { draw, dispose(){canvas.width=0;canvas.height=0;} };
}
