import { useState } from "react";

import { EMAIL_SIGN_IN_NOTE } from "./labels.ts";

export { EMAIL_SIGN_IN_NOTE };

/** "open" when email sign-in is set up (the server has a Privy App ID) and a panel can open; otherwise the note. */
export function emailButtonAction(available: boolean, onOpen: (() => void) | undefined): "open" | "note" {
  return available && onOpen ? "open" : "note";
}

export interface EmailSignInProps {
  /** True when `/api/signin/config` returned a Privy App ID. */
  available?: boolean;
  /** Opens the sign-in panel at its email step. */
  onOpen?: () => void;
  onNote?: (message: string) => void;
}

/** "Sign in with email": opens the sign-in panel, or explains that email sign-in is not connected yet. */
export default function EmailSignIn({ available = false, onOpen, onNote }: EmailSignInProps) {
  const [note, setNote] = useState("");
  const click = () => {
    if (emailButtonAction(available, onOpen) === "open") { onOpen?.(); return; }
    setNote(EMAIL_SIGN_IN_NOTE);
    onNote?.(EMAIL_SIGN_IN_NOTE);
  };
  return <div className="email-sign-in">
    <button className="account-action" type="button" onClick={click}>Sign in with email</button>
    {note && <p className="chain-fine" role="status">{note}</p>}
  </div>;
}
