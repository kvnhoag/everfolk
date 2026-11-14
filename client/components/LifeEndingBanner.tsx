import "../styles/life-ending.css";
import SectionHelp from "./SectionHelp.tsx";

export interface LifeEndingBannerProps {
  name: string;
  dates: string;
  lived: string;
  cause?: string;
  ranked: boolean;
  /** Earned cards a free life can preview: 0 when none were earned on a figure path, otherwise 1–5. */
  packCards: number;
  onChronicle(): void;
  onOpenPack(): void;
  onNewLife(): void;
}

/** Shown at the top of the game once a life ends, so the ending is never missed below the fold. */
export default function LifeEndingBanner({ name, dates, lived, cause, ranked, packCards, onChronicle, onOpenPack, onNewLife }: LifeEndingBannerProps) {
  return <section className="life-ending-banner has-section-help" aria-labelledby="life-ending-title">
    <div className="life-ending-record">
      <p className="life-ending-eyebrow">LIFE COMPLETE</p>
      <h2 id="life-ending-title">{name}</h2>
      <p className="life-ending-dates">{dates} · {lived}</p>
      {cause && <p className="life-ending-cause"><span>CAUSE OF DEATH</span>{cause}</p>}
      <button type="button" className="text-button" onClick={onChronicle}>Read the full chronicle <span aria-hidden="true">↗</span></button>
    </div>
    <div className="life-ending-next">
      {ranked ? <p>Your Weave life is complete. Its pack and mint continue in Weave Mode.</p> : <>
        {packCards > 0
          ? <>
              <p className="life-ending-preview">You could have gotten {packCards} {packCards === 1 ? "card" : "cards"} as NFTs.</p>
              <button type="button" className="primary-button" onClick={onOpenPack}>Preview pack · {packCards} {packCards === 1 ? "card" : "cards"} <span aria-hidden="true">✦</span></button>
            </>
          : <p className="life-ending-no-pack">No pack this time. Cards are earned, not drawn — earn a contributor title on a historical figure’s path to preview what you could have gotten.</p>}
        <a className="life-ending-weave" href="#weave"><strong>Play Weave Mode to get real NFTs</strong><span>A free life shows what you could have gotten. Weave lives are verified and minted on NEAR.</span></a>
      </>}
      <div className="life-ending-links">
        <a href="#market">Browse the market →</a>
        {!ranked && <button type="button" className="text-button" onClick={onNewLife}>Begin another life <span aria-hidden="true">→</span></button>}
      </div>
    </div>
    <SectionHelp hint="ending" />
  </section>;
}
