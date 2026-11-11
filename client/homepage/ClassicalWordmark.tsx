import { useId } from 'react';
import { CLASSICAL_LETTERS, CLASSICAL_VIEWBOX } from './classical-lettering.ts';

/** Engraved metal artwork: custom outlines and facets, no font or SVG text. */
export default function ClassicalWordmark() {
  const id=useId().replaceAll(':','')+'-artifact';
  const ref=(name:string)=>`url(#${id}-${name})`;
  const letters=()=>CLASSICAL_LETTERS.map((glyph,i)=><path key={i} d={glyph.path} transform={`translate(${glyph.x} 0)`} fillRule="evenodd"/>);
  return <svg xmlns="http://www.w3.org/2000/svg" className="ef-classical-wordmark" viewBox={CLASSICAL_VIEWBOX} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2=".18" y2="1">
        <stop offset="0" stopColor="#fff0c5"/><stop offset=".18" stopColor="#eac886"/>
        <stop offset=".39" stopColor="#bb8c48"/><stop offset=".48" stopColor="#f8e3a9"/>
        <stop offset=".52" stopColor="#fff2ca"/><stop offset=".59" stopColor="#d1a65d"/>
        <stop offset=".88" stopColor="#a77538"/><stop offset="1" stopColor="#edcb84"/>
      </linearGradient>
      <linearGradient id={`${id}-bevel`} x1="0" y1="0" x2=".3" y2="1">
        <stop stopColor="#fff6d8"/><stop offset=".34" stopColor="#dfbf7d"/>
        <stop offset=".51" stopColor="#745028"/><stop offset=".7" stopColor="#cba05a"/><stop offset="1" stopColor="#533b25"/>
      </linearGradient>
      <linearGradient id={`${id}-sweep`}><stop stopColor="#fff5d6" stopOpacity="0"/><stop offset=".5" stopColor="#fff9e5" stopOpacity=".8"/><stop offset="1" stopColor="#fff5d6" stopOpacity="0"/></linearGradient>
      <pattern id={`${id}-etch`} width="17" height="19" patternUnits="userSpaceOnUse">
        <path d="M2 3h1M11 12h2M6 17h1" stroke="#fff2d0" strokeOpacity=".18" strokeWidth=".6"/>
        <path d="m3 8 4-.4m6 9 2-.2" stroke="#684928" strokeOpacity=".22" strokeWidth=".55"/>
      </pattern>
      <clipPath id={`${id}-letters`}><g transform="translate(0 82) scale(1 1.1)">{letters()}</g></clipPath>
      <radialGradient id={`${id}-halo`}><stop stopColor="#efd08c" stopOpacity=".12"/><stop offset="1" stopColor="#eac47a" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse className="ef-logo-halo" cx="404" cy="83" rx="330" ry="99" fill={ref('halo')}/>
    <g className="ef-logo-rays" fill="#eccc8c" opacity=".045">
      <path d="m401 60-256-48 237 71ZM408 60 665 10 430 84ZM400 58 333 0l51 82ZM411 58 477 0l-48 82Z"/>
    </g>
    {/* Everfolk's open-book and guiding-star device, recut as a small metal seal. */}
    <g className="ef-logo-emblem" strokeLinejoin="round">
      <path d="M320 49c20-10 40-10 58-2m56 0c18-8 38-8 58 2" fill="none" stroke="#b38b4d" strokeWidth="1"/>
      <path d="M334 48h35m74 0h35" stroke="#f4dfaa" strokeOpacity=".5"/>
      <path d="M375 36q15-5 31 5 16-10 31-5v24q-16-4-31 5-16-9-31-5Z" fill="#4b3d2b" stroke="#9b743e" strokeWidth="2"/>
      <path d="M378 33q14-4 28 6 14-10 28-6v24q-14-4-28 6-14-10-28-6Z" fill={ref('gold')} stroke="#f2dba4" strokeWidth="1.1"/>
      <path d="M406 39v24m-23-24q9 0 17 5m-17 1q9 0 17 5m-17 1q9 0 17 5m29-17q-9 0-17 5m17 1q-9 0-17 5m17 1q-9 0-17 5" fill="none" stroke="#8c693c" strokeWidth="1"/>
      <path d="m406 7 2.5 8.5L417 18l-8.5 2.5L406 29l-2.5-8.5L395 18l8.5-2.5Z" fill="#f2db9e"/>
      <path d="M389 21l-4-4m38 4 4-4M406 1v2" stroke="#be9b5c" strokeWidth="1"/>
    </g>
    <g className="ef-logo-carving">
      <g transform="translate(1.2 86) scale(1 1.1)" fill="#17272d" stroke="#17272d" strokeWidth="5">{letters()}</g>
      <g transform="translate(1 85) scale(1 1.1)" fill="#654526" stroke="#654526" strokeWidth="2.4">{letters()}</g>
      <g transform="translate(0 82) scale(1 1.1)" fill={ref('gold')} stroke={ref('bevel')} strokeWidth="2.2" paintOrder="stroke fill">{letters()}</g>
      <g clipPath={ref('letters')}>
        {/* Offset edge cuts supply directional relief; texture remains confined to the metal. */}
        <g transform="translate(.6 83.7) scale(1 1.1)" fill="none" stroke="#6c4928" strokeOpacity=".52" strokeWidth="1.2">{letters()}</g>
        <g transform="translate(-.5 81.2) scale(1 1.1)" fill="none" stroke="#fff1c5" strokeOpacity=".8" strokeWidth="1.2">{letters()}</g>
        <rect x="0" y="78" width="812" height="129" fill={ref('etch')}/>
        <path className="ef-logo-reflection" d="M-165 74h74l-55 137h-74Z" fill={ref('sweep')} opacity="0"/>
        <path d="M31 90v91m190-91v91m93-91v91m103-91v91m200-91v91m92-91v91" stroke="#fff0bf" strokeOpacity=".21" strokeWidth=".7"/>
      </g>
    </g>
    <g className="ef-logo-rule" fill="none" stroke="#c5a163" strokeWidth=".9">
      <path d="M22 212h332l17-4h26m17 0h26l17 4h330" opacity=".65"/>
      <path d="m400 208 6-4 6 4-6 4Z" fill="#d8b574"/>
    </g>
  </svg>;
}
