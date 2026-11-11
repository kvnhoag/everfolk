import { useId, useMemo, useState, type RefObject } from "react";
import { activityPartnerIds } from "../src/character.ts";
import { formatYear } from "../src/index.ts";
import { resolvePartner } from "../src/people.ts";
import type { ActivityAvailability, Choice, EncounteredPerson, LifeEvent, LifeState, PartnerDefinition, WorldPack } from "../src/types.ts";

function isEncountered(person: PartnerDefinition | EncounteredPerson): person is EncounteredPerson {
  return "sex" in person;
}
import ChoiceImpact from "./ChoiceImpact.tsx";
import { ChoicePreview } from "./CompactSkillPanel.tsx";
import { visibleFamilyActivities } from "./character-panel-model.ts";
import type { DemoScreen, TownFigureView } from "./demo/screen.ts";
import { displayProse } from "./display-prose.ts";
import ImpactValue from "./ImpactValue.tsx";
import LifeMoment from "./LifeMoment.tsx";
import PixelPortrait from "./PixelPortrait.tsx";
import { relationshipLabels } from "./relationship-labels.ts";
import { getSkillImpact } from "./skill-impact.ts";
import YearlyFocus from "./YearlyFocus.tsx";
import type { YearlyFocusId } from "./yearly-focus.ts";
import "./life-choice-board.css";

interface RiskPreview {
  knownCosts: readonly string[];
  chance: string;
  routes?: readonly { choice: string; expectedLossBps: number }[];
}

