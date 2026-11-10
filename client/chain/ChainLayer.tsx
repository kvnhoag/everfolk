import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { LifeView } from "../../chain/types.ts";
import { useChainBackend, type ChainBackend } from "./chain-backend.ts";
import { chainHref, parseChainRoute, type ChainRoute } from "./chain-route.ts";
import RankedEnding, { type RankedEndingSession } from "./RankedEnding.tsx";
import RankedEntry from "./RankedEntry.tsx";
import Market from "./Market.tsx";
import TokenPage from "./TokenPage.tsx";
import "./chain.css";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useChainRoute(): ChainRoute | null {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  return parseChainRoute(hash);
}

/** Back to the game: drop the hash without leaving a bare "#" in the address bar. */
export function leaveChainRoute(): void {
  window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

interface ChainShellProps { backend: ChainBackend | null; focusKey: string; onBack(): void; children: ReactNode }

/**
 * A modal dialog, so it sits in the top layer above the game's own modal dialogs
 * (the birth roll opens on its own for a new visitor) and makes the game inert underneath.
 */
function ChainShell({ backend, focusKey, onBack, children }: ChainShellProps) {
  const shell = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = shell.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // A game dialog opened later (e.g. the first-visit birth roll) would stack above; lift this one back on top.
    const raise = new MutationObserver(records => {
      if (!records.some(record => record.target !== dialog && (record.target as HTMLDialogElement).open)) return;
      const top = dialog.scrollTop;
      dialog.close();
      dialog.showModal();
      dialog.scrollTop = top;
    });
    raise.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => { raise.disconnect(); if (dialog.open) dialog.close(); };
  }, []);
  useEffect(() => {
    shell.current?.scrollTo({ top: 0 });
    shell.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [focusKey, backend === null]);
  return <dialog className="chain-screen" ref={shell} aria-label="Ranked lives" onCancel={event => { event.preventDefault(); onBack(); }}>
    <div className="chain-shell">
      <header className="chain-topline">
        <a href="/" onClick={event => { event.preventDefault(); onBack(); }}><span aria-hidden="true">←</span> Back to Everfolk</a>
        <nav aria-label="Ranked"><a href="#ranked">Ranked life</a><a href="#market">Market</a></nav>
        {backend?.mode === "preview" && <span className="chain-preview" title="Lives, coins and sales here are not recorded anywhere.">Practice ledger</span>}
      </header>
      {children}
    </div>
  </dialog>;
}

/** An active ranked session as GameClient holds it; `state` is the engine's life state. */
export type ChainLayerSession = RankedEndingSession & { state: { phase: string } };

export interface ChainLayerProps {
  /** Hands a started ranked life to the ranked session; the game then plays it. */
  onBeginRanked?(life: LifeView, backend: ChainBackend): Promise<void>;
  /** Only a ranked life shows the end-of-life report; free play passes nothing. */
  rankedSession?: ChainLayerSession | null;
  onRankedClosed?(): void;
}

/** Ranked screens over the game, opened by hash routes. The game stays mounted underneath. */
export default function ChainLayer({ onBeginRanked, rankedSession, onRankedClosed }: ChainLayerProps) {
  const route = useChainRoute();
  const backend = useChainBackend();
  if (rankedSession?.state.phase === "ended" && backend && !route) {
    const close = () => onRankedClosed?.();
    return <ChainShell backend={backend} focusKey={`ending:${rankedSession.life.life_id}`} onBack={close}>
      <RankedEnding session={rankedSession} contract={backend.contract} onClose={close} />
    </ChainShell>;
  }
  if (!route) return null;
  let content: ReactNode = <p className="chain-loading" role="status">Opening the ledger…</p>;
  const begin = onBeginRanked && backend ? async (life: LifeView) => { await onBeginRanked(life, backend); leaveChainRoute(); } : undefined;
  if (backend && route.kind === "ranked") content = <RankedEntry backend={backend} onBegin={begin} />;
  if (backend && route.kind === "market") content = <Market backend={backend} />;
  if (backend && route.kind === "token") content = <TokenPage key={route.tokenId} backend={backend} tokenId={route.tokenId} />;
  return <ChainShell backend={backend} focusKey={chainHref(route)} onBack={leaveChainRoute}>{content}</ChainShell>;
}
