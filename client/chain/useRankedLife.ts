import { useCallback, useRef, useState } from "react";
import type { Command } from "../../src/types.ts";
import { resumeRankedSession, startRankedSession, type RankedSession, type RankedSessionOptions } from "./ranked-session.ts";
import type { MintResult, SignedEvidence } from "./types.ts";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something interrupted this action. Please try again.";
}

/** React binding for a ranked session: one action at a time, with a player-facing error after any failure. */
export function useRankedLife(options: RankedSessionOptions) {
  const [session, setSession] = useState<RankedSession | null>(null);
  const [, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    if (running.current) return null;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (failure) {
      setError(message(failure));
      return null;
    } finally {
      running.current = false;
      setBusy(false);
      setRevision(value => value + 1);
    }
  }, []);

  const start = useCallback(() => run(async () => setSession(await startRankedSession(options))), [options, run]);
  const resume = useCallback((lifeId: string) => run(async () => setSession(await resumeRankedSession(options, lifeId))), [options, run]);
  const dispatch = useCallback((command: Command) => run(() => session ? session.dispatch(command) : Promise.resolve()), [run, session]);
  const finish = useCallback(() => run<SignedEvidence | null>(() => session ? session.finish() : Promise.resolve(null)), [run, session]);
  const mint = useCallback((signed: SignedEvidence, actionId: string) =>
    run<MintResult | null>(() => session ? session.mint(signed, actionId) : Promise.resolve(null)), [run, session]);
  const abandon = useCallback(() => run(async () => { await session?.abandon(); setSession(null); }), [run, session]);

  return { session, busy, error, start, resume, dispatch, finish, mint, abandon };
}
