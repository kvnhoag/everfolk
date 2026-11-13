import { useId, useMemo, useRef, useState, type KeyboardEvent, type CSSProperties } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import type { CapabilityNode, CapabilityNodeView, CapabilityStatus } from "../../src/capabilities/types.ts";
import { capabilityView } from "../../src/capabilities/view.ts";
import { buildCapabilityLayout, CAPABILITY_NODES, capabilityAncestors, capabilityNodeLabel, nextCapabilityNode } from "../models/capability-layout.ts";
import CapabilityIcon from "./CapabilityIcon.tsx";
import { capabilityPresentations, capabilityTier, firstSentence, type CapabilityPresentation } from "../models/capability-presentation.ts";
import { useSkillMapNavigation } from "../hooks/useSkillMapNavigation.ts";
import { skillMapStartNode } from "../models/skill-map-camera.ts";
import "../styles/capability-tree.css";
import "../styles/capability-tree-layout.css";

const STATUS_LABEL: Record<CapabilityStatus, string> = { learned: "Learned", available: "Ready to work", locked: "Locked", unavailable: "Unavailable" };
const BRANCH_DESCRIPTIONS: Record<string, string> = {
  Physique: "Strength, endurance and physical work",
  Handmade: "Clothing, ceramics and sculpture",
  Knowledge: "Reading, inquiry and public reasoning",
  Trade: "Commercial planning",
};
const EMPTY_VIEW: CapabilityNodeView = { id: "", state: "unavailable", reasons: ["This path is unavailable in this world."], progress: { done: 0, required: 1 }, actionId: null, actionLabel: "Work on this skill", requirementText: [] };

