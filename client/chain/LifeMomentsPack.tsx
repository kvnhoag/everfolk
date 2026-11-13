import { useEffect, useState } from "react";
import type { LifeMomentCard } from "../models/free-life-moments.ts";
import EverfolkWordmark from "../components/EverfolkWordmark.tsx";
import "./mint-pack.css";
import "./life-moments-pack.css";

/** A free life's pack: it opens into one portrait per lived stage. Nothing is minted; Weave Mode keeps them for real. */
export default function LifeMomentsPack({ moments, onClose, initiallyOpen = false }: { moments: readonly LifeMomentCard[]; onClose(): void; initiallyOpen?: boolean }) {
  const [opened, setOpened] = useState(initiallyOpen);
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(() => { setOpened(true); setOpening(false); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650);
    return () => clearTimeout(timer);
  }, [opening]);
  return <section className={`chain-card mint-pack life-moments-pack${opened ? " is-open" : ""}`} aria-labelledby="moments-title">
    <p className="chain-kicker">Free life · nothing is minted</p>
    <h1 id="moments-title" tabIndex={-1}>{opened ? "You could have gotten…" : "The moments of your life"}</h1>
    {moments.length === 0 ? <p>This world does not record life stages, so there are no moments to show. Weave Mode lives keep a portrait of every stage.</p> : <p>{opened ? `${moments.length} moments from this life. In Weave Mode, every stage you live is kept as a portrait NFT on NEAR.` : "Open the pack to see a portrait from every stage you lived."}</p>}
    {moments.length === 0 ? null : !opened ? <button className={`booster-pack${opening ? " is-opening" : ""}`} type="button" disabled={opening} onClick={() => setOpening(true)}>
      <span className="booster-seal" aria-hidden="true">✦</span><strong className="booster-pack-wordmark"><EverfolkWordmark tone="cream" /></strong><span className="booster-pack-subtitle">Moments of a life</span><small>{opening ? "Opening…" : "Open your pack →"}</small>
    </button> : <div className="life-moments-grid" role="list">{moments.map((moment, index) => <article role="listitem" key={moment.stageId} className={`life-moment-card${moment.historical ? " is-historical" : ""}`} style={{ animationDelay: `${index * 90}ms` }}>
      <span className="life-moment-stage">{moment.stageTitle}<small>{moment.ages}</small></span>
      <img className="life-moment-portrait" src={moment.media} alt="" />
      <strong className="ef-type-display">{moment.title}</strong>
      {moment.historical && <span className="chain-tag is-figure">Historical figure</span>}
    </article>)}</div>}
    <div className="chain-actions"><a className="chain-primary" href="#weave" onClick={onClose}>Play Weave Mode to get real NFTs<span aria-hidden="true">→</span></a><button className="chain-secondary" type="button" onClick={onClose}>Back to your life</button></div>
  </section>;
}
