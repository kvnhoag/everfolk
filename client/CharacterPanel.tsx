import { displayProse } from "./display-prose.ts";
import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ActivityAvailability, Condition, LifeState, WorldPack } from "../src/types.ts";
import { activityPartnerIds } from "../src/character.ts";
import { getSkillImpact } from "./skill-impact.ts";
import { engineForLife } from "./session.ts";
import ImpactValue from "./ImpactValue.tsx";
import ChoiceImpact from "./ChoiceImpact.tsx";
import SkillTree from "./SkillTree.tsx";
import WealthPanel from "./WealthPanel.tsx";
import LifeHealthPanel from "./LifeHealthPanel.tsx";
import { characterActivitySummary, visibleCharacterSections, visibleFamilyActivities } from "./character-panel-model.ts";
import { careerOpeningNotes } from "./career-openings.ts";
import { activityLoanOffer } from "./loan-access.ts";
import { resolvePartner } from "../src/people.ts";
import PixelPortrait from "./PixelPortrait.tsx";
import { relationshipLabels, romanticPartnerLabel, visibleRelationshipPeople } from "./relationship-labels.ts";
import "./birth-avatar.css";
import "./social-relationships.css";
import type { CharacterSection } from "./character-panel-model.ts";
import "./character-panel.css";

type Section = CharacterSection;
type AvailabilityFilter = "all" | "available" | "unavailable";
type RelationshipFilter = "all" | "friends" | "business" | "romance";

/** Preview skill changes with the same sequential bounds as the engine. */
function skillEffects(activity: ActivityAvailability, life: LifeState, world: WorldPack): { label: string; min: number; max: number; variable: boolean }[] {
  return getSkillImpact(activity, life, world).map(({ id: _id, ...change }) => change);
}

function ActivityButton({ activity, life, world, onActivity }: {
  activity: ActivityAvailability; life: LifeState; world: WorldPack; onActivity: (id: string) => void;
}) {
  const changes = skillEffects(activity, life, world);
  const openings = careerOpeningNotes(activity, world);
  const actionUsed = activity.usesYearlyActivity !== false && life.character?.lastActivityAge === life.age;
  const unavailable = life.phase !== "ready" || actionUsed;
  const reason = life.phase === "choice" ? "Make the pending choice first."
    : life.phase === "ended" ? "This life has ended."
    : actionUsed ? "Action used. Available next year."
    : activity.reason;
  const disabled = !activity.available || unavailable;
  const loanOffer = disabled && activityLoanOffer(world, life, activity);
  return <button type="button" className="personal-activity" disabled={disabled && !loanOffer} onClick={() => onActivity(activity.id)}>
    <span className="personal-activity-heading"><strong>{displayProse(activity.text)}</strong><span className="personal-activity-state">{loanOffer ? "Ask moneylender" : disabled ? "Locked" : "Choose"}</span></span>
    {openings.map(note => <span className="personal-opening-note" key={note}>{note}</span>)}
    {changes.length > 0 && <span className="personal-skill-effects">{changes.map(change => <span className="impact-stat" key={change.label}>{change.label} <ImpactValue min={change.min} max={change.max} /></span>)}</span>}
    {reason && <span className="personal-activity-reason">{displayProse(reason)}</span>}
    {loanOffer && <span className="loan-funding-hint">Short of {formatLoanShortfall(loanOffer.shortfall, world)} · View loan terms</span>}
    <ChoiceImpact choice={activity} life={life} world={world} hideSkills />
  </button>;
}

function formatLoanShortfall(amount: number, world: WorldPack): string {
  return `${amount} ${world.economy?.currency.short ?? ""}`.trim();
}

function tieLabel(value: number, world: WorldPack): string {
  return value >= (world.relationships?.supportThreshold ?? 60) ? "Close" : value < (world.relationships?.marriageMinimum ?? 40) ? "Strained" : "Steady";
}