const BRANCH_INKS: Record<string, string> = { Physique: "#45664d", Knowledge: "#466a82", Handmade: "#986146", Trade: "#957128" };
function sourceStyle(sources: readonly string[]): CSSProperties {
  return { "--cap-source-1": BRANCH_INKS[sources[0]], "--cap-source-2": BRANCH_INKS[sources[1]] } as CSSProperties;
}
function NodeShape({ branch, milestone = false, crossover = false }: { branch: string; milestone?: boolean; crossover?: boolean }) {
  return <svg className="capability-node-shape" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    {milestone || crossover ? <path d="M12 3h40l9 9v40l-9 9H12l-9-9V12l9-9Z" />
      : branch === "Physique" ? <path d="M32 3C48 3 59 15 59 32S48 61 32 61 5 49 5 32 16 3 32 3Z" />
        : branch === "Handmade" ? <path d="m32 3 26 14v30L32 61 6 47V17L32 3Z" />
          : branch === "Knowledge" ? <path d="M13 5h38l8 8v38l-8 8H13l-8-8V13l8-8Z" /> : <path d="M32 2 61 32 32 62 3 32Z" />}
    {milestone && <><path className="capability-milestone-frame" d="M15 8h34l7 7v34l-7 7H15l-7-7V15l7-7Z" /><path className="capability-milestone-crown" d="m25 3 2-6 5 4 5-4 2 6M3 25l-3 3v8l3 3m58-14 3 3v8l-3 3" /></>}
    {crossover && <><path className="capability-source-ring source-one" d="M32 3H12l-9 9v40l9 9h20" /><path className="capability-source-ring source-two" d="M32 3h20l9 9v40l-9 9H32" /></>}
  </svg>;
}
function SourceBranches({ sources }: { sources: readonly string[] }) {
  return <span className="capability-source-names" style={sourceStyle(sources)}>{sources.map((branch, index) => <span key={branch} className={`source-${index === 0 ? "one" : "two"}`}>{index > 0 && <b aria-hidden="true">+</b>}{branch}</span>)}</span>;
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

export function CapabilityInspector({ node, view, world, life, activities, readOnly, onActivity, onAssess, onSelect, detailId, presentation, calendarDeadline = false, onCalendarDeadlineChange, selectedJobIds = [], onToggleJobId }: {
  node: CapabilityNode; view: CapabilityNodeView; world: WorldPack; life: LifeState;
  activities: readonly ActivityAvailability[]; readOnly: boolean; onActivity(id: string, options?: { calendarDeadline?: boolean }): void;
  onAssess?(nodeId: string, jobIds: readonly string[]): void; onSelect(id: string): void; detailId: string; presentation?: CapabilityPresentation;
  calendarDeadline?: boolean; onCalendarDeadlineChange?(checked: boolean): void;
  selectedJobIds?: readonly string[]; onToggleJobId?(jobId: string): void;
}) {
  const nodes = (world.capabilities?.version ?? 0) >= 2 ? world.capabilities!.nodes : CAPABILITY_NODES;
  const action = activities.find(activity => activity.id === view.actionId);
  const feature = presentation ?? capabilityPresentations(nodes, world).get(node.id)!;
  const jobs = relatedJobs(world, node), training = practiceFor(world, node, activities);
  const canWork = Boolean(action?.available) && life.phase === "ready";
  const learned = life.capabilities?.learned[node.id];
  const activeProject = life.capabilities?.project?.nodeId === node.id ? life.capabilities.project : undefined;
  const terms = view.terms;
  const eligibleJobs = view.eligibleJobs ?? [];
  const blocker = !canWork ? action?.reason || view.reasons[0] : undefined;
  const gates = [
    ...Object.entries(node.minimumProficiency).map(([id, target]) => ({ id, label: world.character?.skills[id]?.label ?? id, current: life.character?.skills[id] ?? 0, target })),
    ...Object.entries(node.minimumStats ?? {}).map(([id, target]) => ({ id, label: world.stats[id]?.label ?? id, current: life.stats[id] ?? 0, target })),
  ].filter(gate => gate.target > 0);
  const reward = feature.titles.length ? `Career opportunity: ${feature.titles.join(" · ")}` : firstSentence(node.reward);
  return <aside className={`capability-inspector is-${view.state}${feature.milestone ? " is-milestone" : ""}${feature.crossover ? " is-crossover" : ""}`} id={detailId} aria-label={`${node.title} details`}>
    <header className="capability-detail-heading"><span className="capability-detail-mark"><CapabilityIcon {...node} /></span><div><p>{node.branch}{node.specialization ? ` · ${node.specialization}` : ""}</p><h4>{node.title}</h4></div></header>
    <div className="capability-detail-meta"><span>{node.id} · Depth {node.depth} of 10</span><strong>{STATUS_LABEL[view.state]}{learned ? ` · age ${learned.age}` : ""}</strong></div>
    {feature.crossover && <div className="capability-crossover-note"><span>Requires both branches</span><SourceBranches sources={feature.sources} /></div>}
    <section className="capability-unlock-summary"><h5>{feature.milestone ? "Milestone unlock" : "Unlocks"}</h5><p>{reward}</p></section>
    <section><h5>Requirements</h5>{node.prerequisites.all.length > 0 && <div className="capability-parent-links">{node.prerequisites.all.map(id => <button key={id} type="button" onClick={() => onSelect(id)}>{nodes.find(parent => parent.id === id)?.title ?? id}<span>{life.capabilities?.learned[id] ? "✓" : id}</span></button>)}</div>}
      {gates.length > 0 && <ul className="capability-proficiency-list">{gates.map(gate => <li key={gate.id} className={gate.current >= gate.target ? "is-met" : ""}><span>{gate.label}</span><strong>{Math.floor(gate.current)} / {gate.target}</strong></li>)}</ul>}
      {!node.prerequisites.all.length && !gates.length && <p>No earlier skill required.</p>}
      {node.anyProficiency && <p className="capability-alternative">Also one of: {node.anyProficiency.map(group => Object.entries(group).map(([id, value]) => `${world.character?.skills[id]?.label ?? id} ${value}`).join(" + ")).join(" or ")}.</p>}
    </section>
    <section><h5>Demonstrated work</h5><p>{firstSentence(node.proof)}</p><div className="capability-proof-progress"><progress aria-label={`${node.title} demonstrated work`} max={Math.max(1, view.progress.required)} value={Math.min(view.progress.done, Math.max(1, view.progress.required))} /><span>{view.progress.done} / {view.progress.required} work steps</span></div></section>
    {terms && <section className="capability-terms"><h5>Commission terms</h5><ul>
      <li>Materials: {terms.materialsOwner === "employer" ? "Employer-supplied" : terms.materialsOwner === "worker" ? "Worker-provided" : "None required"}</li>
      <li>Quantity: {terms.quantity} · Minimum quality: Grade {terms.minimumQuality}</li>
      <li>Total payment: {terms.totalPayment} dr · Payer: {terms.payers ? terms.payers.join(" & ") : terms.payer}</li>
      <li>Work-year deadline: {terms.workYearDeadline} active work year{terms.workYearDeadline === 1 ? "" : "s"}{terms.completedWorkYears !== undefined ? ` (${terms.completedWorkYears} complete)` : ""}</li>
      {terms.calendarDeadlineYear !== undefined
        ? <li>Calendar deadline: year {terms.calendarDeadlineYear} (unpaid future payment forfeits if missed)</li>
        : terms.calendarDeadlineYears !== undefined && <li>Optional calendar deadline: {terms.calendarDeadlineYears} calendar years from start (unpaid future payment forfeits if missed)</li>}
      {terms.reservedMissing && Object.keys(terms.reservedMissing).length > 0 && <li>Missing reserved stock: {Object.entries(terms.reservedMissing).map(([item, qty]) => `${qty} ${item}`).join(", ")} (replace before resuming)</li>}
    </ul></section>}
    {!readOnly && view.actionId && !activeProject && terms?.calendarDeadlineYears && <label className="capability-deadline-toggle"><input type="checkbox" checked={calendarDeadline} onChange={event => onCalendarDeadlineChange?.(event.target.checked)} /> Commit to {terms.calendarDeadlineYears}-year calendar deadline</label>}
    {!readOnly && view.actionId && <div className="capability-work-action"><button className="capability-work-button" type="button" disabled={!canWork || view.state === "unavailable"} onClick={() => { if (canWork && action) { if (!activeProject && calendarDeadline) onActivity(action.id, { calendarDeadline: true }); else onActivity(action.id); } }}>{view.actionLabel}<span aria-hidden="true">→</span></button></div>}
    {blocker && <p className="capability-blocker">{blocker}</p>}
    {!learned && eligibleJobs.length > 0 && <section className="capability-assess-jobs"><h5>Qualify via completed jobs</h5><p>Select 2 distinct completed ordinary jobs from this path for assessment (qualification only; payouts and goods are not repeated).</p><ul>{eligibleJobs.map(job => {
      const checked = selectedJobIds.includes(job.jobId);
      const limitReached = !checked && selectedJobIds.length >= 2;
      return <li key={job.jobId}><label><input type="checkbox" checked={checked} disabled={readOnly || Boolean(life.capabilities?.project) || limitReached} onChange={() => onToggleJobId?.(job.jobId)} /><span>{job.title} ({job.jobId}) · age {job.age} · year {job.year} · {job.payment} dr</span></label></li>;
    })}</ul>{!readOnly && onAssess && <button type="button" className="capability-assess-button" disabled={life.phase !== "ready" || Boolean(life.capabilities?.project) || selectedJobIds.length !== 2} onClick={() => onAssess(node.id, selectedJobIds)}>Assess 2 selected jobs</button>}</section>}
    {readOnly && <p className="capability-read-only">Preview · take work in a new life.</p>}
    {!readOnly && training.length > 0 && <details className="capability-practice"><summary>Training options</summary>{training.map(activity => <div key={activity.id}><p>{activity.text}</p><button type="button" disabled={!activity.available || life.phase !== "ready"} onClick={() => onActivity(activity.id)}>Practice</button>{activity.reason && <small>{activity.reason}</small>}</div>)}</details>}
    <details className="capability-full-rules"><summary>Full rules &amp; career opportunities</summary><section><h5>Work proof</h5><p>{node.proof}</p><h5>Full reward</h5><p>{node.reward}</p></section>{jobs.map(job => {
      const appointment = activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job === job.id)));
      return <article key={job.id}><h5>{job.title}</h5><p>Age {job.minAge}+ · {Object.entries(job.requirements ?? {}).map(([id, value]) => `${world.character?.skills[id]?.label ?? id} ${value}`).join(" · ")}</p>{appointment && !readOnly && <button type="button" disabled={!appointment.available || life.phase !== "ready"} onClick={() => onActivity(appointment.id)}>{appointment.text}</button>}{appointment?.reason && <small>{appointment.reason}</small>}</article>;
    })}</details>
  </aside>;
}

