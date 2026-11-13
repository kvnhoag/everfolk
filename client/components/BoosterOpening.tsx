import { useEffect, useRef, useState } from "react";
import { boosterDocument } from "../lib/booster/shell.ts";
import type { BoosterSceneOptions } from "../types/booster.ts";
import "../styles/booster-opening.css";

/** Lazy-loaded scene, with its own document so game-wide flat UI rules cannot alter it. */
export default function BoosterOpening({ options }: { options: BoosterSceneOptions }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(options);
  latest.current = options;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!loaded || !frame.current?.contentWindow) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const host = frame.current.contentWindow;
    void import("../lib/booster/runtime.mjs").then(({ mountBooster }) => {
      if (!cancelled) dispose = mountBooster(host, { ...latest.current,
        onSave: indices => latest.current.onSave(indices),
        onSkip: () => latest.current.onSkip(),
        onClose: () => latest.current.onClose(),
        onRevealed: latest.current.onRevealed ? () => latest.current.onRevealed?.() : undefined,
        mint: latest.current.mint ? { ...latest.current.mint, onMint: index => latest.current.mint!.onMint(index) } : undefined,
      });
    }).catch(() => { if (!cancelled) setError("The pack could not load. Close and try again."); });
    return () => { cancelled = true; dispose?.(); };
  }, [loaded]);
  return <div className="booster-opening">
    <iframe ref={frame} title="Your Everfolk legacy pack" srcDoc={boosterDocument} onLoad={() => setLoaded(true)} />
    {error && <div className="booster-opening-error" role="alert">{error}<button onClick={options.onClose}>Back to memorial</button></div>}
  </div>;
}
