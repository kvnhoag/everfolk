import { useLayoutEffect, useRef, useState } from "react";

/** The box never shrinks below the tallest content it has shown, so switching tabs does not move the page. */
export function nextStableHeight(previous: number, measured: number): number {
  return Number.isFinite(measured) ? Math.max(previous, Math.ceil(measured)) : previous;
}

/** Measures natural height whenever `key` changes and keeps the largest as a min-height. */
export function useStableHeight<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  const [minHeight, setMinHeight] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const saved = element.style.minHeight;
    element.style.minHeight = "";
    const natural = element.getBoundingClientRect().height;
    element.style.minHeight = saved;
    setMinHeight(previous => nextStableHeight(previous, natural));
  }, [key]);
  return { ref, style: minHeight ? { minHeight } : undefined };
}
