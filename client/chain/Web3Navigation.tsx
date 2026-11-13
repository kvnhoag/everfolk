import type { ChainBackend } from "./chain-backend.ts";
import AccountBar from "./AccountBar.tsx";
import EverfolkBrand from "../components/EverfolkBrand.tsx";
import SiteNav from "../components/SiteNav.tsx";
import TutorialButton from "../components/TutorialButton.tsx";
import "./web3-navigation.css";

/** The revamped Weave/Market header, using the same Play · Weave Mode · Market · Figures · My lives links as every screen. */
export default function Web3Navigation({ backend, onExplore }: { backend: ChainBackend | null; onExplore?(): void }) {
  return (
    <header className="web3-header ef-web3-header">
      <a className="web3-brand ef-web3-brand" href="#" aria-label="Everfolk home" onClick={onExplore ? event => { event.preventDefault(); onExplore(); } : undefined}>
        <EverfolkBrand tone="cream" />
      </a>

      <SiteNav className="web3-links ef-web3-nav" onPlay={onExplore} />

      <TutorialButton tone="dark" />

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
