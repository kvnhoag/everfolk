import { displayProse } from "./display-prose.ts";
import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Choice, LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import { formatYear } from "../src/index.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import { ChoicePreview } from "./CompactSkillPanel.tsx";
import "./decision-dialog.css";
import "./decision-storybook.css";

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
}

function OpenDecisionDialog({ event, life, world, choices, returnFocusRef, onChoose, onSetAside, onEnableAuto }: Omit<Props, "open">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previewStack = useRef<HTMLDivElement>(null);
  const id = useId();
  const [previewId, setPreviewId] = useState<string | null>(choices[0]?.id ?? null);
  const preview = choices.find(choice => choice.id === previewId) ?? choices[0];
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
    <header className="life-decision-meta"><span>{event.rarity === "rare" ? "Rare encounter" : "Decision"}</span><span>Age {life.age} · {formatYear(life.year)}</span><button type="button" onClick={onSetAside}>Set aside</button></header>
    <div className="life-decision-content">
      <h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{displayProse(event.title)}</h2>
      <p id={`${id}-body`}>{displayProse(event.text)}</p>
      <div className="life-decision-options" aria-label="Options">{choices.map((choice, index) => <button className={`life-choice-commit${preview?.id === choice.id ? " is-previewed" : ""}`} key={choice.id} type="button" aria-controls={`${id}-choice-preview`} aria-keyshortcuts="ArrowRight" onPointerEnter={event => { if (event.pointerType !== "touch") setPreviewId(choice.id); }} onFocus={() => setPreviewId(choice.id)} onKeyDown={event => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          previewStack.current?.querySelector<HTMLElement>(".is-active .compact-skills")?.focus();
        }
      }} onClick={() => onChoose(choice.id)}><span className="life-option-number" aria-hidden="true">{index + 1}</span><span><strong>{displayProse(choice.text)}</strong><ChoiceImpact choice={choice} life={life} world={world} /></span></button>)}</div>
      <p className="life-decision-legend"><span className="impact-gain">Green: gain.</span> <span className="impact-loss">Red: loss.</span> Ranges show possible outcomes.</p>
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
      {sources.length > 0 && <details className="life-decision-sources"><summary>Historical sources</summary>{sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</details>}
      <footer><button type="button" onClick={onEnableAuto}>Enable Auto mode</button></footer>
    </div>
  </dialog>;
}

export default function DecisionDialog({ open, ...props }: Props) {
  return open ? <OpenDecisionDialog key={`${props.life.seed}:${props.life.age}:${props.event.id}`} {...props} /> : null;
}
