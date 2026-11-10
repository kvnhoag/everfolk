// Explicit social ties share an encountered person's identity with romance.
// These fictional arrangements are gameplay, not reconstructed ancient terms.
const all = (...conditions) => ({ type: "all", conditions });
const known = partner => ({ type: "known-partner", partner });
const role = (partner, value, active = true) => ({ type: "social-role", partner, role: value, active });
const adult = { type: "age", op: "gte", value: 18 };
const cash = delta => ({ type: "cash", delta });
const close = (partner, delta) => ({ type: "closeness", target: "partner", partner, delta });
const bonds = delta => ({ type: "stat", stat: "bonds", delta });
const one = (id, text, result, effects = [], when) => ({ id, text, ...(when ? { when } : {}), outcomes: [{ id: `${id}-result`, text: result, weight: 1, effects }] });
const occupation = {
  harbor: "check a small delivery together", market: "prepare a small market order", workshop: "organize a repair order",
  linen: "check and deliver a cloth order", copies: "prepare a copying order", bakery: "organize a small bread delivery",
  well: "organize a household-supply order", festival: "prepare supplies for a gathering", library: "organize copied reading materials",
  music: "organize supplies for a performance", boat: "prepare a small landing-side delivery", drill: "check an equipment order",
  garden: "organize a gardening-supply order", accounts: "check a small supply account", pottery: "prepare a pottery delivery", neighbors: "organize a small neighborhood order",
};

export function applySocialRoles(world) {
  world.character.socialRelationships = true;
  for (const template of world.character.partners) {
    const id = template.id, key = id.replace(/^person-/, ""), person = `{person:${id}}`;
    const friend = role(id, "friend"), business = role(id, "business-partner");
    const date = world.events.find(event => event.id === `date-${id}`);
    date.title = "Time to get to know each other";
    date.text = `You meet ${person} again during an ordinary day. There is time to talk, build a friendship or ask about a date if you are both free to do so.`;
    date.when = all(adult, known(id));
    const friendly = date.choices.find(choice => choice.id === `keep-friendly-${id}`);
    friendly.text = `Become friends with ${person}`;
    friendly.when = role(id, "friend", false);
    friendly.outcomes[0].text = `You and ${person} decide to keep making time for one another as friends. You agree to meet again without making romantic plans.`;
    friendly.outcomes[0].effects = [role(id, "friend"), close(id, 3)];
    date.choices.unshift(one(`leave-followup-${id}`, "Enjoy a short chat and go", `You and ${person} exchange news and part without making new plans.`));
    const invitation = date.choices.find(choice => choice.id === `invite-date-${id}`);
    invitation.opportunity = { label: "Begin dating", outcomeIds: [`date-${id}-accepted`] };
    const court = world.character.activities.find(activity => activity.id === `court-${id}`);
    court.text = `Ask ${person} on a date`;
    court.opportunity = { label: "Begin dating", outcomeIds: [`court-${id}-accepted`] };
    court.outcomes[0].text = `${person} agrees to begin dating. You arrange to spend more time together.`;

    const ventureRequirements = all(adult, known(id), role(id, "business-partner", false),
      { type: "closeness", partner: id, op: "gte", value: 45 },
      { type: "skill", skill: "reckoning", op: "gte", value: 10 }, { type: "cash", op: "gte", value: 20 });
    const form = one(`form-business-${id}`, `Put 20 drachmas into shared work with ${person}`,
      `You and ${person} set aside 20 drachmas for materials and agree who will check quantities, handle the work and settle the account. You become business partners. No profit has been earned yet.`,
      [cash(-20), business, close(id, 2)], ventureRequirements);
    world.events.push({ id: `business-proposal-${id}`, title: "An offer of shared work",
      text: `${person} suggests that you ${occupation[key] ?? "prepare a small order together"}. You compare the materials and responsibilities before deciding whether to put 20 drachmas into a shared working arrangement. Future orders may earn or lose cash.`,
      trigger: { type: "random", weight: 2 }, maxOccurrences: 1, when: ventureRequirements, evidence: "fictional", sourceIds: [],
      choices: [one(`decline-business-${id}`, "Keep your work separate", `You and ${person} decide to keep your work separate. Your other relationship stays as it was.`), structuredClone(form)] });
    const activity = (choice, cooldownYears = 1, usesYearlyActivity = true) => ({ ...choice, category: "relationship", minAge: 18, cooldownYears, ...(usesYearlyActivity ? {} : { usesYearlyActivity: false }) });
    world.character.activities.push(
      activity(one(`befriend-${id}`, `Build a friendship with ${person}`, `You and ${person} make time for an unhurried conversation and agree to keep in touch as friends.`,
        [friend, close(id, 3), bonds(1)], all(known(id), role(id, "friend", false), { type: "closeness", partner: id, op: "gte", value: 40 }))),
      activity(one(`friend-time-${id}`, `Spend an afternoon with ${person}`, `You and ${person} spend an afternoon talking and sharing the ordinary news of your lives.`,
        [close(id, 5), bonds(1)], all(known(id), friend))),
      activity(form, 2),
      activity({ id: `joint-order-${id}`, text: `Complete a shared order with ${person}`,
        when: all(known(id), business, { type: "closeness", partner: id, op: "gte", value: 25 },
          { type: "skill", skill: "reckoning", op: "gte", value: 10 }, { type: "cash", op: "gte", value: 10 }),
        opportunity: { label: "Complete the joint order", outcomeIds: [`joint-order-${id}-completed`] },
        outcomes: [
          { id: `joint-order-${id}-completed`, text: `You and ${person} complete the order and check the final account together. After the 10-drachma outlay, the 30-drachma receipt leaves you 20 drachmas better off.`, weight: 70,
            effects: [cash(-10), cash(30), { type: "skill", skill: "reckoning", delta: 1 }, close(id, 2)] },
          { id: `joint-order-${id}-lost`, text: `The order cannot be completed as planned. The 10 drachmas already spent on materials are lost, and you and ${person} review what went wrong.`, weight: 30,
            effects: [cash(-10), close(id, -1)] },
        ] }, 2),
      activity(one(`end-friendship-${id}`, `End your friendship with ${person}`, `You explain to ${person} that you no longer want to continue the friendship. Any business arrangement or romantic relationship remains a separate matter.`,
        [role(id, "friend", false), close(id, -2)], all(known(id), friend)), 1, false),
      activity(one(`end-business-${id}`, `End your business partnership with ${person}`, `You and ${person} stop taking on new joint orders. The startup outlay is not refunded; any friendship or romantic relationship remains a separate matter.`,
        [role(id, "business-partner", false), close(id, -2)], all(known(id), business)), 1, false),
    );
  }
  const breakup = world.character.activities.find(activity => activity.id === "end-courtship");
  breakup.text = "Stop dating";
  for (const outcome of breakup.outcomes) outcome.text = "You agree to stop dating. Any friendship or business partnership remains a separate relationship unless you choose to end it too.";
  world.relationships.description = "Friends, business partners and romantic relationships are explicit ties with people actually met in this life. Friendship and shared work can coexist with a love interest or spouse. Contact, conflict and neglect affect closeness. Ending one role leaves the others intact. Only the existing close household-care rules affect recovery; friends and business partners create no automatic income or extra health bonus. These arrangements and numeric rewards are fictional gameplay.";
  return world;
}
