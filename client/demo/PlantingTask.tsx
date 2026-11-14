import { useEffect, useId, useMemo, useState } from "react";
import { usePlanDraft, writePlanDraft } from "../hooks/usePlanDraft.ts";
import { LockedArea } from "../components/Locked.tsx";
import PixelIcon from "../components/PixelIcon.tsx";
import SectionHelp from "../components/SectionHelp.tsx";
import { cropChoices, MIX_LOCKED_NOTE, mixedCurrentNote, pendingLine, plantedLine, sendingLine, splitText } from "../models/field-plan.ts";
import type { PlantingCheck } from "../models/planting-check.ts";
import type { DemoScreen } from "./screen.ts";
import "./planting-task.css";

/** Without a check (no engine at hand) the card still offers the split and sets it; the game answers on Set planting. */
const NO_CHECK: PlantingCheck = { reason: null, warnings: [], mixedUnlocked: true, seed: null, forecast: null };

export interface PlantingTaskProps {
  screen: DemoScreen;
  onPlan(flaxPlots: number): string | null;
  /** What a plan would do, checked before Set planting. */
  checkPlan?(flaxPlots: number): PlantingCheck;
  /** The age the player starts planning the fields; null once it is open. */
  lockedUntil?: number | null;
}

/** The split of the household's plots, one square per plot, grain first. */
function PlotSquares({ plots, flax }: { plots: number; flax: number }) {
  return <span className="aoe-plot-squares" aria-hidden="true">
    {Array.from({ length: plots }, (_, index) => <span key={index} className={index < plots - flax ? "is-grain" : "is-flax"} />)}
  </span>;
}

const Title = () => <h4 id="aoe-task-planting"><PixelIcon name="res-grain" size={14} />Plan your fields</h4>;

/**
 * Plan your fields: the choice, what it would do (checked before the click), Set planting and what was planted, with
 * the game's own forecast. Before Crop allocation it offers one crop for every plot. Shared with Farm & Granary.
 */
export function PlantingTask({ lockedUntil = null, ...props }: PlantingTaskProps) {
  if (lockedUntil !== null) return <article className="aoe-task aoe-planting-row" aria-labelledby="aoe-task-planting">
    <Title />
    <LockedArea locked title="Plan your fields" unlock={`Unlocks at age ${lockedUntil}`} note="Your family plans the fields until then.">
      <p className="aoe-task-how">Split the plots between grain and flax.</p>
    </LockedArea>
  </article>;
  if (props.screen.household.plots === 0) return <article className="aoe-task aoe-planting-row" aria-labelledby="aoe-task-planting">
    <Title />
    <p className="aoe-task-how">The household has no fields to plan this year.</p>
  </article>;
  return <OpenPlanting {...props} />;
}

function OpenPlanting({ screen, onPlan, checkPlan }: Omit<PlantingTaskProps, "lockedUntil">) {
  const { plots, flaxPlots: current } = screen.household;
  const [draft, setDraft] = usePlanDraft(plots, current);
  const [justSet, setJustSet] = useState(false);
  const [refusal, setRefusal] = useState("");
  // A plan on its way (online play answers after a moment): named as sent until the game confirms it.
  const [sent, setSent] = useState<number | null>(null);
  useEffect(() => {
    if (sent === null || sent !== current) return;
    writePlanDraft(null);
    setSent(null);
  }, [sent, current]);
  const checks = useMemo(() => {
    const check = (flaxPlots: number) => checkPlan?.(flaxPlots) ?? NO_CHECK;
    return { pending: check(draft), current: check(current), grain: check(0), flax: check(plots) };
  }, [checkPlan, draft, current, plots]);
  const split = checks.current.mixedUnlocked;
  // Before Crop allocation each choice plants at once; after it, the split is a draft until Set planting.
  const shown = split ? draft : current;
  const plan = (flax: number) => {
    const error = onPlan(flax);
    setRefusal(error ?? ""); setJustSet(!error); setSent(error ? null : flax);
  };
  const change = (next: number) => { setDraft(Math.max(0, Math.min(plots, next))); setJustSet(false); setRefusal(""); };
  const { reason, warnings } = split ? checks.pending : checks.current;
  return <article className="aoe-task aoe-planting-row has-section-help" aria-labelledby="aoe-task-planting">
    <SectionHelp hint="planting" />
    <Title />
    {split
      ? <SplitPlan screen={screen} flax={draft} onChange={change} />
      : <CropChoices plots={plots} current={current} checks={checks} onChoose={plan} />}
    {(reason || warnings.length > 0) && <ul className="aoe-plan-check" aria-label={split ? "Before you set this plan" : "About this plan"}>
      {reason && <li className="is-blocked"><PixelIcon name="lock" size={12} label="Cannot set" />{reason}</li>}
      {warnings.map(line => <li key={line}><PixelIcon name="warn" size={12} label="Warning" />{line}</li>)}
    </ul>}
    <div className="aoe-task-actions">
      {split && <button type="button" className="aoe-task-primary" disabled={draft === current || Boolean(reason)} onClick={() => plan(draft)}>Set planting</button>}
      <PlanStatus refusal={refusal} sending={sent !== null && sent !== current ? sent : null} pending={shown !== current} fresh={justSet}
        plots={plots} flax={shown} forecast={checks.current.forecast} />
    </div>
  </article>;
}