interface Props {
  life: LifeState;
  world: WorldPack;
  decisionEvent?: LifeEvent;
  choices: readonly Choice[];
  activities: readonly ActivityAvailability[];
  focusId: YearlyFocusId;
  readingPause: boolean;
  autoDecisions: boolean;
  isPlaying: boolean;
  decisionButtonRef?: RefObject<HTMLButtonElement | null>;
  demoView?: DemoScreen | null;
  isLoanDecision?: boolean;
  isLoanOffer?: boolean;
  loanBalanceText?: string | null;
  riskPreview?: RiskPreview | null;
  onChoose(id: string): void;
  onOpenPopup(): void;
  onToggleAuto(): void;
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
  decisionEvent,
  choices,
  activities,
  focusId,
  readingPause,
  autoDecisions,
  isPlaying,
  decisionButtonRef,
  demoView = null,
  isLoanDecision = false,
  isLoanOffer = false,
  loanBalanceText = null,
  riskPreview = null,
  onChoose,
  onOpenPopup,
  onToggleAuto,
  onAdvance,
  onOpenChronicle,
  onFocusChange,
  onActivity,
  onOpenPeopleTab,
}: Props) {
  const id = useId();
  const [previewId, setPreviewId] = useState<string | null>(choices[0]?.id ?? null);
  const [userActionTab, setUserActionTab] = useState<ActionTab | null>(null);

  const preview = choices.find(choice => choice.id === previewId) ?? choices[0];
  const routeRisk = riskPreview?.routes?.find(route => route.choice === preview?.id);

  // Detect any established personal partner referenced in the current decision's choices
  const involvedPerson = useMemo(() => {
    if (!decisionEvent) return undefined;
    const partnerIds = new Set<string>();
    for (const choice of choices) {
      for (const outcome of choice.outcomes) {
        for (const effect of outcome.effects) {
          if ("partner" in effect && typeof effect.partner === "string") partnerIds.add(effect.partner);
        }
      }
    }
    const textMatches = `${decisionEvent.title} ${decisionEvent.text}`.matchAll(/\{person:([a-z][a-z0-9-]*)\}/g);
    for (const match of textMatches) {
      if (match[1]) partnerIds.add(match[1]);
    }
    for (const pid of partnerIds) {
      const resolved = resolvePartner(world, life, pid);
      if (resolved) return resolved;
    }
    return undefined;
  }, [decisionEvent, choices, world, life]);

  // Detect any Town Figure involved if this is a Town Offer or town-related turning point
  const involvedTownFigure = useMemo<TownFigureView | undefined>(() => {
    if (!decisionEvent || !demoView?.townFigures) return undefined;
    if (demoView.activeOffer) {
      return demoView.townFigures.find(fig => fig.role === demoView.activeOffer?.role);
    }
    const text = `${decisionEvent.id} ${decisionEvent.title} ${decisionEvent.text}`.toLowerCase();
    if (text.includes("army") || text.includes("convoy") || text.includes("garrison") || text.includes("soldier")) {
      return demoView.townFigures.find(fig => fig.role === "army");
    }
    if (text.includes("neighbour") || text.includes("grower") || text.includes("flood") || text.includes("harvest")) {
      return demoView.townFigures.find(fig => fig.role === "grower");
    }
    if (text.includes("merchant") || text.includes("market") || text.includes("harbor")) {
      return demoView.townFigures.find(fig => fig.role === "merchant");
    }
    return undefined;
  }, [decisionEvent, demoView]);

  const playerName = life.character?.name ?? "Damon";
  const hasUsedYearlyActivity = life.character?.lastActivityAge === life.age;

  // Recent yearly activity outcome (if used this year)
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

  // Group available yearly activities for quick inline board access
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

  const sources = (decisionEvent?.sourceIds ?? [])
    .map(sourceId => world.sources?.find(source => source.id === sourceId))
    .filter(source => source !== undefined);

  if (life.phase === "ended") return null;

  // ── MODE 1: ACTIVE TURNING POINT / DECISION BOARD ──────────────────────────
  if (life.phase === "choice" && decisionEvent) {
    const badgeLabel =
      decisionEvent.rarity === "rare"
        ? "Rare encounter"
        : demoView?.activeOffer
          ? "Town offer"
          : isLoanDecision || isLoanOffer
            ? "Moneylender"
            : "Turning point";

    const involvedCloseness = involvedPerson
      ? life.character?.relationships?.partners[involvedPerson.id]?.closeness
      : undefined;
    const involvedTags = involvedPerson ? relationshipLabels(world, life, involvedPerson.id) : [];

    return (
      <section className={`life-choice-board is-decision${decisionEvent.rarity === "rare" ? " is-rare" : ""}`} aria-labelledby={`${id}-board-title`}>
        <header className="life-choice-board-header">
          <div className="life-choice-board-meta">
            <span className="life-choice-badge">{badgeLabel}</span>
            <span className="life-choice-age">Age {life.age} · {formatYear(life.year)}</span>
            <span className="life-choice-status" role="status">
              {readingPause
                ? "Reading pause."
                : autoDecisions
                  ? isPlaying
                    ? "Auto mode is choosing."
                    : "Auto mode is paused."
                  : "A decision is waiting."}
            </span>
          </div>
          <div className="life-choice-board-controls">
            <button
              ref={decisionButtonRef}
              type="button"
              className="life-choice-popup-btn"
              onClick={onOpenPopup}
            >
              Open decision popup ↗
            </button>
            <button
              type="button"
              className={`life-choice-auto-btn${autoDecisions ? " is-on" : ""}`}
              aria-pressed={autoDecisions}
              onClick={onToggleAuto}
            >
              {autoDecisions ? "Auto mode: On" : "Enable Auto mode"}
            </button>
          </div>
        </header>

        {/* CK3-Style Face-to-Face Character Encounter Strip */}
        {(involvedPerson || involvedTownFigure || isLoanDecision || isLoanOffer) && (
          <div className="life-encounter-banner" aria-label="Characters in this decision">
            <div className="life-encounter-side is-player">
              <PixelPortrait
                age={life.age}
                name={playerName}
                seed={life.seed}
                sex={life.character?.sex}
                originId={life.originId}
                avatarVariant={life.character?.avatarVariant}
                className="life-encounter-avatar"
              />
              <div>
                <span className="life-encounter-role">You</span>
                <strong>{playerName}</strong>
                <small>Age {life.age}</small>
              </div>
            </div>

            <div className="life-encounter-vs" aria-hidden="true">⇄</div>

            {involvedPerson ? (
              <div className="life-encounter-side is-counterpart">
                {isEncountered(involvedPerson) && (
                  <PixelPortrait
                    age={life.age + involvedPerson.ageOffset}
                    name={involvedPerson.name}
                    sex={involvedPerson.sex}
                    originId={involvedPerson.originId}
                    avatarVariant={involvedPerson.avatarVariant}
                    seed={`${life.seed}:${involvedPerson.id}`}
                    className="life-encounter-avatar"
                  />
                )}
                <div>
                  <div className="life-encounter-tags">
                    {involvedTags.length > 0
                      ? involvedTags.map(tag => <span key={tag} className="life-encounter-tag">{tag}</span>)
                      : <span className="life-encounter-role">Acquaintance</span>}
                  </div>
                  <strong>{involvedPerson.name}</strong>
                  <small>
                    {involvedPerson.occupation} · Age {life.age + involvedPerson.ageOffset}
                    {involvedCloseness !== undefined ? ` · Closeness ${involvedCloseness}/100` : ""}
                  </small>
                </div>
              </div>
            ) : involvedTownFigure ? (
              <div className="life-encounter-side is-counterpart">
                <PixelPortrait
                  age={involvedTownFigure.age}
                  name={involvedTownFigure.name}
                  sex={involvedTownFigure.sex}
                  originId={involvedTownFigure.originId}
                  avatarVariant={involvedTownFigure.avatarVariant}
                  seed={`town:${involvedTownFigure.role}`}
                  className="life-encounter-avatar"
                />
                <div>
                  <span className="life-encounter-role">{involvedTownFigure.title}</span>
                  <strong>{involvedTownFigure.name}</strong>
                  <small>{involvedTownFigure.statusLine}</small>
                </div>
              </div>
            ) : (
              <div className="life-encounter-side is-counterpart">
                <PixelPortrait
                  age={52}
                  name="Syros the Banker"
                  sex="male"
                  originId="merchant-household"
                  avatarVariant={2}
                  seed="town:moneylender"
                  className="life-encounter-avatar"
                />
                <div>
                  <span className="life-encounter-role">{world.economy?.moneylender?.title ?? "Moneylender"}</span>
                  <strong>Syros the Banker</strong>
                  <small>{loanBalanceText ?? "High-risk harbor credit"}</small>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="life-choice-board-body">
          <h2 id={`${id}-board-title`} className="life-choice-board-title">{displayProse(decisionEvent.title)}</h2>
          <p className="life-choice-board-text">{displayProse(decisionEvent.text)}</p>

          <div className="life-choice-board-grid">
            <div className="life-choice-options-col" role="group" aria-label="Decision options">
              {choices.map((choice, index) => {
                const isSelected = preview?.id === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={`life-board-option${isSelected ? " is-previewed" : ""}`}
                    onPointerEnter={e => {
                      if (e.pointerType !== "touch") setPreviewId(choice.id);
                    }}
                    onFocus={() => setPreviewId(choice.id)}
                    onClick={() => onChoose(choice.id)}
                  >
                    <span className="life-board-option-num" aria-hidden="true">{index + 1}</span>
                    <span className="life-board-option-copy">
                      <strong>{displayProse(choice.text)}</strong>
                      <ChoiceImpact choice={choice} life={life} world={world} />
                    </span>
                    <span className="life-board-option-cta">Choose →</span>
                  </button>
                );
              })}
            </div>

            {preview && (
              <div className="life-choice-preview-col">
                <ChoicePreview world={world} life={life} choice={preview} />
                {riskPreview && (
                  <section className="life-board-risk" aria-label="Convoy risk">
                    <h4>Convoy &amp; route risk</h4>
                    {riskPreview.knownCosts.length > 0 && (
                      <ul>
                        {riskPreview.knownCosts.map(cost => <li key={cost}>{cost}</li>)}
                      </ul>
                    )}
                    <p>
                      {routeRisk
                        ? `${preview.text}: expected cargo loss ${routeRisk.expectedLossBps / 100}%.`
                        : riskPreview.chance}
                    </p>
                  </section>
                )}
              </div>
            )}
          </div>

          {sources.length > 0 && (
            <details className="life-board-sources">
              <summary>Historical sources ({sources.length})</summary>
              <div className="life-board-source-links">
                {sources.map(source => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                    {source.title} ↗
                  </a>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>
    );
  }

  // ── MODE 2: READY STATE — THIS YEAR'S MOMENT + YEARLY ACTION SLOT + FOCUS ──
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
      <LifeMoment life={life} world={world} onAdvance={onAdvance} onOpenChronicle={onOpenChronicle} />

      {life.age >= 6 && (
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
                        {person && isEncountered(person) && (
                          <PixelPortrait
                            age={life.age + person.ageOffset}
                            name={person.name}
                            sex={person.sex}
                            originId={person.originId}
                            avatarVariant={person.avatarVariant}
                            seed={`${life.seed}:${person.id}`}
                            className="life-action-card-avatar"
                          />
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

      <YearlyFocus life={life} world={world} focusId={focusId} onChange={onFocusChange} />
    </div>
  );
}