/** A fixed, inspectable skill DAG. Views only select and display engine-owned work. */
export default function CapabilityTree({ world, life, activities, onActivity, onAssess, readOnly = false }: {
  world: WorldPack; life: LifeState; activities: readonly ActivityAvailability[];
  onActivity(id: string, options?: { calendarDeadline?: boolean }): void; onAssess?(nodeId: string, jobIds: readonly string[]): void; readOnly?: boolean;
}) {
  const nodes = (world.capabilities?.version ?? 0) >= 2 ? world.capabilities!.nodes : CAPABILITY_NODES;
  const layout = useMemo(() => buildCapabilityLayout(nodes), [nodes]);
  const presentations = useMemo(() => capabilityPresentations(nodes, world), [world]);
  const view = useMemo(() => capabilityView(world, life), [world, life]);
  const byId = useMemo(() => new Map(view.nodes.map(node => [node.id, node])), [view]);
  // The tree opens zoomed out on the whole atlas; the inspector starts on the player's own progress.
  const [selectedId, setSelectedId] = useState(() => skillMapStartNode(view.nodes, new Map(nodes.map(node => [node.id, node.depth])), nodes.find(node => node.id === "F1")?.id ?? nodes[0].id));
  const [pathSelected, setPathSelected] = useState(false);
  const [calendarDeadlines, setCalendarDeadlines] = useState<Record<string, boolean>>({});
  const [selectedJobsByNode, setSelectedJobsByNode] = useState<Record<string, string[]>>({});
  const { viewport, paper, zoom, minZoom, dragging, focusPoint, pointerHandlers } = useSkillMapNavigation(layout);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const instanceId = useId();
  const selected = nodes.find(node => node.id === selectedId) ?? nodes[0];
  const selectedView = byId.get(selected.id) ?? { ...EMPTY_VIEW, id: selected.id };
  const ancestors = useMemo(() => pathSelected ? capabilityAncestors(nodes, selected.id) : new Set<string>(), [pathSelected, selected.id, nodes]);
  const learned = view.nodes.filter(node => node.state === "learned").length;
  const mastered = nodes.filter(node => node.depth === 10 && byId.get(node.id)?.state === "learned").length;

  function centerNode(id: string, scale?: number) {
    const point = layout.nodes.find(item => item.node.id === id);
    if (point) focusPoint(point, scale);
  }
  function select(id: string, focus = false) {
    setSelectedId(id); setPathSelected(true);
    if (focus) requestAnimationFrame(() => { nodeRefs.current.get(id)?.focus({ preventScroll: true }); centerNode(id); });
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const next = nextCapabilityNode(layout, id, event.key);
    if (!next) return;
    event.preventDefault(); select(next, true);
  }
  return <section className="capability-tree" aria-labelledby={`${instanceId}-title`} data-capability-version={world.capabilities?.version ?? "reference"}>
    <header className="capability-heading"><div><h3 id={`${instanceId}-title`}>The paths a life can take</h3><p>Learn the craft. Do the work. Let one skill open the next.</p></div><div className="capability-total"><strong>{learned}<span> / {nodes.length}</span></strong><span>skills learned{mastered > 0 ? ` · ${mastered} mastery path${mastered > 1 ? "s" : ""}` : ""}</span></div></header>
    {!view.enabled && <p className="capability-world-note" role="note">This life keeps its earlier skill rules. The complete atlas is shown as a reference; begin a new life in the current world to learn these nodes.</p>}
    <div className="capability-legend" aria-label="Tree legend">{(["learned", "available", "locked", "unavailable"] as const).map(state => <span key={state} className={`is-${state}`}><i aria-hidden="true" />{state === "available" ? "Ready" : STATUS_LABEL[state]}</span>)}<span className="capability-legend-crossover"><NodeShape branch="Physique" crossover />Crossover</span><span className="capability-legend-milestone"><NodeShape branch="Physique" milestone />Title / key skill</span><span className="capability-legend-path"><i aria-hidden="true" />Selected path</span></div>
    <p className="capability-map-help" id={`${instanceId}-help`}>The whole tree is shown · Scroll or pinch to zoom in, then drag to move · Click a skill to trace its roots · Arrow keys to navigate</p>
    <div className="capability-workspace">
      <div className="capability-map-area"><div className={`capability-viewport${zoom < .55 ? " is-overview" : ""}${zoom <= minZoom + .001 ? " is-fitted" : ""}${dragging ? " is-dragging" : ""}`} ref={viewport} {...pointerHandlers} aria-label="Connected skill tree" aria-describedby={`${instanceId}-help`}>
        <div className="capability-paper" ref={paper} style={{ width: layout.width, height: layout.height }}>
          <svg className="capability-connections" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
            <defs><pattern id={`${instanceId}-fiber`} width="43" height="37" patternUnits="userSpaceOnUse"><path d="M3 7h4M26 29h6M15 19h2" stroke="currentColor" strokeWidth=".7" opacity=".12" /></pattern></defs>
            <rect width={layout.width} height={layout.height} fill={`url(#${instanceId}-fiber)`} />
            {layout.bands.map(band => <g key={band.branch}><line x1="24" x2={layout.width - 24} y1={band.top} y2={band.top} className="capability-band-rule" /><text x="34" y={band.titleY} className="capability-band-title">{band.branch}</text><text x="34" y={band.titleY + 19} className="capability-band-subtitle">{BRANCH_DESCRIPTIONS[band.branch]}</text></g>)}
            {Array.from({ length: 10 }, (_, index) => <text key={index} x={100 + index * 142} y="26" textAnchor="middle" className="capability-depth-label">{index + 1}</text>)}
            {layout.links.map(link => {
              const from = byId.get(link.from), to = byId.get(link.to);
              const target = nodes.find(node => node.id === link.to)!;
              const lineage = ancestors.has(link.from) && ancestors.has(link.to);
              return <path key={`${link.from}-${link.to}`} data-from={link.from} data-to={link.to} data-crossover={link.crossover || undefined} d={link.path} className={`capability-link${link.crossover?" is-crossover":""}${lineage ? " is-lineage" : pathSelected ? " is-off-path" : ""}${from?.state === "learned" && to?.state === "learned" ? " is-learned" : ""}${capabilityTier(to?.state) === "unavailable" ? " is-unavailable" : ""}`} />;
            })}
          </svg>
          {layout.nodes.map(({ node, x, y }) => {
            const state = byId.get(node.id)?.state ?? "unavailable";
            const lineage = ancestors.has(node.id);
            const feature = presentations.get(node.id)!;
            return <button type="button" key={node.id} ref={element => { if (element) nodeRefs.current.set(node.id, element); else nodeRefs.current.delete(node.id); }} className={`capability-node is-${state} tier-${capabilityTier(state)}${node.id === selected.id ? " is-selected" : ""}${lineage ? " is-lineage" : pathSelected ? " is-off-path" : ""}${node.depth === 10 ? " is-mastery" : ""}${feature.milestone ? " is-milestone" : ""}${feature.crossover ? " is-crossover" : ""}`} style={{ left: x, top: y, ...sourceStyle(feature.sources) }} data-capability-id={node.id} data-node-kind={feature.crossover ? "crossover" : feature.milestone ? "milestone" : "standard"} data-source-branches={feature.crossover ? feature.sources.join(" + ") : undefined} data-state={state} aria-label={`${capabilityNodeLabel(node, STATUS_LABEL[state])}${feature.crossover ? ` · Requires ${feature.sources.join(" and ")}` : ""}${feature.milestone ? " · Title or key skill" : ""}`} aria-pressed={node.id === selected.id} aria-controls={`${instanceId}-detail`} tabIndex={node.id === selected.id ? 0 : -1} title={`${capabilityNodeLabel(node, STATUS_LABEL[state])}${feature.titles.length ? ` · Opens ${feature.titles.join(", ")}` : feature.keySkill ? " · Opens multiple skills" : ""}${feature.crossover ? ` · ${feature.sources.join(" + ")}` : ""}`} onClick={() => select(node.id)} onKeyDown={event => navigate(event, node.id)}>
              <span className="capability-seal"><NodeShape branch={node.branch} milestone={feature.milestone} crossover={feature.crossover} /><CapabilityIcon {...node} /><span className="capability-node-id">{node.id}</span>{state === "learned" && <span className="capability-earned-mark" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" /></svg></span>}</span><span className="capability-node-name">{node.title}</span>{feature.crossover && <SourceBranches sources={feature.sources} />}
            </button>;
          })}
        </div>
      </div></div>
      <CapabilityInspector key={selected.id} node={selected} presentation={presentations.get(selected.id)} view={selectedView} {...{ world, life, activities, readOnly, onActivity, onAssess }}
        calendarDeadline={Boolean(calendarDeadlines[selected.id])}
        onCalendarDeadlineChange={checked => setCalendarDeadlines(prev => ({ ...prev, [selected.id]: checked }))}
        selectedJobIds={selectedJobsByNode[selected.id] ?? []}
        onToggleJobId={jobId => setSelectedJobsByNode(prev => {
          const current = prev[selected.id] ?? [];
          return { ...prev, [selected.id]: current.includes(jobId) ? current.filter(id => id !== jobId) : [...current, jobId].slice(0, 2) };
        })}
        onSelect={id => select(id, true)} detailId={`${instanceId}-detail`} />
    </div>
    <p className="capability-footnote">One major work action per year. Skills require practice and demonstrated work.</p>
  </section>;
}
