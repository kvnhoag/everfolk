import { useEffect, useRef } from "react";
import type { ActivityAvailability, EncounteredPerson, LifeState, PartnerDefinition, WorldPack } from "../src/types.ts";
import { activityPartnerIds } from "../src/character.ts";
import { resolvePartner } from "../src/people.ts";
import { displayProse } from "./display-prose.ts";
import PixelPortrait from "./PixelPortrait.tsx";
import { visibleFamilyActivities } from "./character-panel-model.ts";
import { relationshipLabels, romanticPartnerLabel, visibleRelationshipPeople } from "./relationship-labels.ts";
import "./health.css";

function isEncountered(person: PartnerDefinition | EncounteredPerson): person is EncounteredPerson {
  return "sex" in person;
}

const closenessLabel = (value: number, world: WorldPack) => value >= (world.relationships?.supportThreshold ?? 60) ? "Close" : value < (world.relationships?.marriageMinimum ?? 40) ? "Strained" : "Steady";

/** Only established household facts appear here; unknown relatives are not invented. */
export default function HouseholdSummary({ life, world, onOpenCharacter, activities = [], onActivity, onOpenPeopleTab }: {
  life: LifeState;
  world: WorldPack;
  onOpenCharacter(): void;
  activities?: readonly ActivityAvailability[];
  onActivity?(id: string): void;
  onOpenPeopleTab?(): void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const character = life.character;
  const origin = world.origins.find(item => item.id === life.originId);
  const partner = character?.partnerId && (character.relationshipStatus === "courting" || character.relationshipStatus === "married")
    ? resolvePartner(world, life, character.partnerId) : undefined;
  const job = world.character?.jobs.find(item => item.id === character?.jobId);
  const children = character?.children ?? [];
  const otherCircle = visibleRelationshipPeople(world, life).filter(person => person.id !== partner?.id && life.age + person.ageOffset >= 18);
  const canActThisYear = life.phase === "ready" && character?.lastActivityAge !== life.age;

  const quickPartnerActions = (personId: string) =>
    onActivity && canActThisYear
      ? activities.filter(act => act.category === "relationship" && act.available && activityPartnerIds(act).includes(personId)).slice(0, 2)
      : [];

  const quickFamilyActions = onActivity && canActThisYear
    ? visibleFamilyActivities(life, activities).filter(act => act.available).slice(0, 2)
    : [];

  useEffect(() => {
    // Native disclosure remains under player control after its initial layout.
    if (window.matchMedia("(max-width: 760px)").matches && detailsRef.current) detailsRef.current.open = false;
  }, []);

  return <aside className="household-summary" aria-label="Household">
    <details ref={detailsRef} open>
      <summary><span>Household &amp; People</span><svg className="household-disclosure" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
      <div className="household-summary-content">
        <div className="household-meta-grid">
          {origin && <div className="household-background"><span className="household-field-label">Background</span><p>{origin.title}</p></div>}
          {job && <div className="household-work"><span className="household-field-label">Your work</span><p>{job.title}</p></div>}
        </div>
        {partner && <div className="household-person household-person-card">
          <div className="household-person-top">
            {isEncountered(partner) && <PixelPortrait age={life.age + partner.ageOffset} name={partner.name} sex={partner.sex} originId={partner.originId} avatarVariant={partner.avatarVariant} seed={`${life.seed}:${partner.id}`} className="household-mini-avatar" />}
            <div className="household-person-copy">
              <span className="household-field-label">{romanticPartnerLabel(world, life, partner.id)}</span><strong>{partner.name}</strong>
              <p>{partner.occupation} · Age {life.age + partner.ageOffset}</p>
            </div>
          </div>
          {character?.relationships?.partners[partner.id] && <div className="household-closeness-bar-wrap">
            <span className="household-closeness">{closenessLabel(character.relationships.partners[partner.id].closeness, world)} · {character.relationships.partners[partner.id].closeness}/100</span>
            <div className="household-closeness-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, character.relationships.partners[partner.id].closeness))}%` }} /></div>
          </div>}
          {onActivity && quickPartnerActions(partner.id).length > 0 && <div className="household-quick-actions">
            {quickPartnerActions(partner.id).map(act => <button key={act.id} type="button" className="household-quick-btn" onClick={() => onActivity(act.id)}>{displayProse(act.text)}</button>)}
          </div>}
        </div>}
        {children.length > 0 && <div className="household-children"><span className="household-field-label">{children.length === 1 ? "Child" : "Children"}</span><ul>{children.map(child => {
          const age = life.age - child.birthAge;
          const tie = character?.relationships?.children[child.id];
          return <li key={child.id} className="household-child-row">
            <PixelPortrait age={Math.max(0, age)} name={child.name} seed={`${life.seed}:child:${child.id}`} originId={life.originId} className="household-mini-avatar is-child" />
            <div className="household-child-info">
              <strong>{child.name}</strong>
              <span className={tie ? "household-child-tie" : undefined}>{age === 0 ? "Newborn" : `Age ${age}`}{tie && <small>{closenessLabel(tie.closeness, world)} · {tie.closeness}/100</small>}</span>
            </div>
          </li>;
        })}</ul>
        {onActivity && quickFamilyActions.length > 0 && <div className="household-quick-actions">
          {quickFamilyActions.map(act => <button key={act.id} type="button" className="household-quick-btn" onClick={() => onActivity(act.id)}>{displayProse(act.text)}</button>)}
        </div>}
        </div>}
        {otherCircle.length > 0 && <div className="household-circle"><span className="household-field-label">Close circle ({otherCircle.length})</span><ul className="household-circle-list">{otherCircle.map(person => {
          const tie = character?.relationships?.partners[person.id];
          const tags = relationshipLabels(world, life, person.id);
          const actions = quickPartnerActions(person.id);
          return <li key={person.id} className="household-person-card is-circle">
            <div className="household-person-top">
              {"sex" in person && <PixelPortrait age={life.age + person.ageOffset} name={person.name} sex={person.sex} originId={person.originId} avatarVariant={person.avatarVariant} seed={`${life.seed}:${person.id}`} className="household-mini-avatar" />}
              <div className="household-person-copy">
                <div className="household-circle-tags">{tags.map(tag => <span key={tag} className="household-role-badge">{tag}</span>)}</div>
                <strong>{person.name}</strong>
                <p>{person.occupation} · Age {life.age + person.ageOffset}</p>
              </div>
            </div>
            {tie && <span className="household-closeness">{closenessLabel(tie.closeness, world)} · {tie.closeness}/100</span>}
            {onActivity && actions.length > 0 && <div className="household-quick-actions">
              {actions.map(act => <button key={act.id} type="button" className="household-quick-btn" onClick={() => onActivity(act.id)}>{displayProse(act.text)}</button>)}
            </div>}
          </li>;
        })}</ul></div>}
        <div className="household-footer-actions">
          <button type="button" className="household-open" onClick={onOpenCharacter}>Family &amp; life <span aria-hidden="true">→</span></button>
          {onOpenPeopleTab && <button type="button" className="household-open is-secondary" onClick={onOpenPeopleTab}>People &amp; town <span aria-hidden="true">↘</span></button>}
        </div>
      </div>
    </details>
  </aside>;
}
