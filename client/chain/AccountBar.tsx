import { useEffect, useState } from "react";
import { accountBarView, explorerUrl } from "./account-bar-model.ts";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import "./account-bar.css";
import EmailSignIn from "../demo/EmailSignIn.tsx";

const METHOD_LABELS: Record<string, string> = {
  start_life: "Ranked life started", abandon_life: "Life closed", mint_life: "Life minted", open_mint_pack: "Mint pack opened", reroll_mint_slot: "Mint slot rerolled", choose_mint_slot: "Life minted", set_action: "Deed changed",
  withdraw: "Earnings withdrawn", list: "Listed for sale", unlist: "Listing removed", buy: "Purchase complete",
};

/** Who is connected, on which network, what they hold, and the latest transaction on NEAR. */
export default function AccountBar({ backend, compact = false }: { backend: ChainBackend; compact?: boolean }) {
  const [balance, setBalance] = useState<string | null>(null);
  const [claimable, setClaimable] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const { accountId, mode, revision } = backend;

  useEffect(() => {
    let cancelled = false;
    setBalance(null);
    setClaimable(null);
    if (!accountId || mode !== "live") return;
    void backend.nearBalance(accountId).then(value => { if (!cancelled) setBalance(value); }, () => {});
    void backend.contract.balanceOf(accountId).then(value => { if (!cancelled) setClaimable(value); }, () => {});
    return () => { cancelled = true; };
  }, [accountId, mode, revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = accountBarView({ mode, accountId, walletId: backend.walletId, balanceYocto: balance, claimableYocto: claimable });

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError("");
    try { await action(); } catch (cause) { setError(errorText(cause, fallback)); } finally { setBusy(false); }
  }

  const tx = backend.lastTransaction;
  const connected = view.status === "connected";
  return <div className="account-bar-wrap">
    {compact && connected ? <details className="web3-wallet">
      <summary aria-label={`Wallet ${view.account}`}><span className="account-net">{view.network}</span><span>{view.account}</span><span>{view.balance}</span><span aria-hidden="true">⌄</span></summary>
      <div className="web3-wallet-menu">
        <p><strong>{view.wallet ?? "NEAR wallet"}</strong><br />{view.account}</p><p>Spendable balance: {view.balance}</p>
        <a href="#mine" onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>My lives & NFTs</a><a href={view.accountUrl} target="_blank" rel="noreferrer">View on NearBlocks ↗</a>
        {view.claimable && <><p>{view.claimable} to collect</p><button disabled={busy} type="button" onClick={() => { void run(() => backend.contract.withdraw(), "The withdrawal did not go through."); }}>Withdraw earnings</button></>}
        <button type="button" disabled={busy} onClick={() => { void run(async () => { await backend.disconnect(); await backend.connect(); }, "The wallet could not be switched. Connect again to choose a wallet."); }}>Switch wallet</button>
        <button type="button" disabled={busy} onClick={() => { void run(backend.disconnect, "The wallet could not disconnect."); }}>Disconnect</button>
      </div>
    </details> : <>
    <section className="account-bar" aria-label="NEAR account">
      {view.status === "practice" && <p className="account-bar-note"><span className="account-net is-practice">Practice</span>{view.note}</p>}
      {view.status === "disconnected" && <>
        <span className="account-net">{view.network}</span>
        <span className="account-muted">No wallet connected</span>
        <button className="account-action" type="button" disabled={busy} onClick={() => { void run(backend.connect, "The wallet could not connect."); }}>Connect wallet</button>
        <EmailSignIn />
      </>}
      {view.status === "connected" && <>
        <span className="account-net">{view.network}</span>
        <a className="account-name" href={view.accountUrl} target="_blank" rel="noreferrer" title="Open this account on NearBlocks">{view.account}<span aria-hidden="true"> ↗</span></a>
        {view.wallet && <span className="account-muted">via {view.wallet}</span>}
        <span className="account-balance" title="Spendable NEAR in this account"><strong>{view.balance}</strong></span>
        {view.claimable && <span className="account-claim">
          <span>{view.claimable} to collect</span>
          <button className="account-action" type="button" disabled={busy} onClick={() => { void run(() => backend.contract.withdraw(), "The withdrawal did not go through."); }}>Withdraw</button>
        </span>}
        <button className="account-link" type="button" disabled={busy} onClick={() => { void run(backend.disconnect, "The wallet could not disconnect."); }}>Disconnect</button>
      </>}
    </section>
    </>}
    {error && <p className="chain-error account-bar-error" role="alert">{error}</p>}
    {tx && tx.hash !== dismissed && <p className="account-tx" role="status">
      <span className="account-tx-mark" aria-hidden="true">✦</span>
      <span>{METHOD_LABELS[tx.method] ?? "Transaction confirmed"} · recorded on NEAR</span>
      <a href={explorerUrl({ tx: tx.hash })} target="_blank" rel="noreferrer">View transaction<span aria-hidden="true"> ↗</span></a>
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed(tx.hash)}>×</button>
    </p>}
  </div>;
}
