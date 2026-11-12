import "../styles/life-ending.css";

export interface LifeEndingBannerProps {
  name: string;
  dates: string;
  lived: string;
  cause?: string;
  ranked: boolean;
  onChronicle(): void;
  onOpenPack(): void;
  onNewLife(): void;
}

/** Shown at the top of the game once a life ends, so the ending is never missed below the fold. */
export default function LifeEndingBanner({ name, dates, lived, cause, ranked, onChronicle, onOpenPack, onNewLife }: LifeEndingBannerProps) {
  return <section className="life-ending-banner" aria-labelledby="life-ending-title">
    <div className="life-ending-record">
      <p className="life-ending-eyebrow">LIFE COMPLETE</p>
      <h2 id="life-ending-title">{name}</h2>
      <p className="life-ending-dates">{dates} · {lived}</p>
      {cause && <p className="life-ending-cause"><span>CAUSE OF DEATH</span>{cause}</p>}
      <button type="button" className="text-button" onClick={onChronicle}>Read the full chronicle <span aria-hidden="true">↗</span></button>
    </div>
    <div className="life-ending-next">
      {ranked ? <p>Your Weave life is complete. Its pack and mint continue in Weave Mode.</p> : <>
        <button type="button" className="primary-button" onClick={onOpenPack}>Open your pack <span aria-hidden="true">✦</span></button>
        <a className="life-ending-weave" href="#weave"><strong>Play Weave Mode to get real NFTs</strong><span>A free life shows what you could have gotten. Weave lives are verified and minted on NEAR.</span></a>
      </>}
      <div className="life-ending-links">
        <a href="#market">Browse the market →</a>
        {!ranked && <button type="button" className="text-button" onClick={onNewLife}>Begin another life <span aria-hidden="true">→</span></button>}
      </div>
    </div>
  </section>;
}
