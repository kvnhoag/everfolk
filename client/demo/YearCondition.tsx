import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import PixelIcon from "../components/PixelIcon.tsx";
import { placeHelpTip } from "../models/tutorial-flight.ts";
import { levelLabel } from "./labels.ts";

interface YearConditionProps {
  kind: "flood" | "army" | "road";
  icon: string;
  level: string;
  detail?: string;
}

const LABELS = { flood: "Nile flood", army: "Army", road: "Road" };

/** A compact condition button with a styled hover, focus and touch tooltip. */
export default function YearCondition({ kind, icon, level, detail }: YearConditionProps) {
  const tipId = `${useId()}-condition`;
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const hovered = useRef(false);
  const [open, setOpen] = useState(false);
  const label = LABELS[kind];
  const value = levelLabel(level);

  useLayoutEffect(() => {
    const tooltip = tip.current;
    const anchor = button.current;
    if (!tooltip || !anchor) return;
    try { tooltip.togglePopover(open); }
    catch { /* The fixed tooltip also works in browsers without popovers. */ }
    if (!open) return;
    const place = placeHelpTip(anchor.getBoundingClientRect(), { width: tooltip.offsetWidth, height: tooltip.offsetHeight }, {
      width: document.documentElement.clientWidth || window.innerWidth,
      height: document.documentElement.clientHeight || window.innerHeight,
    });
    tooltip.style.top = `${Math.round(place.top)}px`;
    tooltip.style.left = `${Math.round(place.left)}px`;
  }, [open, level, detail]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !button.current?.contains(event.target) && !tip.current?.contains(event.target)) close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  return <span className="aoe-condition">
    <button ref={button} type="button" className={`aoe-cond is-icon-only aoe-cond-${kind}-${level}`}
      aria-label={`${label}: ${value}`} aria-describedby={tipId}
      onPointerEnter={event => { if (event.pointerType !== "touch") { hovered.current = true; setOpen(true); } }}
      onPointerLeave={() => { hovered.current = false; if (!button.current?.matches(":focus-visible")) setOpen(false); }}
      onFocus={() => setOpen(true)} onBlur={() => { if (!hovered.current) setOpen(false); }} onClick={() => setOpen(true)}>
      <PixelIcon name={icon} size={15} />
      <span className="aoe-cell-word" aria-hidden="true">{kind === "flood" ? "Flood" : label}</span>
    </button>
    <span ref={tip} id={tipId} role="tooltip" className="aoe-condition-tip" popover="manual" data-open={open ? "" : undefined}>
      <strong className="aoe-condition-tip-heading">{label}<span>{value}</span></strong>
      {detail && <span className="aoe-condition-tip-detail">{detail}</span>}
    </span>
  </span>;
}
