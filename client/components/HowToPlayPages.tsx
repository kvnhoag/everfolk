import { KEY_FACTS, RESOURCE_GUIDE, screenAreas, YEAR_RHYTHM, YEAR_SCRIPT, type PlayChip, type PlayStep } from "../models/how-to-play.ts";
import { stageAges, type RoadmapStage } from "../models/life-roadmap.ts";
import PixelIcon from "./PixelIcon.tsx";

/** The pages of How to Play: a rule sheet, an annotated screen, the year's script, the roadmap and a lookup table. */

function Chip({ chip }: { chip: PlayChip }) {
  return <span className={`htp-chip is-${chip.tone ?? "neutral"}`}><PixelIcon name={chip.icon} size={12} />{chip.text}</span>;
}

function StepCard({ step }: { step: PlayStep }) {
  return <li className="htp-step">
    <span className="htp-step-number" aria-hidden="true">{step.step}</span>
    <div className="htp-step-copy">
      <div className="htp-title-row"><h3>{step.title}</h3>{step.opens && <span className="htp-opens"><PixelIcon name="lock" size={10} />{step.opens}</span>}</div>
      <p>{step.body}</p>
      {step.warning && <p className="htp-warning"><PixelIcon name="warn" size={12} label="Watch out" />{step.warning}</p>}
    </div>
    <div className="htp-example" aria-label={`Example: ${step.doThis.text} gives ${step.getThat.map(chip => chip.text).join(", ")}`}>
      <Chip chip={step.doThis} />
      <span className="htp-arrow" aria-hidden="true">→</span>
      <span className="htp-results">{step.getThat.map(chip => <Chip key={chip.text} chip={chip} />)}</span>
    </div>
  </li>;
}

export function BasicsPage({ steps }: { steps: readonly PlayStep[] }) {
  return <>
    <ol className="htp-facts">{KEY_FACTS.map(fact => <li key={fact}>{fact}</li>)}</ol>
    <ol className="htp-steps">{steps.map(step => <StepCard key={step.id} step={step} />)}</ol>
    <p className="htp-rhythm">{YEAR_RHYTHM} <span>The numbers match the sections on screen and the “This year” checklist.</span></p>
  </>;
}

/** A small map of the game screen with its numbered areas, beside what each one is for. */
export function ScreenPage() {
  const areas = screenAreas();
  return <div className="htp-screen">
    <div className="htp-screen-map" aria-hidden="true">
      <span className="htp-area is-header">Header · How to play · Tutorial</span>
      <span className="htp-area is-time"><b>1</b>Time bar</span>
      <span className="htp-area is-check">This year · 1 2 3 4 5 6</span>
      <span className="htp-area is-household"><b>4</b>Household bar · Inventory &amp; Granary</span>
      <span className="htp-area is-scene">Scene &amp; character</span>
      <span className="htp-area is-action"><b>3</b>Yearly action</span>
      <span className="htp-area is-focus"><b>2</b>Focus</span>
      <span className="htp-area is-town"><b>5</b>Market &amp; town</span>
      <span className="htp-area is-record"><b>6</b>Life record</span>
    </div>
    <ol className="htp-legend">
      {areas.map(area => <li key={area.id}><span className="htp-step-number is-small" aria-hidden="true">{area.step}</span><div><strong>{area.label}</strong><p>{area.note}</p></div></li>)}
      <li><span className="htp-step-number is-small is-help" aria-hidden="true">?</span><div><strong>Section help</strong><p>Every section has a “?”: hover for one line, click for its tip.</p></div></li>
    </ol>
  </div>;
}

/** What happens every year, in order, like a game's night script. "You" marks the beats that wait for you. */
export function YearPage() {
  return <ol className="htp-script">
    {YEAR_SCRIPT.map((beat, index) => <li key={beat.title} className={beat.you ? "is-you" : undefined}>
      <span className="htp-script-step" aria-hidden="true">{index + 1}</span>
      <div>
        <div className="htp-title-row"><h3><PixelIcon name={beat.icon} size={14} /> {beat.title}</h3>{beat.you && <span className="htp-you">Your part</span>}</div>
        <p className="htp-line">{beat.line}</p>
        <p>{beat.detail}</p>
      </div>
    </li>)}
  </ol>;
}

export function RoadmapPage({ stages }: { stages: readonly RoadmapStage[] }) {
  return <>
    <p className="htp-goal"><PixelIcon name="pin" size={14} />Your life opens up as you grow. Each stage brings new things to do; locked parts of the screen say when they open.</p>
    <ol className="htp-roadmap">
      {stages.map((stage, index) => <li key={stage.id} className={`htp-stage is-${stage.state}`}>
        <span className="htp-stage-dot" aria-hidden="true">{index + 1}</span>
        <div className="htp-stage-body">
          <div className="htp-title-row"><h3>{stage.title}</h3><small className="htp-ages">{stageAges(stage)}</small>{stage.state === "current" && <span className="htp-here">You are here</span>}</div>
          <p className="htp-todo">{stage.todo}</p>
          {stage.unlocks.length > 0 && <ul className="htp-unlocks" aria-label={`Opens in ${stage.title}`}>
            {stage.unlocks.map(unlock => <li key={`${unlock.age}:${unlock.text}`}><PixelIcon name={unlock.icon} size={11} /><b>{unlock.age}</b>{unlock.text}</li>)}
          </ul>}
        </div>
      </li>)}
    </ol>
  </>;
}

/** Look it up: every resource, what it is for, how you get it and how you lose it. */
export function LookupPage() {
  return <table className="htp-lookup">
    <thead><tr><th scope="col">Resource</th><th scope="col">For</th><th scope="col">Comes from</th><th scope="col">Goes to</th></tr></thead>
    <tbody>{RESOURCE_GUIDE.map(row => <tr key={row.name}>
      <th scope="row"><PixelIcon name={row.icon} size={13} />{row.name}</th>
      <td>{row.use}</td><td className="is-gain">{row.gain}</td><td className="is-loss">{row.loss}</td>
    </tr>)}</tbody>
  </table>;
}
