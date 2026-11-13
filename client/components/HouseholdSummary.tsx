import { useEffect, useRef } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { resolvePartner } from "../../src/people.ts";
import { romanticPartnerLabel } from "../models/relationship-labels.ts";
import { familyRelationshipRows, socialRelationshipRows } from "../models/relationship-table.ts";
import { displayProse } from "../models/display-prose.ts";
import { childPortraitState, personPortraitState } from "../models/portrait-state.ts";
import PixelPortrait from "./PixelPortrait.tsx";
import "../styles/health.css";
import "../styles/relationship-table.css";

const closenessLabel = (value: number, world: WorldPack) => value >= (world.relationships?.supportThreshold ?? 60) ? "Close" : value < (world.relationships?.marriageMinimum ?? 40) ? "Strained" : "Steady";

/** Only established household facts appear here; unknown relatives are not invented. */
export default function HouseholdSummary({ life, world, onOpenCharacter, onOpenRelationships }: {
  life: LifeState;
  world: WorldPack;
  onOpenCharacter(): void;
  onOpenRelationships?(): void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const character = life.character;
  const origin = world.origins.find(item => item.id === life.originId);
  const partner = character?.partnerId && (character.relationshipStatus === "courting" || character.relationshipStatus === "married")
    ? resolvePartner(world, life, character.partnerId) : undefined;
  const job = world.character?.jobs.find(item => item.id === character?.jobId);
  const children = character?.children ?? [];
  const family = familyRelationshipRows(world, life);
  const parents = family.filter(row => row.roles.includes("Mother") || row.roles.includes("Father"));

  useEffect(() => {
    // Native disclosure remains under player control after its initial layout.
    if (window.matchMedia("(max-width: 760px)").matches && detailsRef.current) detailsRef.current.open = false;
  }, []);

  return <aside className="household-summary" aria-label="Household">
    <details ref={detailsRef} open>
      <summary><span>Household</span><svg className="household-disclosure" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
      <div className="household-summary-content">
        {origin && <div className="household-background"><span className="household-field-label">Background</span><p>{origin.title}</p><p className="household-background-detail">{displayProse(origin.text)}</p></div>}
        {job && <div className="household-work"><span className="household-field-label">Your work</span><p>{job.title}</p></div>}
        {parents.length > 0 && <div className="household-natal-family"><span className="household-field-label">Parents</span><ul>{parents.map(parent => <li key={parent.id} className="household-person-row"><PixelPortrait portrait={parent.portrait} name={parent.name} className="household-person-portrait" /><div className="household-person-copy"><strong>{parent.name}</strong><span>{parent.roles[0]}{parent.deceased ? " · Deceased" : ""}</span><span>{parent.occupation}</span></div></li>)}</ul></div>}
        {partner && <div className="household-person"><span className="household-field-label">{romanticPartnerLabel(world, life, partner.id)}</span><div className="household-person-row"><PixelPortrait portrait={personPortraitState(world, life, partner)} name={partner.name} className="household-person-portrait" /><div className="household-person-copy"><strong>{partner.name}</strong><p>{partner.occupation}</p>{character?.relationships?.partners[partner.id] && <span className="household-closeness">{closenessLabel(character.relationships.partners[partner.id].closeness, world)} · {character.relationships.partners[partner.id].closeness}/100</span>}</div></div></div>}
        {children.length > 0 && <div className="household-children"><span className="household-field-label">{children.length === 1 ? "Child" : "Children"}</span><ul>{children.map(child => {
          const age = life.age - child.birthAge;
          const tie = character?.relationships?.children[child.id];
          return <li key={child.id}><div className="household-person-row"><PixelPortrait portrait={childPortraitState(world, life, child)} name={child.name} className="household-person-portrait" /><strong>{child.name}</strong></div><span className={tie ? "household-child-tie" : undefined}>{age === 0 ? "Newborn" : `Age ${age}`}{tie && <small>{closenessLabel(tie.closeness, world)} · {tie.closeness}/100</small>}</span></li>;
        })}</ul></div>}
        {character?.family?.length && <p className="household-family-count">{family.filter(row => !row.deceased).length} living family · {family.filter(row => row.deceased).length} remembered</p>}
        <button type="button" className="household-open" onClick={onOpenCharacter}>Family table &amp; life <span aria-hidden="true">→</span></button>
        {onOpenRelationships && <button type="button" className="household-open" onClick={onOpenRelationships}>Relationships <span>{socialRelationshipRows(world, life).length} <span aria-hidden="true">→</span></span></button>}
      </div>
    </details>
  </aside>;
}
