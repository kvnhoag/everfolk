import { useId } from 'react';
import { ROYAL_SIZE,ROYAL_LETTERS,ROYAL_PIXELS,ROYAL_COLORS,pixelPath,cellPath } from './royal-pixel-art.ts';

/** A bitmap inscription and a symbolic portrait; neither is a village simulation object. */
export default function RoyalPixelWordmark({sculptureHref='/assets/brand/alexander-royal-pixel.png'}:{sculptureHref?:string}) {
  const id=useId().replaceAll(':','')+'-royal';
  return <svg xmlns="http://www.w3.org/2000/svg" className="ef-royal-wordmark" viewBox={`0 0 ${ROYAL_SIZE.width} ${ROYAL_SIZE.height}`} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <defs>
      <clipPath id={`${id}-metal`}><path d={pixelPath(ROYAL_PIXELS)}/></clipPath>
      <linearGradient id={`${id}-light`}><stop stopColor="#fff4cb" stopOpacity="0"/><stop offset=".5" stopColor="#fff4cb" stopOpacity=".68"/><stop offset="1" stopColor="#fff4cb" stopOpacity="0"/></linearGradient>
    </defs>
    {/* A small papyrus/book seal, laurel fronds and time star share the inscription grid. */}
    <g className="ef-logo-emblem">
      <path fill="#735a35" d="M92 18h9v1h4v1h4v-1h4v-1h9v11h-9v1h-4v1h-4v-1h-4v-1h-9z"/>
      <path fill="#ddbf7d" d="M93 17h8v1h4v1h4v-1h4v-1h8v10h-8v1h-4v1h-4v-1h-4v-1h-8z"/>
      <path fill="#fff0b8" d="M94 17h7v1h4v1h-4v-1h-7zM113 17h7v1h-7v1h-4v-1h4zM106 20h1v8h-1z"/>
      <path fill="#947744" d="M95 20h5v1h-5zM95 23h5v1h-5zM101 21h3v1h-3zM101 24h3v1h-3zM114 20h5v1h-5zM114 23h5v1h-5zM110 21h3v1h-3zM110 24h3v1h-3z"/>
      <path fill="#f2d697" d="M106 5h1v4h2v1h-2v4h-1v-4h-2V9h2zM78 17h1v2h-1zM136 17h1v2h-1z"/>
      <path fill="#746b3d" d="M85 29h2v1h4v1h5v1h-5v-1h-4v-1h-2zM84 28h1v-4h-1zM82 24h2v-4h-2zM126 29h2v1h-4v1h-5v1h5v-1h4v-1h2v-1zM130 28h1v-4h-1zM131 24h2v-4h-2z"/>
      <path fill="#b1a466" d="M81 25h3v2h-3zM79 21h3v2h-3zM80 17h2v3h-2zM85 21h2v4h-2zM86 26h3v2h-3zM89 29h3v1h-3zM131 25h3v2h-3zM133 21h3v2h-3zM133 17h2v3h-2zM128 21h2v4h-2zM126 26h3v2h-3zM123 29h3v1h-3z"/>
      <path fill="#dfc780" d="M80 21h2v1h-2zM82 25h2v1h-2zM85 21h1v2h-1zM132 25h2v1h-2zM134 21h2v1h-2zM128 21h1v2h-1z"/>
      <path fill="#705b36" d="M9 25h54v1H9zM151 25h48v1h-48z"/>
      <path fill="#a58a50" d="M17 24h38v1H17zM159 24h32v1h-32zM9 23h1v5H9zM198 23h1v5h-1z"/>
    </g>
    <g className="ef-logo-carving">
      <path fill="#112b31" d={ROYAL_LETTERS.map(g=>cellPath(g.shadow)).join('')}/>
      <path fill="#4a452e" d={ROYAL_LETTERS.map(g=>cellPath(g.border)).join('')}/>
      {Array.from({length:16},(_,batch)=><g className="ef-royal-pixel-batch" key={batch}>
        {ROYAL_COLORS.map((color,shade)=><path key={shade} fill={color} d={pixelPath(ROYAL_PIXELS.filter(p=>p.batch===batch&&p.shade===shade))}/>)}
      </g>)}
      <g clipPath={`url(#${id}-metal)`}><path className="ef-logo-reflection" d="M-46 35h21l-12 37h-21z" fill={`url(#${id}-light)`} opacity="0"/></g>
    </g>
    {/* A low relief footer: broken brass edges, a restrained meander and inset malachite. */}
    <g fill="#806437"><path d="M9 77h80v1H9zM124 77h75v1h-75zM8 73h1v7h9v-1h-8zM199 73h1v7h-9v-1h8zM101 78h3v-2h3v-2h1v2h3v2h3v1h-3v2h-7v-2h-3z"/></g>
    <g fill="#d7b775"><path d="M16 76h63v1H16zM134 76h57v1h-57zM105 77h5v2h-5zM15 73h11v1h-4v2h-1v-2h-6zM182 73h10v1h-5v2h-1v-2h-4z"/></g>
    <path fill="#507561" d="M106 77h2v1h-2zM15 77h3v1h-3zM188 77h2v1h-2z"/>
    <g className="ef-royal-sculpture"><image href={sculptureHref} x="211" y="1" width="65" height="82" preserveAspectRatio="xMidYMid meet" style={{imageRendering:'pixelated'}}/></g>
    <g className="ef-royal-dust" fill="#efd18b" opacity="0"><path d="M62 8h1v1h-1zM146 33h1v1h-1zM203 57h1v1h-1zM185 15h1v1h-1z"/></g>
  </svg>;
}
