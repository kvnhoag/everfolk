import { useEffect, useState } from "react";
import { FIGURES } from "../../chain/catalog/index.ts";
import { FIGURE_ACTIONS } from "../../chain/ids.ts";
import type { FigureId } from "../../chain/ids.ts";
import { actionName, actionDescription, rarityLabel } from "./chain-copy.ts";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import type { TokenView } from "./types.ts";
import StorybookMark from "../components/StorybookMark.tsx";
import EverfolkCard from "./EverfolkCard.tsx";
import "./web3-navigation.css";
import "./token-market.css";

type Copy = TokenView & { token_id: string };
type FigureState = { copies: Copy[]; supply: [number, number] };

/** The full catalog of Historical Figures, presented as museum-grade collectible cards. */
export default function Figures({ backend }: { backend: ChainBackend }) {
  const [figures, setFigures] = useState<Partial<Record<FigureId, FigureState>>>({});
  const [error, setError] = useState("");
  const [expandedFigure, setExpandedFigure] = useState<FigureId | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError("");
    void Promise.all(
      FIGURES.map(async figure => {
        const [pool, supply] = await Promise.all([
          backend.contract.figureCopies(figure.figure),
          backend.contract.figureSupply(figure.figure),
        ]);
        const copies = await Promise.all(
          pool.map(async copy => {
            const token = await backend.contract.token(copy.token_id);
            if (!token) throw new Error("A figure copy could not be read. Reload the directory to try again.");
            return { token_id: copy.token_id, ...token };
          }),
        );
        return [figure.figure, { copies, supply }] as const;
      }),
    )
      .then(rows => {
        if (!cancelled) setFigures(Object.fromEntries(rows));
      })
      .catch(cause => {
        if (!cancelled) setError(errorText(cause, "Figure ownership could not be loaded. Reload to try again."));
      });
    return () => {
      cancelled = true;
    };
  }, [backend.contract, backend.revision]);

  return (
    <section className="figure-directory ef-market-panel">
      <header className="ledger-heading ef-market-header">
        <div className="ef-market-hero-eyebrow">
          <StorybookMark size={20} />
          <p className="ledger-kicker">The people who shape a city</p>
        </div>
        <h1 tabIndex={-1}>Historical figures</h1>
        <p className="ef-market-hero-desc">
          Meet every legendary figure of Rhakotis. Open a record to see its owners, chosen deeds, and the path a life
          must follow to qualify.
        </p>
        <p className="chain-fine" style={{ color: "#d6bc8e" }}>
          Meeting a figure's requirements makes a life eligible for its drop; it does not guarantee a figure card.
        </p>
        {error && <p role="alert" className="chain-error">{error}</p>}
      </header>

      <div className="ef-market-card-grid ledger-body">
        {FIGURES.map((figure, idx) => {
          const state = figures[figure.figure];
          const isExpanded = expandedFigure === figure.figure;
          const supplyText = state
            ? `${state.supply[0]} / ${state.supply[1]} Minted${state.copies.length === 0 ? " · Unclaimed" : ""}`
            : error
              ? "Ownership unavailable"
              : "Reading on NEAR…";

          return (
            <article key={figure.figure} className="ef-market-grid-item figure-showcase-item">
              <EverfolkCard
                slotNumber={idx + 1}
                title={figure.title}
                subtitle="Historical Figure"
                isFigure={true}
                figureId={figure.figure}
                badge={supplyText}
                rarityLabel="Mythic Figure"
                actionName="Historic Deeds"
                actionDescription={figure.summary}
                actions={
                  <div className="ef-market-card-footer">
                    <button
                      type="button"
                      className="chain-secondary"
                      style={{ width: "100%", justifyContent: "center", minHeight: "34px", fontSize: "11px" }}
                      aria-expanded={isExpanded}
                      aria-controls={`figure-panel-${figure.figure}`}
                      onClick={() => setExpandedFigure(isExpanded ? null : figure.figure)}
                    >
                      {isExpanded ? "Hide Requirements ▲" : "View Deeds & Requirements ▼"}
                    </button>

                    {/* Kept in the page while closed so the records stay readable and searchable. */}
                    <div className="figure-expanded-panel" id={`figure-panel-${figure.figure}`} hidden={!isExpanded}>
                        <h3 style={{ fontSize: "12px", margin: "8px 0 4px", color: "#263b43" }}>Owners &amp; deeds</h3>
                        {(!state?.copies || state.copies.length === 0) && (
                          <p className="chain-fine">No owner yet. This figure is available to qualifying ranked lives.</p>
                        )}
                        {state?.copies?.map(copy => (
                          <div className="figure-owner" key={copy.token_id}>
                            <a href={`#token/${copy.token_id}`}>
                              Copy #{copy.token_id} · {copy.owner_id}
                            </a>
                            <p className="chain-fine">
                              {rarityLabel(copy.extra.rarity)} · Affection {copy.extra.affection}
                            </p>
                            <p className="chain-fine">
                              <strong>{actionName(copy.extra.action_id)}</strong> · {actionDescription(copy.extra.action_id)}
                            </p>
                          </div>
                        ))}

                        <h3 style={{ fontSize: "12px", margin: "10px 0 4px", color: "#263b43" }}>Choices this figure can make</h3>
                        {(FIGURE_ACTIONS[figure.figure] ?? []).map(id => (
                          <p key={id} className="chain-fine" style={{ marginBottom: "6px" }}>
                            <strong>{actionName(id)}</strong>: {actionDescription(id)}
                          </p>
                        ))}

                        {figure.biography && (
                          <>
                            <h3 style={{ fontSize: "12px", margin: "10px 0 4px", color: "#263b43" }}>Life and work</h3>
                            <p className="chain-fine">{figure.biography.period}</p>
                            <h4 style={{ fontSize: "11px", margin: "8px 0 4px", color: "#263b43" }}>Authored writings</h4>
                            {figure.biography.authoredWorks.length ? (
                              <ul className="chain-fine" style={{ paddingLeft: "16px", margin: "0" }}>
                                {figure.biography.authoredWorks.map(work => (
                                  <li key={work.title}><em>{work.title}</em> — {work.status}. {work.note}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="chain-fine">No authored literary work is securely identified in the sources reviewed.</p>
                            )}
                            {figure.biography.otherWorks.length > 0 && (
                              <>
                                <h4 style={{ fontSize: "11px", margin: "8px 0 4px", color: "#263b43" }}>Other works and achievements</h4>
                                <ul className="chain-fine" style={{ paddingLeft: "16px", margin: "0" }}>
                                  {figure.biography.otherWorks.map(work => (
                                    <li key={work.title}><strong>{work.title}</strong> — {work.note}</li>
                                  ))}
                                </ul>
                              </>
                            )}
                            {figure.biography.cautions.map(note => <p className="chain-fine" key={note}>{note}</p>)}
                            <p className="chain-fine">
                              Sources:{" "}
                              {figure.biography.sources.map((source, index) => (
                                <span key={source.url}>{index > 0 && " · "}<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></span>
                              ))}
                            </p>
                          </>
                        )}

                        <h3 style={{ fontSize: "12px", margin: "10px 0 4px", color: "#263b43" }}>How a life qualifies</h3>
                        <ul className="chain-fine" style={{ paddingLeft: "16px", margin: "0" }}>
                          {figure.origins && figure.origins.length > 0 && (
                            <li>Origin: {figure.origins.map(id => id.replaceAll("-", " ")).join(", ")}</li>
                          )}
                          {figure.jobsAny && figure.jobsAny.length > 0 && (
                            <li>Reach one of: {figure.jobsAny.map(id => id.replaceAll("-", " ")).join(", ")}</li>
                          )}
                          {Object.entries(figure.minSkills ?? {}).map(([id, value]) => (
                            <li key={id}>{id}: {value}+</li>
                          ))}
                          {Object.entries(figure.minStats ?? {}).map(([id, value]) => (
                            <li key={id}>{id}: {value}+</li>
                          ))}
                          {figure.accomplishmentsAny && figure.accomplishmentsAny.length > 0 && (
                            <li>
                              Record accomplishment: {figure.accomplishmentsAny.map(id => id.replaceAll("-", " ")).join(", ")}
                              {figure.maxAgeAtAccomplishment ? ` by age ${figure.maxAgeAtAccomplishment}` : ""}.
                            </li>
                          )}
                        </ul>
                    </div>
                  </div>
                }
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
