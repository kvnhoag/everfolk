"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import App from "../screens/App.tsx";
import LoadingScreen from "../screens/LoadingScreen.tsx";
import ChainLayer, { leaveChainRoute, useChainRoute } from "../chain/ChainLayer.tsx";
import type { ChainBackend } from "../chain/chain-backend.ts";
import {
  DEMO_LIFE_A_OWNER,
  DEMO_NEXT_OWNER,
  normalizeWeavePreset,
  prepareWeavePreset,
  withoutGranary,
  type PreparedWeavePreset,
  type WeavePresetId,
} from "../chain/demo-scenario.ts";
import { beginRankedSession } from "../chain/ranked-session.ts";
import { PRACTICE_CONTRACT_ID, practiceVerifier } from "../chain/practice-verifier.ts";
import { selectWorldPack } from "../lib/world-session.ts";
import { GRANARY_GRAIN } from "../../chain/catalog/demo-deeds.ts";
import { householdView } from "../../src/demo/household.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";
import type { ComparisonSide } from "./EconomyPanels.tsx";

export default function WeaveLab({ initialPreset = "granary" }: { initialPreset?: string }) {
  const [preset, setPreset] = useState<WeavePresetId>(() => normalizeWeavePreset(initialPreset));
  const [prepared, setPrepared] = useState<PreparedWeavePreset | null>(null);
  const [error, setError] = useState("");
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [rankedRevision, setRankedRevision] = useState(0);
  const [endingDismissed, setEndingDismissed] = useState(false);
  const syncedUrlPreset = useRef(false);
  const chainRoute = useChainRoute();

  useEffect(() => {
    setPreset(normalizeWeavePreset(initialPreset));
  }, [initialPreset]);

  useEffect(() => {
    if (!syncedUrlPreset.current) {
      syncedUrlPreset.current = true;
      const param = new URLSearchParams(window.location.search).get("preset");
      if (param) {
        const fromQuery = normalizeWeavePreset(param);
        if (fromQuery !== preset) {
          setPreset(fromQuery);
          return;
        }
      }
    }
    let cancelled = false;
    setError("");
    setEndingDismissed(false);
    void prepareWeavePreset(preset)
      .then(result => {
        if (cancelled) return;
        selectWorldPack(result.world);
        setPrepared(result);
        setSessionEpoch(v => v + 1);
        setRankedRevision(v => v + 1);
        if (result.initialHash) {
          window.location.hash = result.initialHash;
        } else if (window.location.hash) {
          leaveChainRoute();
        }
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not prepare the Weave preset.");
      });
    return () => {
      cancelled = true;
    };
  }, [preset]);

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
    if (!prepared?.granary || (preset !== "granary" && preset !== "weave")) return null;
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
  }, [prepared, preset, rankedRevision, sessionEpoch]);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!prepared || !backend) {
    return <LoadingScreen phase="world" />;
  }

  const sessionEnded = prepared.session.state.phase === "ended";
  const chainModalOpen = Boolean(chainRoute) || Boolean(sessionEnded && !endingDismissed);

  return (
    <>
      <App
        key={`weave-${preset}-${prepared.session.life.life_id}-${sessionEpoch}`}
        worldPickerOpen={chainModalOpen}
        initialPanel={preset === "career" ? "character" : null}
        initialCharacterSection="career"
        deferInitialDecision={preset === "granary" || preset === "weave"}
        demoComparison={demoComparison}
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
      />
    </>
  );
}
