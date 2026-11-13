import { useId } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import type { LateRouteNode } from "../models/late-skill-routes.ts";
import { buildHouseholdTitlePaths, householdProjectCooldown } from "../models/household-title-paths.ts";
import { displayProse } from "../models/display-prose.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";

function Requirements({ node }: { node: LateRouteNode }) {
  return node.requirements.length > 0 && <ul className="household-project-requirements" aria-label={`${node.achievement.title} requirements`}>
    {node.requirements.map((requirement, index) => <li key={index} className={requirement.met ? "is-met" : "is-missing"}>
      <span aria-hidden="true">{requirement.met ? "✓" : "○"}</span><span>{displayProse(requirement.text)}</span>
    </li>)}
  </ul>;
}

export default function HouseholdTitlePaths({ world, life, activities, onActivity }: {
  world: WorldPack; life: LifeState; activities: readonly ActivityAvailability[]; onActivity(id: string): void;
}) {
  const id = useId();
  const paths = buildHouseholdTitlePaths(world, life, activities);
  if (!paths.length) return null;
  const first = paths.find(path => path.next?.state === "ready") ?? paths.find(path => path.next) ?? paths[0];
  return <section className="household-title-paths" aria-labelledby={`${id}-heading`}>
    <h4 className="household-decisions-heading" id={`${id}-heading`}>Service &amp; titles</h4>
    <p className="wealth-muted">Complete accepted work to earn a household title. Each project shares your yearly activity with council decisions. Earned cards stay in your collection.</p>
    {paths.map(path => <details key={path.id} className="household-conditions household-title-path" open={path.id === first.id}>
      <summary><strong>{path.titleNode?.achievement.title ?? path.title}</strong><span>{path.titleNode?.state === "earned" ? "Title earned" : `${path.completed} / ${path.steps.length} completed`}</span></summary>
      <p className="wealth-muted">{displayProse(path.description)}</p>
      <ol className="household-title-progress" aria-label={`${path.titleNode?.achievement.title ?? path.title} path`}>
        {path.steps.map(node => <li key={node.achievement.id} className={node.state === "earned" ? "is-earned" : node === path.next ? "is-next" : undefined}>
          <span>{node.achievement.title}</span><small>{node.state === "earned" ? "✓ Completed" : node === path.next ? "Next project" : "Later"}</small>
        </li>)}
      </ol>
      {path.next ? <div className="household-current-project">
        <h5>Next: {path.next.achievement.title}</h5>
        <p className="wealth-muted">{displayProse(path.next.achievement.description)}</p>
        <Requirements node={path.next} />
        {path.next.state === "assessed" ? <p className="personal-activity-reason">This final review is complete. Accepted milestones remain in your collection.</p> : path.next.activity && <>
          <div className="personal-activity-list"><button type="button" className="personal-activity" disabled={path.next.state !== "ready"} onClick={() => onActivity(path.next!.activity!.id)}>
            <span className="personal-activity-heading"><strong>{path.next.activity.text}</strong><span className="personal-activity-state">{path.next.state === "ready" ? "Choose" : "Locked"}</span></span>
            <ChoiceImpact choice={path.next.activity} life={life} world={world} showSkillChanges />
            {path.next.reason && <span className="personal-activity-reason">{displayProse(path.next.reason)}</span>}
          </button></div>
          <p className="wealth-muted household-project-cooldown">{householdProjectCooldown(path.next.activity, life)}</p>
        </>}
      </div> : <p className="wealth-muted">This title was earned through your completed work. Its card is recorded in your collection.</p>}
      {path.steps.some(node => node !== path.next && node.state !== "earned") && <details className="household-later-projects">
        <summary>Later projects &amp; title requirements</summary>
        {path.steps.filter(node => node !== path.next && node.state !== "earned").map(node => <article key={node.achievement.id}>
          <h5>{node.achievement.title}</h5><p className="wealth-muted">{displayProse(node.achievement.description)}</p>
          <Requirements node={node} />
          {node.activity && <><ChoiceImpact choice={node.activity} life={life} world={world} showSkillChanges /><p className="wealth-muted household-project-cooldown">{householdProjectCooldown(node.activity, life)}</p></>}
        </article>)}
      </details>}
    </details>)}
  </section>;
}
