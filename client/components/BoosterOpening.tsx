import { useEffect, useRef, useState } from "react";
import { boosterDocument } from "../lib/booster/shell.ts";
import type { BoosterController } from "../lib/booster/runtime.mjs";
import type { BoosterSceneOptions } from "../types/booster.ts";
import "../styles/booster-opening.css";

/** Lazy-loaded scene, with its own document so game-wide flat UI rules cannot alter it. */
export default function BoosterOpening({ options, replayKey = 0 }: { options: BoosterSceneOptions; replayKey?: number }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const scene = useRef<BoosterController | undefined>(undefined);
  const requestedReplay = useRef(replayKey);
  const appliedReplay = useRef(replayKey);
  requestedReplay.current = replayKey;
  const latest = useRef(options);
  latest.current = options;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const frameDocument = options.hideClose ? boosterDocument.replace("<body>", '<body data-hide-close="true">') : boosterDocument;
  useEffect(() => {
    if (!loaded || !frame.current?.contentWindow) return;
    let cancelled = false;
    let current: BoosterController | undefined;
    const host = frame.current.contentWindow;
    void import("../lib/booster/runtime.mjs").then(({ mountBooster }) => {
      if (!cancelled) {
        current = mountBooster(host, { ...latest.current,
          onSave: indices => latest.current.onSave(indices),
          onSkip: () => latest.current.onSkip(),
          onClose: () => latest.current.onClose(),
          onRevealed: latest.current.onRevealed ? () => latest.current.onRevealed?.() : undefined,
          mint: latest.current.mint ? { ...latest.current.mint, onMint: index => latest.current.mint!.onMint(index) } : undefined,
        });
        scene.current = current;
        appliedReplay.current = requestedReplay.current;
      }
    }).catch(() => { if (!cancelled) setError("The pack could not load. Close and try again."); });
    return () => { cancelled = true; current?.dispose(); if (scene.current === current) scene.current = undefined; };
  }, [loaded]);
  useEffect(() => {
    if (!scene.current || appliedReplay.current === replayKey) return;
    appliedReplay.current = replayKey;
    setError("");
    void scene.current.replay(latest.current.cards).catch(() => setError("The pack could not load. Try opening another pack."));
  }, [replayKey]);
  return <div className="booster-opening">
    <iframe ref={frame} title="Your Everfolk legacy pack" srcDoc={frameDocument} onLoad={() => setLoaded(true)} />
    {error && <div className="booster-opening-error" role="alert">{error}<button onClick={options.onClose}>{options.labels?.close ?? "Back to memorial"}</button></div>}
  </div>;
}