type Checks = Record<"pending" | "current" | "grain" | "flax", PlantingCheck>;

/** Before Crop allocation: one crop for every plot. Each choice says what it gives and needs, and plants at once. */
function CropChoices({ plots, current, checks, onChoose }: { plots: number; current: number; checks: Checks; onChoose(flax: number): void }) {
  const name = useId();
  const choices = cropChoices(plots, checks.grain.seed, checks.flax.seed);
  const mixedNow = current > 0 && current < plots;
  return <>
    <p className="aoe-task-how">Choose what your {plots === 1 ? "plot grows" : `${plots} plots grow`} for the next harvest. Your choice is planted at once.</p>
    <div className="aoe-crop-choices" role="radiogroup" aria-labelledby="aoe-task-planting">
      {choices.map(choice => {
        const refused = checks[choice.id].reason;
        return <label key={choice.id} className={`aoe-crop-choice${current === choice.flaxPlots ? " is-selected" : ""}`} title={refused ?? undefined}>
          <input type="radio" name={name} value={choice.id} checked={current === choice.flaxPlots} disabled={Boolean(refused)} onChange={() => onChoose(choice.flaxPlots)} />
          <span className="aoe-crop-choice-head"><PixelIcon name={choice.icon} size={16} /><strong>{choice.title}</strong>
            {current === choice.flaxPlots && <span className="aoe-crop-current">Current plan</span>}</span>
          <span className="aoe-crop-choice-line">{choice.line}</span>
        </label>;
      })}
    </div>
    {mixedNow && <p className="aoe-plan-current">{mixedCurrentNote(plots - current, current)}</p>}
    {plots >= 2 && <p className="aoe-crop-mix-note">{MIX_LOCKED_NOTE}</p>}
  </>;
}

/** After Crop allocation: the grain/flax split, plot by plot; the plan in effect stays named while a draft differs. */
function SplitPlan({ screen, flax, onChange }: { screen: DemoScreen; flax: number; onChange(next: number): void }) {
  const { plots, mouths, flaxPlots: current } = screen.household;
  const unchanged = flax === current;
  return <>
    <p className="aoe-task-how">Grain plots feed {mouths} {mouths === 1 ? "mouth" : "mouths"} and pay the rent. Flax plots grow flax to spin into linen and sell. The split counts for the next harvest.</p>
    <div className="aoe-plot-plan">
      <PlotSquares plots={plots} flax={flax} />
      <span className="aoe-plot-count"><strong>{plots - flax}</strong> grain · <strong>{flax}</strong> flax{unchanged && <span className="aoe-crop-current">Current plan</span>}</span>
      <span className="aoe-stepper" role="group" aria-label="Flax plots next year">
        <button type="button" aria-label="One less flax plot" disabled={flax <= 0} onClick={() => onChange(flax - 1)}>−</button>
        <output aria-live="polite">{flax} flax</output>
        <button type="button" aria-label="One more flax plot" disabled={flax >= plots} onClick={() => onChange(flax + 1)}>+</button>
      </span>
    </div>
    {!unchanged && <p className="aoe-plan-current">Current plan: {splitText(plots - current, current)}.</p>}
  </>;
}

/** What was planted, or the draft still to set: always one line, so the card never goes quiet after a click. */
function PlanStatus({ refusal, sending, pending, fresh, plots, flax, forecast }: {
  refusal: string; sending: number | null; pending: boolean; fresh: boolean; plots: number; flax: number; forecast: PlantingCheck["forecast"];
}) {
  if (refusal) return <span className="aoe-plan-status is-refused" role="alert">{refusal}</span>;
  if (sending !== null) return <span className="aoe-plan-status is-draft" role="status">{sendingLine(plots - sending, sending)}</span>;
  if (pending) return <span className="aoe-plan-status is-draft" role="status">{pendingLine(plots - flax, flax)}</span>;
  return <span className={`aoe-plan-status is-planted${fresh ? " is-fresh" : ""}`} role="status">
    <PixelIcon name="check" size={12} />{plantedLine(plots - flax, flax, forecast)}
  </span>;
}
