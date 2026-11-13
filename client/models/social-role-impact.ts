import type { Choice, LifeState, SocialRole, WorldPack } from "../../src/types.ts";
import { resolvePartner } from "../../src/people.ts";
import { getOutcomeProbabilities } from "../../src/outcomes.ts";

/** Final role changes only; previews never introduce or name a future person. */
export function socialRoleImpact(choice: Choice, life: LifeState, world: WorldPack): { text: string; gain: boolean }[] {
  if (!world.character?.socialRelationships) return [];
  const changes = new Map<string, { partner: string; role: SocialRole; active: boolean; probability: number }>();
  for (const { outcome, probability } of getOutcomeProbabilities(world, life, choice)) {
    if (probability <= 0) continue;
    const final = new Map<string, { partner: string; role: SocialRole; active: boolean }>();
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "social-role") final.set(`${effect.partner}:${effect.role}`, effect);
    }
    for (const [key, effect] of final) {
      const initial = life.character?.relationships?.partners[effect.partner]?.roles?.includes(effect.role) === true;
      if (initial === effect.active) continue;
      const previous = changes.get(key);
      changes.set(key, { partner: effect.partner, role: effect.role, active: effect.active, probability: (previous?.probability ?? 0) + probability });
    }
  }
  return [...changes.values()].map(change => {
    const person = resolvePartner(world, life, change.partner)?.name ?? "someone you meet";
    const role = { friend: "Friendship", "business-partner": "Business partnership", teacher: "Teacher relationship", disciple: "Discipleship", enemy: "Hostility" }[change.role];
    const action = change.active ? role : `End ${role.toLocaleLowerCase()}`;
    const possible = change.active ? role.toLocaleLowerCase() : `end of ${role.toLocaleLowerCase()}`;
    return { text: `${change.probability < 1 - 1e-12 ? `Possible ${possible}` : action} with ${person}`, gain: change.role === "enemy" ? !change.active : change.active };
  });
}
