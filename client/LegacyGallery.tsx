import { displayProse } from "./display-prose.ts";
import { useId, useMemo, useState } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import { getAccomplishments, getLegacyRoutes } from "../src/legacy.ts";
import { formatYear } from "../src/calendar.ts";
import type { LegacyEntry } from "./legacy-store.ts";
import PixelIcon from "./PixelIcon.tsx";
import "./legacy-gallery.css";

const distinction = (kind: string) => kind === "ultimate" ? "Ultimate title" : kind === "prestige" ? "Prestige" : undefined;

export function CurrentLegacySummary({ world, life, onOpenGallery }: { world: WorldPack; life: LifeState; onOpenGallery(): void }) {
  const routes = getLegacyRoutes(world, life);
  const records = getAccomplishments(world, life);
  if (!routes.length) return null;
  return <section className="current-legacy" aria-label="Works and deeds from this life">
    <header><h3>Works &amp; deeds</h3><button type="button" onClick={onOpenGallery}>View collection <span aria-hidden="true">↗</span></button></header>
    {records.length > 0 ? <ul>{records.slice(-3).reverse().map(record => <li key={record.id}><PixelIcon name={record.routeId} size={21} /><div><strong>{record.name}</strong><span>{record.title} · Age {record.age}</span></div>{distinction(record.kind) && <span className="legacy-prestige">{distinction(record.kind)}</span>}</li>)}</ul> : <p>No accomplishments recorded yet.</p>}
    <div className="legacy-route-strip" aria-label="Life paths">{routes.map(route => <span key={route.id} className={route.earned.length ? "is-earned" : ""} title={`${route.title}: ${route.earned.length} accomplishments${route.next ? `. Next: ${route.next.title}` : ""}`}><PixelIcon name={route.id} size={15} /><span>{route.title}</span><strong>{route.earned.length}</strong></span>)}</div>
  </section>;
}

export default function LegacyGallery({ entries, currentLifeKey, storageNotice }: {
  entries: readonly LegacyEntry[]; currentLifeKey?: string; storageNotice?: string;
}) {
  const [route, setRoute] = useState("all");
  const [scope, setScope] = useState("all");
  const [query, setQuery] = useState("");
  const id = useId();
  const routes = useMemo(() => [...new Map(entries.map(entry => [entry.accomplishment.routeId, entry.routeTitle ?? entry.accomplishment.routeId.replace(/-/g, " ")])).entries()], [entries]);
  const filtered = entries.filter(entry => (route === "all" || entry.accomplishment.routeId === route) &&
    (scope === "all" || entry.lifeKey === currentLifeKey) &&
    `${entry.accomplishment.name} ${entry.accomplishment.title} ${entry.characterName} ${entry.accomplishment.people.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice().reverse();
  const lives = new Set(entries.map(entry => entry.lifeKey)).size;
  return <div className="legacy-gallery">
    <p className="legacy-intro">Your accomplishments from every life, saved in this browser. They stay here even after a life leaves the archive.</p>
    {storageNotice && <p className="legacy-storage-notice" role="status">{storageNotice}</p>}
    <div className="legacy-gallery-tally"><span><strong>{entries.length}</strong> accomplishments</span><span><strong>{lives}</strong> {lives === 1 ? "life" : "lives"}</span><span><strong>{entries.filter(entry => entry.accomplishment.kind === "prestige").length}</strong> prestige</span><span><strong>{entries.filter(entry => entry.accomplishment.kind === "ultimate").length}</strong> ultimate titles</span></div>
    <div className="legacy-gallery-filters"><label htmlFor={`${id}-search`}>Search accomplishments<input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Work, person or achievement" /></label><label htmlFor={`${id}-route`}>Path<select id={`${id}-route`} value={route} onChange={event => setRoute(event.target.value)}><option value="all">All paths</option>{routes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{currentLifeKey && <label htmlFor={`${id}-scope`}>Lives<select id={`${id}-scope`} value={scope} onChange={event => setScope(event.target.value)}><option value="all">All lives</option><option value="current">Current life</option></select></label>}</div>
    {filtered.length ? <div className="legacy-gallery-grid">{filtered.map(entry => {
      const record = entry.accomplishment;
      return <article className={`legacy-card${distinction(record.kind) ? " is-prestige" : ""}${record.kind === "ultimate" ? " is-ultimate" : ""}`} key={entry.key}>
        <div className="legacy-card-art" aria-hidden="true"><img src={`/assets/pixel/routes/${record.routeId}.svg`} width={64} height={64} alt="" /><span>{distinction(record.kind) ? "✦" : "◆"}</span></div>
        <div className="legacy-card-copy"><p className="legacy-card-path">{entry.routeTitle ?? record.routeId.replace(/-/g, " ")}{distinction(record.kind) && <span className="legacy-prestige">{distinction(record.kind)}</span>}</p><h3>{record.name}</h3><strong className="legacy-card-achievement">{record.title}</strong><p>{displayProse(record.description)}</p><div className="legacy-card-person"><strong>{entry.characterName}</strong><span>Age {record.age} · {formatYear(record.year)}</span></div>{record.people.length > 0 && <p className="legacy-card-people">Remembered with {record.people.join(", ")}</p>}<small className="legacy-card-world">{entry.worldTitle}</small>
        </div>
      </article>;
    })}</div> : <p className="legacy-empty">{entries.length ? "No accomplishments match these filters." : "No accomplishments yet. Your first one will appear here."}</p>}
  </div>;
}
