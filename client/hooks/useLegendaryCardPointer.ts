import { useEffect, useRef } from "react";
import { legendaryCardPointer } from "../models/legendary-card-pointer.ts";

/** Listen on the stack because its inspect button covers the decorative card face. */
export function useLegendaryCardPointer(enabled: boolean, identity: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const card = ref.current;
    const view = card?.ownerDocument.defaultView;
    if (!enabled || !card || !view) return;
    const host = card.closest<HTMLElement>(".figure-card-stack, .figure-card-preview-stack") ?? card;
    const media = view.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const properties = ["--foil-x", "--foil-y", "--foil-rotate-x", "--foil-rotate-y", "--foil-sweep", "--foil-angle"];
    let frame = 0;
    let pose: ReturnType<typeof legendaryCardPointer> = null;
    const reset = () => {
      view.cancelAnimationFrame(frame);
      frame = 0;
      pose = null;
      delete card.dataset.pointerActive;
      properties.forEach(property => card.style.removeProperty(property));
    };
    const draw = () => {
      frame = 0;
      if (!pose) return;
      const values = [pose.lightX + "%", pose.lightY + "%", pose.rotateX + "deg", pose.rotateY + "deg", pose.sweep + "%", pose.angle + "deg"];
      properties.forEach((property, index) => card.style.setProperty(property, values[index]!));
      card.dataset.pointerActive = "true";
    };
    const move = (event: PointerEvent) => {
      const layer = card.closest(".figure-card-stack-item, .figure-preview-layer");
      if (!media.matches || event.pointerType !== "mouse" || event.buttons !== 0 || (layer && !layer.classList.contains("is-current"))) {
        reset();
        return;
      }
      const surface = card.closest(".figure-tcg-card") ?? card.parentElement ?? card;
      pose = legendaryCardPointer(event.clientX, event.clientY, surface.getBoundingClientRect());
      if (!frame) frame = view.requestAnimationFrame(draw);
    };
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", reset);
    host.addEventListener("pointercancel", reset);
    host.addEventListener("keydown", reset);
    media.addEventListener("change", reset);
    return () => {
      reset();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", reset);
      host.removeEventListener("pointercancel", reset);
      host.removeEventListener("keydown", reset);
      media.removeEventListener("change", reset);
    };
  }, [enabled, identity]);
  return ref;
}
