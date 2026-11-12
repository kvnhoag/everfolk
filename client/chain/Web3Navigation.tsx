import type { ChainBackend } from "./chain-backend.ts";
import AccountBar from "./AccountBar.tsx";
import SiteNav from "../components/SiteNav.tsx";
import EverfolkWordmark from "../components/EverfolkWordmark.tsx";
import "./web3-navigation.css";

export default function Web3Navigation({ backend, onExplore }: { backend: ChainBackend | null; onExplore?(): void }) {
  return <header className="web3-header">
    <a className="web3-brand" href="#" aria-label="Everfolk home" onClick={onExplore ? event => { event.preventDefault(); onExplore(); } : undefined}><EverfolkWordmark /><span>Weaving fates</span></a>
    <SiteNav className="web3-links" onPlay={onExplore} />
    {backend ? <AccountBar backend={backend} compact /> : <span role="status" className="chain-fine">Opening NEAR…</span>}
  </header>;
}
