import { useEffect, useState } from "react";
import { FIGURES } from "../../chain/catalog/index.ts";
import { FIGURE_ACTIONS } from "../../chain/ids.ts";
import type { FigureId } from "../../chain/ids.ts";
import { actionName, actionDescription, rarityLabel } from "./chain-copy.ts";
import FigureArtwork from "./FigureArtwork.tsx";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import type { TokenView } from "./types.ts";
import "./web3-navigation.css";

type Copy = TokenView & { token_id: string };
type FigureState = { copies: Copy[]; supply: [number, number] };

/** The full catalog remains visible even when a figure has no minted copies or no sale listing. */
export default function Figures({ backend }: { backend: ChainBackend }) {
  const [figures, setFigures] = useState<Partial<Record<FigureId, FigureState>>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setError("");
    void Promise.all(FIGURES.map(async figure => {
      const [pool, supply] = await Promise.all([backend.contract.figureCopies(figure.figure), backend.contract.figureSupply(figure.figure)]);
      const copies = await Promise.all(pool.map(async copy => {
        const token = await backend.contract.token(copy.token_id);
        if (!token) throw new Error("A figure copy could not be read. Reload the directory to try again.");
        return { token_id: copy.token_id, ...token };
      }));
      return [figure.figure, { copies, supply }] as const;
    })).then(rows => { if (!cancelled) setFigures(Object.fromEntries(rows)); }).catch(cause => { if (!cancelled) setError(errorText(cause, "Figure ownership could not be loaded. Reload to try again.")); });
    return () => { cancelled = true; };
  }, [backend.contract, backend.revision]);
  return <section className="figure-directory">
    <header className="chain-card"><p className="chain-kicker">The people who shape a city</p><h1 tabIndex={-1}>Historical figures</h1><p>Meet every available figure, including those still waiting to be minted. Open a record to see its owners, chosen deeds, and the path a life must follow to qualify.</p><p className="chain-fine">Meeting a figure's requirements makes a life eligible for its drop; it does not guarantee a figure card.</p>{error && <p role="alert" className="chain-error">{error}</p>}</header>
    <div className="figure-directory-grid">{FIGURES.map(figure => {
      const state = figures[figure.figure];
      return <article key={figure.figure} className="chain-card figure-directory-card">
        <FigureArtwork figureId={figure.figure} />
        <p className="chain-kicker">{state ? `${state.supply[0]} / ${state.supply[1]} minted${state.copies.length === 0 ? " · Unminted" : ""}` : error ? "Ownership unavailable" : "Reading ownership…"}</p>
        <h2>{figure.title}</h2><p>{figure.summary}</p>
        <details><summary>View owners & life choices</summary>
          <h3>Owners & chosen deeds</h3>
          {state?.copies.length === 0 && <p>No owner yet. This figure is available to qualifying ranked lives.</p>}
          {state?.copies.map(copy => <div className="figure-owner" key={copy.token_id}><a href={`#token/${copy.token_id}`}>Copy #{copy.token_id} · {copy.owner_id}</a><p>{rarityLabel(copy.extra.rarity)} · Affection {copy.extra.affection}</p><p><strong>{actionName(copy.extra.action_id)}</strong> · {actionDescription(copy.extra.action_id)}</p></div>)}
          <h3>Choices this figure can make</h3>
          {FIGURE_ACTIONS[figure.figure].map(id => <p key={id}><strong>{actionName(id)}</strong><br />{actionDescription(id)}</p>)}
          <h3>How a life qualifies</h3>
          <ul>{figure.origins && <li>Origin: {figure.origins.map(id => id.replaceAll("-", " ")).join(", ")}</li>}{figure.jobsAny && <li>Reach one of: {figure.jobsAny.map(id => id.replaceAll("-", " ")).join(", ")}</li>}{Object.entries(figure.minSkills ?? {}).map(([id, value]) => <li key={id}>{id}: {value}+</li>)}{Object.entries(figure.minStats ?? {}).map(([id, value]) => <li key={id}>{id}: {value}+</li>)}{figure.accomplishmentsAny && <li>Record a qualifying accomplishment: {figure.accomplishmentsAny.map(id => id.replaceAll("-", " ")).join(", ")}{figure.maxAgeAtAccomplishment ? ` by age ${figure.maxAgeAtAccomplishment}` : ""}.</li>}</ul>
        </details>
      </article>;
    })}</div>
  </section>;
}
