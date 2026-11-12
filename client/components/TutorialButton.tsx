import { tutorialStore } from "../state/tutorial-store.ts";
import "../styles/tutorial.css";

/**
 * The always-available way back into the guided tour, at the top right of every screen.
 * It restarts the tour from step one so the walkthrough always reads in order.
 */
export default function TutorialButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  return <button type="button" className={`tutorial-button is-${tone}`} aria-label="Open the guided tutorial" title="Walk through every screen of the game" onClick={() => tutorialStore.start()}>
    <span className="tutorial-button-mark" aria-hidden="true">?</span>
    <span className="tutorial-button-label">Tutorial</span>
  </button>;
}
