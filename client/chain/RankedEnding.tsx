import { useEffect, useState } from "react";
import type { LifeView, MintResult, MintPack as Pack, MintTerms, StageMintResult } from "../../chain/types.ts";
import { packCardCount } from "../../chain/pack-count.ts";
import type { OwnersByToken } from "./born-into-model.ts";
import { errorText } from "./chain-backend.ts";
import LifeReport from "./LifeReport.tsx";
import { lifeReport, lifeSpanLine, npcActionMenu } from "./life-report-model.ts";
import MintPack from "./MintPack.tsx";
import StageAlbum, { StageAlbumReceipt } from "./StageAlbum.tsx";
import MintRecovery from "./MintRecovery.tsx";
import MintReveal from "./MintReveal.tsx";
import { mintRevealView } from "./life-report-model.ts";
import { resultCardView } from "./nft-card-view.ts";
import DeclineChoice from "./DeclineChoice.tsx";
import { DEFAULT_MINT_FEE_YOCTO, formatNear } from "./near-amount.ts";
import type { LivesContract, SignedEvidence } from "./types.ts";

/** The part of the ranked session (Task 17) the ending needs. `RankedSession` satisfies it structurally. */
export interface RankedEndingSession {
  life: LifeView;
  finish(): Promise<SignedEvidence>;
  chooseMint(slot: number): Promise<MintResult>;
  mintStages(signed: SignedEvidence, npcActionId: string, expectedFee?: string): Promise<StageMintResult>;
  mint(signed: SignedEvidence, npcActionId: string): Promise<MintResult>;
  recoverMint(): Promise<MintResult>;
  abandon(): Promise<void>;
}

export interface RankedEndingProps {
  session: RankedEndingSession;
  practice?: boolean;
  walletPath?: boolean;
  contract: LivesContract;
  feeYocto?: string;
  /** Hash of the latest confirmed wallet transaction (the mint, once it lands), for an explorer link. */
  lastTxHash?: string | null;
  onClose(): void;
}

type Stage = { kind: "album-recovered"; result: StageMintResult } | { kind: "verifying" } | { kind: "failed"; error: string } | { kind: "committed" } | { kind: "recovered"; result: MintResult } | { kind: "report"; signed: SignedEvidence } | { kind: "declining"; signed: SignedEvidence } | { kind: "pack"; signed: SignedEvidence; pack: Pack };

/** Matches the contract's default `abandon_cooldown_ms`. */
const COOLDOWN_MINUTES = 10;

async function ownersOf(contract: LivesContract, tokenIds: readonly string[]): Promise<OwnersByToken> {
  const entries = await Promise.all(tokenIds.map(async id => [id, (await contract.token(id).catch(() => null))?.owner_id] as const));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
}

