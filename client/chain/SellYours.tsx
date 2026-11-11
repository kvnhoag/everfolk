import { useId, useState } from "react";
import { formatNear, parseNearInput } from "./near-amount.ts";
import { previewForInput } from "./payout-preview.ts";
import type { MarketTerms } from "./types.ts";

export const PRICE_PLACEHOLDER = "0.025";

export interface SellItem {
  tokenId: string;
  title: string;
  href: string;
  /** Set when the NFT is already offered, e.g. "0.025 NEAR". */
  listedPriceText: string | null;
  /** Whether earlier lives stand behind this NFT. */
  hasSources: boolean;
}

export interface SellYoursProps {
  items: readonly SellItem[];
  terms: MarketTerms;
  busy: boolean;
  onList(tokenId: string, priceYocto: string): void;
  onUnlist(tokenId: string): void;
  /** Starting price text per token id (for tests and restored forms). */
  initialPrices?: Readonly<Record<string, string>>;
}

type RowProps = Omit<SellYoursProps, "items" | "initialPrices"> & { item: SellItem; initialPrice: string };

/** The "You receive … · Earlier lives receive … · Treasury …" line for a typed price. */
export function PayoutLine({ text, terms, hasSources }: { text: string; terms: MarketTerms; hasSources: boolean }) {
  const preview = previewForInput(text, terms, hasSources);
  if (!preview) return null;
  return <p className="chain-fine sell-preview" role="status">
    You receive {formatNear(preview.sellerYocto)} NEAR · Earlier lives receive {formatNear(preview.sourcesYocto)} · Treasury {formatNear(preview.treasuryYocto)}
  </p>;
}

function SellRow({ item, terms, busy, onList, onUnlist, initialPrice }: RowProps) {
  const priceId = useId();
  const [price, setPrice] = useState(initialPrice);
  const [error, setError] = useState("");
  function submit() {
    const parsed = parseNearInput(price);
    if (!parsed.ok) { setError(parsed.error); return; }
    setError("");
    onList(item.tokenId, parsed.yocto);
  }
  return <li className="sell-row">
    <h2><a href={item.href}>{item.title}</a></h2>
    {item.listedPriceText !== null
      ? <div className="chain-actions">
          <span>For sale at <strong>{item.listedPriceText}</strong></span>
          <button className="chain-secondary" type="button" disabled={busy} onClick={() => onUnlist(item.tokenId)}>Take off the market</button>
        </div>
      : <form className="token-sale" onSubmit={event => { event.preventDefault(); submit(); }}>
          <label className="chain-field" htmlFor={priceId}>Price in NEAR
            <input id={priceId} inputMode="decimal" autoComplete="off" placeholder={PRICE_PLACEHOLDER} value={price} disabled={busy}
              onChange={event => setPrice(event.target.value)} aria-invalid={error ? true : undefined} />
          </label>
          {error && <p className="chain-error" role="alert">{error}</p>}
          <PayoutLine text={price} terms={terms} hasSources={item.hasSources} />
          <div className="chain-actions"><button className="chain-secondary" type="submit" disabled={busy}>Put it up for sale</button></div>
        </form>}
  </li>;
}

/** The player's own kept lives, each with a sale form and a preview of how a sale would split. */
export default function SellYours({ items, initialPrices = {}, ...rest }: SellYoursProps) {
  if (items.length === 0) return <p className="market-empty">You do not keep any lives yet.</p>;
  return <ul className="sell-yours">{items.map(item => <SellRow key={item.tokenId} item={item} initialPrice={initialPrices[item.tokenId] ?? ""} {...rest} />)}</ul>;
}
