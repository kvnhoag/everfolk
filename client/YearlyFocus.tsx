import { useId, useMemo } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import { engineForLife } from "./session.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import { focusActivity, focusStatus, yearlyDeclineNotes, YEARLY_FOCUSES } from "./yearly-focus.ts";
import type { YearlyFocusId } from "./yearly-focus.ts";
import "./yearly-focus.css";

export default function YearlyFocus({ life, world, focusId, onChange }: {
  life: LifeState; world: WorldPack; focusId: YearlyFocusId; onChange: (focusId: YearlyFocusId) => void;
}) {
  const id = useId();
  const activities = useMemo(() => engineForLife(life).getActivities(life), [life]);
  const firstAge = Math.min(...YEARLY_FOCUSES.flatMap(focus => {
    const activity = focusActivity(world, focus.id);
    return activity ? [activity.minAge ?? 0] : [];
  }));
  if (life.age < firstAge || life.phase === "ended") return null;
  const selected = activities.find(activity => activity.id === focusActivity(world, focusId)?.id);
  return <section className="yearly-focus" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>This year’s focus <small>Change anytime</small></h2>
    <div className="yearly-focus-options" role="group" aria-label="Yearly focus">{YEARLY_FOCUSES.map(focus => {
      const activity = focusActivity(world, focus.id);
      if (focus.activityId && !activity) return null;
      const ageLocked = Boolean(activity && life.age < (activity.minAge ?? 0));
      return <button key={focus.id} type="button" aria-pressed={focusId === focus.id} disabled={ageLocked}
        title={ageLocked ? `Available from age ${activity!.minAge}.` : undefined} onClick={() => onChange(focus.id)}>
        {focus.label}{ageLocked && <span>Age {activity!.minAge}+</span>}
      </button>;
    })}</div>
    {selected && <div className="yearly-focus-impact"><ChoiceImpact choice={selected} life={life} world={world} /></div>}
    <p className="yearly-focus-note" aria-live="polite">{focusStatus(life, world, focusId, activities)}</p>
    {yearlyDeclineNotes(life, world).map(note => <p className="yearly-focus-decay" key={note}>{note}</p>)}
  </section>;
}
