// Named natal family and explicit teaching/hostility are fictional life records.
// An occupation alone never assigns a teacher, disciple or enemy relationship.
const all = (...conditions) => ({ type: "all", conditions });
const not = condition => ({ type: "not", condition });
const known = partner => ({ type: "known-partner", partner });
const role = (partner, value, active = true) => ({ type: "social-role", partner, role: value, active });
const age = value => ({ type: "age", op: "gte", value });
const skill = (id, op, value) => ({ type: "skill", skill: id, op, value });
const closeness = (partner, delta) => ({ type: "closeness", target: "partner", partner, delta });
const one = (id, text, result, effects = [], when) => ({ id, text, ...(when ? { when } : {}), outcomes: [{ id: `${id}-result`, text: result, weight: 1, effects }] });
const teachingSkills = {
  harbor: "seamanship", market: "reckoning", workshop: "craft", linen: "craft", copies: "literacy", bakery: "reckoning",
  well: "reckoning", festival: "craft", library: "literacy", music: "music", boat: "seamanship", drill: "warfare",
  garden: "craft", accounts: "reckoning", pottery: "pottery", neighbors: "reckoning",
};

// The engine enforces hostile/cooperative exclusivity during acceptance. Mirror
// it in authored availability so an earlier friendship/date follow-up cannot
// offer an impossible choice after a later dispute has made this person an enemy.
function cooperativePeople(effects) {
  return effects.flatMap(effect => effect.type === "relationship" || effect.type === "social-role" && effect.active && effect.role !== "enemy" ? [effect.partner] : []);
}
function guardCooperation(record, people) {
  const ids = [...new Set(people)];
  if (ids.length) record.when = all(...(record.when ? [record.when] : []), ...ids.map(id => role(id, "enemy", false)));
}

