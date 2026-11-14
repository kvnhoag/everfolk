import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gameModalShown, gameScreenShown, syncModal } from "../client/models/game-modal.ts";

/** A stand-in for a <dialog>: open state plus counts, and showModal fails the way a detached dialog does. */
function fakeDialog({ connected = true } = {}) {
  const self = {
    open: false, shows: 0, closes: 0,
    showModal() { if (!connected) throw new Error("InvalidStateError: the dialog is not connected"); self.open = true; self.shows += 1; },
    close() { self.open = false; self.closes += 1; },
  };
  return self;
}

test("the game screen is on view only when neither the home page nor another screen covers it", () => {
  assert.equal(gameScreenShown({ homeOpen: false, coveredByScreen: false }), true);
  assert.equal(gameScreenShown({ homeOpen: true, coveredByScreen: false }), false);
  assert.equal(gameScreenShown({ homeOpen: false, coveredByScreen: true }), false);
});

test("a game modal shows only while it is wanted and the game screen is on view", () => {
  assert.equal(gameModalShown(true, true), true);
  assert.equal(gameModalShown(true, false), false);
  assert.equal(gameModalShown(false, true), false);
  assert.equal(gameModalShown(false, false), false);
});

test("syncing opens and closes a dialog once, and repeating a sync changes nothing", () => {
  const dialog = fakeDialog();
  assert.equal(syncModal(dialog, true), true);
  assert.equal(syncModal(dialog, true), true);
  assert.equal(dialog.shows, 1);
  assert.equal(syncModal(dialog, false), false);
  assert.equal(syncModal(dialog, false), false);
  assert.equal(dialog.closes, 1);
});

test("a missing or detached dialog never throws and never counts as open", () => {
  assert.equal(syncModal(null, true), false);
  assert.equal(syncModal(undefined, false), false);
  const detached = fakeDialog({ connected: false });
  assert.equal(syncModal(detached, true), false);
  assert.equal(detached.open, false);
});

test("hidden with a pack moment pending: no open modal remains, and the moment shows again on return", () => {
  const pack = fakeDialog();
  const pending = true;
  const sync = (homeOpen: boolean) => syncModal(pack, gameModalShown(pending, gameScreenShown({ homeOpen, coveredByScreen: false })));
  sync(false);
  assert.equal(pack.open, true, "the card pack moment opens over the game");
  sync(true);
  assert.equal(pack.open, false, "on the home page no modal stays open to make the page inert");
  sync(false);
  assert.equal(pack.open, true, "back in the game, the still-pending moment shows again");
});

test("a pack moment that becomes pending while the home page is shown never opens there", () => {
  const pack = fakeDialog();
  syncModal(pack, gameModalShown(true, gameScreenShown({ homeOpen: true, coveredByScreen: false })));
  assert.equal(pack.open, false);
  assert.equal(pack.shows, 0, "reloading on the home page with a moment due leaves Weave Mode and every link clickable");
});

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Every modal the game screen opens. Dialogs that belong over the home page (the birth roll) are not listed. */
const GAME_DIALOGS = [
  "client/components/PackMilestoneDialog.tsx",
  "client/components/YearEndDialog.tsx",
  "client/components/DecisionDialog.tsx",
  "client/components/LoanOfferDialog.tsx",
  "client/components/LoanDeadlineDialog.tsx",
  "client/components/HowToPlay.tsx",
  "client/components/HouseholdWelcome.tsx",
  "client/chain/FreePlayBoosterModal.tsx",
];

test("every game dialog opens through the shared game-modal hook, never by calling showModal itself", () => {
  for (const path of GAME_DIALOGS) {
    const source = read(path);
    assert.match(source, /useGameModal\(/, `${path} uses useGameModal`);
    assert.doesNotMatch(source, /\.showModal\(/, `${path} leaves showModal to the hook`);
  }
});

test("App tells its dialogs whether the game screen is on view", () => {
  const app = read("client/screens/App.tsx");
  assert.match(app, /<GameScreenContext value=\{gameScreenShown\(\{ homeOpen: menuOpen, coveredByScreen: worldPickerOpen \}\)\}>/);
  assert.match(app, /<\/GameScreenContext>/);
});
