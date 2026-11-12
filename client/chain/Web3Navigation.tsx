import { useSyncExternalStore } from "react";
import type { ChainBackend } from "./chain-backend.ts";
import AccountBar from "./AccountBar.tsx";
import StorybookMark from "../components/StorybookMark.tsx";
import "./web3-navigation.css";

export default function Web3Navigation({ backend, onExplore }: { backend: ChainBackend | null; onExplore?(): void }) {
  const hash = useSyncExternalStore(
    listener => {
      window.addEventListener("hashchange", listener);
      return () => window.removeEventListener("hashchange", listener);
    },
    () => window.location.hash,
    () => "",
  );

  return (
    <header className="web3-header ef-web3-header">
      <a className="web3-brand ef-web3-brand" href="#weave" aria-label="Everfolk Weave Mode">
        <div className="ef-web3-mark-wrap" aria-hidden="true">
          <StorybookMark size={28} />
        </div>
        <div className="ef-web3-brand-text">
          <strong>Everfolk</strong>
          <span>Weaving fates · NEAR</span>
        </div>
      </a>

      <nav className="web3-links ef-web3-nav" aria-label="Everfolk experiences">
        {[
          ["#weave", "Weave Mode"],
          ["#market", "Market"],
          ["#mine", "My lives"],
          ["#figures", "Figures"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            aria-current={hash === href || (href === "#weave" && hash === "#ranked") ? "page" : undefined}
          >
            {label}
          </a>
        ))}
        <a
          href="/"
          className="ef-nav-explore-btn"
          onClick={
            onExplore
              ? event => {
                  event.preventDefault();
                  onExplore();
                }
              : undefined
          }
        >
          Explore for free ✕
        </a>
      </nav>

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
