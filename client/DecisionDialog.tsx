import { useEffect, useId, useRef, useState } from "react";
import type { Choice, LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import { formatYear } from "../src/index.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import CompactSkillPanel from "./CompactSkillPanel.tsx";
import "./decision-dialog.css";

interface Props {
  open: boolean;
  event: LifeEvent;
  life: LifeState;
  world: WorldPack;
  choices: readonly Choice[];
  onChoose(id: string): void;
  onSetAside(): void;
  onEnableAuto(): void;
}

function OpenDecisionDialog({ event, life, world, choices, onChoose, onSetAside, onEnableAuto }: Omit<Props, "open">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const [previewId, setPreviewId] = useState<string | null>(choices[0]?.id ?? null);
  const preview = choices.find(choice => choice.id === previewId);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    heading.current?.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, []);
  const sources = (event.sourceIds ?? []).map(sourceId => world.sources?.find(source => source.id === sourceId)).filter(source => source !== undefined);
  return <dialog ref={dialog} className={`life-decision-dialog${event.rarity === "rare" ? " is-rare" : ""}`} aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onCancel={event => { event.preventDefault(); onSetAside(); }}>
    <header className="life-decision-meta"><span>{event.rarity === "rare" ? "Rare encounter" : "Decision"}</span><span>Age {life.age} · {formatYear(life.year)}</span><button type="button" onClick={onSetAside}>Set aside</button></header>
    <div className="life-decision-content">
      <h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{event.title}</h2>
      <p id={`${id}-body`}>{event.text}</p>
      <div className="life-decision-options" aria-label="Options">{choices.map((choice, index) => <button className={`life-choice-commit${previewId === choice.id ? " is-previewed" : ""}`} key={choice.id} type="button" onPointerEnter={event => { if (event.pointerType !== "touch") setPreviewId(choice.id); }} onFocus={() => setPreviewId(choice.id)} onClick={() => onChoose(choice.id)}><span className="life-option-number" aria-hidden="true">{index + 1}</span><span><strong>{choice.text}</strong><ChoiceImpact choice={choice} life={life} world={world} /></span></button>)}</div>
      <p className="life-decision-legend"><span className="impact-gain">Green: gain.</span> <span className="impact-loss">Red: loss.</span> Ranges show possible outcomes.</p>
      <div id={`${id}-choice-preview`}>{preview && <CompactSkillPanel world={world} life={life} choice={preview} previewOnly />}</div>
      {sources.length > 0 && <details className="life-decision-sources"><summary>Historical sources</summary>{sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</details>}
      <footer><button type="button" onClick={onEnableAuto}>Enable Auto mode</button></footer>
    </div>
  </dialog>;
}

export default function DecisionDialog({ open, ...props }: Props) {
  return open ? <OpenDecisionDialog key={`${props.life.seed}:${props.life.age}:${props.event.id}`} {...props} /> : null;
}
