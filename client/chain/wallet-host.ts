/** Element id the wallet-selector modal mounts into (`@near-wallet-selector/modal-ui`). */
export const WALLET_MODAL_ID = "near-wallet-selector-modal";

type Host = Pick<Document, "body" | "getElementById" | "querySelector" | "querySelectorAll">;

/**
 * The ranked screens are a modal `<dialog>`: it sits in the browser's top layer and makes the rest of the page
 * inert. The wallet picker mounts on `<body>`, so it would open hidden and unclickable behind it. While the picker
 * is open, move it inside the open modal dialog; the returned function puts it back.
 */
export function hostInTopLayer(doc: Host = document): () => void {
  const picker = doc.getElementById(WALLET_MODAL_ID);
  // Several dialogs can be open (the game keeps its own behind); the ranked screen re-opens itself on top.
  const open = Array.from(doc.querySelectorAll("dialog[open]"));
  const dialog = doc.querySelector("dialog.chain-screen[open]") ?? open[open.length - 1] ?? null;
  if (!picker || !dialog || picker.parentElement === dialog) return () => {};
  const home = picker.parentElement ?? doc.body;
  dialog.appendChild(picker);
  return () => { if (picker.parentElement === dialog) home.appendChild(picker); };
}
