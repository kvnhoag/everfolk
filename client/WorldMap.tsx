import { useId, useMemo, useState } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import { buildLocationMap } from "./location-map.ts";
import type { MapPlace } from "./location-map.ts";
import PixelIcon from "./PixelIcon.tsx";
import "./location-map.css";

type MapScale = "city" | "egypt";

function Compass() {
  return <g className="location-map-compass" transform="translate(828 65)" aria-hidden="true">
    <text x="0" y="-27" textAnchor="middle">N</text>
    <path d="M0-18 9 10 0 5-9 10Z" fill="currentColor" />
    <path d="M0 5V25M-18 5H18" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </g>;
}

function SeaLines({ city }: { city: boolean }) {
  return <g className="location-map-wave-lines" fill="none" aria-hidden="true">
    {(city ? [[55, 65], [355, 57], [620, 95], [720, 220], [65, 145]] : [[75, 55], [280, 35], [490, 45], [675, 75]]).map(([x, y]) => <path key={`${x}-${y}`} d={`M${x} ${y}q10-7 20 0t20 0t20 0`} />)}
  </g>;
}

function CityGround({ founded, lighthouseBuilt }: { founded: boolean; lighthouseBuilt: boolean }) {
  return <g aria-hidden="true">
    <rect width="900" height="520" className="location-map-water" />
    <SeaLines city />
    <path className="location-map-land" d="M0 182 85 190 155 204 245 222 330 232 400 240 475 252 535 275 620 292 715 310 900 330V520H0Z" />
    <path className="location-map-shore" d="M0 182 85 190 155 204 245 222 330 232 400 240 475 252 535 275 620 292 715 310 900 330" />
    <path className="location-map-island" d="M135 105 165 90 210 93 245 110 298 116 330 138 307 153 258 145 214 133 165 127Z" />
    <path className="location-map-sand-detail" d="m41 277 26-7 15 6m-9 77 35-5m596 20 24-6 22 4m-90 90 42-7m96-63 33-7" />
    <path className="location-map-floodplain" d="M205 386Q328 356 470 372T733 399L761 482 687 520H162L140 458Z" />
    <path className="location-map-lake" d="M183 418Q232 389 285 398L352 391 402 406 470 397 535 412 603 407 668 424 701 448 657 466 598 472 535 459 463 477 397 469 344 484 286 470 223 468 171 450Z" />
    <path className="location-map-wave-lines" d="M292 442q10-7 20 0t20 0m150-4q10-7 20 0t20 0m50 8q10-7 20 0t20 0" fill="none" />
    {founded ? <g className="location-map-city-blocks">
      {[0, 1, 2, 3, 4, 5].flatMap(column => [0, 1, 2].map(row => <rect key={`${column}-${row}`} x={305 + column * 48 + row * 7} y={270 + column * 10 + row * 29} width="33" height="19" />))}
      <path d="m289 286 312 66m-303-31 306 66" />
    </g> : <g className="location-map-settlement" fill="none" strokeWidth="2">
      <path d="m325 282 12-8 13 8v16h-25Zm37 12 12-8 13 8v16h-25Zm-8 32 12-8 13 8v16h-25Z" />
      <path d="M335 298v-9h6v9m32 12v-9h6v9" />
    </g>}
    {lighthouseBuilt && <g className="location-map-lighthouse" transform="translate(306 124)">
      <path className="location-map-beacon" d="m0-23-31-12m31 12 31-12" />
      <path d="M-12 8h24v8h-24Zm3-23H9V8H-9Zm3-12H6v12H-6Zm-3 0h18v-5H-9Z" />
      <path d="M-2-7h4v8h-4Z" className="location-map-lighthouse-window" />
    </g>}
    <text className="location-map-water-label" x="520" y="45" textAnchor="middle">MEDITERRANEAN SEA</text>
    <text className="location-map-water-label location-map-lake-label" x="431" y="462" textAnchor="middle">LAKE MAREOTIS</text>
    <text className="location-map-land-label" x="769" y="417" textAnchor="middle">EGYPT</text>
  </g>;
}

