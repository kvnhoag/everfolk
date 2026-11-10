import { displayProse } from "./display-prose.ts";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../src/types.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import ImpactValue from "./ImpactValue.tsx";
import { buildSkillTree, currentSkillTree, layoutSkillTree, practiceBlockReason, skillActionRequirements, trainingSkillChanges } from "./skill-tree.ts";
import type { SkillNode, SkillRequirement } from "./skill-tree.ts";
import { layoutSkillLinks } from "./skill-tree-links.ts";
import { activityLoanOffer } from "./loan-access.ts";
import SkillGrowth from "./SkillGrowth.tsx";
import LateSkillRoutes from "./LateSkillRoutes.tsx";
import { formatSkillValue as skillNumber } from "./skill-growth.ts";
import "./skill-tree.css";

function SkillIcon({ id }: { id: string }) {
  const paths: Record<string, ReactNode> = {
    craft: <><path d="m6 19 10-10M13 5l2-2 6 6-2 2zM3 18l3 3 3-3-3-3z" /></>,
    pottery: <><path d="M8 3h8M9 3v4C9 9 5 10 5 15c0 4 2 6 7 6s7-2 7-6c0-5-4-6-4-8V3M6 14h12M7 18h10" /></>,
    carving: <><path d="m5 18 3 3 10-10-3-3zM15 8l2-2 3 3-2 2M3 12l3-3M3 6l3 1M10 3l1 3" /></>,
    sculpture: <><path d="M9 12v3l-4 2v4h14v-4l-4-2v-3M16 7c0 4-2 6-4 6s-4-2-4-6a4 4 0 0 1 8 0ZM8 6h8M9 18h6" /></>,
    literacy: <><path d="M4 4h7l2 2h7v15h-7l-2-2H4zM12 7v11M7 8h2M7 11h2M15 10h2M15 13h2" /></>,
    oratory: <><path d="M4 4h16v12h-9l-5 4v-4H4zM8 8h8M8 12h5" /></>,
    philosophy: <><path d="m3 7 9-4 9 4H3ZM4 21h16M5 18h14M7 10v6M12 10v6M17 10v6" /></>,
    reckoning: <><path d="M4 3v18M20 3v18M4 7h16M4 12h16M4 17h16" /><path d="M8 5v4M14 5v4M10 10v4M16 15v4M7 15v4" strokeWidth="3" /></>,
    astronomy: <><circle cx="10" cy="13" r="7" /><path d="m10 6 3 7-3 7-3-7zM18 2v5M15.5 4.5h5M20 13v4M18 15h4" /></>,
    astrology: <><circle cx="12" cy="12" r="9" /><path d="m12 5 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></>,
    seamanship: <><path d="M12 3v13M12 4l7 9h-7M9 7l-5 6h5M3 16h18l-3 4H6z" /></>,
    warfare: <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6zM12 7v10M8 12h8" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[id] ?? <><path d="M4 4h7l1 2 1-2h7v16h-7l-1-2-1 2H4zM12 6v12" /></>}</svg>;
}

function Requirement({ requirement, onSelect }: { requirement: SkillRequirement; onSelect?: (id: string) => void }) {
  return <li className={requirement.met ? "skill-requirement met" : "skill-requirement missing"}>
    <span className="skill-requirement-mark" aria-hidden="true">{requirement.met ? "✓" : "○"}</span>
    {onSelect ? <button type="button" onClick={() => onSelect(requirement.id)}>{requirement.label}</button> : <span>{requirement.label}</span>}
    <span className="skill-requirement-numbers">{skillNumber(requirement.value, requirement.required)} <span>/ {requirement.required}</span><span className="sr-only"> {requirement.met ? "requirement met" : "required"}</span></span>
  </li>;
}

function Practice({ activity, life, world, onActivity, readOnly = false }: {
  activity: ActivityAvailability; life: LifeState; world: WorldPack; onActivity: (id: string) => void; readOnly?: boolean;
}) {
  const reason = practiceBlockReason(activity, life);
  const changes = trainingSkillChanges(activity, world, life);
  const loanOffer = reason && activityLoanOffer(world, life, activity);
  return <div className={`skill-practice${reason ? " unavailable" : ""}`}>
    <p className="skill-practice-name">{displayProse(activity.text)}</p>
    {changes.length > 0 && <div className="skill-practice-gains" aria-label="Possible skill changes">{changes.map(change => <span key={change.id}>{change.label} <ImpactValue min={change.min} max={change.max} /></span>)}</div>}
    <ChoiceImpact choice={activity} life={life} world={world} hideSkills />
    {!readOnly && <button type="button" className="skill-practice-button" disabled={Boolean(reason) && !loanOffer} onClick={() => onActivity(activity.id)}>{loanOffer ? "Ask moneylender to fund training" : reason ? "Unavailable" : "Train"}<span aria-hidden="true">↗</span></button>}
    {reason && <p className="skill-practice-reason">{displayProse(reason)}</p>}
  </div>;
}

function SkillWorkAction({ activity, life, world, onActivity, occupation = false, readOnly = false }: {
  activity: ActivityAvailability; life: LifeState; world: WorldPack; onActivity: (id: string) => void; occupation?: boolean; readOnly?: boolean;
}) {
  const reason = practiceBlockReason(activity, life);
  const changes = trainingSkillChanges(activity, world, life);
  const requirements = skillActionRequirements(activity, world);
  const loanOffer = reason && activityLoanOffer(world, life, activity);
  return <div className={`skill-work-action${reason ? " unavailable" : ""}`}>
    <p className="skill-practice-name">{displayProse(activity.text)}</p>
    {requirements.length > 0 && <p className="skill-work-requirements">{requirements.join(" · ")}</p>}
    {changes.length > 0 && <div className="skill-practice-gains" aria-label="Possible skill changes">{changes.map(change => <span key={change.id}>{change.label} <ImpactValue min={change.min} max={change.max} /></span>)}</div>}
    <ChoiceImpact choice={activity} life={life} world={world} hideSkills />
    {!readOnly && <button type="button" className="skill-practice-button" disabled={Boolean(reason) && !loanOffer} aria-label={`${loanOffer ? "Ask moneylender to fund" : occupation ? "Change occupation" : "Take paid work"}: ${displayProse(activity.text)}`} onClick={() => onActivity(activity.id)}>
      {loanOffer ? "Ask moneylender to fund this" : occupation ? "Choose this occupation" : "Take paid work"}<span aria-hidden="true">↗</span>
    </button>}
    {reason && <p className="skill-practice-reason">{displayProse(reason)}</p>}
  </div>;
}

export default function SkillTree({ life, world, activities, onActivity, initialView = "current" }: {
  life: LifeState; world: WorldPack; activities: readonly ActivityAvailability[]; onActivity: (id: string) => void; initialView?: "current" | "wiki";
}) {
  const [view, setView] = useState(initialView);
  const wiki = view === "wiki";
  const fullModel = useMemo(() => buildSkillTree(world, life, activities), [world, life, activities]);
  const model = useMemo(() => wiki ? fullModel : currentSkillTree(fullModel), [fullModel, wiki]);
  const layout = useMemo(() => layoutSkillTree(model), [model]);
  const links = useMemo(() => layoutSkillLinks(model, layout), [model, layout]);
  const [selectedId, setSelectedId] = useState("craft");
  const [search, setSearch] = useState("");
  const instanceId = useId();
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const target = pendingFocus.current && nodeRefs.current[pendingFocus.current];
    if (target) {
      target.focus();
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      pendingFocus.current = null;
    }
  }, [view, selectedId]);
  const selected = model.nodes.find(node => node.id === selectedId) ?? model.nodes[0];
  if (!fullModel.nodes.length) return <p className="character-empty">This world has no skills to practice.</p>;
  if (!selected) return <div className="skill-tree skill-tree-empty"><h3>Your skills</h3><p>Skills unlock as you grow and learn. Browse the wiki for future paths and requirements.</p><button type="button" className="skill-wiki-link" onClick={() => setView("wiki")}>Skill wiki <span aria-hidden="true">↗</span></button></div>;
  const query = search.trim().toLocaleLowerCase();
  const matches = (node: SkillNode) => `${node.label} ${node.branch} ${node.description}`.toLocaleLowerCase().includes(query);
  const matchCount = model.nodes.filter(matches).length;
  const mastered = model.nodes.filter(node => node.state === "mastered").length;
  const started = model.nodes.filter(node => node.value > node.min).length;
  const incoming = new Set(selected.requirements.map(item => item.id));
  const outgoing = model.nodes.filter(node => node.requirements.some(item => item.id === selected.id));
  const otherTraining = wiki ? model.otherTraining : model.otherTraining.filter(activity => !practiceBlockReason(activity, life));

  function select(id: string, focus = false) {
    if (!model.nodes.some(node => node.id === id)) setView("wiki");
    setSelectedId(id);
    if (focus) {
      if (!model.nodes.some(node => node.id === id)) pendingFocus.current = id;
      else { nodeRefs.current[id]?.focus(); nodeRefs.current[id]?.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, node: SkillNode) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home" || event.key === "End") return select(model.nodes[event.key === "Home" ? 0 : model.nodes.length - 1].id, true);
    const origin = layout.positions[node.id];
    const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const candidates = model.nodes.filter(item => item.id !== node.id && (horizontal ? layout.positions[item.id].x - origin.x : layout.positions[item.id].y - origin.y) * direction > 0);
    candidates.sort((a, b) => {
      const score = (item: SkillNode) => { const p = layout.positions[item.id]; return horizontal ? Math.abs(p.x - origin.x) + Math.abs(p.y - origin.y) * 1.7 : Math.abs(p.y - origin.y) + Math.abs(p.x - origin.x) * 1.7; };
      return score(a) - score(b);
    });
    if (candidates[0]) select(candidates[0].id, true);
  }

  return <div className="skill-tree">
    <div className="skill-tree-heading"><div><span className="skill-tree-eyebrow">{wiki ? "Reference" : "Training"}</span><h3>{wiki ? "All skill paths" : "Your skills"}</h3><p>{wiki ? "Explore every skill, including future paths and their requirements." : "Learned skills and paths you have unlocked."}</p><button type="button" className="skill-wiki-link" onClick={() => setView(wiki ? "current" : "wiki")}>{wiki ? "Your skills" : "Skill wiki"} <span aria-hidden="true">↗</span></button></div><div className="skill-tree-tally"><strong>{started}<span> / {model.nodes.length}</span></strong><span>skills learned{mastered > 0 ? ` · ${mastered} mastered` : ""}</span></div></div>
    <div className="skill-tree-toolbar">
      <div className="skill-tree-search"><label htmlFor={`${instanceId}-search`}>Find a skill</label><input id={`${instanceId}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try pottery or astronomy" autoComplete="off" /></div>
      <div className="skill-tree-legend" aria-label="Skill states">{model.nodes.some(node => node.state === "locked") && <span className="is-locked">Locked</span>}<span className="is-ready">Ready</span><span className="is-learning">Learning</span><span className="is-mastered">Mastered</span></div>
    </div>
    <p className="skill-tree-map-note" id={`${instanceId}-map-help`}>{query ? `${matchCount} matching ${matchCount === 1 ? "skill" : "skills"}. All paths remain visible.` : "Follow each path from left to right. Green links show requirements you have met."} <span>Select a skill to highlight its connections. Use arrow keys to explore.</span></p>
    <div className="skill-tree-layout">
      <div className="skill-tree-map-wrap"><div className="skill-tree-scroll" tabIndex={0} role="region" aria-label="Skill tree map, scroll horizontally to explore" aria-describedby={`${instanceId}-map-help`}>
        <div className="skill-tree-board" style={{ width: layout.width, height: layout.height }}>
          {layout.tierX.map((left, tier) => <span key={tier} className="skill-tree-tier" style={{ left, width: layout.cardWidth }}>{tier === 0 ? "Basic" : tier === 1 ? "Intermediate" : tier === 2 ? "Advanced" : `Tier ${tier + 1}`}</span>)}
          {layout.branches.map((branch, index) => <div key={branch.label} className={`skill-tree-branch skill-branch-${index % 4}`} style={{ top: branch.y, height: branch.height, width: layout.width }}><span>{branch.label}</span></div>)}
          <svg className="skill-tree-connectors" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
            <defs><marker id={`${instanceId}-arrow`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 6 3 0 6z" fill="context-stroke" /></marker></defs>
            {links.map(edge => {
              const active = edge.to === selected.id || edge.from === selected.id;
              return <path key={`${edge.from}-${edge.to}`} className={`${edge.met ? "connection-met" : "connection-locked"}${active ? " connection-selected" : ""}`} d={edge.path} markerEnd={`url(#${instanceId}-arrow)`} />;
            })}
          </svg>
          {model.nodes.map(node => {
            const position = layout.positions[node.id];
            const related = incoming.has(node.id) || outgoing.some(item => item.id === node.id);
            return <button type="button" key={node.id} ref={element => { nodeRefs.current[node.id] = element; }}
              className={`skill-tree-node is-${node.state}${node.id === selected.id ? " is-selected" : ""}${related ? " is-connected" : ""}${query && matches(node) ? " is-search-match" : ""}${query && !matches(node) ? " is-search-muted" : ""}`}
              style={{ left: position.x, top: position.y, width: layout.cardWidth, height: layout.cardHeight }}
              aria-pressed={node.id === selected.id} aria-controls={`${instanceId}-detail`} aria-label={`${node.label}, ${skillNumber(node.value, node.max)} of ${node.max}, ${node.state}${node.requirements.length ? `, requires ${node.requirements.map(item => `${item.label} ${item.required}`).join(", ")}` : ""}`}
              onClick={() => select(node.id)} onKeyDown={event => navigate(event, node)}>
              <span className="skill-node-heading"><span className="skill-node-icon"><SkillIcon id={node.id} /></span><span className="skill-node-name">{node.label}</span></span>
              <span className="skill-node-progress" aria-hidden="true"><span style={{ width: `${node.progress * 100}%` }} /></span>
              <span className="skill-node-bottom"><span className="skill-node-state">{node.state === "locked" && <svg viewBox="0 0 10 12" width="7" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><rect x="1" y="5" width="8" height="6" rx="1" /><path d="M3 5V3a2 2 0 0 1 4 0v2" /></svg>}{node.state}</span><span className="skill-node-value">{skillNumber(node.value, node.max)}<small> / {node.max}</small></span></span>
            </button>;
          })}
        </div>
      </div><p className="skill-tree-scroll-hint">Follow each branch from left to right <span aria-hidden="true">→</span></p></div>
      <aside className={`skill-tree-detail is-${selected.state}`} id={`${instanceId}-detail`} aria-label={`${selected.label} details`}>
        <div className="skill-detail-title"><span className="skill-detail-icon"><SkillIcon id={selected.id} /></span><div><span className="skill-detail-branch">{selected.branch}</span><h4>{selected.label}</h4></div><span className="skill-detail-state">{selected.state}</span></div>
        <p className="skill-detail-description">{displayProse(selected.description)}</p>
        <div className="skill-detail-proficiency"><label htmlFor={`${instanceId}-proficiency`}>Proficiency <strong>{skillNumber(selected.value, selected.max)}<span> / {selected.max}</span></strong></label><meter id={`${instanceId}-proficiency`} min={selected.min} max={selected.max} value={selected.value} /></div>
        <SkillGrowth life={life} world={world} skillId={selected.id} />
        <section className="skill-detail-section"><h5>Requirements</h5><ul className="skill-requirement-list">
          {selected.minAge > 0 && <li className={`skill-requirement ${selected.ageMet ? "met" : "missing"}`}><span className="skill-requirement-mark" aria-hidden="true">{selected.ageMet ? "✓" : "○"}</span><span>Age {selected.minAge} or older</span><span className="skill-requirement-numbers">{selected.ageMet ? "Met" : `Age ${life.age}`}</span></li>}
          {selected.requirements.map(item => <Requirement key={item.id} requirement={item} onSelect={id => select(id, true)} />)}
        </ul>{selected.requirements.length === 0 && <p className="skill-detail-small">A foundation skill. No other skill is required.</p>}</section>
        <section className="skill-detail-section"><h5>{selected.state === "mastered" ? "Mastered" : "Training"}</h5>
          {selected.state === "mastered" && <p className="skill-detail-small">You have reached this skill’s maximum proficiency.</p>}
          {selected.training.map(activity => <Practice key={activity.id} activity={activity} life={life} world={world} onActivity={onActivity} readOnly={wiki} />)}
          {selected.training.length === 0 && <p className="skill-detail-small">There is no direct practice for this skill in this world. Events and work may develop it.</p>}
        </section>
        {selected.paidWork.length > 0 && <section className="skill-detail-section skill-paid-work"><h5>Paid work</h5><p className="skill-detail-small">Earn from this skill while keeping your current occupation.</p>{selected.paidWork.map(activity => <SkillWorkAction key={activity.id} activity={activity} life={life} world={world} onActivity={onActivity} readOnly={wiki} />)}</section>}
        {outgoing.length > 0 && <section className="skill-detail-section"><h5>Unlocks</h5><div className="skill-next-list">{outgoing.map(node => <button type="button" key={node.id} onClick={() => select(node.id, true)}><span>{node.label}</span><span>{selected.label} {node.requirements.find(item => item.id === selected.id)!.required} <span aria-hidden="true">→</span></span></button>)}</div></section>}
        {selected.careers.length > 0 && <section className="skill-detail-section skill-career-section"><h5>Make it your occupation</h5><p className="skill-detail-small">Choosing an occupation replaces your current job if accepted. Age, skills and other requirements still apply.</p>{selected.careers.map(career => <details className="skill-career" key={career.job.id}><summary><span>{career.job.title}</span><span>{life.character?.jobId === career.job.id ? "Current occupation" : career.thresholdsMet ? "Thresholds met" : "View requirements"}</span></summary><p>{displayProse(career.job.description)}</p><ul className="skill-requirement-list"><li className={`skill-requirement ${career.ageMet ? "met" : "missing"}`}><span aria-hidden="true">{career.ageMet ? "✓" : "○"}</span><span>Age {career.job.minAge} or older</span><span className="skill-requirement-numbers">{career.ageMet ? "Met" : `Age ${life.age}`}</span></li>{career.requirements.map(item => <Requirement key={item.id} requirement={item} onSelect={id => select(id, true)} />)}</ul>{career.activities.map(activity => <SkillWorkAction key={activity.id} activity={activity} life={life} world={world} onActivity={onActivity} occupation readOnly={wiki} />)}</details>)}</section>}
      </aside>
    </div>
    {otherTraining.length > 0 && <details className="skill-other-practice"><summary>Other training activities <span>{otherTraining.length}</span></summary><div>{otherTraining.map(activity => <Practice key={activity.id} activity={activity} life={life} world={world} onActivity={onActivity} readOnly={wiki} />)}</div></details>}
    <LateSkillRoutes world={world} life={life} activities={activities} onActivity={onActivity} readOnly={wiki} skillId={selected.id} />
    <p className="skill-tree-footnote">One activity per year. Skills also improve through work and events.{world.character?.skills[selected.id]?.gainCurve && " Gains get smaller at higher proficiency."}</p>
  </div>;
}
