/**
 * Game dialogs and the screen they belong to. A modal <dialog> makes everything else on the page inert, even when an
 * ancestor hides the dialog itself, so a game modal left open behind the home page (or behind a Weave screen) would
 * silently swallow every click there. Game modals therefore open only while the game screen is on view, and close
 * when it is hidden; the state that asked for them stays pending, so they show again when the player returns.
 */

/** The part of a <dialog> the game drives. */
export interface ModalHost {
  readonly open: boolean;
  showModal(): void;
  close(): void;
}

export interface GameScreenFacts {
  /** The home page (main menu) is shown in place of the game. */
  homeOpen: boolean;
  /** Another screen covers the game: the world library, a Weave screen, or a world being opened. */
  coveredByScreen: boolean;
}

export function gameScreenShown({ homeOpen, coveredByScreen }: GameScreenFacts): boolean {
  return !homeOpen && !coveredByScreen;
}

/** A game dialog is open while the game wants it and the game screen is on view. */
export function gameModalShown(wanted: boolean, screenShown: boolean): boolean {
  return wanted && screenShown;
}

/**
 * Opens or closes `host` as a modal to match `shown`, and reports whether it is open afterwards. A dialog that cannot
 * open (not yet in the page) stays closed instead of breaking the screen; the next sync tries again.
 */
export function syncModal(host: ModalHost | null | undefined, shown: boolean): boolean {
  if (!host) return false;
  if (shown && !host.open) {
    try { host.showModal(); }
    catch { return false; }
  } else if (!shown && host.open) host.close();
  return host.open;
}
