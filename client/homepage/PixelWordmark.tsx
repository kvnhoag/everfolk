import { useId } from 'react';
import { WORDMARK_ART, WORDMARK_WIDTH, WORDMARK_HEIGHT, wordmarkPixelPath } from './pixel-wordmark.ts';

/** Native pixel geometry only: no SVG text, web font or text-gradient mask. */
export default function PixelWordmark() {
  const clip=useId().replaceAll(':','')+'-jewels';
  return <svg className="ef-pixel-wordmark" viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <defs><clipPath id={clip}>{WORDMARK_ART.map(g=><path key={g.letter} d={g.silhouette}/>)}</clipPath></defs>
    <g fill="#162c35">{WORDMARK_ART.map(g=><path key={g.letter} d={g.shadow}/>)}</g>
    <g fill="#28333d">{WORDMARK_ART.map(g=><path key={g.letter} d={g.outline}/>)}</g>
    {Array.from({length:12},(_,batch)=><g key={batch} className="ef-logo-pixel-batch">
      {WORDMARK_ART.flatMap((glyph,i)=>glyph.palette.map((color,shade)=><path key={`${i}-${shade}`} fill={color} d={wordmarkPixelPath(glyph.cells.filter(c=>c.batch===batch&&c.shade===shade))}/>))}
    </g>)}
    <g clipPath={`url(#${clip})`}><path className="ef-logo-reflection" d="M-25 0h3l-12 30h-3zM-19 0h1l-12 30h-1z" fill="#fff8dc" opacity="0"/></g>
    <g fill="#e9d4a0"><path d="M112 21h3v3h-3z"/><path d="M112 21h2v1h-2z" fill="#fff0c3"/></g>
    <g className="ef-logo-inlay" fill="#e8e2b0"><path d="M6 1h1v3H6zM5 2h3v1H5zM64 27h12v1H64zM79 25h1v3h-1zM78 26h3v1h-3z"/></g>
  </svg>;
}