export function applyFamilyRelationships(world) {
  world.version = "0.43.0";
  world.character.familyBackgrounds = true;
  world.character.familyLivingGrandparentChance = 0.1;
  world.character.extendedSocialRoles = true;
  // Care can come from other relatives; these scenes do not guarantee a living
  // grandparent in a household that did not receive the rare survival roll.
  for (const origin of world.origins) origin.text = origin.text.replaceAll("A grandparent", "A relative");
  for (const id of ["background-fishing-household-childhood", "background-temple-household-childhood"]) {
    const event = world.events.find(item => item.id === id);
    event.text = event.text.replaceAll("a grandparent", "a relative").replaceAll("A grandparent", "A relative");
  }
  for (const template of world.character.partners) {
    const id = template.id, person = `{person:${id}}`, skillId = teachingSkills[id.replace(/^person-/, "")];
    const definition = world.character.skills[skillId], label = definition.label.toLocaleLowerCase();
    const prerequisites = Object.entries(definition.prerequisites ?? {}).map(([id, value]) => skill(id, "gte", value));
    const trusted = { type: "closeness", partner: id, op: "gte", value: 40 };
    const teacherRequirements = all(age(18), known(id), trusted, role(id, "teacher", false), role(id, "disciple", false), role(id, "enemy", false), skill(skillId, "lt", 40), ...prerequisites);
    const discipleRequirements = all(age(25), known(id), trusted, role(id, "disciple", false), role(id, "teacher", false), role(id, "enemy", false), skill(skillId, "gte", 40), ...prerequisites);
    const enemyRequirements = all(age(18), known(id), ...["friend", "business-partner", "teacher", "disciple", "enemy"].map(value => role(id, value, false)),
      not({ type: "relationship", status: "courting", partner: id }), not({ type: "relationship", status: "married", partner: id }));
    const acceptTeacher = one(`ask-teacher-${id}`, `Ask ${person} to teach you ${label}`,
      `${person} agrees to be your teacher in ${label}. You arrange future lessons; agreeing to learn has not yet improved the skill.`, [role(id, "teacher"), closeness(id, 2)], teacherRequirements);
    const acceptDisciple = one(`take-disciple-${id}`, `Take ${person} as a disciple in ${label}`,
      `You and ${person} agree on a teaching arrangement in ${label}. You become their teacher and they become your disciple.`, [role(id, "disciple"), closeness(id, 2)], discipleRequirements);
    const acceptEnemy = one(`become-enemies-${id}`, `Let the dispute with ${person} become lasting enmity`,
      `You and ${person} leave the dispute unresolved and openly regard one another as enemies. No friendship, shared work or romantic relationship is ended by this decision.`,
      [role(id, "enemy"), closeness(id, -15), { type: "stat", stat: "bonds", delta: -2 }], enemyRequirements);
    const activity = (choice, usesYearlyActivity = true, minAge = 18) => ({ ...choice, category: "relationship", minAge, cooldownYears: 1, ...(usesYearlyActivity ? {} : { usesYearlyActivity: false }) });
    world.character.activities.push(
      activity(acceptTeacher), activity(acceptDisciple, true, 25), activity(acceptEnemy),
      activity(one(`learn-from-${id}`, `Practise ${label} with your teacher ${person}`,
        `${person} demonstrates a task in ${label}, watches your attempt and explains what to practise next.`,
        [{ type: "skill", skill: skillId, delta: 2 }, closeness(id, 3)], all(known(id), role(id, "teacher"), role(id, "enemy", false), ...prerequisites))),
      activity(one(`teach-disciple-${id}`, `Give your disciple ${person} a lesson in ${label}`,
        `You explain a task in ${label} to ${person}, watch their attempt and make time for questions.`,
        [closeness(id, 4), { type: "stat", stat: "bonds", delta: 1 }], all(known(id), role(id, "disciple"), skill(skillId, "gte", 40), ...prerequisites)), true, 25),
      activity(one(`leave-teacher-${id}`, `End your lessons with ${person}`, `You and ${person} end the teaching arrangement. Any friendship or shared work remains a separate relationship.`,
        [role(id, "teacher", false)], all(known(id), role(id, "teacher"))), false),
      activity(one(`release-disciple-${id}`, `End your teaching arrangement with ${person}`, `You and ${person} agree that your teaching arrangement has ended. Any other relationship remains as it was.`,
        [role(id, "disciple", false)], all(known(id), role(id, "disciple"))), false),
      activity(one(`settle-enmity-${id}`, `Settle your hostility with ${person}`, `You and ${person} agree to stop treating one another as enemies. You have not automatically become friends.`,
        [role(id, "enemy", false), closeness(id, 3)], all(known(id), role(id, "enemy"))), false),
    );
    for (const [kind, title, text, requirements, accept] of [
      ["teacher", "Someone willing to explain", `${person} explains a difficult part of ${label}. You can ask whether they would be willing to teach you more regularly.`, teacherRequirements, acceptTeacher],
      ["disciple", "Someone asks to learn from you", `${person} asks whether you could help them learn ${label}. You discuss the time and attention regular lessons would require.`, discipleRequirements, acceptDisciple],
      ["enmity", "A disagreement that could last", `A disagreement with ${person} becomes heated. You can leave it as an ordinary dispute or let it become lasting hostility.`, enemyRequirements, acceptEnemy],
    ]) {
      world.events.push({ id: `${kind}-offer-${id}`, title, text, trigger: { type: "random", weight: 1 }, maxOccurrences: 1, when: requirements, evidence: "fictional", sourceIds: [], choices: [
        one(`decline-${kind}-${id}`, kind === "enmity" ? "Let the disagreement go" : "Keep things as they are", kind === "enmity" ? `You and ${person} step away from the argument without becoming enemies.` : `You and ${person} leave your relationship as it was.`), structuredClone(accept),
      ] });
    }
  }
  for (const activity of world.character.activities) guardCooperation(activity, activity.outcomes.flatMap(outcome => cooperativePeople(outcome.effects)));
  for (const event of world.events) {
    const people = cooperativePeople(event.effects ?? []);
    for (const choice of event.choices) {
      const acquired = choice.outcomes.flatMap(outcome => cooperativePeople(outcome.effects));
      guardCooperation(choice, acquired);
      people.push(...acquired);
    }
    guardCooperation(event, people);
  }
  world.relationships.description += " Teachers, disciples and enemies become recorded only after an explicit accepted arrangement or conflict. A teacher can also be a friend or business partner. Teacher and disciple roles cannot be held with the same person at once, and hostile ties must be settled before a cooperative arrangement begins. These fictional roles do not prove historical biographies, confer titles or create automatic income.";
  return world;
}
