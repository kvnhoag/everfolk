"use client";

import { useState } from "react";
import App from "./App.tsx";
import { createRoyaltyTestSession, ROYALTY_TEST_PRESETS } from "../models/royalty-test.ts";
import "../styles/royalty-test.css";

/** Test lives use the same screen, dialogs and controls as ordinary play. */
export default function RoyaltyTestScreen({ initialPreset = "comfortable" }: { initialPreset?: string }) {
  const [session, setSession] = useState(() => createRoyaltyTestSession(initialPreset));
  const [revision, setRevision] = useState(0);
  const reset = (presetId: string, atBirth = false) => {
    setSession(createRoyaltyTestSession(presetId, { atBirth }));
    setRevision(value => value + 1);
  };
  return <>
    <aside className="game-preview-controls" aria-label="Test life controls">
      <label htmlFor="game-preview-preset">Test life</label>
      <select id="game-preview-preset" value={session.preset.id} onChange={event => reset(event.target.value)}>
        {(["aristocrat", "royal"] as const).map(socialClass => <optgroup key={socialClass} label={socialClass === "aristocrat" ? "Aristocratic estates" : "Royal households"}>
          {ROYALTY_TEST_PRESETS.filter(preset => preset.socialClass === socialClass).map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </optgroup>)}
      </select>
      <button type="button" onClick={() => reset(session.preset.id, session.atBirth)}>Reset test life</button>
      <button type="button" onClick={() => reset(session.preset.id, true)}>Try birth welcome</button>
      <span>Test progress is not saved.</span>
      <a href="/">Return to your game ↗</a>
    </aside>
    <App key={`${session.preset.id}:${revision}`} enterGame previewSession={session} />
  </>;
}
