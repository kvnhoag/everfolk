import { createContext, useContext, useEffect, type RefObject } from "react";
import { gameModalShown, syncModal } from "../models/game-modal.ts";

/** Whether the game screen is on view. App provides it; dialogs used outside the game read the default (on view). */
export const GameScreenContext = createContext(true);

/**
 * Shows `dialog` as a modal while it is `wanted` and the game screen is on view, and closes it otherwise and when it
 * unmounts (see client/models/game-modal.ts). `onShow` runs each time the dialog opens, with that render's props
 * (focus, scroll lock) and the element that had focus before the dialog took it; the cleanup it returns runs before
 * the dialog closes. Returns whether the dialog is shown.
 */
export function useGameModal(dialog: RefObject<HTMLDialogElement | null>, wanted: boolean, onShow?: (previousFocus: HTMLElement | null) => void | (() => void)): boolean {
  const shown = gameModalShown(wanted, useContext(GameScreenContext));
  useEffect(() => {
    if (!shown) return;
    const element = dialog.current;
    // Read before showModal, which moves focus into the dialog.
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    syncModal(element, true);
    const cleanup = onShow?.(previousFocus);
    return () => {
      cleanup?.();
      syncModal(element, false);
    };
  }, [dialog, shown]); // eslint-disable-line react-hooks/exhaustive-deps -- onShow runs with the props of the render that opened it
  return shown;
}
