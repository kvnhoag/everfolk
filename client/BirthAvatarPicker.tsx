import type { LifeState, WorldPack } from "../src/types.ts";
import PixelPortrait from "./PixelPortrait.tsx";
import { avatarOptions } from "./life-background.ts";
import "./birth-avatar.css";

const stages = [
  { age: 0, label: "Infancy" }, { age: 7, label: "Childhood" },
  { age: 16, label: "Youth" }, { age: 28, label: "Adult" },
  { age: 48, label: "Middle age" }, { age: 70, label: "Later life" },
];

export default function BirthAvatarPicker({ life, world, onChoose }: { life: LifeState; world: WorldPack; onChoose(variant: number): void }) {
  const character = life.character;
  if (!world.character?.identity || !character?.sex) return null;
  const options = avatarOptions(life.originId, character.sex);
  if (!options.length) return null;
  const origin = world.origins.find(origin => origin.id === life.originId);
  const appearance = { originId: life.originId, sex: character.sex, seed: life.seed, name: character.name };
  return <section className="birth-avatar-picker" aria-label="Choose your avatar">
    <header><h3>Choose your portrait</h3><p>{character.sex === "female" ? "Born a girl" : "Born a boy"} · {origin?.title}</p></header>
    <div className="birth-avatar-options" role="group" aria-label="Portrait choices">{options.map(option => <button type="button" key={option.variant} aria-pressed={character.avatarVariant === option.variant} onClick={() => onChoose(option.variant)}>
      <PixelPortrait {...appearance} age={28} avatarVariant={option.variant} className="birth-avatar-image" />
      <span>Portrait {option.variant + 1}</span><small>{character.avatarVariant === option.variant ? "Selected" : "Choose"}</small>
    </button>)}</div>
    <p className="birth-avatar-note">Your portrait will age with you.</p>
    <div className="birth-avatar-ages" aria-label="Your portrait through life">{stages.map(stage => <figure key={stage.age}><PixelPortrait {...appearance} age={stage.age} avatarVariant={character.avatarVariant} className="birth-avatar-stage" /><figcaption>{stage.label}</figcaption></figure>)}</div>
  </section>;
}
