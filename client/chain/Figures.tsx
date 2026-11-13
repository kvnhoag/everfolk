import { useEffect, useMemo, useState } from "react";
import { FIGURES } from "../../chain/catalog/index.ts";
import { FIGURE_ROSTER, type FigureCardRank, type FigureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import { FIGURE_ACTIONS } from "../../chain/ids.ts";
import { actionName, actionDescription, rarityLabel } from "./chain-copy.ts";
import FigureCardStack from "../components/FigureCardStack.tsx";
import { figureRarityLabel } from "../models/figure-card-labels.ts";
import FigureCardViewer from "../components/FigureCardViewer.tsx";
import referenceWorld from "../../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import type { WorldPack } from "../../src/types.ts";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import { loadFigureOwnership, matchingFigures, type FigureOwnership } from "./figure-directory-model.ts";
import "./web3-navigation.css";
import "../styles/figure-directory.css";

/** All eleven figures are visible. Only deployed IDs are queried for collectible ownership. */
export default function Figures({ backend }: { backend: ChainBackend }) {
  const [figures, setFigures] = useState<FigureOwnership>({});
  const [error, setError] = useState("");
  const [query, setQuery] = useState(""), [rarity, setRarity] = useState("all");
  const [selected, setSelected] = useState<{ figure: FigureRosterEntry; rank: FigureCardRank } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setError("");
    void loadFigureOwnership(backend.contract).then(rows => { if (!cancelled) setFigures(rows); }).catch(cause => { if (!cancelled) setError(errorText(cause, "Figure ownership could not be loaded. Reload to try again.")); });
    return () => { cancelled = true; };
  }, [backend.contract, backend.revision]);
  const visible = useMemo(() => matchingFigures(query, rarity), [query, rarity]);
  return <section className="figure-directory">
    <header className="chain-card"><p className="chain-kicker">The people who shape a city</p><h1 tabIndex={-1}>Historical figures</h1>
      <p>Explore all eleven figures. Inspect a card at full size, compare its rarity variants, and follow the work that earns its traits and titles.</p>
      <p className="chain-fine">Catalogue variants are previews. Contributor ranks come from completed work; a figure's defining title has its own achievement. Existing collectibles keep their recorded rarity.</p>
      <div className="figure-catalogue-filters"><label>Find a figure<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, craft or trait" /></label><label>Rarity<select value={rarity} onChange={event => setRarity(event.target.value)}><option value="all">All variants</option><option value="Epic">Epic</option><option value="Legendary">Legendary</option></select></label><span aria-live="polite">{visible.length} of {FIGURE_ROSTER.length} figures</span></div>
      {error && <p role="alert" className="chain-error">{error}</p>}
    </header>
    <div className="figure-directory-grid">{visible.map(figure => {
      const id = figure.legacyFigureId, state = id ? figures[id] : undefined;
      const eligibility = id ? FIGURES.find(item => item.figure === id) : undefined;
      return <article key={figure.id} className="chain-card figure-directory-card" data-roster-figure={figure.id}>
        <FigureCardStack figure={figure} onInspect={rank => setSelected({ figure, rank })} />
        <p className="chain-kicker">{id ? state ? `${state.supply[0]} / ${state.supply[1]} minted${state.copies.length === 0 ? " · Unminted" : ""}` : error ? "Ownership unavailable" : "Reading ownership…" : "Historical title collection"}</p>
        <h2>{figure.name}</h2><p>{figure.biography.biography}</p>
        <p className="figure-catalogue-rank">{figureRarityLabel(figure)}{figure.maximumRank !== figure.baseRank ? " · Legendary through its defining achievement" : " figure"}</p>
        <details><summary>Life, works &amp; card conditions</summary>
          <h3>Rarity variants</h3>{figure.variants.map(variant => <p key={variant.rank}><strong>{variant.rank} · {variant.title}</strong><br />{variant.condition}</p>)}
          <h3>Life and work</h3><p>{figure.biography.period}</p>
          <h4>Authored writings</h4>{figure.biography.authoredWorks.length ? <ul>{figure.biography.authoredWorks.map(work => <li key={work.title}><em>{work.title}</em> — {work.status}. {work.note}</li>)}</ul> : <p>No authored literary work is securely identified in the sources reviewed.</p>}
          {figure.biography.otherWorks.length > 0 && <><h4>Other works and achievements</h4><ul>{figure.biography.otherWorks.map(work => <li key={work.title}><strong>{work.title}</strong> — {work.note}</li>)}</ul></>}
          {figure.biography.cautions.map(note => <p className="chain-fine" key={note}>{note}</p>)}
          <p className="chain-fine">Sources: {figure.biography.sources.map((source, index) => <span key={source.url}>{index > 0 && " · "}<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></span>)}</p>
        </details>
        {id ? <details><summary>View owners &amp; life choices</summary>
          <h3>Owners &amp; chosen deeds</h3>
          {state?.copies.length === 0 && <p>No owner yet. This collectible is available to qualifying ranked lives.</p>}
          {state?.copies.map(copy => <div className="figure-owner" key={copy.token_id}><a href={`#token/${copy.token_id}`}>Copy #{copy.token_id} · {copy.owner_id}</a><p>{rarityLabel(copy.extra.rarity)} · Affection {copy.extra.affection}</p><p><strong>{actionName(copy.extra.action_id)}</strong> · {actionDescription(copy.extra.action_id)}</p></div>)}
          <h3>Choices this figure can make</h3>{FIGURE_ACTIONS[id].map(action => <p key={action}><strong>{actionName(action)}</strong><br />{actionDescription(action)}</p>)}
          {eligibility && <><h3>How a life qualifies for the existing collectible</h3><ul>{eligibility.origins && <li>Origin: {eligibility.origins.map(origin => origin.replaceAll("-", " ")).join(", ")}</li>}{eligibility.jobsAny && <li>Reach one of: {eligibility.jobsAny.map(job => job.replaceAll("-", " ")).join(", ")}</li>}{Object.entries(eligibility.minSkills ?? {}).map(([skill, value]) => <li key={skill}>{skill}: {value}+</li>)}{Object.entries(eligibility.minStats ?? {}).map(([stat, value]) => <li key={stat}>{stat}: {value}+</li>)}{eligibility.accomplishmentsAny && <li>Record a qualifying accomplishment: {eligibility.accomplishmentsAny.map(achievement => achievement.replaceAll("-", " ")).join(", ")}{eligibility.maxAgeAtAccomplishment ? ` by age ${eligibility.maxAgeAtAccomplishment}` : ""}.</li>}</ul></>}
        </details> : <p className="chain-fine">The historical title path is playable. Collectible minting for this figure is not available yet.</p>}
      </article>;
    })}</div>
    {!visible.length && <p className="chain-card">No figures match this search.</p>}
    <FigureCardViewer figure={selected?.figure ?? null} initialRank={selected?.rank} world={referenceWorld as unknown as WorldPack} onClose={() => setSelected(null)} />
  </section>;
}
