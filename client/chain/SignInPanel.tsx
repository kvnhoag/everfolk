import { useId, useState, type FormEvent } from "react";
import EmailSignIn from "../demo/EmailSignIn.tsx";
import "./sign-in.css";

/**
 * One sign-in panel for every method: email first (a code, then the account is set up for the player), and a
 * NEAR wallet for players who have one. The email steps never mention wallets, keys or fees.
 */

export interface EmailSignInFlow {
  sendCode(email: string): Promise<void>;
  /** Verifies the code, sets up the account and signs in. */
  verify(code: string): Promise<void>;
}

export interface SignInPanelProps {
  available: { email: boolean };
  onEmail: EmailSignInFlow;
  onWallet(): Promise<void>;
  onClose(): void;
}

type Step = { kind: "email" } | { kind: "code"; email: string } | { kind: "setup"; email: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const CODE_PATTERN = /^\d{6}$/;
const BAD_EMAIL = "Enter a valid email address.";
const BAD_CODE = "Enter the 6-digit code from your email.";

const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export function validEmail(value: string): string | null {
  const email = value.trim();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email) ? email : null;
}

export function validCode(value: string): string | null {
  const code = value.replace(/\s/g, "");
  return CODE_PATTERN.test(code) ? code : null;
}

function submitted(event: FormEvent<HTMLFormElement>, field: string): string {
  event.preventDefault();
  const value = new FormData(event.currentTarget).get(field);
  return typeof value === "string" ? value : "";
}

export function EmailStep({ busy, onSubmit }: { busy: boolean; onSubmit(email: string): void }) {
  const id = useId();
  return <form className="sign-in-step" onSubmit={event => onSubmit(submitted(event, "email"))}>
    <label htmlFor={id}>Email</label>
    <input id={id} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={MAX_EMAIL_LENGTH} placeholder="you@example.com" disabled={busy} />
    <button className="chain-primary" type="submit" disabled={busy}>{busy ? "Sending your code…" : "Continue with email"}<span aria-hidden="true">→</span></button>
    <p className="chain-fine">We'll email you a 6-digit code. Your Everfolk account is ready in a moment, with nothing to install.</p>
  </form>;
}

export function CodeStep({ email, busy, onSubmit, onBack }: { email: string; busy: boolean; onSubmit(code: string): void; onBack(): void }) {
  const id = useId();
  return <form className="sign-in-step" onSubmit={event => onSubmit(submitted(event, "code"))}>
    <label htmlFor={id}>Enter the code we sent to <strong>{email}</strong></label>
    <input id={id} name="code" type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9 ]*" required maxLength={7} placeholder="123456" disabled={busy} />
    <button className="chain-primary" type="submit" disabled={busy}>Sign in<span aria-hidden="true">→</span></button>
    <button className="account-link" type="button" disabled={busy} onClick={onBack}>Use a different email</button>
  </form>;
}

export function SettingUpStep() {
  return <div className="sign-in-step" role="status" aria-live="polite">
    <p className="sign-in-setup"><span className="sign-in-spinner" aria-hidden="true" />Setting up your account…</p>
    <p className="chain-fine">This takes a few seconds the first time.</p>
  </div>;
}

export default function SignInPanel({ available, onEmail, onWallet, onClose }: SignInPanelProps) {
  const headingId = useId();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function attempt(action: () => Promise<void>, fallback: string, onFail?: () => void) {
    setBusy(true);
    setError("");
    try { await action(); } catch (cause) { setError(messageOf(cause, fallback)); onFail?.(); } finally { setBusy(false); }
  }

  const sendCode = (value: string) => {
    const email = validEmail(value);
    if (!email) { setError(BAD_EMAIL); return; }
    void attempt(async () => { await onEmail.sendCode(email); setStep({ kind: "code", email }); }, "We couldn't send a code. Try again.");
  };

  const verify = (email: string, value: string) => {
    const code = validCode(value);
    if (!code) { setError(BAD_CODE); return; }
    setStep({ kind: "setup", email });
    void attempt(async () => { await onEmail.verify(code); onClose(); }, "Sign-in didn't finish. Try again.", () => setStep({ kind: "code", email }));
  };

  const emailBody = !available.email ? <EmailSignIn />
    : step.kind === "email" ? <EmailStep busy={busy} onSubmit={sendCode} />
    : step.kind === "code" ? <CodeStep email={step.email} busy={busy} onSubmit={code => verify(step.email, code)} onBack={() => { setError(""); setStep({ kind: "email" }); }} />
    : <SettingUpStep />;

  return <section className="sign-in-panel" aria-labelledby={headingId}>
    <div className="sign-in-head">
      <h2 id={headingId}>Sign in</h2>
      <button className="sign-in-close" type="button" aria-label="Close sign-in" disabled={busy && step.kind === "setup"} onClick={onClose}>×</button>
    </div>
    <div className="sign-in-email">{emailBody}</div>
    {error && <p className="chain-error" role="alert">{error}</p>}
    {step.kind === "email" && <div className="sign-in-other">
      <span className="sign-in-or">or</span>
      <button className="chain-secondary" type="button" disabled={busy} onClick={() => { void attempt(async () => { await onWallet(); onClose(); }, "The NEAR wallet could not connect."); }}>Use a NEAR wallet<span aria-hidden="true">→</span></button>
    </div>}
  </section>;
}
