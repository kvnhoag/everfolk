import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { FLIGHT_MS, flightTransform } from "../models/tutorial-flight.ts";
import type { Rect } from "../models/tutorial-placement.ts";
import { prefersReducedMotion } from "./useTutorialSpotlight.ts";

const EASING = "cubic-bezier(.2,.75,.25,1)";

function rectOf(element: Element): Rect {
  const box = element.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/**
 * The Tutorial button the card flies to: the one inside the card's popup window when there is one, else the last
 * drawn. With `inView` (the default) only a button inside the viewport counts; otherwise any rendered one does.
 */
export function findTutorialButton(near: Element | null, inView = true): HTMLElement | null {
  const viewportHeight = window.innerHeight;
  const visible = Array.from(document.querySelectorAll<HTMLElement>("[data-tutorial-button]")).filter(button => {
    const box = button.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && (!inView || box.bottom > 0 && box.top < viewportHeight);
  });
  const host = near?.closest("dialog");
  return visible.find(button => host?.contains(button)) ?? visible.at(-1) ?? null;
}

function canAnimate(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element) && typeof element!.animate === "function" && !prefersReducedMotion();
}

export interface FlightOptions {
  panel: RefObject<HTMLElement | null>;
  /** The card has its position and is visible. */
  ready: boolean;
  closing: boolean;
  run: number;
  onClosed(): void;
}

/**
 * FLIP between the card and the Tutorial button: the card grows out of the button when it opens and shrinks back
 * into it when it closes (about 300 ms). Without the button it fades; with reduced motion it is instant.
 * Returns whether the opening flight is over, after which the card may glide between sections.
 */
export function useTutorialFlight({ panel, ready, closing, run, onClosed }: FlightOptions): boolean {
  const [settledRun, setSettledRun] = useState(-1);
  const openedRun = useRef<number | null>(null);
  const finished = useRef(onClosed);
  finished.current = onClosed;

  useLayoutEffect(() => {
    if (!ready || closing || openedRun.current === run) return;
    openedRun.current = run;
    const element = panel.current;
    if (!canAnimate(element)) { setSettledRun(run); return; }
    const button = findTutorialButton(element);
    const frames = button
      ? [{ transform: flightTransform(rectOf(element), rectOf(button)), opacity: 0.2 }, { transform: "none", opacity: 1 }]
      : [{ opacity: 0 }, { opacity: 1 }];
    const animation = element.animate(frames, { duration: FLIGHT_MS, easing: EASING });
    animation.onfinish = () => setSettledRun(run);
    return () => { animation.onfinish = null; };
  }, [ready, closing, run]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!closing) return;
    const element = panel.current;
    const shown = openedRun.current !== null;
    if (!shown || !canAnimate(element)) { finished.current(); return; }
    const button = findTutorialButton(element);
    const frames = button
      ? [{ transform: "none", opacity: 1 }, { transform: flightTransform(rectOf(element), rectOf(button)), opacity: 0.15 }]
      : [{ opacity: 1 }, { opacity: 0 }];
    const animation = element.animate(frames, { duration: FLIGHT_MS, easing: EASING, fill: "forwards" });
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      // The button takes the card back with a small nod, so the player sees where the tutorial went.
      if (button && typeof button.animate === "function") button.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 240, easing: "ease-out" });
      finished.current();
    };
    animation.onfinish = finish;
    const timer = window.setTimeout(finish, FLIGHT_MS + 200);
    return () => { window.clearTimeout(timer); animation.onfinish = null; animation.cancel(); };
  }, [closing]); // eslint-disable-line react-hooks/exhaustive-deps

  return settledRun === run;
}
