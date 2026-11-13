import { useMemo, useState } from "react";
import { activityPartnerIds } from "../../src/character.ts";
import { resolvePartner } from "../../src/people.ts";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import { visibleFamilyActivities } from "../models/character-panel-model.ts";
import { displayProse } from "../models/display-prose.ts";
import ImpactValue from "./ImpactValue.tsx";
import LifeMoment from "./LifeMoment.tsx";
import PixelPortrait from "./PixelPortrait.tsx";
import { personPortraitState } from "../models/portrait-state.ts";
import { getSkillImpact } from "../models/skill-impact.ts";
import YearlyFocus from "./YearlyFocus.tsx";
import type { YearlyFocusId } from "../models/yearly-focus.ts";
import "../styles/life-choice-board.css";

interface Props {
  life: LifeState;
  world: WorldPack;
  activities: readonly ActivityAvailability[];
  focusId: YearlyFocusId;
  onAdvance(): void;
  onOpenChronicle(): void;
  onFocusChange(focusId: YearlyFocusId): void;
  onActivity(id: string): void;
  onOpenPeopleTab?(): void;
}

type ActionTab = "social" | "training" | "career";

export default function LifeChoiceBoard({
  life,
  world,
  activities,
  focusId,
  onAdvance,
  onOpenChronicle,
  onFocusChange,
  onActivity,
  onOpenPeopleTab,
}: Props) {
  const [userActionTab, setUserActionTab] = useState<ActionTab | null>(null);
  const hasUsedYearlyActivity = life.character?.lastActivityAge === life.age;

  const recentActivityOutcome = useMemo(() => {
    if (!life.character || !world.character) return undefined;
    for (let index = life.journal.length - 1; index >= 0; index--) {
      const entry = life.journal[index];
      if (entry.type === "activity" && entry.age === life.age && world.character.activities.some(a => a.id === entry.id)) {
        return life.journal.slice(index + 1).find(item => item.type === "outcome")?.text;
      }
    }
    return undefined;
  }, [life.journal, life.age, life.character, world.character]);

  const socialAndFamilyActions = useMemo(() => {
    const knownSet = new Set([
      ...(life.character?.knownPartnerIds ?? []),
      ...(life.character?.partnerId ? [life.character.partnerId] : []),
    ]);
    const relActions = activities.filter(act => {
      if (act.category !== "relationship" || !act.available) return false;
      const pids = activityPartnerIds(act);
      return pids.every(pid => !world.character?.requireIntroductions || knownSet.has(pid));
    });
    const famActions = visibleFamilyActivities(life, activities).filter(act => act.available);
    return [...relActions, ...famActions];
  }, [activities, life, world.character?.requireIntroductions]);

  const trainingActions = useMemo(
    () => activities.filter(act => act.category === "training" && act.available),
    [activities],
  );

  const careerActions = useMemo(
    () => activities.filter(act => act.category === "career" && act.available),
    [activities],
  );

  if (life.phase === "ended") return null;

  const actionTab: ActionTab =
    userActionTab ??
    (socialAndFamilyActions.length > 0
      ? "social"
      : trainingActions.length > 0
        ? "training"
        : "career");
  const setActionTab = (next: ActionTab) => setUserActionTab(next);

  const activeTabActions =
    actionTab === "social"
      ? socialAndFamilyActions
      : actionTab === "training"
        ? trainingActions
        : careerActions;

  return (
    <div className="life-choice-board is-ready">
      {life.phase === "ready" && (
        <LifeMoment showNotifications={false} life={life} world={world} onAdvance={onAdvance} onOpenChronicle={onOpenChronicle} />
      )}

      {life.phase === "ready" && life.age >= 6 && (
        <section className="life-yearly-action-deck" aria-label="Yearly personal action board">
          <header className="life-action-deck-header">
            <div>
              <span className="life-action-eyebrow">YEARLY PERSONAL ACTION SLOT</span>
              <h3>
                {hasUsedYearlyActivity
                  ? `Action taken for Age ${life.age}`
                  : "Spend your yearly action with people, training, or work"}
              </h3>
            </div>
            <span className={`life-action-budget-pill${hasUsedYearlyActivity ? " is-spent" : ""}`}>
              {hasUsedYearlyActivity ? "0 / 1 remaining this year" : "1 / 1 available this year"}
            </span>
          </header>

          {recentActivityOutcome && (
            <div className="life-action-outcome" role="status">
              <strong>This year’s outcome:</strong> {displayProse(recentActivityOutcome)}
            </div>
          )}

          {!hasUsedYearlyActivity && (
            <>
              <div className="life-action-tabs" role="tablist" aria-label="Yearly action categories">
                <button
                  type="button"
                  role="tab"
                  aria-selected={actionTab === "social"}
                  className={actionTab === "social" ? "is-active" : undefined}
                  onClick={() => setActionTab("social")}
                >
                  People &amp; Family ({socialAndFamilyActions.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={actionTab === "training"}
                  className={actionTab === "training" ? "is-active" : undefined}
                  onClick={() => setActionTab("training")}
                >
                  Practice &amp; Study ({trainingActions.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={actionTab === "career"}
                  className={actionTab === "career" ? "is-active" : undefined}
                  onClick={() => setActionTab("career")}
                >
                  Career &amp; Work ({careerActions.length})
                </button>
                {onOpenPeopleTab && (
                  <button type="button" className="life-action-open-people" onClick={onOpenPeopleTab}>
                    Full People &amp; Town Deck ↘
                  </button>
                )}
              </div>

              {activeTabActions.length === 0 ? (
                <p className="life-action-empty">
                  {actionTab === "social"
                    ? "No personal or family actions available right now. Live another year to meet people or unlock family milestones."
                    : actionTab === "training"
                      ? "No practice activities available at this age."
                      : "No new career actions available right now."}
                </p>
              ) : (
                <div className="life-action-cards">
                  {activeTabActions.slice(0, 6).map(act => {
                    const pid = activityPartnerIds(act)[0];
                    const person = pid ? resolvePartner(world, life, pid) : undefined;
                    const skillDeltas = getSkillImpact(act, life, world);
                    return (
                      <button
                        key={act.id}
                        type="button"
                        className="life-action-card"
                        onClick={() => onActivity(act.id)}
                      >
                        {person && (
                          <PixelPortrait portrait={personPortraitState(world, life, person)} name={person.name} className="life-action-card-avatar" />
                        )}
                        <div className="life-action-card-body">
                          <strong>{displayProse(act.text)}</strong>
                          {person && (
                            <small className="life-action-person-note">
                              {person.name} · {person.occupation}
                            </small>
                          )}
                          {skillDeltas.length > 0 && (
                            <span className="life-action-skill-tags">
                              {skillDeltas.map(change => (
                                <span key={change.id} className="impact-stat">
                                  {change.label} <ImpactValue min={change.min} max={change.max} />
                                </span>
                              ))}
                            </span>
                          )}
                          <ChoiceImpact choice={act} life={life} world={world} hideSkills />
                        </div>
                        <span className="life-action-card-do">Do →</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <YearlyFocus life={life} world={world} focusId={focusId} activities={activities} onChange={onFocusChange} />
    </div>
  );
}
