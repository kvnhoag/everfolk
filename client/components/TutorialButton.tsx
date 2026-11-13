import { useTutorial } from "../hooks/useTutorial.ts";
import { tutorialStore } from "../state/tutorial-store.ts";
import "../styles/tutorial.css";

/**
 * The tutorial switch at the top right of every screen. It shows whether tips are On or Off (remembered in this
 * browser) and flips them: switching on opens the tip for the screen on view, switching off closes any open tip.
 * The "?" on each section still opens that section's tip either way.
 */
export default function TutorialButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { tipsOn } = useTutorial();
  function toggle() {
    tutorialStore.setTipsOn(!tipsOn);
    if (tipsOn) tutorialStore.close();
    else tutorialStore.openFromButton();
  }
  return <button type="button" role="switch" aria-checked={tipsOn} className={`tutorial-button is-${tone}${tipsOn ? " is-on" : " is-off"}`} data-tutorial-button=""
    aria-label="Tutorial tips" title={tipsOn ? "Tutorial is on: tips open as new things unlock. Click to turn off." : "Tutorial is off. Click to turn tips on."} onClick={toggle}>
    <span className="tutorial-button-mark" aria-hidden="true">?</span>
    <span className="tutorial-button-label">Tutorial</span>
    <span className="tutorial-button-state" aria-hidden="true">{tipsOn ? "On" : "Off"}</span>
  </button>;
}