/** A ranked life's end: verify the save, show who shaped it, offer the mint, reveal the result. */
export default function RankedEnding({ session, walletPath = true, practice = false, contract, feeYocto = DEFAULT_MINT_FEE_YOCTO, lastTxHash, onClose }: RankedEndingProps) {
  const [stage, setStage] = useState<Stage>(() => ({ kind: session.life.status === "alive" ? "verifying" : "committed" }));
  const [terms, setTerms] = useState<MintTerms | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [owners, setOwners] = useState<OwnersByToken>({});
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session.life.status !== "alive") { setStage({ kind: "committed" }); return; }
    let cancelled = false;
    void session.finish().then(async signed => {
      const [quote, existing] = await Promise.all([contract.mintTerms(), contract.mintPack(session.life.life_id)]);
      const found = await ownersOf(contract, signed.evidence.sources.map(source => source.token_id));
      if (cancelled) return;
      setTerms(quote);
      setOwners(found);
      setSelected(npcActionMenu(signed.evidence.career_group)[0]?.id ?? "");
      setStage(existing ? { kind: "pack", signed, pack: existing } : { kind: "report", signed });
    }).catch(cause => { if (!cancelled) setStage({ kind: "failed", error: errorText(cause, "Your life could not be checked.") }); });
    return () => { cancelled = true; };
  }, [session, contract, attempt]);

  async function mint(signed: SignedEvidence) {
    setBusy(true);
    setError("");
    try { setStage({ kind: "pack", pack: await contract.openMintPack(session.life.life_id, signed, selected), signed }); }
    catch (cause) {
      const landed = await contract.mintPack(session.life.life_id).catch(() => null);
      if (landed) setStage({ kind: "pack", signed, pack: landed });
      else setError(errorText(cause, "The pack was not opened. Please try again."));
    }
    finally { setBusy(false); }
  }

  async function closeLife() {
    setBusy(true);
    setError("");
    try { await session.abandon(); onClose(); }
    catch (cause) { setError(errorText(cause, "This life could not be closed. Please try again.")); }
    finally { setBusy(false); }
  }

  async function recover() {
    setBusy(true);
    setError("");
    try {
      const result = await session.recoverMint();
      const album = await contract.stageMintResult(session.life.life_id).catch(() => null);
      setStage(album ? { kind: "album-recovered", result: album } : { kind: "recovered", result });
    }
    catch (cause) { setError(errorText(cause, "The mint could not finish. Please try again.")); }
    finally { setBusy(false); }
  }

  if (stage.kind === "album-recovered") return <StageAlbumReceipt result={stage.result} onClose={onClose} />;
  if (stage.kind === "committed") return <MintRecovery busy={busy} error={error} onRecover={() => { void recover(); }} onBack={onClose} />;
  if (stage.kind === "recovered") return <MintReveal view={mintRevealView(stage.result)} affection={stage.result.affection} card={resultCardView(stage.result)} onClose={onClose} />;
  if (stage.kind === "verifying") return <p className="chain-loading" role="status">Checking your life against its record…</p>;
  if (stage.kind === "failed") return <section className="chain-card">
    <h1 tabIndex={-1}>We couldn't check this life</h1>
    <p className="chain-error" role="alert">{stage.error}</p>
    <div className="chain-actions"><button className="chain-primary" type="button" onClick={() => { setStage({ kind: "verifying" }); setAttempt(value => value + 1); }}>Try again<span aria-hidden="true">→</span></button><button className="chain-secondary" type="button" onClick={onClose}>Back to Everfolk</button></div>
  </section>;
  const evidence = stage.signed.evidence;
  const cardCount = packCardCount(evidence);
  if (stage.kind === "declining") return <DeclineChoice cooldownMinutes={COOLDOWN_MINUTES} busy={busy} error={error}
    onKeep={onClose} onClose={() => { void closeLife(); }} onBack={() => { setError(""); setStage({ kind: "report", signed: stage.signed }); }} />;
  if (stage.kind === "pack") return <MintPack walletPath={walletPath} practice={practice} initialPack={stage.pack} evidence={evidence} contract={contract} careerGroup={evidence.career_group} onChoose={slot => session.chooseMint(slot)} onClose={onClose} txHash={lastTxHash} />;
  if (evidence.stage_figures?.length) return <StageAlbum signed={stage.signed} contract={contract} practice={practice} walletPath={walletPath}
    onMint={(action, fee) => session.mintStages(stage.signed, action, fee)} onClose={onClose}
    onDecline={() => { setError(""); setStage({ kind: "declining", signed: stage.signed }); }} />;
  return <LifeReport
    walletPath={walletPath}
    report={lifeReport({ life: session.life, sources: evidence.sources, owners })}
    spanLine={lifeSpanLine(evidence)}
    feeText={formatNear(terms?.mint_fee ?? feeYocto)}
    menu={npcActionMenu(evidence.career_group)}
    selectedAction={selected}
    busy={busy}
    error={error}
    packMode
    cardCount={cardCount}
    sourceSharePercent={(terms?.source_share_bps ?? 5000) / 100}
    onSelectAction={setSelected}
    onMint={() => { void mint(stage.signed); }}
    onDecline={() => { setError(""); setStage({ kind: "declining", signed: stage.signed }); }}
    onCloseTooEarly={() => { void closeLife(); }}
  />;
}
