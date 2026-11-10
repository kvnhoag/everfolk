import { useMemo } from "react";
import { formatYear } from "../src/calendar.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { buildLifeEvents } from "./life-events.ts";
import { lifeRecordChanges, lifeYearHeadline } from "./life-record.ts";
import type { YearChange } from "./life-record.ts";
import { createEngine } from "../src/engine.ts";
import InfluenceMarkerTag from "./InfluenceMarkerTag.tsx";
import { influenceMarker } from "./influence-marker.ts";
import PixelIcon from "./PixelIcon.tsx";
import "./life-event-feed.css";

function RecordChanges({ changes, label }: { changes: YearChange[]; label: string }) {
  if (!changes.length) return null;
  return <ul className="life-year-changes" aria-label={label}>{changes.map(change => <li key={change.id} className={`life-year-change ${change.delta > 0 ? "is-gain" : "is-loss"}`} title={`${change.label}: ${change.delta > 0 ? "+" : ""}${change.delta}${change.unit ? ` ${change.unit}` : ""}`} aria-label={`${change.label} ${change.delta > 0 ? "increased" : "decreased"} by ${Math.abs(change.delta)}${change.unit ? ` ${change.unit}` : ""}`}>
              <PixelIcon name={change.id.replace("skill:", "")} size={17} /><span aria-hidden="true">{change.delta > 0 ? "↑" : "↓"} {Math.abs(change.delta)}{change.unit && <small> {change.unit}</small>}</span>
            </li>)}</ul>;
}

/** A yearly highlight with exact annual changes; the disclosure retains every entry. */
export default function LifeEventFeed({ life, world }: { life: LifeState; world: WorldPack }) {
  const years = useMemo(() => buildLifeEvents(life, world), [life, world]);
  const recordEngine = useMemo(() => createEngine(world), [world]);
  const changes = useMemo(() => lifeRecordChanges(life, recordEngine), [life, recordEngine]);
  const entriesByAge = useMemo(() => {
    const groups = new Map<number, { entry: LifeState["journal"][number]; journalIndex: number }[]>();
    for (const [journalIndex, entry] of life.journal.entries()) if (entry.type !== "year") {
      const entries = groups.get(entry.age) ?? [];
      entries.push({ entry, journalIndex });
      groups.set(entry.age, entries);
    }
    return groups;
  }, [life.journal]);
  const sources = new Map(world.sources?.map(source => [source.id, source]) ?? []);
  return <div className="life-event-feed" aria-label="Life events">
    {years.map(group => {
      const entries = entriesByAge.get(group.age) ?? [];
      const deltas = changes.years.get(group.age) ?? [];
      return <section className={`life-event-year${group.age === life.age ? " is-current" : ""}`} key={group.age} aria-label={`${formatYear(group.year)}, age ${group.age}`}>
        <header className="life-event-year-heading"><strong>Age {group.age}</strong><span>{formatYear(group.year)}</span></header>
        <div className="life-event-year-body">
          <div className="life-year-overview">
            <h3 className="life-year-headline">{lifeYearHeadline(group.events)}</h3>
            <RecordChanges changes={deltas} label="Net changes this year" />
          </div>
          <details className="life-year-details">
            <summary aria-label={`Show full record for age ${group.age}`}><span className="life-year-chevron" aria-hidden="true" /><span className="life-year-expand">Full year</span></summary>
            <div className="life-year-expanded">
              <p className="life-year-change-note">Year totals above; individual changes beside each entry.</p>
              {entries.length > 0 ? <ol className="life-event-rows">{entries.map(({ entry, journalIndex }, index) => {
                const marker = influenceMarker(entry, world);
                const ids = entry.type === "event" ? world.events.find(event => event.id === entry.id)?.sourceIds
                  : entry.type === "birth" ? world.origins.find(origin => origin.id === entry.id)?.sourceIds
                  : entry.type === "ending" ? world.endings.find(ending => ending.id === entry.id)?.sourceIds : [];
                const references = (ids ?? []).map(id => sources.get(id)).filter(source => source !== undefined);
                return <li className={`life-event-row life-event-${entry.type}${marker ? ` is-shaped is-${marker.material}` : ""}`} key={`${index}-${entry.id}`}>
                  <div className="life-event-copy">{marker && <InfluenceMarkerTag marker={marker} />}<span className="life-record-kind">{entry.type === "outcome" ? "Result" : entry.type === "birth" ? "Background" : entry.type}</span><div className="life-entry-overview"><p>{entry.text}</p><RecordChanges changes={changes.entries.get(journalIndex) ?? []} label="Changes from this event" /></div>{references.length > 0 && <details className="life-event-sources"><summary>Sources</summary><div>{references.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div></details>}</div>
                </li>;
              })}</ol> : <p className="life-event-quiet">No recorded events.</p>}
            </div>
          </details>
        </div>
      </section>;
    })}
  </div>;
}