function EgyptGround() {
  return <g aria-hidden="true">
    <rect width="900" height="520" className="location-map-land" />
    <path className="location-map-water" d="M0 0H900V70L813 67 749 78 691 70 625 93 574 86 520 100 477 92 437 110 395 104 350 116 300 110 245 105 198 92 129 87 59 91 0 75Z" />
    <SeaLines city={false} />
    <path className="location-map-shore" d="M0 75 59 91 129 87 198 92 245 105 300 110 350 116 395 104 437 110 477 92 520 100 574 86 625 93 691 70 749 78 813 67 900 70" />
    <path className="location-map-floodplain" d="M324 117 350 110 397 103 439 110 477 97 522 104 568 90 598 106 574 145 532 177 493 220 462 237 436 188 399 161 361 140Z" />
    <path className="location-map-floodplain location-map-nile-valley" d="M475 225C450 256 503 275 486 302S469 343 487 372 511 408 515 434 546 465 550 520" />
    <path className="location-map-river" d="M475 225C450 256 503 275 486 302S469 343 487 372 511 408 515 434 546 465 550 520" />
    <path className="location-map-river location-map-delta-rivers" d="M475 225 469 190 442 161 418 139 397 106M475 225 494 187 515 161 538 132 551 95M469 190 453 148 453 106M494 187 489 140 488 99" />
    <path className="location-map-water" d="M685 225 701 248 737 281 773 316 815 348 857 380 900 413V520H869L842 484 817 447 786 411 756 374 728 337 711 305 698 271Z" />
    <path className="location-map-water" d="m685 225-6-34-16-29-15-31 12 6 17 25 15 31 15 41Zm3-2 18-30 16-27 14-30 4 6-8 33-12 29-18 30Z" />
    <path className="location-map-shore" d="M685 225 701 248 737 281 773 316 815 348 857 380 900 413M869 520 842 484 817 447 786 411 756 374 728 337 711 305 698 271 685 225" />
    <path className="location-map-sand-detail" d="m85 210 26-8 18 8m55 83 37-8 14 4m-78 99 28-8 23 6m131 62 28-9 14 5m396-143 26-6 14 3m-37 142 31-7" />
    <text className="location-map-water-label" x="375" y="54" textAnchor="middle">MEDITERRANEAN SEA</text>
    <text className="location-map-land-label" x="225" y="310" textAnchor="middle">WESTERN DESERT</text>
    <text className="location-map-land-label" x="610" y="338" textAnchor="middle" transform="rotate(19 610 338)">EASTERN DESERT</text>
    <text className="location-map-land-label" x="702" y="120" textAnchor="middle">SINAI</text>
    <text className="location-map-water-label location-map-red-sea-label" x="810" y="427" textAnchor="middle" transform="rotate(49 810 427)">RED SEA</text>
    <text className="location-map-river-label" x="461" y="325" textAnchor="middle" transform="rotate(85 461 325)">NILE</text>
  </g>;
}

function PlaceDots({ places, selectedId, onSelect }: { places: MapPlace[]; selectedId: string; onSelect(id: string): void }) {
  return <g className="location-map-places" aria-hidden="true">{places.map((place, index) => place.id === "home" ? null : <g key={place.id} className={`location-map-place-dot${selectedId === place.id ? " is-selected" : ""}`} transform={`translate(${place.x} ${place.y})`} onClick={() => onSelect(place.id)}>
    <circle r="18" className="location-map-place-hit" />
    <circle r="11" />
    <text y="4" textAnchor="middle">{index + 1}</text>
  </g>)}</g>;
}

function HomePin({ x, y, label, onSelect }: { x: number; y: number; label: string; onSelect(): void }) {
  return <g className="location-map-home" transform={`translate(${x} ${y})`} aria-hidden="true" onClick={onSelect}>
    <ellipse cy="6" rx="14" ry="5" className="location-map-home-shadow" />
    <path d="M0 4C-5-4-16-13-16-25a16 16 0 1 1 32 0C16-13 5-4 0 4Z" className="location-map-home-pin" />
    <circle cy="-25" r="8" className="location-map-home-center" />
    <text y="-21" textAnchor="middle" className="location-map-home-number">1</text>
    <path d="M-16-12H-26" className="location-map-home-leader" />
    <rect x="-220" y="-17" width="194" height="50" className="location-map-home-label-bg" />
    <text x="-123" y="2" textAnchor="middle" className="location-map-home-caption">YOUR HOME AREA</text>
    <text x="-123" y="20" textAnchor="middle" className="location-map-home-name">{label}</text>
  </g>;
}

