import { useId, useMemo, useState } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../src/types.ts";
import { buildCareerEconomyTree, type CareerAction } from "./career-economy-tree.ts";
import { displayProse } from "./display-prose.ts";
import { formatSkillValue } from "./skill-growth.ts";
import { practiceBlockReason } from "./skill-tree.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import SkillArtwork from "./SkillArtwork.tsx";
import "./career-economy-tree.css";

function Action({ action, world, life, readOnly, onActivity }: {
  action: CareerAction; world: WorldPack; life: LifeState; readOnly: boolean; onActivity(id: string): void;
}) {
  return <div className="career-tree-action">
    <p>{displayProse(action.activity.text)}</p>
    {action.requirements.length > 0 && <ul className="career-tree-requirements">{action.requirements.map((requirement, index) =>
      <li key={index} className={requirement.met ? "is-met" : ""}><span aria-hidden="true">{requirement.met ? "✓" : "○"}</span> {requirement.text}</li>)}</ul>}
    <ChoiceImpact choice={action.activity} world={world} life={life} showSkillChanges />
    {!readOnly && <button type="button" disabled={Boolean(action.reason)} onClick={() => onActivity(action.activity.id)}>{displayProse(action.activity.text)}</button>}
    {action.reason && <p className="career-tree-reason">{displayProse(action.reason)}</p>}
  </div>;
}

