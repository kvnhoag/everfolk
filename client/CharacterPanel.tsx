import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../src/types.ts";
import { activityPartnerIds } from "../src/character.ts";
import { engineForLife } from "./session.ts";
import ImpactValue from "./ImpactValue.tsx";
import ChoiceImpact from "./ChoiceImpact.tsx";
import SkillTree from "./SkillTree.tsx";
import WealthPanel from "./WealthPanel.tsx";
import "./character-panel.css";

type Section = "career" | "skills" | "wealth" | "relationships" | "children";
type AvailabilityFilter = "all" | "available" | "unavailable";
const sections: { id: Section; label: string }[] = [
  { id: "career", label: "Career" },
  { id: "skills", label: "Skills" },
  { id: "wealth", label: "Wealth" },
  { id: "relationships", label: "Relationships" },
  { id: "children", label: "Household" },
];

/** Preview skill changes with the same sequential bounds as the engine. */
function skillEffects(activity: ActivityAvailability, life: LifeState, world: WorldPack): { label: string; min: number; max: number; variable: boolean }[] {
  if (!world.character || !life.character) return [];
  return Object.entries(world.character.skills).flatMap(([id, definition]) => {
    const initial = life.character!.skills[id];
    const deltas = activity.outcomes.map(outcome => {
      let value = initial;
      for (const effect of outcome.effects) {
        if (effect.type === "end") break;
        if (effect.type === "skill" && effect.skill === id) {
          value = Math.max(definition.min, Math.min(definition.max, value + effect.delta));
        }
      }
      return value - initial;
    });
    const min = Math.min(...deltas), max = Math.max(...deltas);
    return min === 0 && max === 0 ? [] : [{ label: definition.label, min, max, variable: min !== max }];
  });
}

function ActivityButton({ activity, life, world, onActivity }: {
  activity: ActivityAvailability; life: LifeState; world: WorldPack; onActivity: (id: string) => void;
}) {
  const changes = skillEffects(activity, life, world);
  const unavailable = life.phase !== "ready" || life.character?.lastActivityAge === life.age;
  const reason = life.phase === "choice" ? "Resolve the current decision first."
    : life.phase === "ended" ? "This life has ended."
    : life.character?.lastActivityAge === life.age ? "Your personal activity for this year is complete."
    : activity.reason;
  const disabled = !activity.available || unavailable;
  return <button type="button" className="personal-activity" disabled={disabled} onClick={() => onActivity(activity.id)}>
    <span className="personal-activity-heading"><strong>{activity.text}</strong><span className="personal-activity-state">{disabled ? "Locked" : "Choose"}</span></span>
    {changes.length > 0 && <span className="personal-skill-effects">{changes.map(change => <span className="impact-stat" key={change.label}>{change.label} <ImpactValue min={change.min} max={change.max} /></span>)}</span>}
    {reason && <span className="personal-activity-reason">{reason}</span>}
    <ChoiceImpact choice={activity} life={life} world={world} />
  </button>;
}

function ActivityList({ activities, life, world, onActivity }: {
  activities: readonly ActivityAvailability[]; life: LifeState; world: WorldPack; onActivity: (id: string) => void;
}) {
  return <div className="personal-activity-list">{activities.map(activity => <ActivityButton key={activity.id} activity={activity} life={life} world={world} onActivity={onActivity} />)}</div>;
}

function targetsJob(activity: ActivityAvailability, jobId: string): boolean {
  return activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job === jobId));
}

function targetsPartner(activity: ActivityAvailability, partnerId: string): boolean {
  return activityPartnerIds(activity).includes(partnerId);
}

function matchesSearch(text: string, query: string): boolean {
  const normalized = text.toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => normalized.includes(word));
}

function activitySearchText(activity: ActivityAvailability, world: WorldPack): string {
  return [activity.text, ...activity.outcomes.flatMap(outcome => [outcome.text, ...outcome.effects.map(effect => {
    if (effect.type === "skill") return world.character?.skills[effect.skill]?.label ?? effect.skill;
    if (effect.type === "stat") return world.stats[effect.stat]?.label ?? effect.stat;
    if (effect.type === "job") return world.character?.jobs.find(job => job.id === effect.job)?.title ?? "";
    return "";
  })])].join(" ");
}