export default function WorldMap({ life, world }: { life: LifeState; world: WorldPack }) {
  const model = useMemo(() => buildLocationMap(world, life), [world, life]);
  const [scale, setScale] = useState<MapScale>("city");
  const [selection, setSelection] = useState<Partial<Record<MapScale, string>>>({});
  const instanceId = useId();
  const places = scale === "city" ? model.cityPlaces : model.egyptPlaces;
  const selected = places.find(place => place.id === selection[scale]) ?? places[0];
  const marker = scale === "city" ? model.cityMarker : model.egyptMarker;
  const select = (id: string) => setSelection(previous => ({ ...previous, [scale]: id }));
  return <section className="location-map" aria-label="Your location in Egypt">
    <header className="location-map-heading"><div><span className="location-map-eyebrow">YOUR LOCATION</span><h3><PixelIcon name="pin" size={22} /><span className="location-map-current-place">{model.placeName}<small>, Egypt</small></span></h3><p>{model.homeNote}</p></div><span className="location-map-date">{model.yearLabel}</span></header>
    <div className="location-map-toolbar"><div className="location-map-scales" aria-label="Map scale"><button type="button" aria-pressed={scale === "city"} onClick={() => setScale("city")}>Alexandria area</button><button type="button" aria-pressed={scale === "egypt"} onClick={() => setScale("egypt")}>Egypt</button></div><span className="location-map-scale-caption">{scale === "city" ? "The coast and its surroundings" : "The coast, the Delta and the Nile"}</span></div>
    <div className="location-map-layout">
      <figure className="location-map-figure"><div className="location-map-canvas"><svg viewBox="0 0 900 520" role="img" aria-labelledby={`${instanceId}-map-title ${instanceId}-map-description`}>
        <title id={`${instanceId}-map-title`}>{scale === "city" ? `${model.placeName} and the Alexandria coast` : "Egypt and the Nile Valley"}</title>
        <desc id={`${instanceId}-map-description`}>A schematic map, with north at the top. Your home area is marked at {model.placeName} on Egypt’s Mediterranean coast. Numbered places can be explored using the buttons beside the map.</desc>
        {scale === "city" ? <CityGround founded={model.founded} lighthouseBuilt={model.lighthouseBuilt} /> : <EgyptGround />}
        <Compass />
        <PlaceDots places={places} selectedId={selected?.id ?? ""} onSelect={select} />
        <HomePin {...marker} label={model.placeName} onSelect={() => select("home")} />
        <rect x="12" y="12" width="876" height="496" className="location-map-frame" aria-hidden="true" />
      </svg></div><figcaption><span><i className="location-map-key-home" />Your home area</span><span><i className="location-map-key-place" />Places to explore</span><span>North ↑ · Schematic, not to scale</span></figcaption></figure>
      <aside className="location-map-explore" aria-label="Explore places on the map"><span className="location-map-eyebrow">LOOK AROUND</span><h4>{scale === "city" ? "Along the coast" : "Across Egypt"}</h4><div className="location-map-place-list">{places.map((place, index) => <button type="button" key={place.id} aria-pressed={place.id === selected?.id} aria-controls={`${instanceId}-place-detail`} onClick={() => select(place.id)}><span className="location-map-place-number">{index + 1}</span><span>{place.label}</span><span aria-hidden="true">↗</span></button>)}</div>{selected && <div className="location-map-place-detail" id={`${instanceId}-place-detail`} aria-live="polite"><span className="location-map-detail-kind">{selected.kind === "water" ? "Water & landscape" : selected.kind === "settlement" ? "Settlement" : "Landmark"}</span><h5>{selected.label}</h5><p>{selected.description}</p></div>}</aside>
    </div>
    <p className="location-map-note">The marker shows your home area. Coastlines, streets and distances are simplified for orientation.</p>
    {model.sources.length > 0 && <details className="location-map-sources"><summary>Map references</summary><ul>{model.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<span aria-hidden="true"> ↗</span></a></li>)}</ul></details>}
  </section>;
}
