"use client";
import { useEffect, useRef, useState } from "react";
import { displayProse } from "./models/display-prose.ts";
import { useWorldLibrary } from "./hooks/useWorldLibrary.ts";
import App from "./screens/App.tsx";
import LoadingScreen from "./screens/LoadingScreen.tsx";

export default function GameClient() {
  const [enterGame] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("enter") === "1");
  const { active, pickerOpen, setPickerOpen, worlds, busy, error, loadingPhase, loadingProgress, openWorlds, enterWorld, keepImportedWorld } = useWorldLibrary();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (pickerOpen && !dialog.current?.open) dialog.current?.showModal();
    else if (!pickerOpen && dialog.current?.open) dialog.current?.close();
  }, [pickerOpen]);

  if (!active) return <LoadingScreen phase={loadingPhase} progress={loadingProgress} />;
  return <>
    <App key={active.key} enterGame={enterGame} onChooseWorld={() => { void openWorlds(); }} onNewLife={previous => { void enterWorld(active.world.id, true, previous); }} onImportedLife={keepImportedWorld} worldPickerOpen={pickerOpen || busy} startFresh={active.fresh} startFreshFrom={active.previousLife} worldRoutes={active.world.routes} eventVisuals={active.world.eventVisuals} />
    <dialog ref={dialog} className="detail-dialog world-picker" onCancel={() => setPickerOpen(false)} aria-labelledby="world-picker-title">
      <div className="dialog-content"><button className="dialog-close" aria-label="Close world library" onClick={() => setPickerOpen(false)}>×</button><p className="eyebrow">WORLD SELECT</p><h2 id="world-picker-title">Choose a world</h2><p>Start a life or resume your save.</p>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        {busy && <p role="status">Opening the world library…</p>}
        <div className="world-library">{worlds.map(world => <article key={world.id}><span className="eyebrow">{world.id === active.world.id ? "YOUR CURRENT WORLD" : "A WORLD TO EXPLORE"}</span><h3>{world.title}</h3><p>{displayProse(world.description)}</p><div className="world-route-tags">{world.routes.filter(route => route.enabled).map(route => <span key={route.id}>{route.title}</span>)}</div><button className="primary-button" disabled={busy} onClick={() => { void enterWorld(world.id, false); }}>Enter this world →</button></article>)}</div>
      </div>
    </dialog>
  </>;
}
