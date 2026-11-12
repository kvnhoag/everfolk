import { useEffect, useId, useState } from "react";
import type { LifeView } from "../../chain/types.ts";
import ActiveLifeCard, { useActiveRankedLife } from "./ActiveLifeCard.tsx";
import PixelIcon from "../components/PixelIcon.tsx";
import StorybookMark from "../components/StorybookMark.tsx";
import FigureArtwork from "./FigureArtwork.tsx";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import { keptRows, type KeptRow } from "./token-page-model.ts";
import { FIGURES } from "../../chain/catalog/index.ts";
import SignInPanel from "./SignInPanel.tsx";
import EverfolkCard from "./EverfolkCard.tsx";
import "./token-market.css";
import "./ledger.css";

/** The signed-in player's kept lives, with PokemonSim-style collection progress and card grid. */
export default function MyLives({ backend, onOpen }: { backend: ChainBackend; onOpen?(life: LifeView): Promise<void> }) {
  const headingId = useId();
  const current = useActiveRankedLife(backend);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "ledger">("grid");
  const [activeTab, setActiveTab] = useState<"owned" | "set">("owned");

  async function openLife(life: LifeView) {
    if (backend.signin?.needsPlayKey) {
      await backend.signin.useWallet().catch(cause => setError(errorText(cause, "Sign-in did not finish. Try again.")));
      return;
    }
    if (!onOpen) {
      window.location.hash = "#ranked";
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onOpen(life);
    } catch (cause) {
      setError(errorText(cause, "This life could not be opened."));
    } finally {
      setBusy(false);
    }
  }

  const [rows, setRows] = useState<KeptRow[] | null>(null);
  const [error, setError] = useState("");
  const { accountId, revision, signin } = backend;
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError("");
    if (!accountId) return;
    void backend.contract.tokensOf(accountId).then(
      tokens => {
        if (!cancelled) setRows(keptRows(tokens));
      },
      cause => {
        if (!cancelled) setError(errorText(cause, "Your lives could not be read from NEAR."));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [accountId, revision]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collection stats
  const ownedCount = rows?.length ?? 0;
  const ownedFigureIds = new Set((rows ?? []).filter(r => r?.isFigure && r?.figureId).map(r => r.figureId as string));
  const figuresUnlockedCount = ownedFigureIds.size;
  const totalFigures = FIGURES.length; // 4 legendary figures
  const setPercent = Math.round((figuresUnlockedCount / totalFigures) * 100);

  return (
    <section className="ledger-panel market ef-market-panel" aria-labelledby={headingId}>
      {/* Ancient Memorial Hero Header */}
      <header className="ledger-heading ef-market-header">
        <div className="ef-market-hero-eyebrow">
          <StorybookMark size={20} />
          <p className="ledger-kicker">
            <span className="cr-index">{String(ownedCount).padStart(2, "0")}</span>
            {backend.mode === "preview" ? "Practice collection" : "Kept on NEAR"}
          </p>
        </div>
        <h1 id={headingId} tabIndex={-1}>My lives</h1>
        <p className="ef-market-hero-desc">
          Your current Weave life, completed lives waiting to mint, and the NFTs {signin ? "you own" : "your wallet owns"}.
        </p>

        {/* PokemonSim-inspired Collection Tracker Bar */}
        <div className="ef-collection-tracker">
          <div className="ef-collection-stats-row">
            <div className="ef-market-stat">
              <span>HISTORICAL FIGURES</span>
              <strong>{figuresUnlockedCount} / {totalFigures} Unlocked</strong>
            </div>
            <div className="ef-market-stat">
              <span>TOTAL LIVES KEPT</span>
              <strong>{ownedCount} {ownedCount === 1 ? "Card" : "Cards"}</strong>
            </div>
            <div className="ef-market-stat is-network">
              <span>SET PROGRESS</span>
              <strong>{setPercent}% Complete</strong>
            </div>

            {/* Booster Pack CTA */}
            <div className="ef-collection-cta">
              {current.active?.progress.status === "ended" ? (
                <a className="chain-primary ef-open-pack-btn" href={`#pack/${current.active.life.life_id}`}>
                  ✦ Open Your Booster Pack →
                </a>
              ) : (
                <a className="chain-primary ef-open-pack-btn" href="#weave">
                  ✦ Play Weave Mode →
                </a>
              )}
            </div>
          </div>

          {/* Golden Progress Meter */}
          <div className="ef-collection-progress-track" aria-hidden="true">
            <div className="ef-collection-progress-bar" style={{ width: `${Math.max(4, setPercent)}%` }} />
          </div>
        </div>
      </header>

      {/* Sign-in Prompts */}
      {!accountId && !signin && <p className="market-empty">Connect a NEAR wallet to see the lives you keep.</p>}
      {!accountId && signin && (
        <div className="market-empty">
          <p>Sign in to see the lives you keep.</p>
          {signingIn ? (
            <SignInPanel
              available={signin.available}
              onEmail={signin.emailFlow}
              onWallet={signin.useWallet}
              onClose={() => setSigningIn(false)}
            />
          ) : (
            <button className="chain-secondary" type="button" onClick={() => setSigningIn(true)}>
              Sign in
            </button>
          )}
        </div>
      )}

      {/* Active Life Card */}
      {current.active && (
        <div className="ledger-body">
          <ActiveLifeCard
            walletPath={signin?.method !== "email"}
            needsPlayKey={signin?.needsPlayKey}
            life={current.active.life}
            progress={current.active.progress}
            busy={busy}
            onOpen={() => {
              void openLife(current.active!.life);
            }}
          />
        </div>
      )}

      {current.loading && <p role="status" className="market-empty">Finding your Weave life…</p>}
      {current.error && <p className="chain-error" role="alert">{current.error}</p>}
      {error && (
        <div className="ledger-body">
          <p className="chain-error" role="alert">{error}</p>
        </div>
      )}
      {accountId && rows === null && !error && (
        <p className="market-empty" role="status">Reading your lives from NEAR…</p>
      )}

      {/* Empty State */}
      {rows !== null && rows.length === 0 && (
        <div className="market-empty ef-empty-collection">
          <p>No minted NFTs yet. {current.active ? "Your Weave life is shown above." : <a href="#weave">Start a Weave life</a>}</p>
        </div>
      )}

      {/* Tabs: My Kept Lives vs Full Set Directory */}
      {rows !== null && (
        <div className="ef-market-toolbar">
          <ul className="market-tabs" role="tablist" aria-label="Collection views">
            <li>
              <button
                className="market-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === "owned"}
                onClick={() => setActiveTab("owned")}
              >
                My Kept Lives<small>{rows.length}</small>
              </button>
            </li>
            <li>
              <button
                className="market-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === "set"}
                onClick={() => setActiveTab("set")}
              >
                Set Catalog &amp; Uncollected<small>{totalFigures}</small>
              </button>
            </li>
          </ul>

          <div className="ef-view-toggle" role="group" aria-label="Collection view format">
            <button
              type="button"
              className={`ef-view-btn ${viewMode === "grid" ? "is-active" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              🎴 Card Grid
            </button>
            <button
              type="button"
              className={`ef-view-btn ${viewMode === "ledger" ? "is-active" : ""}`}
              onClick={() => setViewMode("ledger")}
            >
              ☰ Ledger
            </button>
          </div>
        </div>
      )}

      {/* OWNED CARDS: Grid View */}
      {rows !== null && rows.length > 0 && activeTab === "owned" && viewMode === "grid" && (
        <div className="ef-market-card-grid ledger-body">
          {rows.map((row, idx) => (
            <article key={row.tokenId || `kept-${idx}`} className="ef-market-grid-item">
              <span className="ledger-label sr-only">
                No. {row.tokenId}
                <small>{row.isFigure ? "Famous figure" : "Person of the city"}</small>
              </span>
              <EverfolkCard
                tokenId={row.tokenId}
                title={row.title}
                subtitle={row.isFigure ? "Historical Figure" : "Person of the city"}
                isFigure={row.isFigure}
                figureId={row.figureId}
                portraitMedia={row.portraitMedia}
                rarityLabel={row.rarityLabel}
                actionName={row.actionName}
                affection={row.affection}
                actions={
                  <div className="ef-market-card-footer">
                    <ul className="ledger-chips ef-market-chips">
                      <li key="rarity" className={`ledger-chip ${row.isFigure ? "is-gold" : "is-faience"}`}>
                        {row.rarityLabel}
                      </li>
                      <li key="action" className="ledger-chip">{row.actionName}</li>
                      <li key="aff" className="ledger-chip is-faience">Affection {row.affection}</li>
                    </ul>
                    <div className="ef-market-card-bottom">
                      <a className="chain-secondary" href={row.href}>
                        Open<span aria-hidden="true">→</span>
                      </a>
                    </div>
                  </div>
                }
              />
            </article>
          ))}
        </div>
      )}

      {/* OWNED CARDS: Ledger View */}
      {rows !== null && rows.length > 0 && activeTab === "owned" && viewMode === "ledger" && (
        <ol className="ledger-rows market-ledger ledger-body">
          {rows.map((row, idx) => (
            <li key={row.tokenId || `ledger-kept-${idx}`} className="ledger-row">
              <span className="ledger-label">
                No. {row.tokenId}
                <small>{row.isFigure ? "Famous figure" : "Person of the city"}</small>
              </span>
              <div className="ledger-value">
                <span className="market-thumb">
                  {row.portraitMedia ? (
                    <img src={row.portraitMedia} alt={row.title} className="stage-market-portrait" />
                  ) : row.figureId ? (
                    <FigureArtwork figureId={row.figureId} />
                  ) : (
                    <span className="ledger-emblem" aria-hidden="true">
                      <PixelIcon name={row.emblem ?? "sun"} size={26} />
                    </span>
                  )}
                </span>
                <h2>
                  <a href={row.href}>{row.title}</a>
                </h2>
                <ul className="ledger-chips">
                  <li key="rarity" className={`ledger-chip ${row.isFigure ? "is-gold" : "is-faience"}`}>{row.rarityLabel}</li>
                  <li key="action" className="ledger-chip">{row.actionName}</li>
                  <li key="aff" className="ledger-chip is-faience">Affection {row.affection}</li>
                </ul>
              </div>
              <div className="market-price">
                <a className="chain-secondary" href={row.href}>
                  Open<span aria-hidden="true">→</span>
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* SET CATALOG & UNCOLLECTED (PokemonSim Set Collection View) */}
      {activeTab === "set" && (
        <div className="ef-market-card-grid ledger-body">
          {FIGURES.map((figure, idx) => {
            const isCollected = ownedFigureIds.has(figure.figure);
            return (
              <article key={figure.figure || `fig-${idx}`} className="ef-market-grid-item">
                <EverfolkCard
                  slotNumber={idx + 1}
                  title={figure.title}
                  subtitle={isCollected ? "Historical Figure · In Collection" : "Historical Figure · Uncollected"}
                  isFigure={true}
                  figureId={figure.figure}
                  isSilhouette={!isCollected}
                  badge={isCollected ? "COLLECTED ✓" : "LOCKED"}
                  actionName="Historical Deed"
                  actionDescription={figure.summary}
                  actions={
                    <div className="ef-market-card-footer">
                      <p className="chain-fine" style={{ margin: "4px 0" }}>
                        {isCollected
                          ? "You have immortalized this figure in your collection."
                          : "Qualify in Weave Mode to unlock this legendary card."}
                      </p>
                      <a href="#figures" className="chain-link ef-market-inspect-btn">
                        View requirements &amp; deeds ↗
                      </a>
                    </div>
                  }
                />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
