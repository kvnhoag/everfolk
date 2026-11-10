import { useEffect, useRef } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import { resolvePartner } from "../src/people.ts";
import { romanticPartnerLabel } from "./relationship-labels.ts";
import "./health.css";

const closenessLabel = (value: number, world: WorldPack) => value >= (world.relationships?.supportThreshold ?? 60) ? "Close" : value < (world.relationships?.marriageMinimum ?? 40) ? "Strained" : "Steady";

/** Only established household facts appear here; unknown relatives are not invented. */
export default function HouseholdSummary({ life, world, onOpenCharacter }: {
  life: LifeState;
  world: WorldPack;
  onOpenCharacter(): void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const character = life.character;
  const origin = world.origins.find(item => item.id === life.originId);
  const partner = character?.partnerId && (character.relationshipStatus === "courting" || character.relationshipStatus === "married")
    ? resolvePartner(world, life, character.partnerId) : undefined;
  const job = world.character?.jobs.find(item => item.id === character?.jobId);
  const children = character?.children ?? [];

  useEffect(() => {
    // Native disclosure remains under player control after its initial layout.
    if (window.matchMedia("(max-width: 760px)").matches && detailsRef.current) detailsRef.current.open = false;
  }, []);

  return <aside className="household-summary" aria-label="Household">
    <details ref={detailsRef} open>
      <summary><span>Household</span><svg className="household-disclosure" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
      <div className="household-summary-content">
        {origin && <div className="household-background"><span className="household-field-label">Background</span><p>{origin.title}</p></div>}
        {job && <div className="household-work"><span className="household-field-label">Your work</span><p>{job.title}</p></div>}
        {partner && <div className="household-person"><span className="household-field-label">{romanticPartnerLabel(world, life, partner.id)}</span><strong>{partner.name}</strong><p>{partner.occupation}</p>{character?.relationships?.partners[partner.id] && <span className="household-closeness">{closenessLabel(character.relationships.partners[partner.id].closeness, world)} · {character.relationships.partners[partner.id].closeness}/100</span>}</div>}
        {children.length > 0 && <div className="household-children"><span className="household-field-label">{children.length === 1 ? "Child" : "Children"}</span><ul>{children.map(child => {
          const age = life.age - child.birthAge;
          const tie = character?.relationships?.children[child.id];
          return <li key={child.id}><strong>{child.name}</strong><span className={tie ? "household-child-tie" : undefined}>{age === 0 ? "Newborn" : `Age ${age}`}{tie && <small>{closenessLabel(tie.closeness, world)} · {tie.closeness}/100</small>}</span></li>;
        })}</ul></div>}
        <button type="button" className="household-open" onClick={onOpenCharacter}>Family &amp; life <span aria-hidden="true">→</span></button>
      </div>
    </details>
  </aside>;
}
