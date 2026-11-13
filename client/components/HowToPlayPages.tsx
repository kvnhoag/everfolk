import { BAR_LEGEND, HOW_TO_WIN, YEAR_SCRIPT, type PlayStep, type Shot } from "../models/how-to-play.ts";
import type { RoadmapStage } from "../models/life-roadmap.ts";
import { stageAges } from "../models/life-roadmap.ts";
import type { StageGuide } from "../models/stage-guide.ts";
import PixelIcon from "./PixelIcon.tsx";
import PixelPortrait from "./PixelPortrait.tsx";

/**
 * The two pages of How to Play, laid out like a board game's rule card: big type, one numbered section per card as
 * "do this → this happens" with the game's own screen and an example in the player's own numbers; then the road of a
 * life, where each stage opens its own guide.
 */

function Screenshot({ shot }: { shot: Shot }) {
  // Captured at twice the size, shown at half: sharp on any screen and never wider than it was on screen.
  return <img className="htp-shot" src={shot.src} width={shot.width / 2} height={shot.height / 2} alt={shot.alt} loading="lazy" decoding="async" draggable={false} />;
}

function StepCard({ step }: { step: PlayStep }) {
  return <li className="htp-step" data-step={step.id}>
    <header className="htp-step-head">
      <span className="htp-step-number" aria-hidden="true">{step.step}</span>
      <h3>{step.title}</h3>
      {step.opens && <span className="htp-opens"><PixelIcon name="lock" size={12} />Opens at {step.opens.toLowerCase()}</span>}
    </header>
    <figure className="htp-step-shot"><Screenshot shot={step.shot} /></figure>
    <div className="htp-step-copy">
      <dl className="htp-do-then">
        <div><dt>Do</dt><dd>{step.body}</dd></div>
        <div><dt>Then</dt><dd>{step.result}</dd></div>
      </dl>
      <p className="htp-example"><strong>Example</strong>{step.example}</p>
      {step.warning && <p className="htp-warning"><PixelIcon name="warn" size={14} label="Watch out" />{step.warning}</p>}
    </div>
  </li>;
}

export function PlayPage({ steps }: { steps: readonly PlayStep[] }) {
  return <div className="htp-play">
    <p className="htp-goal"><PixelIcon name="sun" size={22} /><span><strong>Goal.</strong> {HOW_TO_WIN}</span></p>
    <section className="htp-year" aria-label="Every year, in order">
      <h3 className="htp-section-title">Every year, in order</h3>
      <ol className="htp-loop">
        {YEAR_SCRIPT.map((beat, index) => <li key={beat.title} className={beat.you ? "is-you" : undefined}>
          <span className="htp-loop-icon"><PixelIcon name={beat.icon} size={20} /></span>
          <strong>{index + 1}. {beat.title}</strong>
          <small>{beat.detail}</small>
          {beat.you && <em>Your action matters</em>}
        </li>)}
      </ol>
      <div className="htp-loop-back" aria-hidden="true"><span>Next year starts again at 1</span></div>
    </section>
    <h3 className="htp-section-title">The screen, section by section</h3>
    <p className="htp-lead">The same numbers are on the game screen. Work through them in order each year.</p>
    <ol className="htp-steps">{steps.map(step => <StepCard key={step.id} step={step} />)}</ol>
    <section className="htp-legend" aria-label="What the household bar's icons mean">
      <h3 className="htp-section-title">The household bar's icons</h3>
      <ul>{BAR_LEGEND.map(item => <li key={item.label}><PixelIcon name={item.icon} size={20} />{item.label}</li>)}</ul>
    </section>
  </div>;
}

/** Who you are, drawn at each stage of life. */
export interface RoadPortrait {
  seed: string;
  name: string;
  sex?: "male" | "female";
  avatarVariant?: number;
  personKey?: string;
  jobId?: string | null;
  role?: "royalty" | "aristocrat";
}

function Portrait({ portrait, age, className }: { portrait: RoadPortrait; age: number; className: string }) {
  return <PixelPortrait age={age} seed={portrait.seed} name={portrait.name} sex={portrait.sex} avatarVariant={portrait.avatarVariant} personKey={portrait.personKey} jobId={portrait.jobId} role={portrait.role} className={className} />;
}

