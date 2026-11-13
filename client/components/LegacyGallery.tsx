import { displayProse } from "../models/display-prose.ts";
import { useId, useMemo, useState } from "react";
import type { AccomplishmentRecord, LifeState, WorldPack } from "../../src/types.ts";
import { getAccomplishments, getLegacyRoutes } from "../../src/legacy.ts";
import { formatYear } from "../../src/calendar.ts";
import type { LegacyEntry } from "../storage/legacy-store.ts";
import { groupFigureCards } from "../models/figure-card-collection.ts";
import { findCardArt, getFigureCardArt, type CardArtRank } from "../models/card-art.ts";
import CollectionCardArtwork from "./CollectionCardArtwork.tsx";
import PixelIcon from "./PixelIcon.tsx";
import FigureCardStack from "./FigureCardStack.tsx";
import FigureCardViewer from "./FigureCardViewer.tsx";
import { legacyFigureCard, type LegacyFigureCard } from "../models/legacy-figure-card.ts";
import BoosterCollection from "./BoosterCollection.tsx";
import "../styles/legacy-gallery.css";

const distinction = (kind: string) => kind === "ultimate" ? "Ultimate title" : kind === "prestige" ? "Prestige" : undefined;
const cardLabel = (record: AccomplishmentRecord) => record.figure ? record.kind === "ordinary" ? "Milestone sub-card" : "Title sub-card" : distinction(record.kind);

function CollectionCard({ entry, subcard = false, world, life, onInspect }: {
  entry: LegacyEntry; subcard?: boolean; world?: WorldPack; life?: LifeState; onInspect(card: LegacyFigureCard): void;
}) {
  const record = entry.accomplishment;
  const figureCard = legacyFigureCard(entry, world, life);
  const Heading = subcard ? "h4" : "h3";
  const tier = record.figure ? (["common", "uncommon", "rare", "epic"] as CardArtRank[])
    .find(rank => record.achievementId === `fig-${record.figure!.id}-${rank}`) : undefined;
  const art = subcard && record.figure ? findCardArt({ figureId: record.figure.id, kind: "contribution", tier,
    title: record.title, gender: entry.characterSex, seed: entry.seed }) : undefined;
  return <article className={`legacy-card${!subcard && distinction(record.kind) ? " is-prestige" : ""}${!subcard && record.kind === "ultimate" ? " is-ultimate" : ""}${subcard ? " is-figure-subcard" : ""}${art ? " has-collection-art" : ""}`}>
    {art ? <a href={art.footerlessSrc} target="_blank" rel="noreferrer" className="legacy-card-art-link" aria-label={`View full artwork: ${art.displayTitle}`}>
      <CollectionCardArtwork art={art} />
    </a> : figureCard ? <div style={{ display: "flex", justifyContent: "center", padding: "18px 12px 0" }}>
      <FigureCardStack recorded gender={entry.characterSex} artSeed={entry.seed} figure={figureCard.figure} rank={figureCard.rank} title={figureCard.mode === "contribution" ? figureCard.title : figureCard.figure.name} mode={figureCard.mode} contributionRanks={figureCard.contributionRanks} compact onInspect={() => onInspect(figureCard)} />
    </div> : <div className="legacy-card-art" aria-hidden="true"><img src={`/assets/pixel/routes/${record.routeId.startsWith("figure-") ? "philosophy" : record.routeId}.svg`} width={64} height={64} alt="" /><span>{subcard ? "◆" : distinction(record.kind) ? "✦" : "◆"}</span></div>}
    <div className="legacy-card-copy"><p className="legacy-card-path">{entry.routeTitle ?? record.routeId.replace(/-/g, " ")}{cardLabel(record) && <span className="legacy-prestige">{cardLabel(record)}</span>}</p><Heading>{displayProse(record.name)}</Heading><strong className="legacy-card-achievement">{displayProse(record.title)}</strong><p>{displayProse(record.description)}</p><div className="legacy-card-person"><strong>{entry.characterName}</strong><span>Age {record.age} · {formatYear(record.year)}</span></div>{record.people.length > 0 && <p className="legacy-card-people">Remembered with {record.people.join(", ")}</p>}<small className="legacy-card-world">{entry.worldTitle}</small>
      {figureCard && <button type="button" className="text-button" onClick={() => onInspect(figureCard)}>Inspect earned card</button>}
    </div>
  </article>;
}

export function CurrentLegacySummary({ world, life, onOpenGallery }: { world: WorldPack; life: LifeState; onOpenGallery(): void }) {
  const routes = getLegacyRoutes(world, life).filter(route => route.earned.length > 0);
  const records = getAccomplishments(world, life);
  if (!records.length) return null;
  return <section className="current-legacy" aria-label="Works and deeds from this life">
    <header><h3>Works &amp; deeds</h3><button type="button" onClick={onOpenGallery}>View collection <span aria-hidden="true">↗</span></button></header>
    {records.length > 0 ? <ul>{records.slice(-3).reverse().map(record => <li key={record.id}><PixelIcon name={record.routeId.startsWith("figure-") ? "philosophy" : record.routeId} size={21} /><div><strong>{displayProse(record.name)}</strong><span>{displayProse(record.title)} · Age {record.age}</span></div>{distinction(record.kind) && <span className="legacy-prestige">{distinction(record.kind)}</span>}</li>)}</ul> : <p>No accomplishments recorded yet.</p>}
    <div className="legacy-route-strip" aria-label="Life paths">{routes.map(route => <span key={route.id} className={route.earned.length ? "is-earned" : ""} title={`${route.title}: ${route.earned.length} accomplishments`}><PixelIcon name={route.id.startsWith("figure-") ? "philosophy" : route.id} size={15} /><span>{route.title}</span><strong>{route.earned.length}</strong></span>)}</div>
  </section>;
}

