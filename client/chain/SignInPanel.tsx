import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { EMAIL_RESEND_DELAY_MS, resendDelaySeconds, validEmail, validCode } from "../models/email-sign-in.ts";
export { validEmail, validCode } from "../models/email-sign-in.ts";
import { WrongCodeError } from "./sign-in-errors.ts";
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
  onSuccess?(): void;
}

export type Step = { kind: "email" } | { kind: "code"; email: string } | { kind: "setup"; email: string };

const MAX_EMAIL_LENGTH = 254;
const BAD_EMAIL = "Enter a valid email address.";
const BAD_CODE = "Enter the 6-digit code from your email.";
export const EMAIL_UNAVAILABLE = "Email sign-in is not available yet. Please try again later.";

const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** A wrong code may be typed again; any other failure (setup refused, sign-in lost) starts over from the email. */
export function stepAfterVerifyError(cause: unknown, email: string): Step {
  return cause instanceof WrongCodeError ? { kind: "code", email } : { kind: "email" };
}

function submitted(event: FormEvent<HTMLFormElement>, field: string): string {
  event.preventDefault();
  const value = new FormData(event.currentTarget).get(field);
  return typeof value === "string" ? value : "";
}

export function EmailStep({ busy, enabled = true, onSubmit }: { busy: boolean; enabled?: boolean; onSubmit(email: string): void }) {
  const id = useId();
  return <form className="sign-in-step" onSubmit={event => onSubmit(submitted(event, "email"))}>
    <label htmlFor={id}>Email</label>
    <input id={id} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={MAX_EMAIL_LENGTH} placeholder="you@example.com" disabled={busy} autoFocus />
    <button className="chain-primary" type="submit" disabled={busy || !enabled}>{busy ? "Sending your code…" : "Continue with email"}<span aria-hidden="true">→</span></button>
    <p className="chain-fine">We'll email you a 6-digit code. Your Everfolk account is ready in a moment, with nothing to install.</p>
  </form>;
}

export function CodeStep({ email, busy, onSubmit, onBack, onResend, resendSeconds = 0 }: { email: string; busy: boolean; onSubmit(code: string): void; onBack(): void; onResend?(): void; resendSeconds?: number }) {
  const id = useId();
  return <form className="sign-in-step" onSubmit={event => onSubmit(submitted(event, "code"))}>
    <label htmlFor={id}>Enter the code we sent to <strong>{email}</strong></label>
    <input id={id} name="code" type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9 ]*" required maxLength={7} placeholder="123456" disabled={busy} autoFocus />
    <button className="chain-primary" type="submit" disabled={busy}>Sign in<span aria-hidden="true">→</span></button>
    {onResend && <button className="account-link" type="button" disabled={busy || resendSeconds > 0} onClick={onResend}>{resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}</button>}
    <button className="account-link" type="button" disabled={busy} onClick={onBack}>Use a different email</button>
  </form>;
}

export function SettingUpStep() {
  return <div className="sign-in-step" role="status" aria-live="polite">
    <p className="sign-in-setup"><span className="sign-in-spinner" aria-hidden="true" />Setting up your account…</p>
    <p className="chain-fine">This takes a few seconds the first time.</p>
  </div>;
}

export default function SignInPanel({ available, onEmail, onWallet, onClose, onSuccess }: SignInPanelProps) {
  const headingId = useId();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const inFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (step.kind !== "code" || !retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step.kind, retryAt]);

  async function attempt(action: () => Promise<void>, fallback: string, onFail?: (cause: unknown) => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try { await action(); }
    catch (cause) { if (active.current) { setError(messageOf(cause, fallback)); onFail?.(cause); } }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }

  const sendCode = (value: string) => {
    if (!available.email) { setError(EMAIL_UNAVAILABLE); return; }
    const email = validEmail(value);
    if (!email) { setError(BAD_EMAIL); return; }
    void attempt(async () => {
      await onEmail.sendCode(email);
      if (!active.current) return;
      const sentAt = Date.now(); setNow(sentAt); setRetryAt(sentAt + EMAIL_RESEND_DELAY_MS);
      setStep({ kind: "code", email });
      setStatus("Your code is on its way. Check your inbox and spam folder.");
    }, "We couldn't send a code. Try again.");
  };

  const resend = (email: string) => {
    if (!available.email || inFlight.current || resendDelaySeconds(retryAt, Date.now()) > 0) return;
    void attempt(async () => {
      await onEmail.sendCode(email);
      if (!active.current) return;
      const sentAt = Date.now(); setNow(sentAt); setRetryAt(sentAt + EMAIL_RESEND_DELAY_MS);
      setStatus("A new code is on its way. Use the most recent email.");
    }, "We couldn't resend your code. Please try again.");
  };

  const verify = (email: string, value: string) => {
    if (!available.email || inFlight.current) return;
    const code = validCode(value);
    if (!code) { setError(BAD_CODE); return; }
    setStep({ kind: "setup", email });
    void attempt(async () => { await onEmail.verify(code); if (active.current) (onSuccess ?? onClose)(); }, "Sign-in didn't finish. Try again.", cause => setStep(stepAfterVerifyError(cause, email)));
  };

  const emailBody = step.kind === "email" ? <EmailStep busy={busy} enabled={available.email} onSubmit={sendCode} />
    : step.kind === "code" ? <CodeStep email={step.email} busy={busy} resendSeconds={resendDelaySeconds(retryAt, now)} onResend={() => resend(step.email)} onSubmit={code => verify(step.email, code)} onBack={() => { setError(""); setStatus(""); setStep({ kind: "email" }); }} />
    : <SettingUpStep />;

  return <section className="sign-in-panel" aria-labelledby={headingId}>
    <div className="sign-in-head">
      <h2 id={headingId}>Sign in</h2>
      <button className="sign-in-close" type="button" aria-label="Close sign-in" disabled={busy && step.kind === "setup"} onClick={onClose}>×</button>
    </div>
    <div className="sign-in-email">{emailBody}</div>
    <div className="sign-in-feedback" aria-live="polite" aria-atomic="true">
      {error ? <p className="chain-error" role="alert">{error}</p> : <p role="status">{!available.email ? EMAIL_UNAVAILABLE : status}</p>}
    </div>
    {step.kind === "email" && <div className="sign-in-other">
      <span className="sign-in-or">or</span>
      <button className="chain-secondary" type="button" disabled={busy} onClick={() => { void attempt(async () => { await onWallet(); onClose(); }, "The NEAR wallet could not connect."); }}>Use a NEAR wallet<span aria-hidden="true">→</span></button>
    </div>}
  </section>;
}
