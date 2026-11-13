import { displayProse } from "../models/display-prose.ts";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import type { Choice, LifeEvent, LifeState, WorldPack } from "../../src/types.ts";
import { formatYear } from "../../src/index.ts";
import { resolvePartner } from "../../src/people.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import { ChoicePreview } from "./CompactSkillPanel.tsx";
import type { DemoScreen, TownFigureView } from "../demo/screen.ts";
import PixelPortrait from "./PixelPortrait.tsx";
import { playerPortraitState, personPortraitState } from "../models/portrait-state.ts";
import { relationshipLabels } from "../models/relationship-labels.ts";
import "../styles/decision-dialog.css";
import "../styles/decision-storybook.css";
import "../styles/life-choice-board.css";

interface Props {
  open: boolean;
  event: LifeEvent;
  life: LifeState;
  world: WorldPack;
  choices: readonly Choice[];
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  onChoose(id: string): void;
  onSetAside(): void;
  onEnableAuto(): void;
  riskPreview?: { knownCosts: readonly string[]; chance: string; routes?: readonly { choice: string; expectedLossBps: number }[] } | null;
  demoView?: DemoScreen | null;
  isLoanDecision?: boolean;
  isLoanOffer?: boolean;
  loanBalanceText?: string | null;
}

function OpenDecisionDialog({
  event,
  life,
  world,
  choices,
  returnFocusRef,
  onChoose,
  onSetAside,
  onEnableAuto,
  riskPreview = null,
  demoView = null,
  isLoanDecision = false,
  isLoanOffer = false,
  loanBalanceText = null,
}: Omit<Props, "open">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previewStack = useRef<HTMLDivElement>(null);
  const id = useId();
  const [previewId, setPreviewId] = useState<string | null>(choices[0]?.id ?? null);
  const preview = choices.find(choice => choice.id === previewId) ?? choices[0];
  const routeRisk = riskPreview?.routes?.find(route => route.choice === preview?.id);

  const involvedPerson = useMemo(() => {
    const partnerIds = new Set<string>();
    for (const choice of choices) {
      for (const outcome of choice.outcomes) {
        for (const effect of outcome.effects) {
          if ("partner" in effect && typeof effect.partner === "string") partnerIds.add(effect.partner);
        }
      }
    }
    const textMatches = `${event.title} ${event.text}`.matchAll(/\{person:([a-z][a-z0-9-]*)\}/g);
    for (const match of textMatches) {
      if (match[1]) partnerIds.add(match[1]);
    }
    for (const pid of partnerIds) {
      const resolved = resolvePartner(world, life, pid);
      if (resolved) return resolved;
    }
    return undefined;
  }, [event, choices, world, life]);

  const involvedTownFigure = useMemo<TownFigureView | undefined>(() => {
    if (!demoView?.townFigures) return undefined;
    if (demoView.activeOffer) {
      return demoView.townFigures.find(fig => fig.role === demoView.activeOffer?.role);
    }
    const text = `${event.id} ${event.title} ${event.text}`.toLowerCase();
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
  }, [event, demoView]);

  const playerName = life.character?.name ?? "Damon";
  const involvedCloseness = involvedPerson ? life.character?.relationships?.partners[involvedPerson.id]?.closeness : undefined;
  const involvedTags = involvedPerson ? relationshipLabels(world, life, involvedPerson.id) : [];

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) element.showModal();
    heading.current?.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      const restoreFocus = document.activeElement === document.body || element?.contains(document.activeElement);
      element?.close();
      document.body.style.overflow = previous;
      const target = previousFocus?.isConnected ? previousFocus : returnFocusRef?.current;
      if (restoreFocus && target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);
  const sources = (event.sourceIds ?? []).map(sourceId => world.sources?.find(source => source.id === sourceId)).filter(source => source !== undefined);
  return <dialog ref={dialog} className={`life-decision-dialog choice-popup${event.rarity === "rare" ? " is-rare" : ""}`} aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onCancel={event => { event.preventDefault(); onSetAside(); }}>
    <header className="life-decision-meta"><span>{event.rarity === "rare" ? "Rare encounter" : demoView?.activeOffer ? "Town offer" : isLoanDecision || isLoanOffer ? "Moneylender" : "Turning point"}</span><span>Age {life.age} · {formatYear(life.year)}</span><button type="button" onClick={onSetAside}>Set aside</button></header>
    <div className="life-encounter-banner" aria-label="Characters in this decision">
      <div className="life-encounter-side is-player">
        <PixelPortrait portrait={playerPortraitState(world, life)} name={playerName} className="life-encounter-avatar" />
        <div>
          <span className="life-encounter-role">You</span>
          <strong>{playerName}</strong>
          <small>Age {life.age}</small>
        </div>
      </div>

      <div className="life-encounter-vs" aria-hidden="true">⇄</div>

      {involvedPerson ? (
        <div className="life-encounter-side is-counterpart">
          {involvedPerson && (
            <PixelPortrait portrait={personPortraitState(world, life, involvedPerson)} name={involvedPerson.name} className="life-encounter-avatar" />
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
      ) : isLoanDecision || isLoanOffer ? (
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
      ) : (
        <div className="life-encounter-side is-counterpart">
          <div>
            <span className="life-encounter-role">{event.rarity === "rare" ? "Rare Encounter" : "Personal Turning Point"}</span>
            <strong>{world.character?.jobs.find(j => j.id === life.character?.jobId)?.title ?? world.origins.find(o => o.id === life.originId)?.title ?? "Household"}</strong>
            <small>{formatYear(life.year)} · {choices.length} {choices.length === 1 ? "option" : "options"} available</small>
          </div>
        </div>
      )}
    </div>
    <div className="life-decision-content">
      <h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{displayProse(event.title)}</h2>
      <p id={`${id}-body`}>{displayProse(event.text)}</p>
      <div className="life-decision-board-grid">
        <div className="life-decision-options" aria-label="Options">{choices.map((choice, index) => <button className={`life-choice-commit${preview?.id === choice.id ? " is-previewed" : ""}`} key={choice.id} type="button" aria-controls={`${id}-choice-preview`} aria-keyshortcuts="ArrowRight" onPointerEnter={event => { if (event.pointerType !== "touch") setPreviewId(choice.id); }} onFocus={() => setPreviewId(choice.id)} onKeyDown={event => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            previewStack.current?.querySelector<HTMLElement>(".is-active .compact-skills")?.focus();
          }
        }} onClick={() => onChoose(choice.id)}><span className="life-option-number" aria-hidden="true">{index + 1}</span><span><strong>{displayProse(choice.text)}</strong><ChoiceImpact choice={choice} life={life} world={world} /></span></button>)}</div>
        {choices.length > 0 && <div ref={previewStack} id={`${id}-choice-preview`} className="life-choice-preview-stack" onKeyDown={event => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            dialog.current?.querySelector<HTMLButtonElement>(".life-choice-commit.is-previewed")?.focus();
          }
        }}>{choices.map(choice => {
          const active = preview?.id === choice.id;
          return <div key={choice.id} className={`life-choice-preview-layer${active ? " is-active" : ""}`} aria-hidden={active ? undefined : true} inert={!active}>
            <ChoicePreview world={world} life={life} choice={choice} />
          </div>;
        })}</div>}
      </div>
      <p className="life-decision-legend"><span className="impact-gain">Green: gain.</span> <span className="impact-loss">Red: loss.</span> Ranges show possible outcomes.</p>
      {sources.length > 0 && <details className="life-decision-sources"><summary>Historical sources</summary>{sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</details>}
      {riskPreview && <section className="life-decision-risk" aria-label="Convoy risk"><h3>Known costs</h3>{riskPreview.knownCosts.length ? <ul>{riskPreview.knownCosts.map(cost => <li key={cost}>{cost}</li>)}</ul> : <p>No known cost is listed.</p>}<h3>Chance</h3><p>{routeRisk ? `${preview?.text}: expected cargo loss ${routeRisk.expectedLossBps / 100}%.` : riskPreview.chance}</p></section>}
      <footer><button type="button" onClick={onEnableAuto}>Enable Auto mode</button></footer>
    </div>
  </dialog>;
}

export default function DecisionDialog({ open, ...props }: Props) {
  return open ? <OpenDecisionDialog key={`${props.life.seed}:${props.life.age}:${props.event.id}`} {...props} /> : null;
}
