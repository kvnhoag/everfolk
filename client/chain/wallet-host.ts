import { TUTORIAL_LAYER_CLASS } from "../models/tutorial-placement.ts";

/** Class NEAR Connect (`@hot-labs/near-connect`) gives every popup root it appends to `<body>`. */
export const WALLET_POPUP_CLASS = "hot-connector-popup";
/** Class of the dialog that hosts NEAR Connect popups above the ranked screen. */
export const WALLET_HOST_CLASS = "everfolk-wallet-host";
/** Class of the in-game spend sheet an email player confirms NFT payments on; it must also stay on top. */
export const SPEND_SHEET_CLASS = "everfolk-spend-sheet";
const HOST_CLASS = WALLET_HOST_CLASS;
const HOST_STYLE = "position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:visible;";
const BACKDROP_RULE = `dialog.${HOST_CLASS}::backdrop{background:transparent}`;

interface PopupLike { classList?: { contains(name: string): boolean }; style?: { display?: string } }
interface HostLike {
  readonly open: boolean;
  readonly children: ArrayLike<unknown>;
  showModal(): void;
  close(): void;
  appendChild(node: never): unknown;
}

/**
 * The ranked screens are a modal `<dialog>`: it sits in the browser's top layer and makes the rest of the page
 * inert. NEAR Connect mounts its wallet picker and wallet iframes on `<body>`, where they would open hidden and
 * unclickable. Each popup is moved once, as soon as it appears, into a page-lifetime host `<dialog>` that is shown
 * as the topmost modal while any popup is visible. Popups are never moved again: moving an iframe reloads it.
 */
export function isWalletPopup(node: unknown): boolean {
  const popup = node as PopupLike | null;
  return Boolean(popup?.classList?.contains(WALLET_POPUP_CLASS));
}

function isShown(node: unknown): boolean {
  return isWalletPopup(node) && (node as PopupLike).style?.display !== "none";
}

export function isWalletHost(node: unknown): boolean {
  const host = node as PopupLike | null;
  return Boolean(host?.classList?.contains(WALLET_HOST_CLASS));
}

/** The guided tour's own top-layer dialog; it explains the screen beneath it, so it stays on top. */
export function isTutorialLayer(node: unknown): boolean {
  const layer = node as PopupLike | null;
  return Boolean(layer?.classList?.contains(TUTORIAL_LAYER_CLASS));
}

export function isSpendSheet(node: unknown): boolean {
  const sheet = node as PopupLike | null;
  return Boolean(sheet?.classList?.contains(SPEND_SHEET_CLASS));
}

/**
 * For the ranked screen's raise observer: true when a dialog other than `self` opened, so the ranked screen
 * should lift itself back on top. The wallet host, the spend sheet and the guided tour are exempt: they must stay above it.
 */
export function anotherDialogOpened(records: ArrayLike<{ target: unknown }>, self: unknown): boolean {
  return Array.from(records).some(({ target }) => target !== self && !isWalletHost(target) && !isSpendSheet(target) && !isTutorialLayer(target) && Boolean((target as { open?: boolean } | null)?.open));
}

/** Moves the wallet popups among `nodes` into `host`; other nodes stay where they are. */
export function adoptPopups(host: HostLike, nodes: ArrayLike<unknown>): void {
  for (const node of Array.from(nodes)) if (isWalletPopup(node)) host.appendChild(node as never);
}

/** Opens the host above every other dialog while a popup in it is shown; closes it once none is. */
export function syncHost(host: HostLike): void {
  const shown = Array.from(host.children).some(isShown);
  try {
    if (shown && !host.open) host.showModal();
    else if (!shown && host.open) host.close();
  } catch (error) {
    console.warn("Everfolk: the wallet window could not be shown.", error);
  }
}

function createHost(doc: Document): HTMLDialogElement {
  const style = doc.createElement("style");
  style.textContent = BACKDROP_RULE;
  doc.head.appendChild(style);
  const host = doc.createElement("dialog");
  host.className = HOST_CLASS;
  host.style.cssText = HOST_STYLE;
  host.setAttribute("aria-label", "Wallet");
  // Escape is the popup's own business (it rejects and closes itself); the host just follows.
  host.addEventListener("cancel", event => event.preventDefault());
  doc.body.appendChild(host);
  return host;
}

/** Installs the host once per document. Browser only. */
export function installWalletHost(doc: Document = document): HTMLDialogElement {
  const existing = doc.querySelector<HTMLDialogElement>(`dialog.${HOST_CLASS}`);
  if (existing) return existing;
  const host = createHost(doc);
  adoptPopups(host, doc.body.children);
  new MutationObserver(records => {
    for (const record of records) adoptPopups(host, record.addedNodes);
  }).observe(doc.body, { childList: true });
  new MutationObserver(() => syncHost(host)).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
  syncHost(host);
  return host;
}
