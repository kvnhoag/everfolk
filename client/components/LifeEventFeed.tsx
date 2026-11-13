import { useMemo } from "react";
import { formatYear } from "../../src/calendar.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { buildLifeEvents } from "../models/life-events.ts";
import "../styles/life-event-feed.css";

/** Completed events only; the full command journal lives in the chronicle. */
export default function LifeEventFeed({ life, world }: { life: LifeState; world: WorldPack }) {
  const years = useMemo(() => buildLifeEvents(life, world), [life, world]);
  const sources = new Map(world.sources?.map(source => [source.id, source]) ?? []);
  return <div className="life-event-feed" aria-label="Life events">
    {years.map(group => <section className="life-event-year" key={group.age} aria-label={`${formatYear(group.year)}, age ${group.age}`}>
      <header className="life-event-year-heading"><strong>Age {group.age}</strong><span>{formatYear(group.year)}</span></header>
      {group.events.length ? <ol className="life-event-rows">{group.events.map(event => {
        const references = event.sourceIds.map(id => sources.get(id)).filter(source => source !== undefined);
        return <li className={`life-event-row life-event-${event.kind}`} key={event.key}>
          <div className="life-event-copy"><p>{event.text}</p>{references.length > 0 && <details className="life-event-sources"><summary>Sources</summary><div>{references.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div></details>}</div>
        </li>;
      })}</ol> : <p className="life-event-quiet">No recorded events.</p>}
    </section>)}
  </div>;
}
