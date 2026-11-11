import { useSyncExternalStore } from "react";
import type { ChainBackend } from "./chain-backend.ts";
import AccountBar from "./AccountBar.tsx";
import "./web3-navigation.css";

export default function Web3Navigation({ backend, onExplore }: { backend: ChainBackend | null; onExplore?(): void }) {
  const hash = useSyncExternalStore(listener => { window.addEventListener("hashchange", listener); return () => window.removeEventListener("hashchange", listener); }, () => window.location.hash, () => "");
  return <header className="web3-header">
    <a className="web3-brand" href="#weave" aria-label="Everfolk Weave Mode">Everfolk<span>Weaving fates</span></a>
    <nav className="web3-links" aria-label="Everfolk experiences">
      {[["#weave", "Weave Mode"], ["#figures", "Figures"], ["#market", "Market"], ["#mine", "My lives"]].map(([href, label]) => <a key={href} href={href} aria-current={hash === href || (href === "#weave" && hash === "#ranked") ? "page" : undefined}>{label}</a>)}
      <a href="/" onClick={onExplore ? event => { event.preventDefault(); onExplore(); } : undefined}>Explore for free</a>
    </nav>
    {backend ? <AccountBar backend={backend} compact /> : <span role="status" className="chain-fine">Opening NEAR…</span>}
  </header>;
}
