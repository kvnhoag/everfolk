import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createSpendQueue, type SpendQueue, type SpendText } from "./spend-confirmation.ts";
import type { ContractCall } from "./types.ts";
import { SPEND_SHEET_CLASS } from "./wallet-host.ts";
import "./sign-in.css";

/**
 * The in-game spend sheet: the one place an email player sees a NEAR price, and only before an NFT action that
 * spends NEAR. A modal `<dialog>` opened after the ranked screen, so it sits above it; the ranked screen's raise
 * observer exempts it by class.
 */

export function SpendSheet({ text, onConfirm, onCancel }: { text: SpendText; onConfirm(): void; onCancel(): void }) {
  const titleId = useId();
  return <div className="spend-sheet-body" aria-labelledby={titleId}>
    <p className="chain-kicker">Before you continue</p>
    <h2 id={titleId}>{text.title}</h2>
    <p className="spend-sheet-price"><strong>{text.price}</strong></p>
    <p className="chain-fine">{text.note ?? "Testnet NEAR from your Everfolk account. Nothing is spent until you confirm."}</p>
    <div className="chain-actions">
      <button className="chain-secondary" type="button" onClick={onCancel}>Cancel</button>
      <button className="chain-primary" type="button" onClick={onConfirm} autoFocus>Confirm<span aria-hidden="true">→</span></button>
    </div>
  </div>;
}

/** Shows the queue's current question; Escape and the backdrop-free Cancel both answer "no". */
export function ConfirmSpend({ queue }: { queue: SpendQueue }) {
  const request = useSyncExternalStore(queue.subscribe, queue.current, () => null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    try {
      if (request && !node.open) node.showModal();
      if (!request && node.open) node.close();
    } catch (error) {
      console.warn("Everfolk: the spend sheet could not open.", error);
      request?.answer(false);
    }
  }, [request]);

  return <dialog ref={dialog} className={`${SPEND_SHEET_CLASS} spend-sheet`} aria-label="Confirm payment"
    onCancel={event => { event.preventDefault(); request?.answer(false); }}>
    {request && <SpendSheet text={request.text} onConfirm={() => request.answer(true)} onCancel={() => request.answer(false)} />}
  </dialog>;
}

let mounted: SpendQueue | null = null;

export function cancelSpendConfirmations(): void { mounted?.cancelAll(); }

/** Mounts the sheet once per page (browser only) and returns the `confirm` an email session asks. */
export function mountConfirmSpend(doc: Document = document): (call: ContractCall) => Promise<boolean> {
  if (!mounted) {
    const queue = createSpendQueue();
    const host = doc.createElement("div");
    host.className = "everfolk-spend-root";
    doc.body.appendChild(host);
    createRoot(host).render(<ConfirmSpend queue={queue} />);
    mounted = queue;
  }
  const queue = mounted;
  return call => queue.request(call);
}
