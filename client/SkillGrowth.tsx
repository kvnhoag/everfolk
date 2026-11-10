import type { LifeState, WorldPack } from "../src/types.ts";
import { skillGrowthProfile } from "./skill-growth.ts";
import "./skill-growth.css";

export default function SkillGrowth({ life, world, skillId }: { life: LifeState; world: WorldPack; skillId: string }) {
  const profile = skillGrowthProfile(world, life, skillId);
  if (!profile) return null;
  const definition = world.character!.skills[skillId];
  return <section className="skill-growth" aria-label={`${definition.label} learning pace`}>
    <p className="skill-growth-current"><span>{profile.atCap ? "Ceiling reached" : "Learning pace"}</span><strong>{profile.atCap ? `${definition.max}/${definition.max}` : `${profile.percent}%`}</strong></p>
    {!profile.atCap && <p>Ordinary gains slow as proficiency rises.{profile.hasRareMastery && <> A rare mastery encounter can bring this skill to {definition.max}.</>}</p>}
    <details><summary>How learning scales</summary><dl>{profile.bands.map(band => <div key={band.from}><dt>From {band.from}</dt><dd>{band.percent}% of the usual gain</dd></div>)}</dl><p>These rates apply to practice, work and ordinary events. The choice preview shows your actual gain.{profile.hasRareMastery && " Rare mastery rewards can reach the ceiling directly."}</p></details>
  </section>;
}