export default function LegacyGallery({ entries, currentLifeKey, storageNotice, preview = false, world, life }: {
  entries: readonly LegacyEntry[]; currentLifeKey?: string; storageNotice?: string; preview?: boolean; world?: WorldPack; life?: LifeState;
}) {
  const [cardPreview, setCardPreview] = useState<LegacyFigureCard | null>(null);
  const [route, setRoute] = useState("all");
  const [scope, setScope] = useState("all");
  const [figure, setFigure] = useState("all");
  const [query, setQuery] = useState("");
  const id = useId();
  const routes = useMemo(() => [...new Map(entries.map(entry => [entry.accomplishment.routeId, entry.routeTitle ?? entry.accomplishment.routeId.replace(/-/g, " ")])).entries()], [entries]);
  const figures = useMemo(() => [...new Map(entries.flatMap(entry => entry.accomplishment.figure ? [[entry.accomplishment.figure.id, entry.accomplishment.figure.name] as const] : [])).entries()], [entries]);
  const filtered = entries.filter(entry => (route === "all" || entry.accomplishment.routeId === route) &&
    (figure === "all" || entry.accomplishment.figure?.id === figure) &&
    (scope === "all" || entry.lifeKey === currentLifeKey) &&
    displayProse(`${entry.accomplishment.name} ${entry.accomplishment.title} ${entry.characterName} ${entry.accomplishment.figure?.name ?? ""} ${entry.accomplishment.people.join(" ")}`).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice().reverse();
  const lives = new Set(entries.map(entry => entry.lifeKey)).size;
  const collection = groupFigureCards(filtered);
  return <div className="legacy-gallery">
    {!preview && <BoosterCollection />}
    <p className="legacy-intro">{preview ? "Accomplishments earned in this test life stay in the preview. Your personal collection is kept separate." : "Accomplishments earned in your current life. Previous lives remain saved in the archive."}</p>
    {storageNotice && <p className="legacy-storage-notice" role="status">{storageNotice}</p>}
    <div className="legacy-gallery-tally"><span><strong>{entries.length}</strong> accomplishments</span><span><strong>{lives}</strong> {lives === 1 ? "life" : "lives"}</span>{figures.length > 0 && <><span><strong>{figures.length}</strong> figure {figures.length === 1 ? "card" : "cards"}</span><span><strong>{entries.filter(entry => entry.accomplishment.figure).length}</strong> earned sub-cards</span></>}</div>
    <div className="legacy-gallery-filters"><label htmlFor={`${id}-search`}>Search accomplishments<input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Work, person or achievement" /></label><label htmlFor={`${id}-route`}>Path<select id={`${id}-route`} value={route} onChange={event => setRoute(event.target.value)}><option value="all">All paths</option>{routes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{figures.length > 0 && <label htmlFor={`${id}-figure`}>Historical figure<select id={`${id}-figure`} value={figure} onChange={event => setFigure(event.target.value)}><option value="all">All figures</option>{figures.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}{currentLifeKey && <label htmlFor={`${id}-scope`}>Lives<select id={`${id}-scope`} value={scope} onChange={event => setScope(event.target.value)}><option value="all">All lives</option><option value="current">Current life</option></select></label>}</div>
    {filtered.length ? <>
      {collection.figures.length > 0 && <section className="legacy-figure-collection" aria-label="Historical figure cards"><p className="legacy-figure-guidance">Each figure card holds the title and milestone sub-cards you have earned across your lives.</p>{collection.figures.map(card => {
        const parent = getFigureCardArt(card.figure.id);
        return <article className="legacy-figure-card" key={card.figure.id} aria-labelledby={`${id}-${card.figure.id}`}>
        <header><div><p>Historical figure card</p><h3 id={`${id}-${card.figure.id}`}>{card.figure.name}</h3></div><span>{card.entries.length} earned {card.entries.length === 1 ? "sub-card" : "sub-cards"}</span></header>
        <div className={`legacy-figure-layout${parent ? " has-parent-art" : ""}`}>
          {parent && <a className="legacy-parent-art legacy-card-art-link" href={parent.footerlessSrc} target="_blank" rel="noreferrer" aria-label={`View full artwork: ${parent.displayTitle}`}>
            <CollectionCardArtwork art={parent} />
          </a>}
          <div className="legacy-figure-subcards">{card.entries.map(entry => <CollectionCard key={entry.key} entry={entry} world={world} life={life} onInspect={setCardPreview} subcard />)}</div>
        </div>
      </article>;})}</section>}
      {collection.otherEntries.length > 0 && <section className="legacy-other-records" aria-label="Works and deeds">{collection.figures.length > 0 && <h3>Other works &amp; deeds</h3>}<div className="legacy-gallery-grid">{collection.otherEntries.map(entry => <CollectionCard key={entry.key} entry={entry} world={world} life={life} onInspect={setCardPreview} />)}</div></section>}
    </> : <p className="legacy-empty">{entries.length ? "No accomplishments match these filters." : "No accomplishments yet. Your first one will appear here."}</p>}
    <FigureCardViewer figure={cardPreview?.figure ?? null} initialRank={cardPreview?.rank} mode={cardPreview?.mode} contributionTitle={cardPreview?.title} world={world} life={life} onClose={() => setCardPreview(null)} />
  </div>;
}