/** All branches are generated from this life's world, including deferred careers. */
export default function CareerEconomyTree({ world, life, activities, onActivity, readOnly = false }: {
  world: WorldPack; life: LifeState; activities: readonly ActivityAvailability[]; onActivity(id: string): void; readOnly?: boolean;
}) {
  const tree = useMemo(() => buildCareerEconomyTree(world, life, activities), [world, life, activities]);
  const [branch, setBranch] = useState("all");
  const [skill, setSkill] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const id = useId();
  const query = search.trim().toLocaleLowerCase();
  const selected = tree.skills.find(node => node.id === skill);
  const matches = (text: string) => !query || text.toLocaleLowerCase().includes(query);
  const careers = tree.careers.filter(node => (branch === "all" || node.branch === branch) && (!skill || node.foundationIds.includes(skill)) &&
    matches([node.job.title, node.job.description, ...node.skillIds.map(id => world.character?.skills[id]?.label ?? id), ...node.economy].join(" ")));
  const routes = tree.routes.filter(route => (!skill || route.foundationIds.includes(skill)) &&
    (branch === "all" || route.skillIds.some(id => tree.skills.find(node => node.id === id)?.branch === branch)) &&
    matches([route.title, route.description, ...route.stages.flatMap(stage => stage.nodes.map(node => node.achievement.title))].join(" ")));
  if (!tree.skills.length && !tree.careers.length) return null;
  return <section className="career-economy-tree" aria-labelledby={`${id}-title`}>
    <header><span className="eyebrow">FROM PRACTICE TO A LIVELIHOOD</span><h3 id={`${id}-title`}>Career &amp; economy tree</h3>
      <p>Follow skills into work, income and lasting accomplishments. Careers can share skills; choosing a job replaces your current occupation.</p>
      <p>{tree.skills.length} skills · {tree.careers.length} occupations · {tree.routes.length} paths to accomplishments</p></header>
    <div className="career-tree-controls">
      <label htmlFor={`${id}-branch`}>Branch<select id={`${id}-branch`} value={branch} onChange={event => { setBranch(event.target.value); setSkill(null); }}>
        <option value="all">All branches</option>{tree.branches.map(label => <option key={label}>{label}</option>)}</select></label>
      <label htmlFor={`${id}-search`}>Find a livelihood<input id={`${id}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try sculptor, philosophy or grain" /></label>
    </div>
    <div className="career-tree-foundations" role="group" aria-label="Skills leading to careers">
      <button type="button" aria-pressed={!skill} onClick={() => setSkill(null)}>All skills</button>
      {tree.skills.filter(node => branch === "all" || node.branch === branch).map(node => <button type="button" key={node.id} aria-pressed={skill === node.id} onClick={() => setSkill(node.id)}>
        <SkillArtwork id={node.id} /><span>{node.label}<small>{formatSkillValue(node.value, node.max)} / {node.max}{node.availability === "unavailable" ? " · Unavailable" : ""}</small></span></button>)}
    </div>
    {selected && <aside className="career-tree-selected" aria-label={`${selected.label} progression`}>
      <h4>{selected.label}</h4><p>{displayProse(selected.description)}</p>
      {selected.requirements.length > 0 && <p>Learn first: {selected.requirements.map((requirement, index) => <span key={requirement.id}>{index > 0 ? " + " : ""}<button type="button" onClick={() => { setBranch("all"); setSkill(requirement.id); }}>{requirement.label} {requirement.required}</button></span>)}</p>}
      {selected.availabilityText && <p>{selected.availabilityText}</p>}
      {selected.training.map(activity => <div className="career-tree-action" key={activity.id}>
        {!readOnly && <button type="button" disabled={selected.availability === "unavailable" || Boolean(practiceBlockReason(activity, life))} onClick={() => onActivity(activity.id)}>{displayProse(activity.text)}</button>}
        {readOnly && <p>{displayProse(activity.text)}</p>}
        <ChoiceImpact choice={activity} life={life} world={world} showSkillChanges />
        {practiceBlockReason(activity, life) && <p>{displayProse(practiceBlockReason(activity, life)!)}</p>}
      </div>)}
    </aside>}
    <p className="career-tree-count" role="status">{careers.length} occupations and {routes.length} accomplishment paths match.</p>
    <div className="career-tree-branches">{tree.branches.map(label => {
      const nodes = careers.filter(node => node.branch === label);
      return nodes.length > 0 && <section key={label} aria-label={`${label} careers`}><h4>{label}</h4><div className="career-tree-jobs">{nodes.map(node =>
        <details key={node.job.id} className="career-tree-job" open={node.state === "Current" || undefined}>
          <summary><span>{node.job.title}<small>Age {node.job.minAge}+{Object.entries(node.job.requirements ?? {}).map(([id, value]) => ` · ${world.character?.skills[id]?.label ?? id} ${value}`).join("")}</small></span><span className="career-tree-badge">{node.state}</span></summary>
          <p>{displayProse(node.job.description)}</p>
          <ul className="career-tree-requirements"><li className={life.age >= node.job.minAge ? "is-met" : ""}>Age {node.job.minAge}+ · current age {life.age}</li>{Object.entries(node.job.requirements ?? {}).map(([id, value]) => <li key={id} className={(life.character?.skills[id] ?? 0) >= value ? "is-met" : ""}>
            <button type="button" onClick={() => { setBranch("all"); setSkill(id); }}>{world.character?.skills[id]?.label ?? id}</button> {formatSkillValue(life.character?.skills[id] ?? 0, value)} / {value}</li>)}</ul>
          <h5>How this supports your life</h5><ul>{node.economy.map(line => <li key={line}>{line}</li>)}</ul>
          {node.state === "Unavailable" && <p>Not available in this demo.</p>}
          {node.actions.map(action => <Action key={action.activity.id} action={action} {...{ world, life, readOnly, onActivity }} />)}
          {!node.actions.length && <p>This occupation is reached through life events.</p>}
        </details>)}</div></section>;
    })}</div>
    {routes.length > 0 && <section className="career-tree-routes"><h4>Where your work can lead</h4><p>Accepted work and decisions earn these accomplishments. Reaching a skill threshold alone does not award them.</p>
      {routes.map(route => <details key={route.id}><summary>{route.title}</summary><p>{displayProse(route.description)}</p>
        <ol>{route.stages.map((stage, index) => <li key={index}><h5>{stage.title}</h5>{stage.nodes.map(node => <details key={node.achievement.id}>
          <summary>{node.achievement.title} <span className="career-tree-badge">{node.state}</span></summary><p>{displayProse(node.achievement.description)}</p>
          {node.state === "Unavailable" && <p>Not available in this demo.</p>}
          {node.actions.map(action => <Action key={action.activity.id} action={action} {...{ world, life, readOnly, onActivity }} />)}
          {!node.actions.length && <p>Earned through life events and decisions.</p>}
        </details>)}</li>)}</ol>
      </details>)}
    </section>}
    {tree.futurePaths.length > 0 && <details className="career-tree-future"><summary>Future paths · Unavailable</summary>{tree.futurePaths.map(path => <article key={path.id}><h5>{path.title} · Unavailable</h5><p>{path.description}</p>{path.prerequisites && <p>{path.prerequisites}</p>}<p>Not available in this demo.</p></article>)}</details>}
    <p className="career-tree-footnote">Training and career actions share one activity per year.{world.demo && " A market visit has its own yearly allowance."} Locked paths show requirements; Unavailable paths cannot be played in this world.</p>
  </section>;
}
