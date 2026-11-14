import { useEffect, useState } from "react";

/** Inputs that show the player is acting. Moving the pointer alone does not count: a lost player still moves it. */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * True once the player has done nothing for `ms` while `active`. Any click, key, wheel or touch restarts the
 * wait (except inside an element marked `data-idle-ignore`); so does a change of `resetKey`.
 */
export function useIdle(ms: number, active: boolean, resetKey: string = ""): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    setIdle(false);
    if (!active) return;
    let timer = window.setTimeout(() => setIdle(true), ms);
    const restart = (event: Event) => {
      // Pressing a button on the hint itself is not "moving on"; the hint handles that press.
      if (event.target instanceof Element && event.target.closest("[data-idle-ignore]")) return;
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), ms);
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, restart, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, restart, { capture: true });
    };
  }, [ms, active, resetKey]);
  return idle;
}
