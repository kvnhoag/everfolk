import { useEffect, useState } from "react";
import type { MintPack as Pack, MintResult, Evidence } from "../../chain/types.ts";
import type { CareerGroup } from "../../chain/ids.ts";
import { actionName, actionDescription, figureTitle, GROUP_TITLE, groupOfAction, rarityLabel } from "./chain-copy.ts";
import { errorText } from "./chain-backend.ts";
import { formatNear } from "./near-amount.ts";
import MintReveal from "./MintReveal.tsx";
import { mintRevealView } from "./life-report-model.ts";
import type { LivesContract } from "./types.ts";
import EverfolkCard from "./EverfolkCard.tsx";
import { audioManager } from "../lib/audio-manager.ts";
import "./mint-pack.css";

export interface MintPackProps {
  initialPack: Pack;
  evidence?: Evidence;
  practice?: boolean;
  /** Non-Weave preview only: flips cards to show "You could have gotten…" with no NFT minting. */
  freePlay?: boolean;
  walletPath?: boolean;
  contract: LivesContract;
  careerGroup?: CareerGroup;
  onChoose?(slot: number): Promise<MintResult>;
  onClose(): void;
  txHash?: string | null;
}

/** All outcomes and rerolls are contract values. Animation reveals confirmed cards individually. */
export default function MintPack({
  initialPack,
  evidence,
  walletPath = true,
  practice = false,
  freePlay = false,
  contract,
  careerGroup,
  onChoose,
  onClose,
  txHash,
}: MintPackProps) {
  const [pack, setPack] = useState(initialPack);
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);

  // PokemonSim-style card flip state: cards start face-down, revealed individually on click
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(
      () => {
        setOpened(true);
        setOpening(false);
        audioManager.playClickSound();
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650,
    );
    return () => clearTimeout(timer);
  }, [opening]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);
  const group = careerGroup ?? groupOfAction(pack?.cards?.find(c => c.kind === "npc")?.action_id ?? null) ?? "letters";

  const totalCards = pack?.cards?.length ?? 0;
  const cardNoun = totalCards === 1 ? "card" : "cards";
  const otherCards = totalCards - 1;
  const revealedCount = Object.values(flippedCards).filter(Boolean).length;
  const allRevealed = totalCards > 0 && revealedCount >= totalCards;

  function flipCard(slot: number) {
    setFlippedCards(prev => ({ ...prev, [slot]: true }));
    // Auto-select if nothing is selected yet
    if (!freePlay && selected === null) {
      setSelected(slot);
    }
  }

  function revealAllCards() {
    const revealed: Record<number, boolean> = {};
    (pack?.cards ?? []).forEach((_, idx) => {
      revealed[idx] = true;
    });
    setFlippedCards(revealed);
    audioManager.playClickSound();
    if (!freePlay && selected === null && (pack?.cards?.length ?? 0) > 0) {
      setSelected(0);
    }
  }

  async function reroll(slot: number) {
    setBusy(`reroll:${slot}`);
    setError("");
    try {
      const nextPack = await contract.rerollMintSlot(pack.life_id, slot, pack.reroll_fee);
      setPack(nextPack);
      // Ensure the newly rerolled card is flipped and visible
      setFlippedCards(prev => ({ ...prev, [slot]: true }));
      setSelected(slot);
    } catch (cause) {
      // Re-read once: a wallet can report a timeout after the paid reroll has already landed.
      const landed = await contract.mintPack(pack.life_id).catch(() => null);
      if (landed?.cards[slot]?.rerolled) {
        setPack(landed);
        setFlippedCards(prev => ({ ...prev, [slot]: true }));
        setSelected(slot);
      } else {
        setError(errorText(cause, "The reroll was not confirmed. Your existing card is safe; try again."));
      }
    } finally {
      setBusy(null);
    }
  }

  async function choose() {
    if (freePlay || selected === null) return;
    setBusy("mint");
    setError("");
    try {
      setResult(await (onChoose ? onChoose(selected) : contract.chooseMintSlot(pack.life_id, selected)));
    } catch (cause) {
      const life = await contract.getLife(pack.life_id).catch(() => null);
      const token =
        life?.status === "minted"
          ? (await contract.tokensOf(life.account_id).catch(() => [])).find(t => t.extra.life_id === pack.life_id)
          : null;
      if (token) {
        setResult({
          token_id: token.token_id,
          kind: token.extra.kind,
          figure_id: token.extra.figure_id,
          rarity: token.extra.rarity,
          affection: token.extra.affection,
        });
      } else {
        setError(errorText(cause, "The mint was not confirmed. Your pack is saved on NEAR; try again."));
      }
    } finally {
      setBusy(null);
    }
  }

  if (result) {
    return (
      <MintReveal
        practice={practice}
        view={mintRevealView(result, group, {
          evidence,
          evidenceUrl: practice ? null : `/api/ranked/evidence/${pack.evidence_hash}`,
          actionId: selected === null ? null : pack.cards[selected]?.action_id,
          txHash,
        })}
        affection={result.affection}
        onClose={onClose}
      />
    );
  }

  return (
    <section className={`chain-card mint-pack${opened ? " is-open" : ""}`} aria-labelledby="pack-title">
      <div className="mint-pack-header">
        <p className="chain-kicker">
          <span className="cr-index">№ {pack.life_id}</span>
          {freePlay
            ? "Free Play preview · no NFT minted"
            : practice
              ? "Practice pack · not recorded on NEAR"
              : "Booster pack recorded on NEAR"}
        </p>
        <h1 id="pack-title" tabIndex={-1}>
          {freePlay
            ? opened
              ? allRevealed
                ? "You could have gotten these cards"
                : "See what you could have gotten"
              : `You could have gotten ${totalCards} ${cardNoun}`
            : opened
              ? allRevealed
                ? "Choose who weaves forward"
                : "Reveal your fate"
              : `A life. ${totalCards} ${totalCards === 1 ? "possibility" : "possibilities"}.`}
        </h1>
        <p>
          {freePlay
            ? opened
              ? allRevealed
                ? `These ${totalCards} fate ${cardNoun} come from this life’s duration and titles. Only Weave Mode can mint cards to NFT.`
                : `Tap each card to see what you could have gotten (${revealedCount} of ${totalCards} revealed).`
              : `Break the seal to preview ${totalCards} ${cardNoun} based on this life’s age and titles. Play Weave Mode to mint NFTs.`
            : opened
              ? allRevealed
                ? totalCards === 1
                  ? "Fate revealed. Mint this card as your permanent Life NFT."
                  : `All fates revealed. Select one card to keep as your permanent Life NFT. The other ${otherCards === 1 ? "one returns" : `${otherCards} return`} to the story.`
                : `Tap each card to reveal what echoes forward (${revealedCount} of ${totalCards} revealed).`
              : `Your booster pack is ready. Break the seal to reveal ${totalCards === 1 ? "your fate card" : `your ${totalCards} fate cards`}.`}
        </p>
      </div>

      {!opened ? (
        <div className="booster-pack-stage">
          <button
            className={`booster-pack${opening ? " is-opening" : ""}`}
            type="button"
            disabled={opening}
            onClick={() => setOpening(true)}
            aria-label="Open your booster pack"
          >
            <span className="booster-seal" aria-hidden="true">
              ✦
            </span>
            <strong>EVERFOLK</strong>
            <span>{freePlay ? "Free Play preview" : "Weaving fates"}</span>
            <small>{opening ? "Breaking the golden seal…" : "Open your pack →"}</small>
          </button>
          <p className="chain-fine">
            {totalCards} {cardNoun} {totalCards === 1 ? "is" : "are"} sealed within. Each echoes a chapter and deed.
          </p>
        </div>
      ) : (
        <>
          {/* Card Reveal Status Banner */}
          <div className="mint-pack-reveal-bar" role="status">
            <span className="mint-pack-reveal-counter">
              <span className="cr-index">{revealedCount}/{totalCards}</span>
              {allRevealed
                ? freePlay
                  ? "All preview cards revealed · Weave Mode required to mint NFTs"
                  : `All cards revealed · Slot ${selected !== null ? selected + 1 : "—"} selected`
                : "Click each card to flip and reveal its deed"}
            </span>
            {!allRevealed && (
              <button
                type="button"
                className="chain-link mint-pack-quick-reveal"
                onClick={revealAllCards}
              >
                Reveal all cards ↗
              </button>
            )}
          </div>

          {/* Cards Grid: Each card is individually clickable to flip */}
          <div
            className="augment-cards ef-booster-cards-grid"
            role="group"
            aria-label="Booster pack fate cards. Click each card to reveal it."
          >
            {(pack?.cards ?? []).map((card, slot) => {
              const isFlipped = Boolean(flippedCards[slot]);
              const isSelected = selected === slot;
              const cardTitle = card.figure_id
                ? figureTitle(card.figure_id)
                : card.stage_title && card.character_name
                  ? `${card.character_name} · ${card.stage_title}`
                  : GROUP_TITLE[group];

              const cardSubtitle =
                card.kind === "figure"
                  ? "Historical figure"
                  : card.stage_id
                    ? `Stage portrait · ${card.stage_title ?? card.stage_id}`
                    : "Person of the city";

              return (
                <article
                  key={slot}
                  className={`augment-slot${isSelected ? " is-selected" : ""}`}
                  style={{ animationDelay: `${slot * 120}ms` }}
                >
                  <EverfolkCard
                    isFaceDown={!isFlipped}
                    onFlip={() => flipCard(slot)}
                    onClick={() => {
                      if (!freePlay) setSelected(slot);
                    }}
                    selected={!freePlay && isSelected}
                    slotNumber={slot + 1}
                    title={cardTitle}
                    subtitle={cardSubtitle}
                    isFigure={card.kind === "figure"}
                    figureId={card.figure_id}
                    portraitMedia={card.portrait_media}
                    pixelSeed={`${pack.evidence_hash}:${slot}:${card.rerolled}`}
                    rarity={card.rarity}
                    rarityLabel={rarityLabel(card.rarity)}
                    actionName={actionName(card.action_id)}
                    actionDescription={actionDescription(card.action_id)}
                    affection={card.affection}
                    actions={
                      !freePlay && isFlipped ? (
                        <div className="ef-booster-card-controls">
                          <button
                            type="button"
                            className={`augment-choice-btn ${isSelected ? "is-selected" : ""}`}
                            disabled={Boolean(busy)}
                            aria-pressed={isSelected}
                            onClick={() => setSelected(slot)}
                          >
                            {isSelected ? "Selected ✓" : "Choose this card"}
                          </button>
                          <button
                            className="chain-secondary augment-reroll"
                            type="button"
                            disabled={Boolean(busy) || card.rerolled}
                            onClick={() => {
                              void reroll(slot);
                            }}
                          >
                            {busy === `reroll:${slot}`
                              ? walletPath
                                ? "Confirm in wallet…"
                                : "Confirming…"
                              : card.rerolled
                                ? "Reroll used"
                                : `↻ Reroll · ${formatNear(pack.reroll_fee)} NEAR`}
                          </button>
                        </div>
                      ) : undefined
                    }
                  />
                </article>
              );
            })}
          </div>

          <p className="chain-fine">
            {freePlay
              ? "Click any face-down card to reveal what you could have gotten. Only Weave Mode can mint cards to NFT."
              : `Click any face-down card to reveal its identity and deed. One optional reroll per slot.${
                  practice
                    ? " Practice rerolls update this local ledger; no NEAR is spent."
                    : " Every paid reroll is saved on NEAR and added to your total mint fee."
                }`}
          </p>
        </>
      )}

      {!freePlay && (
        <div className="pack-receipt">
          <strong>Total paid: {formatNear(pack.total_fee)} NEAR</strong>
          <span>
            {pack.source_share_bps / 100}% to source lives by impact; remainder to the protocol treasury. If no
            sources shaped this life, the treasury receives the fee. Fees are split when you mint or close this
            life. {walletPath && "Network gas is separate."}
          </span>
        </div>
      )}

      {busy && (
        <p role="status" className="chain-notice">
          {!walletPath
            ? "Confirming…"
            : busy === "mint"
              ? "Confirm your chosen card in your wallet. Waiting for NEAR…"
              : "Confirm the reroll payment in your wallet. Waiting for NEAR…"}
        </p>
      )}

      {error && (
        <p className="chain-error" role="alert">
          {error}
        </p>
      )}

      <div className="chain-actions">
        {freePlay ? (
          <>
            <a className="chain-primary" href="#weave" onClick={onClose}>
              Play Weave Mode to get real NFTs <span aria-hidden="true">→</span>
            </a>
            <button className="chain-secondary" type="button" disabled={Boolean(busy)} onClick={onClose}>
              Close preview
            </button>
          </>
        ) : (
          <>
            {opened && (
              <button
                className="chain-primary"
                type="button"
                disabled={Boolean(busy) || selected === null || !flippedCards[selected]}
                onClick={() => {
                  void choose();
                }}
              >
                {busy === "mint"
                  ? "Minting…"
                  : selected === null || !flippedCards[selected]
                    ? "Select a revealed card above"
                    : `Mint selected card · Slot ${selected + 1}`}
                <span aria-hidden="true">→</span>
              </button>
            )}
            <button className="chain-secondary" type="button" disabled={Boolean(busy)} onClick={onClose}>
              Save pack & leave
            </button>
          </>
        )}
      </div>

      <p className="chain-fine">
        {freePlay
          ? "Free Play never mints on NEAR. Start a ranked life in Weave Mode to collect and trade real NFTs."
          : practice
            ? "This practice pack lasts while this page stays open. No NEAR is spent."
            : `Your pack is saved on NEAR. Return from My lives at any time. ${walletPath ? "Final selection asks for wallet approval with 1 yoctoNEAR, plus network gas." : "You’ll confirm your choice first."}`}
      </p>

      {!practice && !freePlay && (
        <details className="pack-proof">
          <summary>Verify this pack</summary>
          <p>
            Life #{pack.life_id} · Signed evidence hash <code>{pack.evidence_hash}</code>
          </p>
          <p>
            Opening, each reroll, and final selection have separate NEAR transactions. The contract stores the
            outcomes and enforces the one-reroll limit. Check their receipts from Account details.
          </p>
          <a href={`/api/ranked/evidence/${pack.evidence_hash}`} target="_blank" rel="noreferrer">
            View the verified life & choices
          </a>
        </details>
      )}
    </section>
  );
}
