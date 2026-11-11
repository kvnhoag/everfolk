"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import App, { type AppPanel, type CharacterSection } from "../App.tsx";
import ChainLayer, { leaveChainRoute, useChainRoute } from "../chain/ChainLayer.tsx";
import Web3Navigation from "../chain/Web3Navigation.tsx";
import type { ChainBackend } from "../chain/chain-backend.ts";
import {
  DEMO_LIFE_A_OWNER,
  DEMO_NEXT_OWNER,
  WEAVE_PRESETS,
  fastForwardFarmer,
  openGranary,
  prepareWeavePreset,
  settleGranaryYear,
  withoutGranary,
  type PreparedWeavePreset,
  type WeavePresetId,
} from "../chain/demo-scenario.ts";
import { beginRankedSession } from "../chain/ranked-session.ts";
import { PRACTICE_CONTRACT_ID, practiceVerifier } from "../chain/practice-verifier.ts";
import { selectWorldPack } from "../session.ts";
import { GRANARY_GRAIN } from "../../chain/catalog/demo-deeds.ts";
import { householdView } from "../../src/demo/household.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";
import type { ComparisonSide } from "./EconomyPanels.tsx";
import "./weave-lab.css";

type WeaveStage = "before" | "aid" | "settled";

function parseInitialPreset(fallback: WeavePresetId): WeavePresetId {
  if (typeof window === "undefined") return fallback;
  const param = new URLSearchParams(window.location.search).get("preset");
  if (param && WEAVE_PRESETS.some(p => p.id === param)) return param as WeavePresetId;
  return fallback;
}

