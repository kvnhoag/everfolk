import { useEffect, useRef } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import type { YearEndOption } from "../models/year-end-choice.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import PixelIcon from "./PixelIcon.tsx";
import "../styles/year-end.css";

const KIND_ICON: Record<string, string> = { training: "literacy", relationship: "heart", family: "people", career: "craft" };
const KIND_LABEL: Record<string, string> = { training: "Training", relationship: "People", family: "Family", career: "Work" };

/**
 * The year has ended with its action unspent. The clock waits; the player picks one action (their focus's own action
 * is recommended) or lets this year's action go. Nothing is chosen for them.
 */
export default function YearEndDialog({ age, options, activities, life, world, focus, onChoose, onLetGo }: {
  age: number; options: readonly YearEndOption[]; activities: readonly ActivityAvailability[]; life: LifeState; world: WorldPack;
  /** The focus's name, for the recommendation; null when the focus has no action. */
  focus: string | null;
  onChoose(id: string): void; onLetGo(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    first.current?.focus();
    return () => { if (element?.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className="year-end-dialog" aria-labelledby="year-end-title" data-tutorial="hide" onCancel={event => event.preventDefault()}>
    <p className="year-end-eyebrow"><PixelIcon name="hourglass" size={14} />Age {age} is ending</p>
    <h2 id="year-end-title">Choose this year's action</h2>
    <p className="year-end-lead">You have one action left this year, and it ends with the year. The clock waits until you choose; nothing is chosen for you.</p>
    <ul className="year-end-options">
      {options.map((option, index) => {
        const activity = activities.find(candidate => candidate.id === option.id);
        return <li key={option.id}>
          <button ref={index === 0 ? first : undefined} type="button" className={`year-end-option${option.recommended ? " is-recommended" : ""}`} onClick={() => onChoose(option.id)}>
            <span className="year-end-kind"><PixelIcon name={KIND_ICON[option.category] ?? "check"} size={16} />{KIND_LABEL[option.category] ?? "Action"}</span>
            {option.recommended && <span className="year-end-badge">Recommended{focus ? ` · your focus: ${focus}` : ""}</span>}
            <strong>{option.text}</strong>
            {activity && <ChoiceImpact choice={activity} life={life} world={world} hideSkills showSkillChanges />}
          </button>
        </li>;
      })}
    </ul>
    {options.length > 0 && !options.some(option => option.recommended) && <p className="year-end-note">{focus ? `Nothing for your focus (${focus}) can be done this year. Pick any of these.` : "You have no focus set, so nothing is recommended. Pick any of these."}</p>}
    <button type="button" className="year-end-let-go" onClick={onLetGo}>Skip this year's action (nothing happens)</button>
  </dialog>;
}
