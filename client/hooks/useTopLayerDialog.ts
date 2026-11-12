import { useEffect, useRef, type RefObject } from "react";
import { isSpendSheet, isWalletHost } from "../chain/wallet-host.ts";

function otherDialogOpened(records: readonly MutationRecord[], self: HTMLDialogElement): boolean {
  return records.some(({ target }) => target !== self && target instanceof HTMLDialogElement && target.open && !isWalletHost(target) && !isSpendSheet(target));
}

function showOnTop(dialog: HTMLDialogElement): void {
  try { if (!dialog.open) dialog.showModal(); }
  catch (error) { console.warn("Everfolk tutorial: the tour could not be shown above this screen.", error); }
}

/**
 * Keeps a modal dialog topmost while it is mounted. Game popups and the Weave screens are modal dialogs in
 * the browser's top layer too; whenever one opens later, this dialog lifts itself back above it.
 * The wallet host and the spend sheet are exempt so a real payment prompt is never hidden.
 */
export function useTopLayerDialog(ref: RefObject<HTMLDialogElement | null>, onRaised: () => void): void {
  const raised = useRef(onRaised);
  raised.current = onRaised;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    showOnTop(dialog);
    raised.current();
    const observer = new MutationObserver(records => {
      if (!otherDialogOpened(records, dialog)) return;
      dialog.close();
      showOnTop(dialog);
      raised.current();
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => {
      observer.disconnect();
      if (dialog.open) dialog.close();
    };
  }, [ref]);
}