function matchesAvailability(available: boolean, filter: AvailabilityFilter): boolean {
  return filter === "all" || (filter === "available" ? available : !available);
}

function SearchControls({ id, label, placeholder, value, onChange, filter, onFilter, filterLabel }: {
  id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void;
  filter: AvailabilityFilter; onFilter: (value: AvailabilityFilter) => void; filterLabel: string;
}) {
  return <div className="character-search-controls">
    <div className="character-search-field"><label htmlFor={`${id}-search`}>{label}</label><input id={`${id}-search`} type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" /></div>
    <div className="character-filter-field"><label htmlFor={`${id}-availability`}>{filterLabel}</label><select id={`${id}-availability`} value={filter} onChange={event => onFilter(event.target.value as AvailabilityFilter)}><option value="all">All</option><option value="available">Available now</option><option value="unavailable">Unavailable now</option></select></div>
  </div>;
}

/** Personal actions share the simulation's yearly budget and command history. */
export default function CharacterPanel({ life, world, onActivity, initialSection = "career" }: {
  life: LifeState; world: WorldPack; onActivity: (id: string) => void; initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [jobSearch, setJobSearch] = useState("");
  const [jobAvailability, setJobAvailability] = useState<AvailabilityFilter>("all");
  const instanceId = useId();
  const tabRefs = useRef<Partial<Record<Section, HTMLButtonElement | null>>>({});
  const allActivities = useMemo(() => world.character && life.character ? engineForLife(life).getActivities(life) : [], [life, world]);
  const character = life.character;
  const definition = world.character;
  if (!character || !definition) return <div className="character-management"><p className="character-empty">These options are available in newer worlds. Your current life keeps its original rules.</p></div>;

  const props = { life, world, onActivity };
  const knownPartnerIds = new Set([
    ...(character.knownPartnerIds ?? []),
    ...(character.partnerId ? [character.partnerId] : []),
    ...character.children.map(child => child.otherParentId),
  ]);
  const knowsPartner = (id: string) => !definition.requireIntroductions || knownPartnerIds.has(id);
  const knownPartners = definition.partners.filter(partner => knowsPartner(partner.id));
  const hasRelationships = !definition.requireIntroductions || knownPartners.length > 0;
  const visibleSections = sections.filter(item => (item.id !== "relationships" || hasRelationships) && (item.id !== "wealth" || Boolean(world.economy && life.economy)));
  const activeSection = visibleSections.some(item => item.id === section) ? section : "career";
  // Keep undiscovered people out of the DOM as well as the visible cards.
  const activities = allActivities.filter(activity => activityPartnerIds(activity).every(knowsPartner));
  const currentJob = definition.jobs.find(job => job.id === character.jobId);
  const currentPartner = definition.partners.find(partner => partner.id === character.partnerId);
  const career = activities.filter(activity => activity.category === "career");
  const visibleJobs = definition.jobs.filter(job => {
    const jobActions = career.filter(activity => targetsJob(activity, job.id));
    const searchText = [job.title, job.description, ...Object.entries(job.requirements ?? {}).map(([id, value]) => `${definition.skills[id]?.label ?? id} ${value}`), ...jobActions.map(activity => activitySearchText(activity, world))].join(" ");
    return matchesSearch(searchText, jobSearch) && matchesAvailability(jobActions.some(activity => activity.available), jobAvailability);
  });
  const otherCareer = career.filter(activity => !definition.jobs.some(job => targetsJob(activity, job.id)));
  const visibleOtherCareer = otherCareer.filter(activity => matchesSearch(activitySearchText(activity, world), jobSearch) && matchesAvailability(activity.available, jobAvailability));
  const relationships = activities.filter(activity => activity.category === "relationship");
  const adults = knownPartners.filter(partner => life.age + partner.ageOffset >= 18);
  const hasActivity = character.lastActivityAge === life.age;
  let recentOutcome: string | undefined;
  if (hasActivity) {
    for (let index = life.journal.length - 1; index >= 0; index--) {
      if (life.journal[index].type === "activity" && life.journal[index].age === life.age && definition.activities.some(activity => activity.id === life.journal[index].id)) {
        recentOutcome = life.journal.slice(index + 1).find(entry => entry.type === "outcome")?.text;
        break;
      }
    }
  }
  const budget = life.phase === "choice" ? "A decision is waiting. Resolve it before choosing a personal activity."
    : life.phase === "ended" ? "This life has ended. Its work, skills and family remain in your record."
    : hasActivity ? "Your personal activity is complete for this year. Another becomes available at your next birthday."
    : "One personal activity is available this year. Choose how to spend it.";

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % visibleSections.length;
    else if (event.key === "ArrowLeft") next = (index + visibleSections.length - 1) % visibleSections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = visibleSections.length - 1;
    else return;
    event.preventDefault();
    setSection(visibleSections[next].id);
    tabRefs.current[visibleSections[next].id]?.focus();
  }

  return <div className="character-management">
    <div className={`character-activity-status${hasActivity ? " activity-spent" : ""}`}>
      <span className="character-budget-label">Age {life.age} · Personal activity</span>
      <p>{budget}</p>
    </div>
    {recentOutcome && <div className="character-recent-outcome" role="status"><span>What happened</span><p>{recentOutcome}</p></div>}
    <div className="character-tabs" role="tablist" aria-label="Life management sections">
      {visibleSections.map((item, index) => <button type="button" role="tab" id={`${instanceId}-tab-${item.id}`} aria-selected={activeSection === item.id} aria-controls={`${instanceId}-panel-${item.id}`} tabIndex={activeSection === item.id ? 0 : -1} key={item.id} ref={element => { tabRefs.current[item.id] = element; }} onKeyDown={event => navigateTabs(event, index)} onClick={() => setSection(item.id)}>{item.label}</button>)}
    </div>
    <div className="character-sections">
      <div className="character-section" role="tabpanel" id={`${instanceId}-panel-career`} aria-labelledby={`${instanceId}-tab-career`} tabIndex={0} hidden={activeSection !== "career"}>
        <div className="character-section-heading"><span>Working life</span><h3>{currentJob?.title ?? "No regular trade yet"}</h3><p>{currentJob?.description ?? "Develop your skills and find work in your community."}</p></div>
        <SearchControls id={`${instanceId}-career`} label="Search occupations and work" placeholder="Job, skill or activity" value={jobSearch} onChange={setJobSearch} filter={jobAvailability} onFilter={setJobAvailability} filterLabel="Occupation availability" />
        <p className="character-result-count" role="status">{visibleJobs.length} of {definition.jobs.length} occupations · {visibleOtherCareer.length} of {otherCareer.length} other work activities</p>
        <div className="character-card-list character-job-list">{visibleJobs.map(job => {
          const jobActions = career.filter(activity => targetsJob(activity, job.id));
          const available = jobActions.some(activity => activity.available);
          return <details className={`character-detail-card character-job-card${job.id === character.jobId ? " current-character-card" : ""}`} key={job.id} open={job.id === character.jobId}>
          <summary><span className="character-job-summary-copy"><span className="character-job-title">{job.title}</span><span className="character-job-summary-requirements">Age {job.minAge}+{Object.entries(job.requirements ?? {}).map(([id, value]) => <span key={id}> · {definition.skills[id]?.label ?? id} {value}</span>)}</span></span><span className={`character-status-tag${available ? " occupation-available" : ""}`}>{job.id === character.jobId ? "Current job" : available ? "Available" : "Unavailable"}</span></summary>
          <div className="character-job-details">
          <p>{job.description}</p>
          <ul className="character-requirements" aria-label={`${job.title} requirements`}>
            <li className={life.age >= job.minAge ? "requirement-met" : ""}>Age {job.minAge}+ <span>{life.age >= job.minAge ? "met" : `you are ${life.age}`}</span></li>
            {Object.entries(job.requirements ?? {}).map(([id, value]) => <li key={id} className={character.skills[id] >= value ? "requirement-met" : ""}>{definition.skills[id].label} {value} <span>{character.skills[id] >= value ? "met" : `you have ${character.skills[id]}`}</span></li>)}
          </ul>
          <ActivityList activities={jobActions} {...props} />
          </div>
        </details>;
        })}</div>
        {visibleJobs.length === 0 && <p className="character-search-empty">No occupations match. Try another search or show all availability.</p>}
        {visibleOtherCareer.length > 0 && <h4 className="character-activity-group-title">Other work</h4>}
        <ActivityList activities={visibleOtherCareer} {...props} />
        {visibleOtherCareer.length === 0 && jobSearch.trim() && <p className="character-search-empty">No other work activities match this search.</p>}
      </div>
      <div className="character-section" role="tabpanel" id={`${instanceId}-panel-skills`} aria-labelledby={`${instanceId}-tab-skills`} tabIndex={0} hidden={activeSection !== "skills"}>
        <SkillTree activities={activities} {...props} />
      </div>
      {world.economy && life.economy && <div className="character-section" role="tabpanel" id={`${instanceId}-panel-wealth`} aria-labelledby={`${instanceId}-tab-wealth`} tabIndex={0} hidden={activeSection !== "wealth"}>
        <WealthPanel activities={activities} {...props} />
      </div>}
      {hasRelationships && <div className="character-section" role="tabpanel" id={`${instanceId}-panel-relationships`} aria-labelledby={`${instanceId}-tab-relationships`} tabIndex={0} hidden={activeSection !== "relationships"}>
        <div className="character-section-heading"><span>People close to you</span><h3>{character.relationshipStatus === "married" && currentPartner ? `Married to ${currentPartner.name}` : character.relationshipStatus === "courting" && currentPartner ? `Courting ${currentPartner.name}` : character.relationshipStatus === "divorced" ? "Divorced" : "No current partner"}</h3><p>{character.relationshipStatus === "married" ? "Spend time together or choose whether to divorce." : "Meet someone, court them, and choose whether to build a household together."}</p></div>
        {adults.length === 0 && <p className="character-empty">Partners and courtship become available in adulthood. Skills and work can take shape in the meantime.</p>}
        <div className="character-card-list">{adults.map(partner => <article className={`character-detail-card${partner.id === character.partnerId && character.relationshipStatus !== "divorced" ? " current-character-card" : ""}`} key={partner.id}>
          <div className="character-card-heading"><h4>{partner.name}</h4>{partner.id === character.partnerId && character.relationshipStatus !== "single" && <span className="character-status-tag">{character.relationshipStatus === "married" ? "Spouse" : character.relationshipStatus === "courting" ? "Courting" : "Former partner"}</span>}</div>
          <span className="character-person-meta">Age {life.age + partner.ageOffset} · {partner.occupation}</span><p>{partner.description}</p>
          <ActivityList activities={relationships.filter(activity => targetsPartner(activity, partner.id))} {...props} />
        </article>)}</div>
        <ActivityList activities={relationships.filter(activity => !definition.partners.some(partner => targetsPartner(activity, partner.id)) && (character.relationshipStatus === "married" || !activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "divorce"))))} {...props} />
      </div>}
      <div className="character-section" role="tabpanel" id={`${instanceId}-panel-children`} aria-labelledby={`${instanceId}-tab-children`} tabIndex={0} hidden={activeSection !== "children"}>
        <div className="character-section-heading"><span>Home and family</span><h3>{character.children.length === 0 ? "Household and children" : `${character.children.length} ${character.children.length === 1 ? "child" : "children"} in your life`}</h3><p>{character.children.length === 0 ? "Choose whether to grow your family when your household is ready." : "Your children grow with each passing year. Give time to their care and learning."}</p></div>
        {character.children.length === 0 ? <p className="character-empty">You have no children yet.</p> : <ul className="character-children">{character.children.map(child => {
          const otherParent = definition.partners.find(partner => partner.id === child.otherParentId);
          const age = life.age - child.birthAge;
          return <li key={child.id}><span className="character-child-initial" aria-hidden="true">{child.name.charAt(0)}</span><div><h4>{child.name}</h4><span>{age === 0 ? "Newborn" : `Age ${age}`}{otherParent ? ` · Other parent: ${otherParent.name}` : ""}</span></div></li>;
        })}</ul>}
        <ActivityList activities={activities.filter(activity => activity.category === "family")} {...props} />
      </div>
    </div>
    <p className="character-impact-note"><span className="impact-gain">Green: gain.</span> <span className="impact-loss">Red: loss.</span> Ranges show possible direct changes.</p>
  </div>;
}
