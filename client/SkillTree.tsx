import { displayProse } from "./display-prose.ts";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../src/types.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import ImpactValue from "./ImpactValue.tsx";
import { buildSkillTree, currentSkillTree, practiceBlockReason, skillActionRequirements, trainingSkillChanges } from "./skill-tree.ts";
import type { SkillNode, SkillRequirement } from "./skill-tree.ts";
import SkillArtwork from "./SkillArtwork.tsx";
import SkillRiverMap from "./SkillRiverMap.tsx";
import type { SkillRiverHandle } from "./SkillRiverMap.tsx";
import { SKILL_RIVER_REVISION, skillRequirementNotes } from "./skill-river.ts";
import { activityLoanOffer } from "./loan-access.ts";
import SkillGrowth from "./SkillGrowth.tsx";
import LateSkillRoutes from "./LateSkillRoutes.tsx";
import { formatSkillValue as skillNumber } from "./skill-growth.ts";
import "./skill-tree.css";
import "./skill-river.css";
import "./skill-river-contrast.css";
import "./skill-atlas-theme.css";

function SkillIcon({ id }: { id: string }) {
  return <SkillArtwork id={id} />;
}

function Requirement({ requirement, onSelect, note = false }: { requirement: SkillRequirement; onSelect?: (id: string) => void; note?: boolean }) {
  return <li className={`${requirement.met ? "skill-requirement met" : "skill-requirement missing"}${note ? " skill-requirement-note" : ""}`}>
    <span className="skill-requirement-mark" aria-hidden="true">{requirement.met ? "✓" : "○"}</span>
    {note && <span className="skill-requirement-note-label">Requires:</span>}
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
  const [selectedId, setSelectedId] = useState("craft");
  const [detailOpen, setDetailOpen] = useState(false);
  const mapRef = useRef<SkillRiverHandle>(null);
  const detailRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useState("");
  const instanceId = useId();
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocus.current && mapRef.current) { mapRef.current.focusSkill(pendingFocus.current); pendingFocus.current = null; }
  }, [view, selectedId]);
  const selected = model.nodes.find(node => node.id === selectedId) ?? model.nodes[0];
  if (!fullModel.nodes.length) return <p className="character-empty">This world has no skills to practice.</p>;
  if (!selected) return <div className="skill-tree skill-tree-empty"><h3>Your skills</h3><p>Skills unlock as you grow and learn. Browse the wiki for future paths and requirements.</p><button type="button" className="skill-wiki-link" onClick={() => setView("wiki")}>Skill wiki <span aria-hidden="true">↗</span></button></div>;
  const query = search.trim().toLocaleLowerCase();
  const matches = (node: SkillNode) => `${node.label} ${node.branch} ${node.description}`.toLocaleLowerCase().includes(query);
  const matchCount = model.nodes.filter(matches).length;
  const mastered = model.nodes.filter(node => node.state === "mastered").length;
  const started = model.nodes.filter(node => node.value > node.min).length;
  const outgoing = model.nodes.filter(node => node.requirements.some(item => item.id === selected.id));
  const requirementNotes = skillRequirementNotes(selected, fullModel);
  const otherTraining = wiki ? model.otherTraining : model.otherTraining.filter(activity => !practiceBlockReason(activity, life));

  function openDetails(id: string) {
    select(id);
    setDetailOpen(true);
    requestAnimationFrame(() => {
      detailRef.current?.querySelector("button")?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }
  function select(id: string, focus = false) {
    if (!model.nodes.some(node => node.id === id)) setView("wiki");
    setSelectedId(id);
    if (focus) {
      if (!model.nodes.some(node => node.id === id)) pendingFocus.current = id;
      else mapRef.current?.focusSkill(id);
    }
  }

  return <div className="skill-tree skill-river" data-tree-id={`${world.id}:character.skills`} data-tree-revision={world.version} data-layout-revision={SKILL_RIVER_REVISION}>
    <div className="skill-tree-heading"><div><span className="skill-tree-eyebrow">{wiki ? "Reference" : "Training"}</span><h3>{wiki ? "All skill paths" : "Your skills"}</h3><p>{wiki ? "Follow your curiosity. Find your own way downstream." : "A little practice. A new current. A path of your own."}</p></div><button type="button" className="skill-wiki-link" onClick={() => { setView(wiki ? "current" : "wiki"); setDetailOpen(false); }}>{wiki ? "Your skills" : "Skill wiki"} <span aria-hidden="true">↗</span></button><div className="skill-tree-tally"><strong>{started}<span> / {model.nodes.length}</span></strong><span>skills learned{mastered > 0 ? ` · ${mastered} mastered` : ""}</span></div></div>
    <div className="skill-tree-toolbar">
      <div className="skill-tree-search"><label htmlFor={`${instanceId}-search`}>Find a skill</label><input id={`${instanceId}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try pottery or astronomy" autoComplete="off" /></div>
      <div className="skill-tree-legend" aria-label="Skill states">{model.nodes.some(node => node.state === "locked") && <span className="is-locked">Locked</span>}<span className="is-ready">Ready</span><span className="is-learning">Learning</span><span className="is-mastered">Mastered</span></div>
    </div>
    <p className="skill-tree-map-note" id={`${instanceId}-map-help`}>{query ? `${matchCount} matching ${matchCount === 1 ? "skill" : "skills"}.` : "Choose a branch, then follow its skills downstream."} <span>Hover or focus an icon for a summary and every prerequisite.</span></p>
    <div className={`skill-tree-layout${detailOpen ? " has-detail" : ""}`}>
      <SkillRiverMap ref={mapRef} model={model} query={query} selectedId={selected.id} detailOpen={detailOpen} age={life.age} detailId={`${instanceId}-detail`} onSelect={openDetails} />
      <aside ref={detailRef} hidden={!detailOpen} className={`skill-tree-detail is-${selected.state}`} id={`${instanceId}-detail`} aria-label={`${selected.label} details`}>
        <button type="button" className="skill-detail-close" onClick={() => { setDetailOpen(false); mapRef.current?.focusSkill(selected.id); }} aria-label="Close skill details">Back to the river <span aria-hidden="true">↑</span></button>
        <div className="skill-detail-title"><span className="skill-detail-icon"><SkillIcon id={selected.id} /></span><div><span className="skill-detail-branch">{selected.branch}</span><h4>{selected.label}</h4></div><span className="skill-detail-state">{selected.state}</span></div>
        <p className="skill-detail-description">{displayProse(selected.description)}</p>
        <div className="skill-detail-proficiency"><label htmlFor={`${instanceId}-proficiency`}>Proficiency <strong>{skillNumber(selected.value, selected.max)}<span> / {selected.max}</span></strong></label><meter id={`${instanceId}-proficiency`} min={selected.min} max={selected.max} value={selected.value} /></div>
        <SkillGrowth life={life} world={world} skillId={selected.id} />
        <section className="skill-detail-section"><h5>Requirements</h5><ul className="skill-requirement-list">
          {selected.minAge > 0 && <li className={`skill-requirement ${selected.ageMet ? "met" : "missing"}`}><span className="skill-requirement-mark" aria-hidden="true">{selected.ageMet ? "✓" : "○"}</span><span>Age {selected.minAge} or older</span><span className="skill-requirement-numbers">{selected.ageMet ? "Met" : `Age ${life.age}`}</span></li>}
          {selected.requirements.map(item => <Requirement key={item.id} requirement={item} note={requirementNotes.some(note => note.id === item.id)} onSelect={id => select(id, true)} />)}
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
    <div hidden={!detailOpen}><LateSkillRoutes world={world} life={life} activities={activities} onActivity={onActivity} readOnly={wiki} skillId={selected.id} /></div>
    <details className="skill-icon-credits"><summary>Icon credits</summary><p>Icons made by Delapouite, Lorc and Willdabeast. Available on <a href="https://game-icons.net" target="_blank" rel="noreferrer">Game-icons.net</a>, under <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>. Backgrounds removed; display colors and sizes adjusted.</p></details>
    <p className="skill-tree-footnote">One activity per year. Skills also improve through work and events.{world.character?.skills[selected.id]?.gainCurve && " Gains get smaller at higher proficiency."}</p>
  </div>;
}
