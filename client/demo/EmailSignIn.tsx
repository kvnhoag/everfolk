import { useState } from "react";

import { EMAIL_SIGN_IN_NOTE } from "./labels.ts";

export { EMAIL_SIGN_IN_NOTE };
/** The option is visible now. Connecting a provider belongs to the ranked sign-in work. */
export default function EmailSignIn({ onNote }: { onNote?: (message: string) => void }) {
  const [note, setNote] = useState("");
  return <div className="email-sign-in">
    <button className="account-action" type="button" onClick={() => { setNote(EMAIL_SIGN_IN_NOTE); onNote?.(EMAIL_SIGN_IN_NOTE); }}>Sign in with email</button>
    {note && <p className="chain-fine" role="status">{note}</p>}
  </div>;
}
