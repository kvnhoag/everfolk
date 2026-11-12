import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import type { CapabilityNode, CapabilityNodeView, CapabilityStatus } from "../../src/capabilities/types.ts";
import { capabilityView } from "../../src/capabilities/view.ts";
import { buildCapabilityLayout, CAPABILITY_BRANCHES, CAPABILITY_NODES, capabilityAncestors, capabilityNodeLabel, nextCapabilityNode } from "../models/capability-layout.ts";
import CapabilityIcon from "./CapabilityIcon.tsx";
import { useSkillMapNavigation } from "../hooks/useSkillMapNavigation.ts";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM } from "../models/skill-map-camera.ts";
import "../styles/capability-tree.css";

const STATUS_LABEL: Record<CapabilityStatus, string> = { learned: "Learned", available: "Ready to work", locked: "Locked", unavailable: "Unavailable" };
const BRANCH_DESCRIPTIONS: Record<string, string> = {
  Physique: "Strength, endurance and physical work",
  Handmade: "Clothing, ceramics and sculpture",
  Knowledge: "Reading, inquiry and public reasoning",
  Trade: "Commercial planning",
};
const EMPTY_VIEW: CapabilityNodeView = { id: "", state: "unavailable", reasons: ["This path is unavailable in this world."], progress: { done: 0, required: 1 }, actionId: null, actionLabel: "Work on this skill", requirementText: [] };

function NodeShape({ branch, mastery }: { branch: string; mastery: boolean }) {
  return <svg className="capability-node-shape" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    {branch === "Physique" ? <path d="M32 3C48 3 59 15 59 32S48 61 32 61 5 49 5 32 16 3 32 3Z" />
      : branch === "Handmade" ? <path d="m32 3 26 14v30L32 61 6 47V17L32 3Z" />
        : branch === "Knowledge" ? <path d="M13 5h38l8 8v38l-8 8H13l-8-8V13l8-8Z" />
          : <path d="M32 2 61 32 32 62 3 32Z" />}
    <path className="capability-node-engraving" d={mastery ? "m12 15 8-6m24 0 8 6M12 49l8 6m24 0 8-6M9 20v24m46-24v24" : "m14 12 6-3m24 0 6 3M14 52l6 3m24 0 6-3"} />
  </svg>;
}

function relatedJobs(world: WorldPack, node: CapabilityNode) {
  const patterns = node.specialization === "Military practice" ? /soldier|officer|general/
    : node.branch === "Physique" ? /farm|cultivat|estate|grower/
    : node.branch === "Trade" ? /merchant|trader|dealer|shopkeeper|steward/
      : node.branch === "Knowledge" ? node.specialization === "Research" ? /scientist|research/ : node.specialization === "Civic practice" ? /politician|public|council/ : /philosoph|tutor/
        : node.specialization === "Clothing" ? /tailor|textile|weaver/ : node.specialization === "Ceramics" ? /potter|ceramic/ : node.specialization === "Sculpture" ? /sculpt|carv/ : /apprentice/;
  return world.character?.jobs.filter(job => patterns.test(`${job.id} ${job.title}`.toLowerCase())).slice(0, 4) ?? [];
}

function practiceFor(world: WorldPack, node: CapabilityNode, activities: readonly ActivityAvailability[]) {
  const skills = new Set(Object.keys(node.minimumProficiency));
  return activities.filter(activity => activity.category === "training" && activity.outcomes.some(outcome => outcome.effects.some(effect => {
    if (effect.type === "skill") return skills.has(effect.skill);
    if (effect.type !== "vocation") return false;
    const action = world.vocations?.actions[effect.action];
    return action?.kind === "work" && action.practice && skills.has(action.primary);
  }))).slice(0, 3);
}

