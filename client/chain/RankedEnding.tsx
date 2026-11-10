import { useEffect, useState } from "react";
import type { LifeView, MintResult } from "../../chain/types.ts";
import type { OwnersByToken } from "./born-into-model.ts";
import { errorText } from "./chain-backend.ts";
import LifeReport from "./LifeReport.tsx";
import { lifeReport, lifeSpanLine, mintRevealView, npcActionMenu } from "./life-report-model.ts";
import MintReveal from "./MintReveal.tsx";
import DeclineChoice from "./DeclineChoice.tsx";
import { DEFAULT_MINT_FEE_YOCTO, formatNear } from "./near-amount.ts";
import type { LivesContract, SignedEvidence } from "./types.ts";

/** The part of the ranked session (Task 17) the ending needs. `RankedSession` satisfies it structurally. */
export interface RankedEndingSession {
  life: LifeView;
  finish(): Promise<SignedEvidence>;
  mint(signed: SignedEvidence, npcActionId: string): Promise<MintResult>;
  abandon(): Promise<void>;
}

export interface RankedEndingProps {
  session: RankedEndingSession;
  contract: LivesContract;
  feeYocto?: string;
  onClose(): void;
}

type Stage = { kind: "verifying" } | { kind: "failed"; error: string } | { kind: "report"; signed: SignedEvidence } | { kind: "declining"; signed: SignedEvidence } | { kind: "revealed"; result: MintResult; signed: SignedEvidence };

/** Matches the contract's default `abandon_cooldown_ms`. */
const COOLDOWN_MINUTES = 10;

async function ownersOf(contract: LivesContract, tokenIds: readonly string[]): Promise<OwnersByToken> {
  const entries = await Promise.all(tokenIds.map(async id => [id, (await contract.token(id).catch(() => null))?.owner_id] as const));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
}

/** A ranked life's end: verify the save, show who shaped it, offer the mint, reveal the result. */
export default function RankedEnding({ session, contract, feeYocto = DEFAULT_MINT_FEE_YOCTO, onClose }: RankedEndingProps) {
  const [stage, setStage] = useState<Stage>({ kind: "verifying" });
  const [attempt, setAttempt] = useState(0);
  const [owners, setOwners] = useState<OwnersByToken>({});
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void session.finish().then(async signed => {
      const found = await ownersOf(contract, signed.evidence.sources.map(source => source.token_id));
      if (cancelled) return;
      setOwners(found);
      setSelected(npcActionMenu(signed.evidence.career_group)[0]?.id ?? "");
      setStage({ kind: "report", signed });
    }).catch(cause => { if (!cancelled) setStage({ kind: "failed", error: errorText(cause, "Your life could not be checked.") }); });
    return () => { cancelled = true; };
  }, [session, contract, attempt]);

  async function mint(signed: SignedEvidence) {
    setBusy(true);
    setError("");
    try { setStage({ kind: "revealed", result: await session.mint(signed, selected), signed }); }
    catch (cause) { setError(errorText(cause, "The mint did not go through. Please try again.")); }
    finally { setBusy(false); }
  }

  async function closeLife() {
    setBusy(true);
    setError("");
    try { await session.abandon(); onClose(); }
    catch (cause) { setError(errorText(cause, "This life could not be closed. Please try again.")); }
    finally { setBusy(false); }
  }

  if (stage.kind === "verifying") return <p className="chain-loading" role="status">Checking your life against its record…</p>;
  if (stage.kind === "failed") return <section className="chain-card">
    <h1 tabIndex={-1}>We couldn't check this life</h1>
    <p className="chain-error" role="alert">{stage.error}</p>
    <div className="chain-actions"><button className="chain-primary" type="button" onClick={() => { setStage({ kind: "verifying" }); setAttempt(value => value + 1); }}>Try again<span aria-hidden="true">→</span></button><button className="chain-secondary" type="button" onClick={onClose}>Back to Everfolk</button></div>
  </section>;
  const evidence = stage.signed.evidence;
  if (stage.kind === "declining") return <DeclineChoice cooldownMinutes={COOLDOWN_MINUTES} busy={busy} error={error}
    onKeep={onClose} onClose={() => { void closeLife(); }} onBack={() => { setError(""); setStage({ kind: "report", signed: stage.signed }); }} />;
  if (stage.kind === "revealed") return <MintReveal view={mintRevealView(stage.result, evidence.career_group)} affection={stage.result.affection} onClose={onClose} />;
  return <LifeReport
    report={lifeReport({ life: session.life, sources: evidence.sources, owners })}
    spanLine={lifeSpanLine(evidence)}
    feeText={formatNear(feeYocto)}
    menu={npcActionMenu(evidence.career_group)}
    selectedAction={selected}
    busy={busy}
    error={error}
    onSelectAction={setSelected}
    onMint={() => { void mint(stage.signed); }}
    onDecline={() => { setError(""); setStage({ kind: "declining", signed: stage.signed }); }}
  />;
}
