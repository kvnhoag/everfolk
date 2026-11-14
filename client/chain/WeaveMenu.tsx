import { useState } from "react";
import type { LifeState } from "../../src/types.ts";
import type { LifeView } from "../../chain/types.ts";
import MenuLifeCard from "../components/MenuLifeCard.tsx";
import AccountBar from "./AccountBar.tsx";
import { useActiveRankedLife } from "./ActiveLifeCard.tsx";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import SignInPanel, { EMAIL_UNAVAILABLE } from "./SignInPanel.tsx";

const unavailableEmailFlow = {
  async sendCode() { throw new Error(EMAIL_UNAVAILABLE); },
  async verify() { throw new Error(EMAIL_UNAVAILABLE); },
};

interface WeaveMenuProps {
  backend?: ChainBackend | null;
  life?: LifeState;
  onContinue?: () => void;
  onContinueWeave?(life: LifeView): Promise<void>;
}

function ConnectedWeave({ backend, life, onContinue, onContinueWeave }: WeaveMenuProps & { backend: ChainBackend }) {
  const current = useActiveRankedLife(backend);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const enterWeave = () => { window.location.hash = "#weave"; };
  const progress = current.active?.progress;
  const label = opening ? "Opening your life…" : life ? life.phase === "ended" ? "Review your life" : "Continue your life"
    : current.loading ? "Finding your Weave life…"
    : current.error ? "Find your Weave life"
    : progress?.pack ? "Open your mint pack"
    : progress?.status === "ended" ? "Review your Weave life"
    : "Continue your life";

  async function continueLife() {
    if (opening) return;
    if (life && onContinue) { onContinue(); return; }
    const active = current.active;
    if (!active || !onContinueWeave || backend.signin?.needsPlayKey || active.progress.status === "unavailable" || active.life.status === "minting") { enterWeave(); return; }
    if (active.progress.pack) { window.location.hash = `#pack/${active.life.life_id}`; return; }
    setOpening(true);
    setError("");
    try { await onContinueWeave(active.life); }
    catch (cause) { setError(errorText(cause, "Your Weave life could not be opened. Please try again.")); }
    finally { setOpening(false); }
  }

  return <>
    {life || current.active || current.loading
      ? <MenuLifeCard label={label} name={life?.character?.name ?? progress?.name ?? "A life in Alexandria"} age={life?.age ?? progress?.age} year={life?.year ?? progress?.year} disabled={opening || !life && current.loading} onContinue={() => { void continueLife(); }} />
      : current.error && <button className="ef-home-secondary" type="button" onClick={enterWeave}>Find your Weave life</button>}
    <section className="ef-home-weave-account" aria-label="Weave account details">
      <h2 className="ef-home-step">Account details</h2>
      <AccountBar backend={backend} />
      {!life && progress?.status === "unavailable" && <p className="ef-home-notice">Open this life on the device where you played it.</p>}
    </section>
    {current.error && !onContinue && <p className="ef-home-notice" role="alert">{current.error}</p>}
    {error && <p className="ef-home-notice" role="alert">{error}</p>}
  </>;
}

/** Sign-in stays in the menu so the player can review the account before entering a life. */
export function WeaveAccountDetails({ backend, life, onContinue, onContinueWeave }: WeaveMenuProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const live = backend?.mode === "live" ? backend : null;
  const signIn = live?.signin;

  async function connectWallet() {
    if (!live) return;
    setConnecting(true);
    setError("");
    try { await (signIn?.useWallet ?? live.connect)(); }
    catch (cause) { setError(errorText(cause, "The NEAR wallet could not connect.")); }
    finally { setConnecting(false); }
  }

  const notice = !live ? "Weave Mode sign-in is unavailable right now."
    : !signIn?.available.email ? "Email sign-in is unavailable on this server." : undefined;

  if (live?.accountId) return <ConnectedWeave key={live.accountId} backend={live} life={life} onContinue={onContinue} onContinueWeave={onContinueWeave} />;

  return <>
    {life && <MenuLifeCard label={life.phase === "ended" ? "Review your life" : "Continue your life"} name={life.character?.name ?? "Your character"} age={life.age} year={life.year} onContinue={onContinue} />}
    <section className="ef-home-weave-account" aria-label="Weave account details">
      <h2 className="ef-home-step">Account details</h2>
      <p className="ef-home-account-status">Not signed in</p>
      <button className="ef-home-auth-button" type="button" disabled={!live || connecting || emailOpen} onClick={() => { void connectWallet(); }}>
        {connecting ? "Connecting…" : "Connect with NEAR wallet"}
      </button>
      <div className="ef-home-auth-divider"><span>or</span></div>
      <button className="ef-home-auth-button ef-home-auth-email" type="button" disabled={connecting || emailOpen} onClick={() => { setError(""); setEmailOpen(true); }}>
        Log in with email
      </button>
      {notice && <p className="ef-home-notice" role="status">{notice}</p>}
      {error && <p className="ef-home-notice" role="alert">{error}</p>}
      {emailOpen && <dialog className="ef-home-email-dialog" aria-label="Email sign-in" data-tutorial="hide"
        ref={dialog => { if (dialog && !dialog.open) dialog.showModal(); }}
        onClose={() => setEmailOpen(false)}>
        <SignInPanel available={signIn?.available ?? { email: false }} onEmail={signIn?.emailFlow ?? unavailableEmailFlow}
          onSuccess={() => setEmailOpen(false)}
          onWallet={async () => {
            if (!live) throw new Error("Sign-in could not connect. Please try again.");
            await (signIn?.useWallet ?? live.connect)();
            setEmailOpen(false);
          }} onClose={() => setEmailOpen(false)} />
      </dialog>}
    </section>
  </>;
}
