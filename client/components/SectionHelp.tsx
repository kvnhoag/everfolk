import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { placeHelpTip } from "../models/tutorial-flight.ts";
import { tutorialHint, type TutorialHintId } from "../models/tutorial-hints.ts";
import { tutorialStore } from "../state/tutorial-store.ts";
import "../styles/tutorial.css";

function showTip(tip: HTMLElement, anchor: HTMLElement): void {
  try { if (!tip.matches(":popover-open")) tip.showPopover(); }
  catch { /* Without popovers the tooltip still shows in place through its data-open style. */ }
  const box = anchor.getBoundingClientRect();
  const viewport = { width: document.documentElement.clientWidth || window.innerWidth, height: document.documentElement.clientHeight || window.innerHeight };
  const place = placeHelpTip({ top: box.top, left: box.left, width: box.width, height: box.height }, { width: tip.offsetWidth, height: tip.offsetHeight }, viewport);
  tip.style.top = `${Math.round(place.top)}px`;
  tip.style.left = `${Math.round(place.left)}px`;
  tip.dataset.side = place.side;
}

function hideTip(tip: HTMLElement): void {
  try { if (tip.matches(":popover-open")) tip.hidePopover(); }
  catch { /* Nothing to hide. */ }
}

/**
 * Where the badge sits: on the section's top-right corner, on its top edge just inside the right side (for sections
 * that clip sideways), or inside the corner (for sections that clip all round, such as the scene).
 */
export type SectionHelpPlacement = "corner" | "edge" | "inset";

/**
 * A small "?" in the top-right corner of a section. Hover or keyboard focus shows a one-line tooltip; a click opens
 * the tutorial at that section's hint, even one already seen. The parent section needs the `has-section-help` class.
 */
export default function SectionHelp({ hint: hintId, placement = "corner" }: { hint: TutorialHintId; placement?: SectionHelpPlacement }) {
  const hint = tutorialHint(hintId);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  // The tooltip lives in the top layer, so scrolling panels and popups never clip it; it is placed before paint.
  useLayoutEffect(() => {
    if (!tip.current || !button.current) return;
    if (open) showTip(tip.current, button.current);
    else hideTip(tip.current);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  if (!hint?.help) return null;
  const tipId = `${id}-tip`;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  }

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    tutorialStore.openHint(hintId);
  }

  return <span className={placement === "corner" ? "section-help" : `section-help is-${placement}`}>
    <button ref={button} type="button" className="section-help-button" aria-label={`About ${hint.title}`} aria-describedby={tipId}
      onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={onKeyDown} onClick={onClick}>?</button>
    <span ref={tip} role="tooltip" id={tipId} className="section-help-tip" popover="manual" data-open={open ? "" : undefined}>{hint.help}</span>
  </span>;
}
