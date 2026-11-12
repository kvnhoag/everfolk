import type { ChainBackend } from "./chain-backend.ts";
import AccountBar from "./AccountBar.tsx";
import StorybookMark from "../components/StorybookMark.tsx";
import SiteNav from "../components/SiteNav.tsx";
import "./web3-navigation.css";

/** The revamped Weave/Market header, using the same Play · Weave Mode · Market · Figures · My lives links as every screen. */
export default function Web3Navigation({ backend, onExplore }: { backend: ChainBackend | null; onExplore?(): void }) {
  return (
    <header className="web3-header ef-web3-header">
      <a className="web3-brand ef-web3-brand" href="#" aria-label="Everfolk home" onClick={onExplore ? event => { event.preventDefault(); onExplore(); } : undefined}>
        <div className="ef-web3-mark-wrap" aria-hidden="true">
          <StorybookMark size={28} />
        </div>
        <div className="ef-web3-brand-text">
          <strong>Everfolk</strong>
          <span>Weaving fates · NEAR</span>
        </div>
      </a>

      <SiteNav className="web3-links ef-web3-nav" onPlay={onExplore} />

      {backend ? (
        <AccountBar backend={backend} compact />
      ) : (
        <span role="status" className="chain-fine" style={{ color: "#d6bc8e" }}>
          Opening NEAR…
        </span>
      )}
    </header>
  );
}
