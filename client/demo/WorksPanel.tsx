import { useState } from "react";
import PixelIcon from "../components/PixelIcon.tsx";
import { pathRequirements } from "./future-paths.ts";
import type { DemoScreen } from "./screen.ts";

interface WorksPanelProps {
  screen: DemoScreen;
  hidden: boolean;
  autoPlay: boolean;
  onAutoPlay(on: boolean): void;
  onDelegate(agent: string | null): string | null;
  onNotice(text: string): void;
}

function CommunityWorks({ screen }: { screen: DemoScreen }) {
  return <section className="works-block" aria-label="Community works">
    <header className="works-block-head"><h3>Community works</h3><span className="works-rep"><PixelIcon name="res-reputation" size={12} />Reputation {screen.works.reputation}</span></header>
    <ul className="works-list">
      {screen.works.works.map(work => {
        const share = work.built ? 100 : Math.min(100, Math.round(work.progress / Math.max(1, work.needed) * 100));
        return <li key={work.id} className={work.built ? "is-built" : undefined}>
          <span className="works-title">{work.title}</span>
          <span className="works-progress" role="meter" aria-label={`${work.title} progress`} aria-valuemin={0} aria-valuemax={work.needed} aria-valuenow={work.built ? work.needed : work.progress}><span style={{ width: `${share}%` }} /></span>
          <span className="works-state">{work.built ? "Built" : `${work.progress}/${work.needed}`}</span>
          <span className="works-costs" aria-label="Cost">
            <span className="req-chip"><PixelIcon name="coin" size={11} />{work.cash} dr</span>
            <span className="req-chip"><PixelIcon name="res-grain" size={11} />{work.grain} grain</span>
          </span>
        </li>;
      })}
    </ul>
  </section>;
}

function FuturePaths({ screen }: { screen: DemoScreen }) {
  if (screen.futurePaths.length === 0) return null;
  return <section className="works-block" aria-label="Future paths">
    <header className="works-block-head"><h3>Future paths</h3><span className="works-note">Locked in this demo · what each will take</span></header>
    <ul className="future-path-grid">
      {screen.futurePaths.map(path => <li key={path.id} title={path.description}>
        <strong><PixelIcon name="close" size={10} />{path.title}</strong>
        <ul className="req-chips" aria-label={`To open ${path.title}`}>
          {pathRequirements(path).map(requirement => <li key={requirement.text} className="req-chip"><PixelIcon name={requirement.icon} size={11} />{requirement.text}</li>)}
        </ul>
      </li>)}
    </ul>
  </section>;
}

/** Works & Stewards: the town's works as progress bars with their costs, locked paths as requirement chips. */
export default function WorksPanel({ screen, hidden, autoPlay, onAutoPlay, onDelegate, onNotice }: WorksPanelProps) {
  const [agentName, setAgentName] = useState("");
  return <div className="works-panel" hidden={hidden}>
    <CommunityWorks screen={screen} />
    <FuturePaths screen={screen} />
    <details className="works-block works-stewards">
      <summary><h3>Stewards &amp; auto-play</h3><span className="works-note">{autoPlay ? "Auto-play is on" : "You decide"} · who decided this year</span></summary>
      <ul className="works-agents">{screen.agents.map(agent => <li key={agent.role}>{agent.text}</li>)}</ul>
      {screen.offerText && <p className="works-note">{screen.offerText} It is shown here until it arrives as a decision.</p>}
      <div className="demo-actions">
        <button type="button" aria-pressed={autoPlay} onClick={() => onAutoPlay(!autoPlay)}>{autoPlay ? "Auto-play is on" : "Auto-play is off"}</button>
        <label>Agent account<input value={agentName} onChange={event => setAgentName(event.target.value)} placeholder="account.testnet" /></label>
        <button type="button" onClick={() => onNotice(onDelegate(agentName.trim() || null) ?? "Delegation sent.")}>Hand decisions over</button>
        <button type="button" onClick={() => { setAgentName(""); onNotice(onDelegate(null) ?? "You took the decisions back."); }}>Take the decisions back</button>
      </div>
    </details>
  </div>;
}
