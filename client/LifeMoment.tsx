import { useMemo } from "react";
import { formatYear } from "../src/calendar.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { buildLifeEvents } from "./life-events.ts";
import PixelIcon from "./PixelIcon.tsx";
import { displayProse } from "./display-prose.ts";

/** A completed moment, never a pending choice or an invented outcome. */
export default function LifeMoment({ life, world, onAdvance, onOpenChronicle }: {
  life: LifeState; world: WorldPack; onAdvance(): void; onOpenChronicle(): void;
}) {
  const latest = useMemo(() => buildLifeEvents(life, world).flatMap(year => year.events.map(event => ({ ...event, year: year.year }))).find(event => event.kind !== "ending"), [life, world]);
  const origin = world.origins.find(item => item.id === life.originId);
  return <section className="life-moment" aria-labelledby="life-moment-title">
    <p className="life-moment-intro">{life.age < 3 ? "The early years." : "From your life record."}</p>
    <header className="life-moment-heading"><span>{formatYear(latest?.year ?? life.year)}</span><h2 id="life-moment-title">{latest?.title ?? (life.age === 0 ? "Birth" : "This year")}</h2></header>
    <p className="life-moment-copy">{displayProse(latest?.text ?? origin?.text ?? "No event recorded yet.")}</p>
    {life.phase === "ready" && <button className="moment-advance" type="button" onClick={onAdvance}>Live another year <PixelIcon name="arrow" size={16} /></button>}
    <button className="moment-chronicle" type="button" onClick={onOpenChronicle}>Read your life record <span aria-hidden="true">↗</span></button>
  </section>;
}