function Closeness({ value, lastContactAge, world }: { value: number; lastContactAge: number; world: WorldPack }) {
  const label = tieLabel(value, world);
  return <p className={`relationship-closeness${label === "Strained" ? " is-strained" : ""}`} aria-label={`${label}, closeness ${value} of 100, last contact at age ${lastContactAge}`}><strong>{label}</strong><span>{value}/100</span><small>Last contact: age {lastContactAge}</small></p>;
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

/** Other requirements remain engine-owned; an absent social role hides its controls. */
function socialRequirements(condition: Condition | undefined, life: LifeState): boolean | undefined {
  if (!condition) return;
  if (condition.type === "social-role") return (life.character?.relationships?.partners[condition.partner]?.roles?.includes(condition.role) === true) === condition.active;
  if (condition.type === "not") {
    const value = socialRequirements(condition.condition, life);
    return value === undefined ? undefined : !value;
  }
  if (condition.type !== "all" && condition.type !== "any") return;
  const values = condition.conditions.map(part => socialRequirements(part, life));
  if (condition.type === "all") return values.includes(false) ? false : values.every(value => value === true) ? true : undefined;
  return values.includes(true) ? true : values.every(value => value === false) ? false : undefined;
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
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipFilter>("all");
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
  const datedPartnerIds = new Set(character.datedPartnerIds ?? []);
  const knownPartners = visibleRelationshipPeople(world, life);
  const visiblePeopleIds = new Set(knownPartners.map(person => person.id));
  const hasRelationships = definition.proceduralPartners ? knownPartners.length > 0 : !definition.requireIntroductions || knownPartners.length > 0;
  const visibleSections = visibleCharacterSections(life, world, hasRelationships);
  const activeSection = visibleSections.some(item => item.id === section) ? section : visibleSections[0]?.id ?? "skills";
  // Keep undiscovered people out of the DOM as well as the visible cards.
  const activities = allActivities.filter(activity => activityPartnerIds(activity).every(knowsPartner));
  const currentJob = definition.jobs.find(job => job.id === character.jobId);
  const origin = world.origins.find(item => item.id === life.originId);
  const currentPartner = character.partnerId ? resolvePartner(world, life, character.partnerId) : undefined;
  const career = activities.filter(activity => activity.category === "career");
  const visibleJobs = definition.jobs.filter(job => {
    const jobActions = career.filter(activity => targetsJob(activity, job.id));
    const searchText = [job.title, job.description, ...Object.entries(job.requirements ?? {}).map(([id, value]) => `${definition.skills[id]?.label ?? id} ${value}`), ...jobActions.map(activity => activitySearchText(activity, world))].join(" ");
    return matchesSearch(searchText, jobSearch) && matchesAvailability(jobActions.some(activity => activity.available), jobAvailability);
  });
  const otherCareer = career.filter(activity => !definition.jobs.some(job => targetsJob(activity, job.id)));
  const visibleOtherCareer = otherCareer.filter(activity => matchesSearch(activitySearchText(activity, world), jobSearch) && matchesAvailability(activity.available, jobAvailability));
  const relationships = activities.filter(activity => activity.category === "relationship" && (!definition.proceduralPartners || activityPartnerIds(activity).every(id => visiblePeopleIds.has(id))) && (!definition.socialRelationships || !activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "end-courtship")) || character.relationshipStatus === "courting"));
  const hasBreakupAction = relationships.some(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "end-courtship")));
  const adults = knownPartners.filter(partner => life.age + partner.ageOffset >= 18);
  const matchesRelationshipFilter = (id: string, filter: RelationshipFilter): boolean => {
    const labels = relationshipLabels(world, life, id);
    return filter === "all" || filter === "friends" && labels.includes("Friend") || filter === "business" && labels.includes("Business partner") || filter === "romance" && (datedPartnerIds.has(id) || character.partnerId === id);
  };
  const shownPeople = adults.filter(person => !definition.socialRelationships || matchesRelationshipFilter(person.id, relationshipFilter));
  const currentRomanceLabel = currentPartner && romanticPartnerLabel(world, life, currentPartner.id);
  const personActivities = (id: string) => relationships.filter(activity => {
    if (!targetsPartner(activity, id)) return false;
    if (!definition.socialRelationships) return true;
    if (socialRequirements(activity.when, life) === false) return false;
    const effects = activity.outcomes.flatMap(outcome => outcome.effects);
    if (effects.some(effect => effect.type === "relationship" && effect.status === "courting") && (character.relationshipStatus === "courting" || character.relationshipStatus === "married")) return false;
    if (effects.some(effect => effect.type === "relationship" && effect.status === "married") && !(character.partnerId === id && character.relationshipStatus === "courting")) return false;
    if (activity.id.startsWith("time-with-") && !(character.partnerId === id && (character.relationshipStatus === "courting" || character.relationshipStatus === "married"))) return false;
    const roles = character.relationships?.partners[id]?.roles ?? [];
    if (effects.some(effect => effect.type === "social-role" && effect.active === roles.includes(effect.role))) return false;
    return true;
  });
  const hasActivity = character.lastActivityAge === life.age;
  let recentOutcome: string | undefined;
  for (let index = life.journal.length - 1; index >= 0; index--) {
    if (life.journal[index].type === "activity" && life.journal[index].age === life.age && definition.activities.some(activity => activity.id === life.journal[index].id)) {
      recentOutcome = life.journal.slice(index + 1).find(entry => entry.type === "outcome")?.text;
      break;
    }
  }
  const budget = characterActivitySummary(life, activities);
  const familyActivities = visibleFamilyActivities(life, activities);
  const hasFamily = character.children.length > 0 || character.relationshipStatus === "married";

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
    <LifeHealthPanel {...props} compact />
    {origin && <details className="character-background"><summary><span>Background</span><strong>{origin.title}</strong></summary><div><span className="character-background-name">{character.name ?? "Damon"}</span><p>{displayProse(origin.text)}</p></div></details>}
    <div className={`character-activity-status${hasActivity ? " activity-spent" : ""}`}>
      <span className="character-budget-label">Age {life.age}{character.sex && ` · ${character.sex === "female" ? life.age < 18 ? "Girl" : "Woman" : life.age < 18 ? "Boy" : "Man"}`} · Activities</span>
      <p>{budget}</p>
    </div>
    {recentOutcome && <div className="character-recent-outcome" role="status"><span>Result</span><p>{displayProse(recentOutcome)}</p></div>}
    <div className="character-tabs" role="tablist" aria-label="Life management sections">
      {visibleSections.map((item, index) => <button type="button" role="tab" id={`${instanceId}-tab-${item.id}`} aria-selected={activeSection === item.id} aria-controls={`${instanceId}-panel-${item.id}`} tabIndex={activeSection === item.id ? 0 : -1} key={item.id} ref={element => { tabRefs.current[item.id] = element; }} onKeyDown={event => navigateTabs(event, index)} onClick={() => setSection(item.id)}>{item.label}</button>)}
    </div>
    <div className="character-sections">
      {visibleSections.some(item => item.id === "career") && <div className="character-section" role="tabpanel" id={`${instanceId}-panel-career`} aria-labelledby={`${instanceId}-tab-career`} tabIndex={0} hidden={activeSection !== "career"}>
        <div className="character-section-heading"><span>Career</span><h3>{currentJob?.title ?? "Unemployed"}</h3><p>{displayProse(currentJob?.description ?? "Find work that matches your skills.")}</p></div>
        <SearchControls id={`${instanceId}-career`} label="Find work" placeholder="Job, skill or activity" value={jobSearch} onChange={setJobSearch} filter={jobAvailability} onFilter={setJobAvailability} filterLabel="Availability" />
        <p className="character-result-count" role="status">{visibleJobs.length} of {definition.jobs.length} jobs · {visibleOtherCareer.length} of {otherCareer.length} work activities</p>
        <div className="character-card-list character-job-list">{visibleJobs.map(job => {
          const jobActions = career.filter(activity => targetsJob(activity, job.id));
          const available = jobActions.some(activity => activity.available);
          return <details className={`character-detail-card character-job-card${job.id === character.jobId ? " current-character-card" : ""}`} key={job.id} open={job.id === character.jobId}>
          <summary><span className="character-job-summary-copy"><span className="character-job-title">{job.title}</span><span className="character-job-summary-requirements">Age {job.minAge}+{Object.entries(job.requirements ?? {}).map(([id, value]) => <span key={id}> · {definition.skills[id]?.label ?? id} {value}</span>)}</span></span><span className={`character-status-tag${available ? " occupation-available" : ""}`}>{job.id === character.jobId ? "Current job" : available ? "Available" : "Unavailable"}</span></summary>
          <div className="character-job-details">
          <p>{displayProse(job.description)}</p>
          <ul className="character-requirements" aria-label={`${job.title} requirements`}>
            <li className={life.age >= job.minAge ? "requirement-met" : ""}>Age {job.minAge}+ <span>{life.age >= job.minAge ? "met" : `you are ${life.age}`}</span></li>
            {Object.entries(job.requirements ?? {}).map(([id, value]) => <li key={id} className={character.skills[id] >= value ? "requirement-met" : ""}>{definition.skills[id].label} {value} <span>{character.skills[id] >= value ? "met" : `you have ${Math.floor(character.skills[id] * 100) / 100}`}</span></li>)}
          </ul>
          <ActivityList activities={jobActions} {...props} />
          </div>
        </details>;
        })}</div>
        {visibleJobs.length === 0 && <p className="character-search-empty">No matching jobs. Try another search or filter.</p>}
        {visibleOtherCareer.length > 0 && <h4 className="character-activity-group-title">Other work</h4>}
        <ActivityList activities={visibleOtherCareer} {...props} />
        {visibleOtherCareer.length === 0 && jobSearch.trim() && <p className="character-search-empty">No other work activities match this search.</p>}
      </div>}
      <div className="character-section" role="tabpanel" id={`${instanceId}-panel-skills`} aria-labelledby={`${instanceId}-tab-skills`} tabIndex={0} hidden={activeSection !== "skills"}>
        <SkillTree activities={activities} {...props} />
      </div>
      {world.economy && life.economy && <div className="character-section" role="tabpanel" id={`${instanceId}-panel-wealth`} aria-labelledby={`${instanceId}-tab-wealth`} tabIndex={0} hidden={activeSection !== "wealth"}>
        <WealthPanel activities={activities} {...props} />
      </div>}
      {visibleSections.some(item => item.id === "relationships") && <div className="character-section" role="tabpanel" id={`${instanceId}-panel-relationships`} aria-labelledby={`${instanceId}-tab-relationships`} tabIndex={0} hidden={activeSection !== "relationships"}>
        <div className="character-section-heading"><span>Relationships</span><h3>{currentRomanceLabel && currentPartner ? `${currentRomanceLabel}: ${currentPartner.name}` : definition.socialRelationships ? "People in your life" : character.relationshipStatus === "divorced" ? "Divorced" : "Single"}</h3><p>{definition.socialRelationships ? "Spend time with friends, work with business partners and care for your close relationships." : character.relationshipStatus === "married" ? "Spend time with your spouse or manage your marriage." : character.relationshipStatus === "courting" ? hasBreakupAction ? "Spend time together, propose marriage or end the courtship." : "Spend time together or propose marriage." : "Get to know the people you meet."}</p></div>
        {definition.socialRelationships && <div className="relationship-filters" role="group" aria-label="Relationship groups">{([["all", "All"], ["friends", "Friends"], ["business", "Business"], ["romance", "Romance"]] as const).map(([filter, label]) => <button type="button" key={filter} aria-pressed={relationshipFilter === filter} onClick={() => setRelationshipFilter(filter)}>{label}<span>{adults.filter(person => matchesRelationshipFilter(person.id, filter)).length}</span></button>)}</div>}
        {adults.length === 0 && <p className="character-empty">No adult partners available.</p>}
        {adults.length > 0 && shownPeople.length === 0 && <p className="character-empty">No relationships in this group yet.</p>}
        <div className="character-card-list">{shownPeople.map(partner => <article className={`character-detail-card${partner.id === character.partnerId && character.relationshipStatus !== "divorced" ? " current-character-card" : ""}`} key={partner.id}>
          {"sex" in partner && <PixelPortrait age={life.age + partner.ageOffset} name={partner.name} sex={partner.sex} originId={partner.originId} avatarVariant={partner.avatarVariant} seed={`${life.seed}:${partner.id}`} className="character-person-avatar" />}
          <div className="character-card-heading"><h4>{partner.name}</h4><div className="relationship-tags" aria-label={`Relationship with ${partner.name}`}>{relationshipLabels(world, life, partner.id).map(label => <span className="character-status-tag" key={label}>{label}</span>)}</div></div>
          <span className="character-person-meta">Age {life.age + partner.ageOffset} · {partner.occupation}</span><p>{displayProse(partner.description)}</p>
          {character.relationships?.partners[partner.id] && <Closeness lastContactAge={character.relationships.partners[partner.id].lastContactAge} world={world} value={character.relationships.partners[partner.id].closeness} />}
          <ActivityList activities={personActivities(partner.id)} {...props} />
        </article>)}</div>
        <ActivityList activities={relationships.filter(activity => {
          if (definition.partners.some(partner => targetsPartner(activity, partner.id))) return false;
          const effects = activity.outcomes.flatMap(outcome => outcome.effects);
          if (character.relationshipStatus !== "married" && effects.some(effect => effect.type === "divorce")) return false;
          if (!definition.socialRelationships || relationshipFilter === "all") return true;
          const romantic = effects.some(effect => effect.type === "end-courtship" || effect.type === "divorce");
          return relationshipFilter === "romance" ? romantic : relationshipFilter === "friends" && !romantic;
        })} {...props} />
      </div>}
      {visibleSections.some(item => item.id === "children") && <div className="character-section" role="tabpanel" id={`${instanceId}-panel-children`} aria-labelledby={`${instanceId}-tab-children`} tabIndex={0} hidden={activeSection !== "children"}>
        <div className="character-section-heading"><span>Family</span><h3>{character.children.length === 0 ? "Home life" : `${character.children.length} ${character.children.length === 1 ? "child" : "children"}`}</h3><p>{character.children.length > 0 ? "Spend time with your family and help at home." : hasFamily ? "Manage your household and family plans." : "Help at home or spend time with the neighbors."}</p></div>
        {character.children.length > 0 && <ul className="character-children">{character.children.map(child => {
          const otherParent = resolvePartner(world, life, child.otherParentId);
          const age = life.age - child.birthAge;
          const tie = character.relationships?.children[child.id];
          return <li key={child.id}><span className="character-child-initial" aria-hidden="true">{child.name.charAt(0)}</span><div><h4>{child.name}</h4><span>{age === 0 ? "Newborn" : `Age ${age}`}{otherParent ? ` · Other parent: ${otherParent.name}` : ""}</span>{tie && <span className="character-child-closeness">{tieLabel(tie.closeness, world)} · {tie.closeness}/100 · Last contact: age {tie.lastContactAge}</span>}</div></li>;
        })}</ul>}
        <ActivityList activities={familyActivities} {...props} />
      </div>}
    </div>
    <p className="character-impact-note"><span className="impact-gain">Green: gain.</span> <span className="impact-loss">Red: loss.</span> Ranges show possible outcomes.</p>
  </div>;
}