export function CapabilityInspector({ node, view, world, life, activities, readOnly, onActivity, onSelect, detailId }: {
  node: CapabilityNode; view: CapabilityNodeView; world: WorldPack; life: LifeState;
  activities: readonly ActivityAvailability[]; readOnly: boolean; onActivity(id: string): void;
  onSelect(id: string): void; detailId: string;
}) {
  const action = activities.find(activity => activity.id === view.actionId);
  const jobs = relatedJobs(world, node);
  const training = practiceFor(world, node, activities);
  const canWork = Boolean(action?.available) && life.phase === "ready";
  const learned = life.capabilities?.learned[node.id];
  return <aside className={`capability-inspector is-${view.state}`} id={detailId} aria-label={`${node.title} details`}>
    <header className="capability-detail-heading">
      <span className="capability-detail-mark"><CapabilityIcon {...node} /></span>
      <div><p>{node.branch}{node.specialization ? ` · ${node.specialization}` : ""}</p><h4>{node.title}</h4></div>
    </header>
    <div className="capability-detail-meta"><span>{node.id} · Depth {node.depth} of 10</span><strong>{STATUS_LABEL[view.state]}</strong></div>
    {learned && <p className="capability-earned-note">Learned at age {learned.age}. Your demonstrated work is kept in this life's record.</p>}
    <section><h5>Learn first</h5>{node.prerequisites.all.length ? <div className="capability-parent-links">{node.prerequisites.all.map(id => <button key={id} type="button" onClick={() => onSelect(id)}>{CAPABILITY_NODES.find(parent => parent.id === id)?.title ?? id}<span>{life.capabilities?.learned[id] ? "Learned" : id}</span></button>)}</div> : <p>A foundation skill. No earlier node is required.</p>}</section>
    <section><h5>Practice requirements</h5><ul className="capability-proficiency-list">{Object.entries(node.minimumProficiency).map(([skill, required]) => {
      const current = life.character?.skills[skill] ?? 0;
      return <li key={skill} className={current >= required ? "is-met" : ""}><span>{world.character?.skills[skill]?.label ?? skill}</span><strong>{Math.floor(current * 10) / 10} / {required}</strong></li>;
    })}</ul>{node.anyProficiency && <p>Also meet one: {node.anyProficiency.map(group => Object.entries(group).map(([id, value]) => `${world.character?.skills[id]?.label ?? id} ${value}`).join(" + ")).join(" or ")}.</p>}</section>
    {node.minimumStats && <section><h5>Current condition requirements</h5><ul className="capability-proficiency-list">{Object.entries(node.minimumStats).map(([stat,value])=><li key={stat} className={life.stats[stat]>=value?"is-met":""}><span>{world.stats[stat]?.label ?? stat}</span><strong>{Math.floor(life.stats[stat] ?? 0)} / {value}</strong></li>)}</ul><p>Health is your current condition. Strength and Endurance are trainable skills.</p></section>}
    <section><h5>Demonstrate it</h5><p>{node.proof}</p><div className="capability-proof-progress"><progress aria-label={`${node.title} demonstrated work`} max={Math.max(1, view.progress.required)} value={Math.min(view.progress.done, Math.max(1, view.progress.required))} /><span>{view.progress.done} / {view.progress.required} work steps</span></div></section>
    <section><h5>What this opens</h5><p>{node.reward}</p></section>
    {view.requirementText.length > 0 && <section><h5>Before taking the work</h5><ul>{view.requirementText.map(text => <li key={text}>{text}</li>)}</ul></section>}
    {!readOnly && view.actionId && <div className="capability-work-action"><button className="capability-work-button" type="button" disabled={!canWork || view.state === "unavailable"} onClick={() => { if (canWork && action) onActivity(action.id); }}>{view.actionLabel}<span aria-hidden="true">→</span></button>{action?.reason && !canWork && <p>{action.reason}</p>}{!action && <p>This work is not offered in the current life.</p>}</div>}
    {readOnly && <p className="capability-read-only">Reference view. Return to Character → Skills to take work.</p>}
    {view.reasons.length > 0 && <ul className="capability-reasons">{view.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
    {!readOnly && training.length > 0 && <details className="capability-practice"><summary>Practice the needed skills</summary>{training.map(activity => <div key={activity.id}><p>{activity.text}</p><button type="button" disabled={!activity.available || life.phase !== "ready"} onClick={() => onActivity(activity.id)}>Practice</button>{activity.reason && <small>{activity.reason}</small>}</div>)}</details>}
    {jobs.length > 0 && <details className="capability-career-links"><summary>Where this work can lead</summary><p>Skills and demonstrated work can qualify you for these occupations. An appointment is a separate choice.</p>{jobs.map(job => {
      const appointment = activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job === job.id)));
      return <article key={job.id}><h5>{job.title}</h5><p>{job.description}</p><p>Age {job.minAge}+{Object.entries(job.requirements ?? {}).map(([id, value]) => ` · ${world.character?.skills[id]?.label ?? id} ${value}`).join("")}</p>{appointment && !readOnly && <button type="button" disabled={!appointment.available || life.phase !== "ready"} onClick={() => onActivity(appointment.id)}>{appointment.text}</button>}{appointment?.reason && <small>{appointment.reason}</small>}</article>;
    })}</details>}
  </aside>;
}

