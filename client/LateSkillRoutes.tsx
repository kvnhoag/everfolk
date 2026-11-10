import { displayProse } from "./display-prose.ts";
import { useId, useMemo, useState } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../src/types.ts";
import { buildLateSkillRoutes } from "./late-skill-routes.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import figures from "../research/late-route-figures.json" with { type: "json" };
import "./late-skill-routes.css";

export default function LateSkillRoutes({ world, life, activities, onActivity, readOnly = false, skillId }: {
  world: WorldPack; life: LifeState; activities: readonly ActivityAvailability[];
  onActivity(id: string): void; readOnly?: boolean; skillId?: string;
}) {
  const [routeId, setRouteId] = useState("");
  const id = useId();
  const all = useMemo(() => buildLateSkillRoutes(world, life, activities), [world, life, activities]);
  const routes = readOnly ? all : all.filter(route => route.discovered);
  if (!all.length) return null;
  if (!routes.length) return <section className="late-routes"><h4>Advanced routes &amp; titles</h4><p>Develop a skill to 20 or complete your first work to discover a career path. The skill wiki shows every later route.</p></section>;
  const selected = routes.find(route => route.id === routeId) ?? routes.find(route => skillId && route.skillIds.includes(skillId)) ?? routes[0];
  const models = figures.filter(figure => figure.routeId === selected.id);
  const completed = selected.stages.filter(stage => stage.nodes.some(node => node.state === "earned")).length;
  return <section className="late-routes" aria-labelledby={`${id}-heading`}>
    <header className="late-routes-heading"><div><span className="skill-tree-eyebrow">Later career</span><h4 id={`${id}-heading`}>Advanced routes &amp; titles</h4><p>Each project lists its requirements and possible rewards.</p></div><span>{all.reduce((sum, route) => sum + route.stages.reduce((count, stage) => count + stage.nodes.length, 0), 0)} later milestones</span></header>
    <nav className="late-route-picker" aria-label="Advanced career routes">{routes.map(route => <button type="button" key={route.id} aria-pressed={selected.id === route.id} onClick={() => setRouteId(route.id)}>{route.title}{route.stages.some(stage => stage.nodes.some(node => node.achievement.kind === "ultimate" && node.state === "earned")) && <span aria-label="Ultimate title earned"> ✦</span>}</button>)}</nav>
    <div className="late-route-intro"><div><h5>{selected.title}</h5><p>{displayProse(selected.description)}</p></div><span>{completed} / {selected.stages.length} stages complete</span></div>
    <details className="late-route-entry"><summary>Start with completed work <span>{selected.entries.some(node => node.state === "earned") ? "✓ Recorded" : selected.entries.length > 1 ? "Two entry paths" : "First milestone"}</span></summary><div>{selected.entries.map(node => <article key={node.achievement.id}><h6>{node.achievement.title}</h6>{node.state === "earned" ? <p>✓ Completed in this life</p> : <><p>{displayProse(node.activity?.text ?? node.achievement.description)}</p><ul>{node.requirements.map((item, index) => <li key={index} className={item.met ? "is-met" : "is-missing"}>{item.met ? "✓" : "○"} {displayProse(item.text)}</li>)}</ul>{node.activity && <><ChoiceImpact choice={node.activity} world={world} life={life} />{!readOnly && <button type="button" className="late-route-action" disabled={node.state !== "ready"} onClick={() => onActivity(node.activity!.id)}>Start first project <span aria-hidden="true">↗</span></button>}</>}</>}</article>)}</div></details>
    <div className="late-route-scroll" tabIndex={0} role="region" aria-label={`${selected.title} later progression`}>
      <ol className="late-route-stages">{selected.stages.map((stage, index) => <li key={stage.title} className="late-route-stage">
        <div className="late-stage-heading"><span>{index + 1}</span><h6>{stage.title}</h6></div>
        {stage.nodes.length > 1 && <p className="late-stage-note">Complete either path to continue. You may pursue both.</p>}
        {stage.nodes.map(node => <article key={node.achievement.id} className={`late-route-node is-${node.state}${node.achievement.kind === "ultimate" ? " is-ultimate" : ""}`}>
          <span className="late-node-state">{node.state === "earned" ? "✓ Earned" : node.state === "assessed" ? "Assessment complete" : node.state === "ready" ? "Ready to attempt" : "Requirements to meet"}</span>
          <h6>{node.achievement.title}</h6><p>{displayProse(node.achievement.description)}</p>
          {node.state === "assessed" ? <p className="late-assessment-note">This career’s final assessment was unsuccessful. Your completed work remains in your life record.</p> : node.state !== "earned" && <>
            <details className="late-node-requirements"><summary>Requirements <span>{node.requirements.filter(item => item.met).length}/{node.requirements.length}</span></summary><ul>{node.requirements.map((item, i) => <li key={i} className={item.met ? "is-met" : "is-missing"}><span aria-hidden="true">{item.met ? "✓" : "○"}</span>{displayProse(item.text)}</li>)}</ul></details>
            {node.activity && <><ChoiceImpact choice={node.activity} world={world} life={life} />
              {node.achievement.kind === "ultimate" ? <p className="late-assessment-note">One final assessment for this career, whether it succeeds or fails.</p> : (node.activity.cooldownYears ?? 1) > 1 && <p className="late-stage-note">An unfinished project can be attempted again after {node.activity.cooldownYears} years.</p>}
              {!readOnly && <button type="button" className="late-route-action" disabled={node.state !== "ready"} onClick={() => onActivity(node.activity!.id)}>{node.achievement.kind === "ultimate" ? "Submit final assessment" : "Attempt project"}<span aria-hidden="true">↗</span></button>}
              {!readOnly && node.reason && <p className="late-stage-note">{displayProse(node.reason)}</p>}
            </>}
          </>}
        </article>)}
      </li>)}</ol>
    </div>
    {models.length > 0 && <details className="late-historical-models"><summary>Historical models <span>{models.length} figures</span></summary><p>Explore the careers behind this route. The dates show when each figure lived or worked; their achievements remain separate from your own.</p><ul>{models.map(figure => <li key={figure.name}><a href={figure.url} target="_blank" rel="noreferrer">{figure.name} <span aria-hidden="true">↗</span></a><span>{figure.period}</span><p>{figure.contribution}</p></li>)}</ul></details>}
    {readOnly && <p className="late-stage-note">To start a project, return to Your skills.</p>}
  </section>;
}
