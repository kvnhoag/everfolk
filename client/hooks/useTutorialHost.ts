import { useEffect, useState } from "react";
import { isSpendSheet, isWalletHost } from "../chain/wallet-host.ts";
import { nextHostStack, topTutorialHost } from "../models/tutorial-host.ts";

function isModalHost(dialog: HTMLDialogElement): boolean {
  return dialog.open && dialog.matches(":modal") && !isWalletHost(dialog) && !isSpendSheet(dialog);
}

/** The topmost open modal window (game popup or Weave screen), or null when none is open. */
export function useTutorialHost(): HTMLDialogElement | null {
  const [host, setHost] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    let stack = Array.from(document.querySelectorAll("dialog")).filter(isModalHost);
    setHost(topTutorialHost(stack));
    const observer = new MutationObserver(records => {
      for (const { target } of records) {
        if (target instanceof HTMLDialogElement) stack = nextHostStack(stack, target, isModalHost(target), true);
      }
      stack = stack.filter(dialog => dialog.isConnected && isModalHost(dialog));
      setHost(topTutorialHost(stack));
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);
  return host;
}
