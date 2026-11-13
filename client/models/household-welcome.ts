import type { LifeState, WorldPack } from "../../src/types.ts";
import { householdManagement } from "./household-management.ts";
import { formatMoney } from "./wealth.ts";

export interface HouseholdWelcomeStep {
  id: "treasury" | "conditions" | "decisions" | "titles";
  title: string;
  description: string;
  detail: string;
  icon: string;
}

/** The introduction describes this life's own household rules without acting. */
export function getHouseholdWelcome(world: WorldPack, life: LifeState) {
  const management = householdManagement(world, life);
  if (!management) return undefined;
  const royal = management.kind === "royal";
  const rules = royal ? world.royalty! : world.aristocracy!;
  const values = royal ? life.royalty! : life.aristocracy!;
  const definitions: Record<string, { label: string }> = rules.metrics;
  const metrics = Object.entries(values).filter(([id]) => id !== "treasury").map(([id, value]) => ({
    id, label: definitions[id].label, value,
  }));
  const tutor = world.character?.activities.find(activity => activity.id === (royal ? "royal-study-statecraft" : "aristocrat-study-estates"));
  const titleNames = (world.legacy?.routes ?? []).filter(route => route.achievementIds.some(id =>
    world.legacy?.achievements.some(achievement => achievement.id === id && achievement.kind === "ultimate") &&
    world.character?.activities.some(activity => activity.audience === management.kind && activity.outcomes.some(outcome =>
      outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === id))))).map(route => route.title);
  const figureAchievements = new Set(world.legacy?.achievements.filter(achievement => achievement.figure).map(achievement => achievement.id));
  const historicalTitles = world.events.some(event => (event.audience === undefined || event.audience === management.kind) && event.choices.some(choice =>
    choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && figureAchievements.has(effect.achievement)))));
  const fundedLessons = world.character?.activities.some(activity => activity.audience === management.kind && activity.category === "training" && activity.outcomes.some(outcome =>
    outcome.effects.some(effect => effect.type === management.kind && "metric" in effect && effect.metric === "treasury" && effect.delta < 0))) ?? false;
  const beginsLater = life.age < management.minAge;
  const tutorDetail = tutor ? ` ${royal ? "Statecraft" : "Estate affairs"} lessons begin at age ${tutor.minAge ?? 0}.` : "";
  const steps: HouseholdWelcomeStep[] = [
    {
      id: "treasury", icon: "coin", title: "A treasury for your household",
      description: royal
        ? "The Royal council uses your house's treasury to fund envoys, guards, relief and family agreements."
        : "The Estate council uses your estate's treasury to fund improvements, tenant relief, patronage and inheritance agreements.",
      detail: `Your ${management.treasuryLabel.toLocaleLowerCase()} currently holds ${formatMoney(management.treasury, world)}. The Yearly budget shows regular receipts and the effects of current household conditions.`,
    },
    {
      id: "conditions", icon: "home", title: royal ? "Keep your house together" : "Help your estate prosper",
      description: royal
        ? "Balance court influence, household stability, security and succession. A stronger house has more room to pursue its ambitions."
        : "Balance local standing, estate prosperity, tenant loyalty and inheritance. Productive land and reliable agreements support the family.",
      detail: royal
        ? "Open Household conditions to see which thresholds affect your house each year. Council decisions strengthen the areas that need attention."
        : "Open Estate conditions to see what changes your yearly returns. Prosperity supports income; neglected land and strained agreements can reduce it.",
    },
    {
      id: "decisions", icon: "hourglass", title: "Choose your priorities each year",
      description: royal
        ? "Send envoys, review the guard, hear petitions or prepare succession. The preview shows treasury costs and possible changes before you choose."
        : "Improve irrigation, hear tenant claims, host patrons or record inheritance. The preview shows treasury costs and possible changes before you choose.",
      detail: `${beginsLater ? `Your relatives manage the ${royal ? "house" : "estate"} while you grow. Council responsibilities begin at age ${management.minAge}.` : `Council responsibilities are available from age ${management.minAge}.`} You can choose one major activity each year, shared with lessons and title projects.${tutorDetail}`,
    },
    {
      id: "titles", icon: "feather", title: titleNames.length || historicalTitles ? "Build a name through service" : "Keep learning as you grow",
      description: titleNames.length
        ? "Service & titles in your council shows the accepted duties, household conditions, costs and waiting periods needed for each distinction. Successful work earns cards for your collection."
        : "Develop your skills as your household grows. Lessons can prepare you for later responsibilities.",
      detail: `${fundedLessons ? "Open Skills for lessons funded by your household." : "Open Skills to explore the available lessons."} ${historicalTitles ? "Historical titles follow their own dated opportunities and completed duties; the path shows what you need before recognition." : "Lessons strengthen the abilities you will use in later decisions."}`,
    },
  ];
  return {
    kind: management.kind,
    title: royal ? "Congratulations — you were born into royalty!" : "Congratulations — you were born into an aristocratic family!",
    congratulations: royal
      ? "You belong to a royal household, with its own resources, obligations and ambitions. A life of diplomacy, protection and family leadership lies ahead."
      : "You belong to a landowning household, with an estate to improve, tenants to support and a family legacy to build.",
    councilTitle: management.title, treasuryLabel: management.treasuryLabel, treasury: management.treasury, minAge: management.minAge,
    concerns: management.concerns, metrics, titleNames, steps,
    childhoodNote: beginsLater ? `Your relatives care for you now. You will help guide the household from age ${management.minAge}.` : "Your household has its own council. Here is a short introduction to the choices ahead.",
  };
}

export type HouseholdWelcomeModel = NonNullable<ReturnType<typeof getHouseholdWelcome>>;
