import { useEffect, useRef } from "react";
import { formatYear } from "../src/calendar.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import StorybookMark from "./StorybookMark.tsx";
import "./pause-screen.css";

export default function PauseScreen({ life, world, onContinue, onReborn, onMainMenu }: {
  life: LifeState;
  world: WorldPack;
  onContinue(): void;
  onReborn(): void;
  onMainMenu?(): void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return <main className="pause-screen" aria-labelledby="pause-screen-title">
    <header className="pause-brand"><StorybookMark size={42} />Everfolk<span>{world.title}</span></header>
    <section className="pause-card">
      <div className="pause-art"><img src="/assets/pixel/worlds/alexandria.svg" alt="Pixel artwork of an imagined Alexandrian harbor" /></div>
      <div className="pause-content">
        <h1 ref={heading} id="pause-screen-title" tabIndex={-1}>Game paused</h1>
        <div className="pause-life"><strong>{life.character?.name ?? "Your character"}</strong><span>Age {life.age} · {formatYear(life.year)}</span></div>
        <div className="pause-actions"><button className="pause-continue" type="button" onClick={onContinue}>Continue <span aria-hidden="true">→</span></button><button className="pause-reborn" type="button" onClick={onReborn}>Be reborn</button></div>
        {onMainMenu && <button className="pause-to-menu" type="button" onClick={onMainMenu}>Main menu</button>}
      </div>
    </section>
  </main>;
}