/** A fixed, inspectable skill DAG. Views only select and display engine-owned work. */
export default function CapabilityTree({ world, life, activities, onActivity, readOnly = false }: {
  world: WorldPack; life: LifeState; activities: readonly ActivityAvailability[]; onActivity(id: string): void; readOnly?: boolean;
}) {
  const layout = useMemo(() => buildCapabilityLayout(), []);
  const view = useMemo(() => capabilityView(world, life), [world, life]);
  const byId = useMemo(() => new Map(view.nodes.map(node => [node.id, node])), [view]);
  const [selectedId, setSelectedId] = useState("F1");
  const [pathSelected, setPathSelected] = useState(false);
  const [branch, setBranch] = useState("all");
  const [query, setQuery] = useState("");
  const { viewport, paper, zoom, dragging, fit, changeZoom, focusPoint, pointerHandlers } = useSkillMapNavigation(layout);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const instanceId = useId();
  const selected = CAPABILITY_NODES.find(node => node.id === selectedId) ?? CAPABILITY_NODES[0];
  const selectedView = byId.get(selected.id) ?? { ...EMPTY_VIEW, id: selected.id };
  const ancestors = useMemo(() => pathSelected ? capabilityAncestors(CAPABILITY_NODES, selected.id) : new Set<string>(), [pathSelected, selected.id]);
  const needle = query.trim().toLocaleLowerCase();
  const matches = (node: CapabilityNode) => !needle || `${node.id} ${node.title} ${node.branch} ${node.specialization ?? ""}`.toLocaleLowerCase().includes(needle);
  const learned = view.nodes.filter(node => node.state === "learned").length;
  const mastered = CAPABILITY_NODES.filter(node => node.depth === 10 && byId.get(node.id)?.state === "learned").length;

  function centerNode(id: string, scale?: number) {
    const point = layout.nodes.find(item => item.node.id === id);
    if (point) focusPoint(point, scale);
  }
  function select(id: string, focus = false) {
    setSelectedId(id); setPathSelected(true);
    if (focus) requestAnimationFrame(() => { nodeRefs.current.get(id)?.focus({ preventScroll: true }); centerNode(id); });
  }
  function highlight(value: string) {
    setBranch(value); setPathSelected(false);
    if (value !== "all") {
      const root = CAPABILITY_NODES.find(node => node.branch === value)!;
      setSelectedId(root.id);
    }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const next = nextCapabilityNode(layout, id, event.key);
    if (!next) return;
    event.preventDefault(); select(next, true);
  }
  return <section className="capability-tree" aria-labelledby={`${instanceId}-title`} data-capability-version={world.capabilities?.version ?? "reference"}>
    <header className="capability-heading"><div><h3 id={`${instanceId}-title`}>The paths a life can take</h3><p>Learn the craft. Do the work. Let one skill open the next.</p></div><div className="capability-total"><strong>{learned}<span> / {CAPABILITY_NODES.length}</span></strong><span>skills learned{mastered > 0 ? ` · ${mastered} mastery path${mastered > 1 ? "s" : ""}` : ""}</span></div></header>
    {!view.enabled && <p className="capability-world-note" role="note">This life keeps its earlier skill rules. The complete atlas is shown as a reference; begin a new life in the current world to learn these nodes.</p>}
    <div className="capability-branches" role="group" aria-label="Highlight a skill branch"><button type="button" aria-pressed={branch === "all"} onClick={() => highlight("all")}>Whole tree</button>{CAPABILITY_BRANCHES.map(label => <button key={label} type="button" aria-pressed={branch === label} onClick={() => highlight(label)}><CapabilityIcon id="" branch={label} specialization={null} /><span>{label}<small>{BRANCH_DESCRIPTIONS[label]}</small></span></button>)}</div>
    <div className="capability-toolbar"><label htmlFor={`${instanceId}-find`}>Find a skill<input id={`${instanceId}-find`} type="search" placeholder="Try soil, pottery or inquiry" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="capability-map-controls" role="group" aria-label="Skill map zoom"><button type="button" aria-label="Zoom out skill map" disabled={zoom <= MAP_MIN_ZOOM} onClick={() => changeZoom(zoom / 1.3)}>−</button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button type="button" aria-label="Zoom in skill map" disabled={zoom >= MAP_MAX_ZOOM} onClick={() => changeZoom(zoom * 1.3)}>+</button><button type="button" onClick={() => fit()}>Fit whole tree</button><button type="button" onClick={() => { setPathSelected(true); centerNode(selected.id, 1); }}>Read selected path</button></div></div>
    <div className="capability-legend" aria-label="Skill map states">{(["learned", "available", "locked", "unavailable"] as const).map(state => <span key={state} className={`is-${state}`}><i aria-hidden="true" />{STATUS_LABEL[state]}</span>)}<span className="capability-mastery-key">Double frame · depth 10</span></div>
    <p className="capability-map-help" id={`${instanceId}-help`}>Scroll to zoom at your pointer. Drag to explore; pinch to zoom on touchscreens. Select a skill to light its path from the root. Arrow keys follow connected skills, Enter selects.</p>
    <div className="capability-workspace">
      <div className="capability-map-area"><div className={`capability-viewport${zoom < .55 ? " is-overview" : ""}${dragging ? " is-dragging" : ""}`} ref={viewport} {...pointerHandlers} aria-label="Connected skill tree" aria-describedby={`${instanceId}-help`}>
        <div className="capability-paper" ref={paper} style={{ width: layout.width, height: layout.height }}>
          <svg className="capability-connections" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
            <defs><pattern id={`${instanceId}-fiber`} width="43" height="37" patternUnits="userSpaceOnUse"><path d="M3 7h4M26 29h6M15 19h2" stroke="currentColor" strokeWidth=".7" opacity=".12" /></pattern></defs>
            <rect width={layout.width} height={layout.height} fill={`url(#${instanceId}-fiber)`} />
            {layout.bands.map(band => <g key={band.branch} className={branch !== "all" && branch !== band.branch ? "is-muted" : ""}><line x1="24" x2={layout.width - 24} y1={band.top} y2={band.top} className="capability-band-rule" /><text x="34" y={band.titleY} className="capability-band-title">{band.branch}</text><text x="34" y={band.titleY + 19} className="capability-band-subtitle">{BRANCH_DESCRIPTIONS[band.branch]}</text></g>)}
            {Array.from({ length: 10 }, (_, index) => <text key={index} x={100 + index * 142} y="26" textAnchor="middle" className="capability-depth-label">{index + 1}</text>)}
            {layout.links.map(link => {
              const from = byId.get(link.from), to = byId.get(link.to);
              const target = CAPABILITY_NODES.find(node => node.id === link.to)!;
              const lineage = ancestors.has(link.from) && ancestors.has(link.to);
              return <path key={`${link.from}-${link.to}`} data-from={link.from} data-to={link.to} data-crossover={link.crossover || undefined} d={link.path} className={`capability-link${link.crossover?" is-crossover":""}${lineage ? " is-lineage" : pathSelected ? " is-off-path" : ""}${from?.state === "learned" && to?.state === "learned" ? " is-learned" : ""}${branch !== "all" && target.branch !== branch && !lineage ? " is-muted" : ""}`} />;
            })}
          </svg>
          {layout.nodes.map(({ node, x, y }) => {
            const state = byId.get(node.id)?.state ?? "unavailable";
            const lineage = ancestors.has(node.id);
            return <button type="button" key={node.id} ref={element => { if (element) nodeRefs.current.set(node.id, element); else nodeRefs.current.delete(node.id); }} className={`capability-node is-${state}${node.id === selected.id ? " is-selected" : ""}${lineage ? " is-lineage" : pathSelected ? " is-off-path" : ""}${node.depth === 10 ? " is-mastery" : ""}${!lineage && (branch !== "all" && node.branch !== branch || !matches(node)) ? " is-muted" : ""}`} style={{ left: x, top: y }} data-capability-id={node.id} data-state={state} aria-label={capabilityNodeLabel(node, STATUS_LABEL[state])} aria-pressed={node.id === selected.id} aria-controls={`${instanceId}-detail`} tabIndex={node.id === selected.id ? 0 : -1} title={capabilityNodeLabel(node, STATUS_LABEL[state])} onClick={() => select(node.id)} onKeyDown={event => navigate(event, node.id)}>
              <span className="capability-seal"><NodeShape branch={node.branch} mastery={node.depth === 10} /><CapabilityIcon {...node} /><span className="capability-node-id">{node.id}</span>{state === "learned" && <span className="capability-earned-mark" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" /></svg></span>}</span><span className="capability-node-name">{node.title}</span>
            </button>;
          })}
        </div>
      </div><label className="capability-node-picker" htmlFor={`${instanceId}-node`}>Inspect a skill<select id={`${instanceId}-node`} value={selected.id} onChange={event => select(event.target.value)}>{CAPABILITY_BRANCHES.map(label => <optgroup key={label} label={label}>{CAPABILITY_NODES.filter(node => node.branch === label && (matches(node) || node.id === selected.id)).map(node => <option key={node.id} value={node.id}>{node.id} · {node.title} · {STATUS_LABEL[byId.get(node.id)?.state ?? "unavailable"]}</option>)}</optgroup>)}</select></label><p className="capability-map-summary" role="status">{needle ? `${CAPABILITY_NODES.filter(matches).length} matching skills. ` : ""}{selected.title} selected · {STATUS_LABEL[selectedView.state]}.</p></div>
      <CapabilityInspector node={selected} view={selectedView} {...{ world, life, activities, readOnly, onActivity }} onSelect={id => select(id, true)} detailId={`${instanceId}-detail`} />
    </div>
    <p className="capability-footnote">One major work action per year. Learning requires both proficiency and recorded deeds; a score alone never completes a node. Careers and economic effects are shown in each skill's details.</p>
  </section>;
}