export default function WeaveLab({ initialPreset = "weave" }: { initialPreset?: WeavePresetId }) {
  const [preset, setPreset] = useState<WeavePresetId>(initialPreset);
  const [prepared, setPrepared] = useState<PreparedWeavePreset | null>(null);
  const [weaveStage, setWeaveStage] = useState<WeaveStage>("aid");
  const [packPreopened, setPackPreopened] = useState(true);
  const [weaveBeforeFlood, setWeaveBeforeFlood] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [rankedRevision, setRankedRevision] = useState(0);
  const [endingDismissed, setEndingDismissed] = useState(false);
  const [panelRequest, setPanelRequest] = useState<{ panel: AppPanel; section?: CharacterSection; openDecision?: boolean; seq: number }>({
    panel: null,
    section: "career",
    seq: 0,
  });
  const actionInFlight = useRef(false);
  const syncedUrlPreset = useRef(false);
  const chainRoute = useChainRoute();

  useEffect(() => {
    if (!syncedUrlPreset.current) {
      syncedUrlPreset.current = true;
      const fromUrl = parseInitialPreset(preset);
      if (fromUrl !== preset) {
        setPreset(fromUrl);
        return;
      }
    }
    let cancelled = false;
    setBusy(true);
    setError("");
    setEndingDismissed(false);
    void prepareWeavePreset(preset, { packPreopened, weaveBeforeFlood })
      .then(result => {
        if (cancelled) return;
        selectWorldPack(result.world);
        setPrepared(result);
        setWeaveStage(weaveBeforeFlood ? "before" : "aid");
        setSessionEpoch(v => v + 1);
        setRankedRevision(v => v + 1);
        if (result.initialHash) {
          window.location.hash = result.initialHash;
        } else if (window.location.hash) {
          leaveChainRoute();
        }
        if (preset === "career") {
          setPanelRequest(prev => ({ panel: null, section: "career", openDecision: false, seq: prev.seq + 1 }));
        } else if (preset === "convoy") {
          setPanelRequest(prev => ({ panel: null, section: "career", openDecision: false, seq: prev.seq + 1 }));
        } else {
          setPanelRequest(prev => ({ panel: null, section: "career", openDecision: false, seq: prev.seq + 1 }));
        }
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not prepare the Weave test preset.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preset, packPreopened, weaveBeforeFlood, attempt]);

  function selectPreset(next: WeavePresetId) {
    if (busy) return;
    if (next === preset) {
      setAttempt(v => v + 1);
      return;
    }
    setWeaveBeforeFlood(false);
    setPackPreopened(true);
    setPreset(next);
  }

  function requestView(panel: AppPanel, section?: CharacterSection, openDecision?: boolean) {
    if (window.location.hash) leaveChainRoute();
    setEndingDismissed(true);
    setPanelRequest(prev => ({ panel, section, openDecision, seq: prev.seq + 1 }));
  }

  async function runWeaveStep(fn: () => Promise<void>, nextStage?: WeaveStage, showEnding?: boolean) {
    if (actionInFlight.current || !prepared) return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (window.location.hash) leaveChainRoute();
      await fn();
      if (nextStage) setWeaveStage(nextStage);
      if (showEnding) setEndingDismissed(false);
      setSessionEpoch(v => v + 1);
      setRankedRevision(v => v + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This fast-forward step could not be completed.");
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  const backend: ChainBackend | null = useMemo(() => {
    if (!prepared) return null;
    return {
      mode: "preview",
      contract: prepared.ledger,
      accountId: DEMO_NEXT_OWNER,
      walletId: "practice",
      worldVersion: prepared.world.version,
      contractId: PRACTICE_CONTRACT_ID,
      lastTransaction: null,
      revision: rankedRevision,
      connect: async () => {},
      disconnect: async () => {},
      nearBalance: async () => "25000000000000000000000000",
    };
  }, [prepared, rankedRevision]);

  const demoComparison = useMemo((): { withDeed: ComparisonSide; withoutDeed: ComparisonSide } | null => {
    if (!prepared?.granary || preset !== "weave" || weaveStage === "before") return null;
    const state = prepared.session.state;
    const tokenId = prepared.granary.source.minted.token_id;
    const cf = withoutGranary(prepared.world, state, tokenId);
    const withView = householdView(prepared.world.demo!, state as LifeStateWithDemo);
    const withoutView = householdView(prepared.world.demo!, cf as LifeStateWithDemo);
    return {
      withDeed: {
        label: `With the earlier granary (${withView.grain} grain in store, ${state.economy?.cash ?? 0} dr cash)`,
        grainReceived: GRANARY_GRAIN,
        hungerAvoided: withView.shortfallBps === 0,
        sourceName: `Farmer Life NFT #${tokenId}`,
        ownerShare: `50% of mint fee & 5% of market sales to ${DEMO_LIFE_A_OWNER}`,
      },
      withoutDeed: {
        label: `Without the earlier granary (${withoutView.grain} grain in store, ${cf.economy?.cash ?? 0} dr cash)`,
        grainReceived: 0,
        hungerAvoided: withoutView.shortfallBps === 0,
        sourceName: null,
        ownerShare: null,
      },
    };
  }, [prepared, preset, weaveStage, rankedRevision, sessionEpoch]);

  const activePresetMeta = WEAVE_PRESETS.find(p => p.id === preset) ?? WEAVE_PRESETS[0];
  const sessionEnded = prepared?.session.state.phase === "ended";
  const chainModalOpen = Boolean(chainRoute) || Boolean(sessionEnded && !endingDismissed);

  const testBar = (
    <section className="weave-test-bar" aria-label="Weave Mode Feature Test Bar">
      <div className="weave-test-bar-inner">
        <div className="weave-test-top">
          <div className="weave-test-brand">
            <a href="/">← Everfolk</a>
            <span className="weave-test-badge">Weave Mode · Fast-Forward Test Lab</span>
          </div>
          <div className="weave-test-presets" role="tablist" aria-label="Feature presets">
            {WEAVE_PRESETS.map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={preset === item.id}
                className={`weave-test-tab${preset === item.id ? " is-active" : ""}`}
                disabled={busy}
                onClick={() => selectPreset(item.id)}
              >
                {item.shortLabel}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="weave-test-action"
            disabled={busy}
            onClick={() => setAttempt(v => v + 1)}
          >
            Reset preset
          </button>
        </div>

        <div className="weave-test-subbar">
          <p className="weave-test-summary">
            <strong>{activePresetMeta.label}:</strong> {activePresetMeta.summary}
          </p>
          {busy && <p className="weave-test-status" role="status">Preparing prefilled state…</p>}
          {error && <p className="weave-test-status" role="alert">{error}</p>}

          {prepared && !busy && (
            <div className="weave-test-actions" aria-label="Preset controls">
              {preset === "weave" && prepared.granary && (
                <>
                  <button
                    type="button"
                    className={`weave-test-action${weaveBeforeFlood && weaveStage === "before" ? " is-active" : ""}`}
                    onClick={() => setWeaveBeforeFlood(true)}
                  >
                    1. Before poor harvest
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${weaveStage === "aid" && !chainModalOpen ? " is-active" : ""}`}
                    onClick={() => {
                      if (weaveStage === "before") {
                        void runWeaveStep(() => openGranary(prepared.granary!), "aid");
                      } else if (weaveBeforeFlood) {
                        setWeaveBeforeFlood(false);
                      } else {
                        requestView(null, "career", false);
                      }
                    }}
                  >
                    2. Granary arrives (+{GRANARY_GRAIN} grain)
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${weaveStage === "settled" && !chainModalOpen ? " is-active" : ""}`}
                    disabled={weaveStage !== "aid" || sessionEnded}
                    onClick={() => { void runWeaveStep(() => settleGranaryYear(prepared.granary!), "settled"); }}
                  >
                    3. Keep seed &amp; compare outcome
                  </button>
                  {prepared.session.state.phase === "choice" && (
                    <button
                      type="button"
                      className="weave-test-action"
                      onClick={() => requestView(null, "career", true)}
                    >
                      Open flood decision
                    </button>
                  )}
                  <button
                    type="button"
                    className={`weave-test-action${chainRoute?.kind === "token" ? " is-active" : ""}`}
                    onClick={() => { window.location.hash = `#token/${prepared.granary!.source.minted.token_id}`; }}
                  >
                    Inspect Farmer NFT #{prepared.granary.source.minted.token_id}
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${sessionEnded && !endingDismissed && !chainRoute ? " is-active" : ""}`}
                    onClick={() => {
                      if (sessionEnded) {
                        if (window.location.hash) leaveChainRoute();
                        setEndingDismissed(false);
                      } else {
                        void runWeaveStep(() => fastForwardFarmer(prepared.session, prepared.world), "settled", true);
                      }
                    }}
                  >
                    {sessionEnded ? "Open Ending & Mint" : "4. Fast-forward to Ending & Mint"}
                  </button>
                </>
              )}

              {(preset === "career" || preset === "economy" || preset === "convoy") && (
                <>
                  <button
                    type="button"
                    className={`weave-test-action${panelRequest.panel === null && !chainModalOpen ? " is-active" : ""}`}
                    onClick={() => requestView(null, "career", false)}
                  >
                    Live Dashboard
                  </button>
                  {preset === "convoy" && prepared.session.state.phase === "choice" && (
                    <button
                      type="button"
                      className="weave-test-action"
                      onClick={() => requestView(null, "career", true)}
                    >
                      Convoy Decision &amp; Route Risk
                    </button>
                  )}
                  <button
                    type="button"
                    className={`weave-test-action${panelRequest.panel === "wiki" && !chainModalOpen ? " is-active" : ""}`}
                    onClick={() => requestView("wiki")}
                  >
                    Skill Tree &amp; Wiki
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${panelRequest.panel === "character" && panelRequest.section === "career" && !chainModalOpen ? " is-active" : ""}`}
                    onClick={() => requestView("character", "career")}
                  >
                    Career &amp; Jobs
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${panelRequest.panel === "character" && panelRequest.section === "skills" && !chainModalOpen ? " is-active" : ""}`}
                    onClick={() => requestView("character", "skills")}
                  >
                    Character Skills
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${panelRequest.panel === "character" && panelRequest.section === "wealth" && !chainModalOpen ? " is-active" : ""}`}
                    onClick={() => requestView("character", "wealth")}
                  >
                    Wealth &amp; Spend
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${sessionEnded && !endingDismissed && !chainRoute ? " is-active" : ""}`}
                    onClick={() => {
                      if (sessionEnded) {
                        if (window.location.hash) leaveChainRoute();
                        setEndingDismissed(false);
                      } else {
                        void runWeaveStep(() => fastForwardFarmer(prepared.session, prepared.world), undefined, true);
                      }
                    }}
                  >
                    {sessionEnded ? "Open Ending & Mint" : "Fast-forward to Ending & Mint"}
                  </button>
                </>
              )}

              {preset === "nft-pack" && (
                <>
                  <button
                    type="button"
                    className={`weave-test-action${packPreopened && !endingDismissed && !chainRoute ? " is-active" : ""}`}
                    onClick={() => {
                      if (window.location.hash) leaveChainRoute();
                      setEndingDismissed(false);
                      if (!packPreopened) setPackPreopened(true);
                    }}
                  >
                    3-Card Booster Pack (Open, Reroll &amp; Mint)
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${!packPreopened && !endingDismissed && !chainRoute ? " is-active" : ""}`}
                    onClick={() => {
                      if (window.location.hash) leaveChainRoute();
                      setEndingDismissed(false);
                      if (packPreopened) setPackPreopened(false);
                    }}
                  >
                    Step 1: Life Report &amp; Deed Pick
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${endingDismissed && !chainRoute ? " is-active" : ""}`}
                    onClick={() => requestView(null, "career", false)}
                  >
                    Inspect Completed Life Dashboard
                  </button>
                </>
              )}

              {preset === "nft-market" && (
                <>
                  <button
                    type="button"
                    className={`weave-test-action${chainRoute?.kind === "token" && chainRoute.tokenId === "1" ? " is-active" : ""}`}
                    onClick={() => { window.location.hash = "#token/1"; }}
                  >
                    My Farmer NFT #1 (Deed, Royalties &amp; Sell)
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${chainRoute?.kind === "market" ? " is-active" : ""}`}
                    onClick={() => { window.location.hash = "#market"; }}
                  >
                    Market (Buy NFTs)
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${chainRoute?.kind === "mine" ? " is-active" : ""}`}
                    onClick={() => { window.location.hash = "#mine"; }}
                  >
                    My Lives
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${chainRoute?.kind === "figures" ? " is-active" : ""}`}
                    onClick={() => { window.location.hash = "#figures"; }}
                  >
                    Famous Figures
                  </button>
                  <button
                    type="button"
                    className={`weave-test-action${!chainModalOpen ? " is-active" : ""}`}
                    onClick={() => requestView(null, "career", false)}
                  >
                    Live Game Dashboard
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  if (!prepared || !backend) {
    return (
      <main>
        {testBar}
        <div className="weave-lab-loading" role="status">
          <p><strong>Preparing Weave Mode test preset…</strong></p>
          <p>{activePresetMeta.summary}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="weave-lab-host">
      <div className="web3-home-bar" hidden={chainModalOpen}>
        <Web3Navigation backend={backend} onExplore={() => leaveChainRoute()} />
      </div>
      <App
        key={`weave-${preset}-${prepared.session.life.life_id}-${sessionEpoch}`}
        worldPickerOpen={chainModalOpen}
        deferInitialDecision={preset === "weave" || preset === "convoy"}
        demoComparison={demoComparison}
        panelRequest={panelRequest}
        topSlot={!chainModalOpen ? testBar : undefined}
        ranked={{
          initial: prepared.session.state,
          current: () => prepared.session.state,
          sync: next => prepared.session.sync(next),
          onSynced: () => setRankedRevision(v => v + 1),
          skipResumeScreen: true,
        }}
      />
      <ChainLayer
        backend={backend}
        rankedSession={endingDismissed ? null : prepared.session}
        onBeginRanked={async life => {
          const nextSession = await beginRankedSession({
            contract: prepared.ledger,
            contractId: PRACTICE_CONTRACT_ID,
            world: prepared.world,
            verifyUrl: "",
            verifyLocally: practiceVerifier(prepared.world, prepared.ledger),
          }, life);
          setPrepared(curr => curr ? { ...curr, session: nextSession } : curr);
          setEndingDismissed(false);
          setSessionEpoch(v => v + 1);
          setRankedRevision(v => v + 1);
        }}
        onRankedClosed={() => setEndingDismissed(true)}
        topSlot={testBar}
      />
    </div>
  );
}
