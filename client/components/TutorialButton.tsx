import { tutorialStore } from "../state/tutorial-store.ts";
import "../styles/tutorial.css";

/**
 * The always-available way back into the tutorial, at the top right of every screen. It opens the tip for the
 * screen on view (or the step the tutorial was last on), and never leaves the screen or resets anything.
 */
export default function TutorialButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  return <button type="button" className={`tutorial-button is-${tone}`} data-tutorial-button="" aria-label="Open the tutorial for this screen" title="Show the tips for this screen" onClick={() => tutorialStore.openFromButton()}>
    <span className="tutorial-button-mark" aria-hidden="true">?</span>
    <span className="tutorial-button-label">Tutorial</span>
  </button>;
}
