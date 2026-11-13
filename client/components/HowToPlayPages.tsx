import { BAR_LEGEND, CHECKLIST_SHOT, DECISION_SHOT, KEY_FACTS, SCREEN_SHOT, YEAR_RHYTHM, YEAR_SCRIPT, type PlayStep, type Shot } from "../models/how-to-play.ts";
import { stageAges, type RoadmapStage } from "../models/life-roadmap.ts";
import { sectionStep, type SectionStepId } from "../models/section-steps.ts";
import PixelIcon from "./PixelIcon.tsx";
import PixelPortrait from "./PixelPortrait.tsx";

/** The two pages of How to Play: the game's own screens with numbered steps, then a life as a road. */

function Screenshot({ shot, className }: { shot: Shot; className?: string }) {
  return <img className={`htp-shot${className ? ` ${className}` : ""}`} src={shot.src} width={shot.width} height={shot.height} alt={shot.alt} loading="lazy" decoding="async" draggable={false} />;
}

/** The whole screen with each numbered section outlined; hovering a step outlines its section. */
function ScreenMap({ active, onActive }: { active: string | null; onActive(id: string | null): void }) {
  return <figure className="htp-map">
    <div className="htp-map-frame">
      <Screenshot shot={SCREEN_SHOT} />
      {Object.entries(SCREEN_SHOT.areas).map(([id, box]) => <span key={id} className={`htp-map-area${active === id ? " is-active" : ""}`}
        style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }} onPointerEnter={() => onActive(id)} onPointerLeave={() => onActive(null)} aria-hidden="true">
        <b>{sectionStep(id as SectionStepId)}</b>
      </span>)}
    </div>
    <figcaption>Your screen. The numbers are on the game too.</figcaption>
  </figure>;
}

function StepRow({ step, active, onActive }: { step: PlayStep; active: boolean; onActive(id: string | null): void }) {
  return <li className={`htp-step${active ? " is-active" : ""}`} onPointerEnter={() => onActive(step.id)} onPointerLeave={() => onActive(null)}>
    <span className="htp-step-number" aria-hidden="true">{step.step}</span>
    <div className="htp-step-copy">
      <div className="htp-title-row"><h3>{step.title}</h3>{step.opens && <span className="htp-opens"><PixelIcon name="lock" size={10} />{step.opens}</span>}</div>
      <p>{step.body}</p>
      {step.warning && <p className="htp-warning"><PixelIcon name="warn" size={12} label="Watch out" />{step.warning}</p>}
    </div>
    <Screenshot shot={step.shot} className="htp-step-shot" />
  </li>;
}

export function PlayPage({ steps, active, onActive }: { steps: readonly PlayStep[]; active: string | null; onActive(id: string | null): void }) {
  return <div className="htp-play">
    <ol className="htp-facts">{KEY_FACTS.map(fact => <li key={fact}>{fact}</li>)}</ol>
    <div className="htp-play-grid">
      <div className="htp-play-side">
        <ScreenMap active={active} onActive={onActive} />
        <div className="htp-legend" aria-label="What the household bar's icons mean">
          {BAR_LEGEND.map(item => <span key={item.label}><PixelIcon name={item.icon} size={13} />{item.label}</span>)}
        </div>
      </div>
      <ol className="htp-steps">{steps.map(step => <StepRow key={step.id} step={step} active={active === step.id} onActive={onActive} />)}</ol>
    </div>
  </div>;
}

/** Who you are, drawn at each stage of life. */
export interface RoadPortrait { seed: string; name: string; sex?: "male" | "female"; avatarVariant?: number }

export function LifePage({ stages, portrait }: { stages: readonly RoadmapStage[]; portrait: RoadPortrait }) {
  return <div className="htp-life">
    <section className="htp-year" aria-label="Every year, in order">
      <h3 className="htp-section-title">Every year, in order</h3>
      <ol className="htp-loop">
        {YEAR_SCRIPT.map((beat, index) => <li key={beat.title} className={beat.you ? "is-you" : undefined}>
          <span className="htp-loop-icon"><PixelIcon name={beat.icon} size={18} /></span>
          <strong>{index + 1}. {beat.title}</strong>
          <small>{beat.detail}</small>
          {beat.you && <em>Your part</em>}
        </li>)}
      </ol>
      <div className="htp-year-shots">
        <figure><Screenshot shot={CHECKLIST_SHOT} /><figcaption>“This year” lists what is still to do, in order.</figcaption></figure>
        <figure className="is-small"><Screenshot shot={DECISION_SHOT} /><figcaption>A turning point: pick one option.</figcaption></figure>
      </div>
      <p className="htp-rhythm">{YEAR_RHYTHM}</p>
    </section>
    <section aria-label="Your life, stage by stage">
      <h3 className="htp-section-title">Your life, stage by stage</h3>
      <ol className="htp-road">
        {stages.map(stage => <li key={stage.id} className={`htp-stage is-${stage.state}`}>
          <div className="htp-stage-portrait"><PixelPortrait age={stage.fromAge} seed={portrait.seed} name={portrait.name} sex={portrait.sex} avatarVariant={portrait.avatarVariant} className="htp-portrait" /></div>
          {stage.state === "current" && <span className="htp-here">You are here</span>}
          <strong className="htp-stage-name">{stage.title}</strong>
          <small className="htp-ages">{stageAges(stage)}</small>
          <p className="htp-todo">{stage.todo}</p>
          {stage.unlocks.length > 0 && <ul className="htp-unlocks" aria-label={`Opens in ${stage.title}`}>
            {stage.unlocks.slice(0, 4).map(unlock => <li key={`${unlock.age}:${unlock.text}`}><b>{unlock.age}</b>{unlock.text}</li>)}
          </ul>}
        </li>)}
      </ol>
    </section>
  </div>;
}
