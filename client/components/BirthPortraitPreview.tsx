import type { LifeState, WorldPack } from "../../src/types.ts";
import PixelPortrait from "./PixelPortrait.tsx";
import { playerPortraitState } from "../models/portrait-state.ts";
import "../styles/birth-avatar.css";

const stages = [
  { age: 0, label: "Infancy" }, { age: 7, label: "Childhood" },
  { age: 16, label: "Youth" }, { age: 28, label: "Adult" },
  { age: 48, label: "Middle age" }, { age: 70, label: "Later life" },
];

/** The engine assigns this person's face once at birth. Views only show it. */
export default function BirthPortraitPreview({ life, world }: { life: LifeState; world: WorldPack }) {
  const character = life.character;
  if (!world.character?.identity || !character?.sex) return null;
  const origin = world.origins.find(origin => origin.id === life.originId);
  return <section className="birth-portrait-preview" aria-label="Your portrait">
    <header><h3>Your portrait</h3><p>{character.sex === "female" ? "Born a girl" : "Born a boy"} · {origin?.title}</p></header>
    <div className="birth-assigned-portrait"><PixelPortrait portrait={playerPortraitState(world, life)} name={character.name} className="birth-assigned-image" /><p>Your portrait is assigned at birth and will age with you.</p></div>
    <div className="birth-portrait-ages" aria-label="Your portrait through life">{stages.map(stage => <figure key={stage.age}><PixelPortrait portrait={playerPortraitState(world, life, { age: stage.age })} name={character.name} className="birth-portrait-stage" /><figcaption>{stage.label}</figcaption></figure>)}</div>
  </section>;
}