function StageDetail({ stage, guide, portrait }: { stage: RoadmapStage; guide: StageGuide; portrait: RoadPortrait }) {
  return <section className="htp-stage-detail" role="tabpanel" id={`htp-stage-${stage.id}`} aria-label={`${stage.title}: what happens`}>
    <header className="htp-detail-head">
      <div className="htp-detail-portrait"><Portrait portrait={portrait} age={stage.fromAge} className="htp-portrait" /></div>
      <div>
        <p className="htp-detail-ages">{guide.ages}{stage.state === "current" && <span className="htp-here">You are here</span>}</p>
        <h3>{guide.title}</h3>
        <p className="htp-detail-role"><strong>Your role.</strong> {guide.role}</p>
      </div>
    </header>
    <div className="htp-detail-grid">
      <div className="htp-detail-block">
        <h4><PixelIcon name="lock" size={16} />Opens in this stage</h4>
        {guide.unlocks.length ? <ul className="htp-unlocks">{guide.unlocks.map(unlock => <li key={`${unlock.age}:${unlock.text}`}>
          <b>Age {unlock.age}</b><PixelIcon name={unlock.icon} size={16} /><span>{unlock.text}</span>
        </li>)}</ul> : <p className="htp-muted">Nothing new opens; what you already have carries on.</p>}
      </div>
      <div className="htp-detail-block">
        <h4><PixelIcon name="check" size={16} />Yearly actions you can take</h4>
        {guide.actions.length ? <ul className="htp-actions">{guide.actions.map(group => <li key={group.id}>
          <span className="htp-action-kind"><PixelIcon name={group.icon} size={16} />{group.label} <small>{group.count} new</small></span>
          <span className="htp-action-examples">{group.examples.join(" · ")}{group.count > group.examples.length ? " …" : ""}</span>
        </li>)}</ul> : <p className="htp-muted">No new actions open; your family acts for you.</p>}
        {guide.jobs.count > 0 && <p className="htp-jobs"><PixelIcon name="craft" size={16} /><span><strong>{guide.jobs.count} jobs open:</strong> {guide.jobs.examples.join(", ")}{guide.jobs.count > guide.jobs.examples.length ? " and more" : ""}.</span></p>}
      </div>
      <div className="htp-detail-block is-wide">
        <h4><PixelIcon name="pin" size={16} />Turning points you may meet</h4>
        <p className="htp-muted">{guide.turningPoints.count} turning points belong to these ages; others can happen at any age. The clock waits while you choose.</p>
        <ul className="htp-turning">{guide.turningPoints.examples.map(example => <li key={example.title}>
          <span className="htp-turning-title">Age {example.age} · {example.title}</span>
          <ol className="htp-choices">{example.choices.map(choice => <li key={choice}>{choice}</li>)}</ol>
        </li>)}</ul>
      </div>
    </div>
  </section>;
}

export function LifePage({ stages, guides, portrait, selected, onSelect }: { stages: readonly RoadmapStage[]; guides: readonly StageGuide[]; portrait: RoadPortrait; selected: string; onSelect(id: string): void }) {
  const stage = stages.find(candidate => candidate.id === selected) ?? stages[0];
  const guide = guides.find(candidate => candidate.id === stage?.id);
  return <div className="htp-life">
    <p className="htp-lead">A life passes through these stages. Pick one to see your role, what opens and what can happen.</p>
    <ol className="htp-road" role="tablist" aria-label="Stages of life">
      {stages.map(candidate => <li key={candidate.id}>
        <button type="button" role="tab" aria-selected={candidate.id === stage?.id} aria-controls={`htp-stage-${candidate.id}`}
          className={`htp-stage is-${candidate.state}${candidate.id === stage?.id ? " is-selected" : ""}`} onClick={() => onSelect(candidate.id)}>
          <span className="htp-stage-portrait"><Portrait portrait={portrait} age={candidate.fromAge} className="htp-portrait" /></span>
          <strong className="htp-stage-name">{candidate.title}</strong>
          <small className="htp-ages">{stageAges(candidate)}</small>
          {candidate.state === "current" && <span className="htp-here">You are here</span>}
        </button>
      </li>)}
    </ol>
    {stage && guide && <StageDetail stage={stage} guide={guide} portrait={portrait} />}
  </div>;
}
