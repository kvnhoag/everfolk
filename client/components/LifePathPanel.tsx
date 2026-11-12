import type { LifeState, WorldPack } from "../../src/types.ts";
import { lifePathModel } from "../models/life-path.ts";
import "../styles/life-path.css";

/** Where the life stands: its stage and district, the trades in demand there, and what draws it. */
export default function LifePathPanel({ life, world }: { life: LifeState; world: WorldPack }) {
  const model = lifePathModel(world, life);
  if (!model) return null;
  return <div className="life-path">
    <div className="character-section-heading"><span>Life path</span><h3>{model.stage?.title ?? "Life"} · {model.current}</h3>
      <p>{model.away ? `You live in ${model.current}; your household stays in ${model.home}.` : `You live with your household in ${model.home}.`}</p></div>
    <section className="life-path-block" aria-label="Trades in demand">
      <h4>Work in {model.current}</h4>
      {model.needs.length === 0 ? <p className="life-path-empty">Every trade here has about as many hands as it needs. Pay is usual.</p> :
        <ul className="life-path-needs">{model.needs.map(need => <li key={need.title} className={`life-path-need is-${need.label}`}>
          <strong>{need.title}</strong><span className="life-path-pay">{need.label === "scarce" ? "Pays" : "Pays only"} {need.pay}</span><p>{need.reason}</p>
        </li>)}</ul>}
    </section>
    <section className="life-path-block" aria-label="What draws you">
      <h4>What draws you</h4>
      {model.affinities.length === 0 ? <p className="life-path-empty">Nothing has drawn you to a trade yet.</p> :
        <ul className="life-path-affinities">{model.affinities.map(entry => <li key={entry.title}>
          <span className="life-path-affinity-title">{entry.title}</span>
          <span className="life-path-bar" role="meter" aria-label={`${entry.title} pull`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={entry.value}><span style={{ width: `${entry.value}%` }} /></span>
          {entry.sources.length > 0 && <p>From {entry.sources.join("; ")}.</p>}
        </li>)}</ul>}
    </section>
    {model.people.length > 0 && <section className="life-path-block" aria-label="People you have met">
      <h4>People who shaped you</h4>
      <ul className="life-path-people">{model.people.map((text, index) => <li key={index}>{text}</li>)}</ul>
    </section>}
    <section className="life-path-block" aria-label="Life stages">
      <h4>Life stages</h4>
      {model.records.length === 0 ? <p className="life-path-empty">Your first stage is still under way.</p> :
        <ol className="life-path-records">{model.records.map(record => <li key={record.ages}>
          <span className="life-path-record-stage">{record.stage} · {record.ages}</span><strong>{record.title}</strong><span>{record.district}</span>
        </li>)}</ol>}
    </section>
  </div>;
}
