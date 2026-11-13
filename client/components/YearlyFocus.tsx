import { useId, useMemo } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import { engineForLife } from "../lib/world-session.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import ImpactValue from "./ImpactValue.tsx";
import { trainingSkillChanges } from "../models/skill-tree.ts";
import { focusActivity, focusStatus, yearlyDeclineNotes, availableYearlyFocuses } from "../models/yearly-focus.ts";
import { yearlyFocusFirstAge } from "../models/yearly-focus.ts";
import SectionHelp from "./SectionHelp.tsx";
import PixelIcon from "./PixelIcon.tsx";
import { LockedSection, SectionStep } from "./YearChecklist.tsx";
import { sectionStep } from "../models/section-steps.ts";
import type { YearlyFocusId } from "../models/yearly-focus.ts";
import "../styles/yearly-focus.css";

export default function YearlyFocus({ life, world, focusId, activities: providedActivities, onChange }: {
  life: LifeState; world: WorldPack; focusId: YearlyFocusId; activities?: readonly ActivityAvailability[]; onChange: (focusId: YearlyFocusId) => void;
}) {
  const id = useId();
  const activities = useMemo(() => providedActivities ?? engineForLife(life).getActivities(life), [providedActivities, life]);
  const focuses = availableYearlyFocuses(world, life);
  const firstAge = yearlyFocusFirstAge(world, life);
  if (life.phase === "ended" || !Number.isFinite(firstAge)) return null;
  if (life.age < firstAge) return <LockedSection step={sectionStep("focus")} id="focus" title="This year’s focus" opensAt={`Opens at age ${firstAge}`}>
    {`Pick what you practise each year, such as Study or Farming; its skills then grow on their own. ${focuses.filter(focus => focus.activityId).slice(0, 3).map(focus => focus.label).join(", ")} and more.`}
  </LockedSection>;
  const selected = activities.find(activity => activity.id === focusActivity(world, focusId)?.id);
  const skillChanges = selected ? trainingSkillChanges(selected, world, life) : [];
  return <section className="yearly-focus has-section-help" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}><SectionStep step={sectionStep("focus")} />This year’s focus <small>Change anytime</small></h2>
    <div className="yearly-focus-options" role="group" aria-label="Yearly focus">{focuses.map(focus => {
      const activity = focusActivity(world, focus.id);
      if (focus.activityId && !activity) return null;
      const ageLocked = Boolean(activity && life.age < (activity.minAge ?? 0));
      return <button key={focus.id} type="button" aria-pressed={focusId === focus.id} disabled={ageLocked}
        title={ageLocked ? `Available from age ${activity!.minAge}.` : undefined} onClick={() => onChange(focus.id)}>
        {focus.label}{ageLocked && <span><PixelIcon name="lock" size={9} /> Age {activity!.minAge}</span>}
      </button>;
    })}</div>
    {selected && <div className="yearly-focus-impact">
      <p className="yearly-focus-action">{selected.text}</p>
      {skillChanges.length > 0 && <div className="yearly-focus-skills" aria-label="Possible skill changes">{skillChanges.map(change => <span key={change.id}>{change.label} <ImpactValue min={change.min} max={change.max} /></span>)}</div>}
      <ChoiceImpact choice={selected} life={life} world={world} />
    </div>}
    <p className="yearly-focus-note" aria-live="polite">{focusStatus(life, world, focusId, activities)}</p>
    {yearlyDeclineNotes(life, world).map(note => <p className="yearly-focus-decay" key={note}>{note}</p>)}
    <SectionHelp hint="focus" />
  </section>;
}
