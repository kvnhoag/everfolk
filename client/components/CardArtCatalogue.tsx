"use client";
import { useEffect, useId, useRef, useState } from "react";
import { allCardArt, CARD_ART_RANKS, type CardArtwork, type CardArtGender } from "../models/card-art.ts";
import CollectionCardArtwork from "./CollectionCardArtwork.tsx";
import "../styles/card-art-catalogue.css";

const figures = allCardArt.filter(art => art.kind === "parent");
const titleCase = (value: string) => value[0].toUpperCase() + value.slice(1);

/** The complete art collection is browsable without awarding or minting a card. */
export default function CardArtCatalogue() {
  const id = useId();
  const [kind, setKind] = useState("parent");
  const [figure, setFigure] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [gender, setGender] = useState<CardArtGender | "all">("all");
  const [query, setQuery] = useState("");
  const [inspected, setInspected] = useState<CardArtwork | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (inspected && !dialog.current?.open) dialog.current?.showModal(); }, [inspected]);
  const shown = allCardArt.filter(art => (kind === "all" || art.kind === kind) &&
    (figure === "all" || art.figureId === figure) && (rarity === "all" || art.rarity === rarity) &&
    (gender === "all" || art.kind === "parent" || art.gender === gender) &&
    `${art.displayTitle} ${art.canonicalTitle} ${art.subtitle} ${art.figureName} ${art.bodyText}`.toLowerCase().includes(query.trim().toLowerCase()));
  const close = () => { dialog.current?.close(); setInspected(null); };
  return <section className="card-art-catalogue" aria-labelledby={`${id}-title`}>
    <header className="card-catalogue-heading">
      <div><p className="card-catalogue-kicker">The people behind history</p><h2 id={`${id}-title`}>The card collection</h2>
        <p>Meet 13 figures and the people who serve, study and create alongside them. Every profession has male and female artwork across four ranks.</p></div>
      <span className="card-catalogue-total">117 <small>card designs</small></span>
    </header>
    <div className="card-catalogue-filters">
      <label htmlFor={`${id}-kind`}>Cards<select id={`${id}-kind`} value={kind} onChange={event => setKind(event.target.value)}>
        <option value="parent">Main figures</option><option value="contribution">Professions &amp; contributions</option><option value="all">All cards</option>
      </select></label>
      <label htmlFor={`${id}-figure`}>Figure<select id={`${id}-figure`} value={figure} onChange={event => setFigure(event.target.value)}>
        <option value="all">All figures</option>{figures.map(art => <option key={art.figureId} value={art.figureId}>{art.displayTitle}</option>)}
      </select></label>
      <label htmlFor={`${id}-rarity`}>Rarity<select id={`${id}-rarity`} value={rarity} onChange={event => setRarity(event.target.value)}>
        <option value="all">All rarities</option>{CARD_ART_RANKS.map(rank => <option key={rank} value={rank}>{titleCase(rank)}</option>)}
      </select></label>
      <label htmlFor={`${id}-gender`}>Artwork<select id={`${id}-gender`} value={gender} disabled={kind === "parent"} onChange={event => setGender(event.target.value as CardArtGender | "all")}>
        <option value="all">Both variants</option><option value="male">Male</option><option value="female">Female</option>
      </select></label>
      <label htmlFor={`${id}-search`}>Search<input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Figure, profession or story" /></label>
    </div>
    <p className="card-catalogue-count" role="status">{shown.length} {shown.length === 1 ? "design" : "designs"} · Select a card to read its story.</p>
    <div className="card-catalogue-grid">{shown.map(art => <button key={art.slug} type="button" className="card-catalogue-tile" onClick={() => setInspected(art)} aria-label={`Inspect ${art.displayTitle}${art.kind === "contribution" ? `, ${art.gender}` : ""}`}>
      <CollectionCardArtwork art={art} editionText={art.exampleEdition} />
      <span className="card-catalogue-caption"><strong>{art.displayTitle}</strong><small>{titleCase(art.rarity)}{art.kind === "contribution" ? ` · ${titleCase(art.gender)}` : ""}</small></span>
    </button>)}</div>
    {!shown.length && <p className="card-catalogue-empty">No cards match these filters. Try another profession, figure or rarity.</p>}
    <p className="card-catalogue-credits"><a href="/assets/cards/collection-v14/icon-credits.html">Symbol artists &amp; credits</a></p>
    {inspected && <dialog ref={dialog} className="card-catalogue-dialog" aria-labelledby={`${id}-inspection-title`} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <button type="button" className="card-catalogue-close" onClick={close} aria-label="Close card story">×</button>
      <div className="card-catalogue-inspection"><CollectionCardArtwork art={inspected} editionText={inspected.exampleEdition} loading="eager" />
        <div className="card-catalogue-story"><p className="card-catalogue-kicker">{titleCase(inspected.rarity)} · Collection catalogue</p>
          <h2 id={`${id}-inspection-title`}>{inspected.displayTitle}</h2><p className="card-catalogue-subtitle">{inspected.subtitle}</p>
          <h3>{inspected.bodyTitle}</h3><p>{inspected.bodyText}</p>
          <button type="button" onClick={close}>Back to the collection</button>
        </div>
      </div>
    </dialog>}
  </section>;
}
