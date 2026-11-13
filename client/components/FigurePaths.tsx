import { figureRosterEntry, type FigureCardRank } from "../../chain/catalog/figure-roster.ts";
import { getFigureCardProgress } from "../../src/figures/card-progress.ts";
import FigureCardStack from "./FigureCardStack.tsx";
import { contributionCardRanks } from "../models/figure-contribution-ranks.ts";
import { figureRarityLabel } from "../models/figure-card-labels.ts";
import FigureCardViewer from "./FigureCardViewer.tsx";
import { matchesCondition } from "../../src/conditions.ts";
import { useMemo, useState } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import type { FigurePathProgress } from "../../src/figures/types.ts";
import { getFigurePaths } from "../../src/figures/progress.ts";
import { formatYear } from "../../src/calendar.ts";
import { deepInventory } from "../../src/deep-capabilities/actions.ts";
import "../styles/figure-paths.css";

interface Props { world: WorldPack; life: LifeState; activities: readonly ActivityAvailability[]; onActivity(id: string): void; readOnly?: boolean; initialFigureId?: string }
export default function FigurePaths({ world, life, activities, onActivity, readOnly = false, initialFigureId }: Props) {
  const paths = useMemo(() => getFigurePaths(world, life), [world, life]);
  const [selectedId, setSelectedId] = useState(initialFigureId ?? paths[0]?.definition.id);
  const [cardPreview, setCardPreview] = useState<{ id: string; rank: FigureCardRank; mode: "principal" | "contribution" } | null>(null);
  if (!paths.length) return null;
  const selected = paths.find(path => path.definition.id === selectedId) ?? paths[0];
  const path = selected.definition, inventory = deepInventory(life);
  const card = figureRosterEntry(path.id), cardProgress = getFigureCardProgress(world, life, path.id);
  const contributionRanks = card ? contributionCardRanks(card, selected) : undefined;
  const previewFigure = cardPreview ? figureRosterEntry(cardPreview.id) : undefined;
  const previewProgress = cardPreview ? getFigureCardProgress(world, life, cardPreview.id) : undefined;
  const nextCardStage = previewProgress?.contributor.nextStage;
  const upgradeActivity = nextCardStage ? activities.find(activity => activity.id === nextCardStage.definition.activityId) : undefined;
  const upgradeAction = !readOnly && cardPreview?.mode === "contribution" && nextCardStage ? {
    label: `Earn ${nextCardStage.definition.rank} contribution`,
    enabled: nextCardStage.ready && upgradeActivity?.available === true,
    reason: upgradeActivity?.available ? previewProgress!.contributor.requirements.join("; ") : upgradeActivity?.reason ?? nextCardStage.missingRequirements.join("; "),
    onActivate: () => { if (nextCardStage.ready && upgradeActivity?.available) { onActivity(nextCardStage.definition.activityId); setCardPreview(null); } },
  } : undefined;
  const actionForWork = (workId: string) => activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === workId)));
  function Action({ activityId, label }: { activityId?: string; label?: string }) {
    const activity = activities.find(activity => activity.id === activityId);
    if (!activity) return null;
    const workEffect = activity.outcomes.flatMap(outcome => outcome.effects).find(effect => effect.type === "vocation");
    const work = workEffect?.type === "vocation" ? world.vocations?.actions[workEffect.action] : undefined;
    const weights = activity.outcomes.map(outcome => outcome.weight * (outcome.weightModifiers ?? []).reduce((weight, modifier) => matchesCondition(modifier.when, life) ? weight * modifier.multiplier : weight, 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    return <div className="figure-action">
      {activity.outcomes.length > 1 && <details className="figure-outcomes"><summary>Possible outcomes · one attempt</summary><ul>{activity.outcomes.map((outcome, index) => <li key={outcome.id}><strong>{new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(weights[index] * 100 / totalWeight)}%</strong> {outcome.text}</li>)}</ul></details>}
      {work?.kind === "work" && <p className="figure-work-quote">
        One work year · fee {work.fee} {world.economy?.currency.short} · pay {work.pay} {world.economy?.currency.short}
        {Object.entries(work.inputs ?? {}).length > 0 && <span>Materials: {Object.entries(work.inputs ?? {}).map(([item, quantity]) => `${quantity} ${item.replaceAll("-", " ")} (have ${inventory[item] ?? 0})`).join("; ")}</span>}
        <span>{world.character?.skills[work.primary]?.label ?? work.primary} +3{work.supports.map(id => ` · ${world.character?.skills[id]?.label ?? id} +2`).join("")}</span>
      </p>}
      <button type="button" disabled={readOnly || !activity.available} onClick={() => onActivity(activity.id)}>{label ?? activity.text}</button>
      {!readOnly && !activity.available && activity.reason && <small>{activity.reason}</small>}
    </div>;
  }
  const projectIds = new Set([...path.stages.map(stage => stage.workActionId), `fig-${path.id}-capstone-work`]);
  const materialIds = new Set([...projectIds].flatMap(id => { const action = world.vocations?.actions[id]; return action?.kind === "work" ? Object.keys(action.inputs ?? {}) : []; }));
  const purchases = [...materialIds].map(item => activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && world.vocations?.actions[effect.action]?.kind === "buy" && (world.vocations.actions[effect.action] as { item: string }).item === item)))).filter((activity): activity is ActivityAvailability => Boolean(activity));
  const entry = selected.encounterMode === "tradition" ? "Through the later tradition" : selected.encounterMode === "circle" ? "Through a teaching circle" : selected.encounterMode ? "Personal encounter recorded" : null;
  return <section className="figure-paths" aria-label="Historical figures and earned titles">
    <header className="figure-paths-heading"><div><p className="figure-eyebrow">Historical paths</p><h3>Work that earns a place in history</h3></div><p>Develop a figure's craft, inquiry or public work. Your contribution earns its own rank; the figure's special title requires a separate defining achievement.</p></header>
    <nav className="figure-roster" aria-label="Choose a historical figure">{paths.map(item => <button key={item.definition.id} type="button" aria-pressed={item.definition.id === path.id} onClick={() => setSelectedId(item.definition.id)}><img src={figureRosterEntry(item.definition.id)?.art.src} alt="" width={38} height={52} loading="lazy" /><strong>{item.definition.name}</strong><span>{figureRosterEntry(item.definition.id) ? figureRarityLabel(figureRosterEntry(item.definition.id)!) : item.principalRank}{item.associationRank ? ` · Your contribution: ${item.associationRank}` : ""}</span></button>)}</nav>
    <article className="figure-path-detail" data-figure-path={path.id}>
      <header><div><p className="figure-eyebrow">Figure · {card ? figureRarityLabel(card) : selected.principalRank}{card && card.variants.length > 1 ? ` · Current: ${selected.principalRank}` : ""}{selected.alternateHistory ? " · Alternate history" : ""}</p><h4>{selected.principalTitle}</h4></div><span className="figure-contribution-rank">{selected.associationRank ?? "No contribution title yet"}</span></header>
      <p>{path.summary}</p>
      {card && <div className="figure-path-card-strip">
        <div><p className="figure-eyebrow">{selected.specialTitle ? "Your figure legacy" : "Figure card preview"}</p><FigureCardStack figure={card} rank={selected.principalRank} traits={cardProgress?.traits.filter(trait => trait.earned)} onInspect={rank => setCardPreview({ id: path.id, rank, mode: "principal" })} /></div>
        <div><p className="figure-eyebrow">{selected.associationRank ? "Your contribution card" : "Next contribution card"}</p><FigureCardStack figure={card} mode="contribution" contributionRanks={contributionRanks} rank={selected.associationRank ?? selected.nextStage?.definition.rank ?? contributionRanks?.[0]} title={selected.associationTitle ?? (selected.encounterMode === "tradition" ? selected.nextStage?.definition.traditionTitle : selected.nextStage?.definition.title)} traits={cardProgress?.traits.filter(trait => trait.earned)} onInspect={rank => setCardPreview({ id: path.id, rank, mode: "contribution" })} /></div>
      </div>}
      {selected.associationTitle && <p className="figure-earned-title">Your earned title: <strong>{selected.associationTitle}</strong></p>}
      {selected.specialTitle && <p className="figure-special-title">Special title earned: <strong>{selected.specialTitle.title}</strong> · {selected.specialTitle.rank}{selected.specialTitle.alternateHistory ? " · Alternate history" : ""}</p>}
      {!selected.capstone.earned && !selected.capstone.failed && <div className="figure-preparation"><h5>Develop the foundations</h5><Action activityId={actionForWork(`fig-${path.id}-prepare`)?.id} /></div>}
      <div className="figure-entry">
        <h5>Reach the work</h5>
        <p>{path.encounter.location} · {formatYear(path.encounter.fromYear)}{path.encounter.toYear === undefined ? " onward" : `–${formatYear(path.encounter.toYear)}`}</p>
        {path.encounter.access === "circle" && <p>A teaching-circle route; a personal meeting is not established by the historical evidence.</p>}
        {entry ? <p className="figure-earned-title">{entry}</p> : <><Action activityId={path.encounter.activityId} />{path.tradition && <><p>Later route: {path.tradition.location}, from {formatYear(path.tradition.fromYear)}. Titles describe the tradition rather than a meeting with the living figure.</p><Action activityId={path.tradition.activityId} /></>}</>}
      </div>
      <ol className="figure-title-ladder">{selected.stages.map(stage => <li key={stage.definition.achievementId} className={stage.earned ? "is-earned" : ""}>
        <div className="figure-tier-heading"><span>{stage.definition.rank}</span><h5>{selected.encounterMode === "tradition" ? stage.definition.traditionTitle : stage.definition.title}</h5><strong>{stage.earned ? "Earned" : `${Math.min(life.vocations?.completed[stage.definition.workActionId] ?? 0, stage.definition.workYears)} / ${stage.definition.workYears} work years`}</strong></div>
        <p>{stage.definition.description}</p>
        {!stage.earned && <><Requirements progress={stage} /><Action activityId={actionForWork(stage.definition.workActionId)?.id} /><Action activityId={stage.definition.activityId} label="Record this contribution title" /></>}
      </li>)}</ol>
      <section className="figure-capstone"><p className="figure-eyebrow">Figure-defining achievement</p><h5>{path.capstone.title}</h5><p>{path.capstone.description}</p>
        {selected.capstone.failed ? <p className="figure-failed" role="status">Unsuccessful outcome recorded. Your earned contribution titles remain. This attempt cannot be repeated.</p> : selected.capstone.earned ? <p className="figure-earned-title">Recorded in this life.</p> : <><Requirements progress={selected.capstone} /><Action activityId={actionForWork(`fig-${path.id}-capstone-work`)?.id} /><Action activityId={path.capstone.activityId} /></>}
        {path.promotion && <p className="figure-promotion">{path.promotion.milestone === "rhodes-captured" ? "Legendary requires the successful capture of Rhodes in an alternate-history outcome." : path.promotion.milestone === "ptolemaic-dynasty-founded" ? "Legendary requires successfully founding the Ptolemaic dynasty." : "Legendary requires an independently functioning Stoic school; this remains the working rarity criterion."} A preparation, attempt, date or failed outcome does not grant the promotion.</p>}
        {selected.promotionOutcome === "failed" && <p className="figure-failed" role="status">The attempt was unsuccessful. The figure remains Epic, and the attempt cannot be repeated.</p>}
        {path.promotion && path.promotion.activityId !== path.capstone.activityId && selected.promotionOutcome === "not-attempted" && <><Action activityId={actionForWork(`fig-${path.id}-promotion-work`)?.id} /><Action activityId={path.promotion.activityId} /></>}
      </section>
      {selected.legendaryContribution && selected.principalRank === "Legendary" && <section className="figure-capstone figure-contribution-recognition" aria-label="Legendary contribution recognition">
        <p className="figure-eyebrow">Contribution · Epic</p><h5>{selected.encounterMode === "tradition" ? selected.legendaryContribution.definition.traditionTitle : selected.legendaryContribution.definition.title}</h5>
        <p>{selected.legendaryContribution.definition.description}</p>
        {selected.legendaryContribution.earned ? <p className="figure-earned-title">Epic contribution recorded. Your earlier contribution cards keep their original ranks.</p> : <><Requirements progress={selected.legendaryContribution} /><Action activityId={selected.legendaryContribution.definition.activityId} label="Record Epic contribution title" /></>}
      </section>}
      {purchases.length > 0 && !readOnly && <details className="figure-supplies"><summary>Project materials</summary><div>{purchases.map(activity => <Action key={activity.id} activityId={activity.id} />)}</div></details>}
      <details className="figure-sources"><summary>Historical basis</summary><p>Encounters, contribution titles and player projects are authored gameplay. The sources support the setting and the figure's work.</p><ul>{path.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
    </article>
    <FigureCardViewer figure={previewFigure ?? null} initialRank={cardPreview?.rank} mode={cardPreview?.mode} world={world} life={life} upgradeAction={upgradeAction} onClose={() => setCardPreview(null)} />
  </section>;
}
function Requirements({ progress }: { progress: Pick<FigurePathProgress["capstone"], "missingRequirements" | "ready"> }) {
  return progress.ready ? <p className="figure-ready">Requirements met. Record the achievement when ready.</p> : <details className="figure-requirements"><summary>What remains</summary><ul>{progress.missingRequirements.map((requirement, index) => <li key={index}>{requirement}</li>)}</ul></details>;
}
