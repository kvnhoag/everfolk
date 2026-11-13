import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { FigureCardRank, FigureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { getFigureCardProgress } from "../../src/figures/card-progress.ts";
import HistoricalFigureCard, { displayedFigureCardRank, type FigureCardMode } from "./HistoricalFigureCard.tsx";
import { stepVariantIndex, initialWheelGesture, reduceVariantWheel, swipeVariantStep, variantStackSlot } from "../models/figure-card-carousel.ts";
import { contributionCardRanks, figureCardRanks } from "../models/figure-contribution-ranks.ts";
import { findCardArt, cardArtRank } from "../models/card-art.ts";
import { buildFigureCardRequirements, changedRequirementIds, type FigureCardRequirement } from "../models/figure-card-requirements.ts";
import "../styles/figure-cards.css";
import "../styles/figure-card-viewer.css";

export interface FigureCardViewerProps {
  figure: FigureRosterEntry | null;
  initialRank?: FigureCardRank;
  onClose(): void;
  world?: WorldPack;
  life?: LifeState;
  mode?: FigureCardMode;
  contributionTitle?: string;
  upgradeAction?: { label: string; enabled: boolean; reason?: string; onActivate(): void };
}

/** Selection is inspection only. This viewer dispatches no game, ownership or minting command. */
export default function FigureCardViewer(props: FigureCardViewerProps) {
  if (!props.figure) return null;
  return <OpenFigureCardViewer key={props.figure.id + "-" + (props.initialRank ?? "") + "-" + (props.mode ?? "principal")} {...props} figure={props.figure} />;
}
function OpenFigureCardViewer({ figure, initialRank, onClose, world, life, mode = "principal", contributionTitle, upgradeAction }: Omit<FigureCardViewerProps, "figure"> & { figure: FigureRosterEntry }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const detailContentRef = useRef<HTMLDivElement>(null);
  const scrollSnapshot = useRef<{ details: number; dialog: number } | null>(null);
  const comparisonSequence = useRef(0);
  const [reservedDetailHeight, setReservedDetailHeight] = useState(0);
  const [comparison, setComparison] = useState<{ sequence: number; from: FigureCardRank; changed: string[]; removed: FigureCardRequirement[]; highlighting: boolean } | null>(null);
  const wheelGesture = useRef(initialWheelGesture());
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const id = useId();
  const progress = useMemo(() => world && life ? getFigureCardProgress(world, life, figure.id) : undefined, [figure, world, life]);
  const contributionRanks = useMemo(() => contributionCardRanks(figure, progress?.pathProgress), [figure, progress]);
  const options = useMemo(() => figureCardRanks(figure, mode, contributionRanks), [mode, figure, contributionRanks]);
  const [selectedRank, setSelectedRank] = useState<FigureCardRank>(displayedFigureCardRank(figure, initialRank, mode, contributionRanks));
  const selectedRankRef = useRef(selectedRank);
  const selectVariant = useCallback((requested: FigureCardRank) => {
    const next = displayedFigureCardRank(figure, requested, mode, contributionRanks);
    const current = selectedRankRef.current;
    if (next === current) return;
    scrollSnapshot.current = { details: detailsRef.current?.scrollTop ?? 0, dialog: dialogRef.current?.scrollTop ?? 0 };
    // Retain enough content height so a shorter variant cannot clamp the saved scroll offset.
    const contentHeight = Math.ceil(detailContentRef.current?.getBoundingClientRect().height ?? 0);
    setReservedDetailHeight(height => Math.max(height, contentHeight));
    const previousRows = buildFigureCardRequirements({ figure, mode, rank: current, world, life, progress });
    const nextRows = buildFigureCardRequirements({ figure, mode, rank: next, world, life, progress });
    const nextIds = new Set(nextRows.map(row => row.id));
    setComparison({ sequence: ++comparisonSequence.current, from: current, changed: changedRequirementIds(previousRows, nextRows), removed: previousRows.filter(row => !nextIds.has(row.id)), highlighting: true });
    selectedRankRef.current = next;
    setSelectedRank(next);
  }, [figure, mode, contributionRanks, world, life, progress]);
  const moveVariant = useCallback((step: -1 | 0 | 1) => {
    selectVariant(options[stepVariantIndex(options.indexOf(selectedRankRef.current), options.length, step)]);
  }, [options, selectVariant]);
  useEffect(() => {
    if (!comparison?.highlighting) return;
    const sequence = comparison.sequence;
    const timer = window.setTimeout(() => setComparison(current => current?.sequence === sequence ? { ...current, highlighting: false } : current), 3000);
    return () => window.clearTimeout(timer);
  }, [comparison?.sequence, comparison?.highlighting]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || options.length < 2) return;
    const scrollVariant = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || (!event.deltaX && !event.deltaY)) return;
      event.preventDefault();
      const result = reduceVariantWheel(wheelGesture.current, { deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, timeStamp: event.timeStamp, pageHeight: stage.clientHeight }, options.length);
      wheelGesture.current = result.state;
      if (result.step) moveVariant(result.step);
    };
    stage.addEventListener("wheel", scrollVariant, { passive: false });
    return () => stage.removeEventListener("wheel", scrollVariant);
  }, [moveVariant, options.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !figure) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = savedOverflow;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [figure?.id, initialRank, mode]);

  const rank = displayedFigureCardRank(figure, selectedRank, mode, contributionRanks);
  useLayoutEffect(() => {
    const snapshot = scrollSnapshot.current;
    if (!snapshot) return;
    if (detailsRef.current) detailsRef.current.scrollTop = snapshot.details;
    if (dialogRef.current) dialogRef.current.scrollTop = snapshot.dialog;
    scrollSnapshot.current = null;
  }, [rank, reservedDetailHeight]);
  const requirementRows = useMemo(() => buildFigureCardRequirements({ figure, mode, rank, world, life, progress }), [figure, mode, rank, world, life, progress]);
  const changedIds = new Set(comparison?.changed ?? []);
  const changeState = comparison?.highlighting ? "highlight" : "marked";
  const variant = figure.variants.find(item => item.rank === rank);
  const contributionFor = (option: FigureCardRank) => progress?.pathProgress?.stages.find(stage => stage.definition.rank === option)
    ?? (option === "Epic" ? progress?.pathProgress?.legendaryContribution ?? undefined : undefined);
  const contribution = contributionFor(rank);
  const inTradition = progress?.pathProgress?.encounterMode === "tradition";
  function titleFor(option: FigureCardRank) {
    if (mode === "principal") return figure.variants.find(variant => variant.rank === option)?.title ?? figure.title;
    const stage = contributionFor(option);
    return stage ? inTradition ? stage.definition.traditionTitle : stage.definition.title : contributionTitle ?? `${figure.name} · Contributor`;
  }
  const title = titleFor(rank);
  const variantProgress = progress?.variants.find(item => item.rank === rank);
  const earned = mode === "contribution" ? contribution?.earned === true : variantProgress?.earned === true;
  const requirements = mode === "contribution"
    ? contribution?.missingRequirements ?? ["Complete the qualifying projects and record this contribution title in a life."]
    : variantProgress?.requirements ?? [variant?.condition ?? "Complete this figure's defining achievement."];
  const shownTraits = progress?.traits ?? [];
  const remainingRequirements = [...new Set(requirements)].filter(requirement => mode !== "principal" || requirement !== variant?.condition);
  return <dialog ref={dialogRef} className="figure-card-viewer" aria-modal="true" aria-labelledby={id + "-title"} aria-describedby={id + "-status"} onKeyDown={event => {
    event.stopPropagation();
    if (event.defaultPrevented || options.length < 2 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const target = event.target;
    if (!step || target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="spinbutton"], [role="slider"]')) return;
    event.preventDefault();
    moveVariant(step);
  }} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="figure-card-viewer-shell" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <button ref={closeRef} type="button" className="figure-card-viewer-close" onClick={onClose} aria-label="Close card preview"><span aria-hidden="true">×</span></button>
      <div className="figure-card-display">
        <p className="figure-card-display-label">EVERFOLK <span aria-hidden="true">/</span> {mode === "contribution" ? "Your contribution" : "Historical collection"}</p>
        <div ref={stageRef} className={`figure-card-stack${options.length === 1 ? " is-single" : ""}`} data-variant-count={options.length} role="region" aria-label="Rarity card stack" aria-roledescription="carousel" aria-describedby={options.length > 1 ? id + "-hint" : undefined} tabIndex={options.length > 1 ? 0 : -1}
          onKeyDown={event => {
            if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && (event.key === "Home" || event.key === "End")) {
              event.preventDefault(); event.stopPropagation();
              stageRef.current?.focus({ preventScroll: true });
              selectVariant(options[event.key === "Home" ? 0 : options.length - 1]);
            }
          }}
          onPointerDown={event => { if (event.isPrimary && event.button === 0) { suppressClick.current = false; pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; } }}
          onPointerUp={event => {
            const start = pointerStart.current;
            pointerStart.current = null;
            if (!start || start.id !== event.pointerId || options.length < 2) return;
            const step = swipeVariantStep(event.clientX - start.x, event.clientY - start.y);
            if (step) { suppressClick.current = true; moveVariant(step); }
          }}
          onPointerCancel={() => { pointerStart.current = null; }}
          onClickCapture={event => { if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
          <div className="figure-card-stack-shadow" aria-hidden="true" />
          <div className="figure-card-stack-plane">
            {options.map((option, index) => {
              const slot = variantStackSlot(index, options.indexOf(rank), options.length);
              const current = slot === 0;
              return <div key={option} className={`figure-card-stack-item${current ? " is-current" : ""}`} data-stack-slot={slot} data-stack-side={slot < 0 ? "left" : slot > 0 ? "right" : "active"} data-variant-rank={option} style={{ "--stack-slot": slot, "--stack-depth": Math.abs(slot), zIndex: options.length - Math.abs(slot) } as CSSProperties}>
                <div className="figure-card-float" aria-hidden={!current || undefined}>
                  <HistoricalFigureCard figure={figure} rank={option} mode={mode} contributionRanks={options} title={mode === "contribution" ? titleFor(option) : figure.name} traits={shownTraits.length ? shownTraits : undefined} gender={life?.character?.sex} artSeed={life?.seed} />
                </div>
                {!current && <button type="button" className="figure-card-stack-select" aria-label={`Preview ${option} variant`} onClick={() => { stageRef.current?.focus({ preventScroll: true }); selectVariant(option); }}><span>{option}</span><span aria-hidden="true">↗</span></button>}
              </div>;
            })}
          </div>
        </div>
        {options.length > 1 && <div className="figure-card-stack-controls">
          <button type="button" className="figure-card-step" aria-label="Previous rarity variant" disabled={options.indexOf(rank) === 0} onClick={() => moveVariant(-1)}><span aria-hidden="true">←</span></button>
          <fieldset className="figure-card-variants"><legend className="figure-card-sr-only">Rarity variants</legend><div role="group" aria-label="Preview rarity variant">{options.map(option => <button type="button" key={option} aria-pressed={rank === option} data-rarity={option.toLowerCase()} onClick={() => selectVariant(option)}>{option}</button>)}</div></fieldset>
          <button type="button" className="figure-card-step" aria-label="Next rarity variant" disabled={options.indexOf(rank) === options.length - 1} onClick={() => moveVariant(1)}><span aria-hidden="true">→</span></button>
        </div>}
        <p className="figure-card-stack-hint" id={id + "-hint"}>{options.length > 1 ? "Scroll over the cards · swipe · use ← →" : "A defining place in history"}</p>
        <p className="figure-card-preview-note">Previewing a variant changes this view only.</p>
        <span className="figure-card-sr-only" aria-live="polite">{rank}, variant {options.indexOf(rank) + 1} of {options.length}</span>
      </div>
      <section ref={detailsRef} className="figure-card-viewer-detail" aria-label="Figure details" tabIndex={0}>
        <div ref={detailContentRef} className="figure-card-detail-content" style={{ minHeight: reservedDetailHeight || undefined }}>
        <div className="figure-card-detail-header"><p className="figure-card-eyebrow">{mode === "contribution" ? "Contributor card" : "Historical figure card"} · {rank}</p><h2 id={id + "-title"}>{title}</h2>
        <p className={earned ? "figure-card-status is-earned" : "figure-card-status"} id={id + "-status"}>{earned ? "Earned in this life" : world && life ? "Preview · Not earned in this life" : "Catalogue preview"}</p>
        <p className="figure-card-viewer-period">{figure.biography.period}</p></div>
        <p className="figure-card-viewer-summary">{figure.biography.biography}</p>
        {figure.art.placeholder && !findCardArt({ figureId: figure.id, kind: mode === "contribution" ? "contribution" : "parent", tier: cardArtRank(rank) }) && <p className="figure-card-art-note">Temporary game artwork stands in for this portrait.</p>}
        <section className="figure-card-conditions" aria-label="Rarity conditions"><h3>{earned ? "Achievement recorded" : `Earn the ${rank} ${mode === "contribution" ? "contribution" : "figure"} card`}</h3>
          {mode === "contribution" && <p>Contribution ranks reflect work completed for the figure or tradition.{progress?.pathProgress?.definition.contributionTiering === "below-principal" && progress.pathProgress.principalRank === "Epic" && " Contributions are capped at Rare while this figure is Epic."}</p>}
          <p className="figure-card-comparison-note" aria-live="polite">{comparison ? <>Compared with {comparison.from} · {comparison.changed.length} changed requirement{comparison.changed.length === 1 ? "" : "s"}{comparison.removed.length > 0 && ` · ${comparison.removed.length} only in ${comparison.from}`}.</> : "Unlock requirements for this rarity"}</p>
          <ul className="figure-card-requirement-list">{requirementRows.map((requirement, index) => <li key={requirement.id} data-requirement-id={requirement.id} data-requirement-change={changedIds.has(requirement.id) ? changeState : undefined}>
            <input className="figure-card-requirement-checkbox" type="checkbox" checked={requirement.met === true} disabled aria-labelledby={`${id}-requirement-${index}`} />
            <div>{changedIds.has(requirement.id) && <span className="figure-card-sr-only">Changed from {comparison?.from}: </span>}<strong id={`${id}-requirement-${index}`}>{requirement.label}</strong>{requirement.detail && <p>{requirement.detail}</p>}</div>
            {changedIds.has(requirement.id) ? <span key={`notification-${comparison?.sequence}`} className="figure-card-requirement-notification" aria-hidden="true" title={`Changed from ${comparison?.from}`} /> : <span aria-hidden="true" />}
            {changedIds.has(requirement.id) && comparison?.highlighting && <span key={`glisten-${comparison.sequence}`} className="figure-card-requirement-glisten" aria-hidden="true" />}
          </li>)}</ul>
          {comparison && comparison.removed.length > 0 && <details key={rank} className="figure-card-removed-requirements" data-requirement-change={changeState}><summary>Only in the {comparison.from} checklist ({comparison.removed.length})<span key={comparison.sequence} className="figure-card-requirement-notification" aria-hidden="true" /></summary>{mode === "contribution" && <p>Earlier contribution titles retain their own prerequisites.</p>}<ul>{comparison.removed.map(requirement => <li key={requirement.id}>{requirement.label}{requirement.detail && <> — {requirement.detail}</>}</li>)}</ul></details>}
          {world && life && !earned && remainingRequirements.length > 0 && <details key={rank + "-remaining"} className="figure-card-current-requirements"><summary>Still needed in this life ({remainingRequirements.length})</summary><ul>{remainingRequirements.map(requirement => <li key={requirement}>{requirement}</li>)}</ul></details>}
          {earned && <p>The required projects and accepted outcome are recorded in this life's history.</p>}
        </section>
        {upgradeAction && <section className="figure-card-upgrade" aria-label="Next earned upgrade"><h3>Next earned upgrade</h3><button type="button" disabled={!upgradeAction.enabled} onClick={upgradeAction.onActivate}>{upgradeAction.label}</button>{upgradeAction.reason && <p>{upgradeAction.reason}</p>}</section>}
        <section className="figure-card-trait-list" aria-label="Card traits"><h3>Traits &amp; distinctions</h3>
          {shownTraits.length ? <ul>{shownTraits.map(trait => <li key={trait.id} className={trait.earned ? "is-earned" : ""}><span className="figure-card-trait-mark" aria-hidden="true">{trait.earned ? "✓" : "◇"}</span><div><strong>{trait.label}</strong><p>{trait.description}</p>{!trait.earned && <small>{trait.requirement}</small>}</div><span className="figure-card-trait-state">{trait.earned ? "Earned" : "Requires proof"}</span></li>)}</ul> : <><div className="figure-card-catalogue-tags">{figure.tags.map(tag => <span key={tag}>{tag}</span>)}</div><p>Open this figure's development path during a life to see earned traits and the work still required.</p></>}
        </section>
        <details className="figure-card-history"><summary>Historical works and sources</summary>{figure.biography.authoredWorks.length > 0 && <ul>{figure.biography.authoredWorks.map(work => <li key={work.title}><strong>{work.title}</strong> · {work.status}. {work.note}</li>)}</ul>}{figure.biography.otherWorks.length > 0 && <ul>{figure.biography.otherWorks.map(work => <li key={work.title}><strong>{work.title}</strong> · {work.note}</li>)}</ul>}<ul>{figure.biography.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>{figure.biography.cautions.map(note => <p key={note}>{note}</p>)}</details>
        <button type="button" className="figure-card-viewer-done" onClick={onClose}>Back to the collection</button>
        </div>
      </section>
    </div>
  </dialog>;
}
