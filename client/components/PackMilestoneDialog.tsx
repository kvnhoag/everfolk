import { useEffect, useRef } from "react";
import type { PackMilestone } from "../models/pack-milestones.ts";
import "../styles/pack-milestone.css";

/** A clear moment when the life's card pack is earned or grows. The clock waits until the player carries on. */
export default function PackMilestoneDialog({ milestone, onClose }: { milestone: PackMilestone; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    button.current?.focus();
    return () => { if (element?.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className="pack-milestone-dialog" aria-labelledby="pack-milestone-title" data-tutorial="hide" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="pack-milestone-cards" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => <span key={index} className={`pack-milestone-card${index < milestone.cards ? " is-earned" : ""}`}>{index < milestone.cards ? "✦" : "?"}</span>)}
    </div>
    <p className="pack-milestone-eyebrow">Age {milestone.age}</p>
    <h2 id="pack-milestone-title">{milestone.title}</h2>
    <p className="pack-milestone-count"><strong>{milestone.cards}</strong> {milestone.cards === 1 ? "card" : "cards"} so far</p>
    <p className="pack-milestone-body">{milestone.body}</p>
    <button ref={button} type="button" className="pack-milestone-close" onClick={onClose}>Keep living <span aria-hidden="true">→</span></button>
  </dialog>;
}
