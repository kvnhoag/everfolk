// Authored surprises, not historical incidents or measured crime frequencies.
// The engine's shared rare-event gate controls appearance, not these weights.
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const age = (op, value) => ({ type: "age", op, value });
const cashAtLeast = value => ({ type: "cash", op: "gte", value });
const trained = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const attribute = (stat, value) => ({ type: "stat", stat, op: "gte", value });
const job = (...ids) => any(...ids.map(job => ({ type: "job", job })));
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const cash = delta => ({ type: "cash", delta });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const fracture = { type: "condition", condition: "open-leg-fracture" };
const fatal = deathCause => ({ type: "end", ending: "death-in-rare-encounter", deathCause });
const result = (id, text, effects = [], weight = 1, weightModifiers) => ({
  id, text, weight, effects, ...(weightModifiers ? { weightModifiers } : {}),
});
const choice = (id, text, outcomes, when) => ({ id, text, outcomes, ...(when ? { when } : {}) });
const one = (id, text, outcome, effects = [], when) => choice(id, text, [result(`${id}-result`, outcome, effects)], when);
const factor = (when, multiplier, reason) => ({ when, multiplier, reason });
const encounter = (id, title, text, choices, when) => ({
  id, title, text, rarity: "rare", trigger: { type: "random", weight: 1 },
  when: all(age("gte", 18), ...(when ? [when] : [])),
  maxOccurrences: 1, evidence: "fictional", sourceIds: [], choices,
});

export function applyRareEncounters(world) {
  const negotiate = choice("rare-abduction-negotiate", "Talk them into letting you go", [
    result("rare-abduction-talked-free", "You keep talking until the men decide holding you is more trouble than it is worth. They let you walk back into the lane.", [skill("oratory", 1)], 65, [
      factor(trained("oratory", 20), 1.6, "You can keep the conversation under control"),
      factor(attribute("bonds", 60), 1.3, "You can name people nearby who will look for you"),
    ]),
    result("rare-abduction-beaten-free", "They shove you against the wall and strike you before letting you leave. You reach home bruised.", [stat("health", -5)], 30),
    result("rare-abduction-fracture", "One man strikes your lower leg as you try to move past him. You leave with an open tibial fracture and need care.", [stat("health", -8), fracture], 5),
  ]);
  negotiate.opportunity = { label: "Leave without an assault", outcomeIds: ["rare-abduction-talked-free"] };

  const shout = choice("rare-abduction-shout", "Shout for help from the lane", [
    result("rare-abduction-neighbors-arrive", "People gather outside the yard. The men release you and leave by another passage before the crowd comes in.", [stat("bonds", 1)], 80, [
      factor(attribute("bonds", 60), 1.5, "People nearby recognize your voice"),
    ]),
    result("rare-abduction-shout-struck", "A man strikes you as you shout. The noise brings people to the entrance, and the men flee before they can take you farther.", [stat("health", -5)], 20),
  ]);
  shout.opportunity = { label: "Help arrives before you are hurt", outcomeIds: ["rare-abduction-neighbors-arrive"] };

  const rescue = choice("rare-scaffold-pull-worker", "Help pull the worker clear", [
    result("rare-scaffold-worker-clear", "You and another person pull the worker clear before the timber falls. Your arms shake after the effort, but both of you can walk away.", [stat("health", -3), stat("bonds", 2)], 80, [
      factor(attribute("health", 60), 1.4, "You have the strength for the pull"),
      factor(trained("craft", 20), 1.3, "You recognize which fastening is still holding"),
    ]),
    result("rare-scaffold-leg-injury", "The worker gets clear, but falling timber strikes your lower leg. You suffer an open tibial fracture and need care.", [stat("health", -8), fracture], 20),
  ]);
  rescue.opportunity = { label: "Get the worker clear without an injury", outcomeIds: ["rare-scaffold-worker-clear"] };

  world.events.push(
    encounter("rare-abduction", "Held for ransom", "Two armed men force you into a yard beside the street. They demand 30 drachmas to let you leave. You can still hear people passing in the lane.", [
      one("rare-abduction-pay", "Pay 30 drachmas to be released", "You hand over 30 drachmas. The men open the gate, and you leave the yard without an injury.", [cash(-30)], cashAtLeast(30)),
      shout,
      negotiate,
      choice("rare-abduction-flee", "Force past them and run", [
        result("rare-abduction-escaped", "You push through the gap and reach the busy lane. The men stop chasing when other people turn to watch.", [stat("health", -3)], 85, [
          factor(attribute("health", 60), 1.5, "You can move quickly"),
        ]),
        result("rare-abduction-escape-injury", "You get through the gate, but a blow to your lower leg knocks you down. People drive the men away. You have an open tibial fracture and need care.", [stat("health", -8), fracture], 13),
        result("rare-abduction-escape-fatal", "One of the men stabs you in the chest as you force past him. The wound proves fatal.", [fatal("abduction-stabbing")], 2),
      ]),
    ], age("lte", 69)),

    encounter("rare-mistaken-cargo-theft", "Mistaken for a cargo thief", "A guard stops you near a cargo yard. Someone has described a thief wearing clothes like yours, and the guard wants to hold you while the missing bundle is found.", [
      one("rare-detention-wait", "Stay and give a clear account of your errand", "You explain where you have been and wait beside the gate. The missing bundle is found in another store, and the guard lets you leave.", [stat("health", -1)]),
      choice("rare-detention-witness", "Ask them to bring someone who knows you", [
        result("rare-detention-recognized", "A worker recognizes you and confirms your errand. You are released before the yard closes.", [stat("bonds", 1)], 70, [
          factor(attribute("bonds", 60), 1.5, "You have people nearby who will speak for you"),
        ]),
        result("rare-detention-witness-late", "Nobody who can confirm your story arrives in time. You wait until the bundle is found, then leave hungry and tired.", [stat("health", -2)], 30),
      ]),
      one("rare-detention-request-check", "Ask them to check the cargo marks again", "You point out that two bundles carry similar marks. The guard has both checked and finds the missing goods without taking you farther.", [skill("reckoning", 1)], trained("reckoning", 15)),
    ], job("porter", "sailor", "shopkeeper", "clerk")),

    encounter("rare-lost-valuables", "A purse under the bench", "You find a small purse under a public bench. It contains coins and a marked token. A trader nearby is searching the ground, but has not noticed you.", [
      one("rare-purse-hand-over", "Hand the purse to the searching trader", "The trader describes the token before you show it. You return the purse, and they thank you before hurrying away.", [stat("bonds", 1)]),
      choice("rare-purse-check-owner", "Ask about the token before returning it", [
        result("rare-purse-owner-reward", "The trader correctly describes the token and names the place where the purse was lost. They give you 10 drachmas after you return it.", [cash(10), skill("reckoning", 1)], 60),
        result("rare-purse-owner-thanks", "The trader describes the purse correctly. You return it, but there is no reward beyond their thanks.", [stat("bonds", 1)], 40),
      ]),
      choice("rare-purse-keep", "Keep the coins and leave the purse", [
        result("rare-purse-coins-kept", "You take 20 drachmas and leave the empty purse under the bench. The trader continues searching while you walk away.", [cash(20), stat("bonds", -1)], 70),
        result("rare-purse-caught", "The trader sees you taking the coins. People nearby make you return them, and the argument follows you into the street.", [stat("bonds", -4)], 30),
      ]),
    ]),

    encounter("rare-patron-test", "A visitor offers a commission", "A visitor sees a piece of your work and asks for a small sample for their household. They offer 20 drachmas for a finished piece they can use.", [
      one("rare-patron-decline", "Turn down the extra work", "You explain that you cannot take the commission. The visitor asks another worker."),
      one("rare-patron-copy", "Prepare a clean copy for 20 drachmas", "You prepare the requested copy and check it before delivery. The visitor accepts it and pays 20 drachmas.", [cash(20), skill("literacy", 1), stat("health", -2)], trained("literacy", 20)),
      one("rare-patron-fitting", "Make a wooden fitting for 20 drachmas", "You measure and make the small fitting, then adjust it at the visitor's home. They pay 20 drachmas when it fits.", [cash(20), skill("craft", 1), stat("health", -2)], trained("craft", 20)),
      one("rare-patron-pot", "Finish a clay vessel for 20 drachmas", "You make and finish a small clay vessel with the agreed decoration. The visitor collects it after firing and pays 20 drachmas.", [cash(20), skill("pottery", 1), stat("health", -2)], trained("pottery", 20)),
    ], any(trained("literacy", 20), trained("craft", 20), trained("pottery", 20))),

    encounter("rare-scaffold-collapse", "A beam cracks above the lane", "A beam cracks above a narrow lane. A worker slips against a hanging rope while the people underneath begin to move away.", [
      one("rare-scaffold-get-clear", "Move clear of the falling timber", "You step away and keep others from entering the lane. Workers deal with the damaged frame before the passage opens again."),
      one("rare-scaffold-warn", "Warn the people coming around the corner", "You shout until the approaching carriers stop. Everyone stays clear while other workers lower the damaged timber.", [skill("oratory", 1), stat("bonds", 1)]),
      rescue,
    ], age("lte", 74)),

    encounter("rare-sailor-rescue", "A crewmate falls overboard", "A crewmate loses their footing and falls into the water. They surface near the ship, but cannot reach the side. A loose rope lies on the deck.", [
      one("rare-rescue-rope", "Throw the rope and call the crew", "You throw the rope within reach and call for help. The crew hauls the crewmate alongside and gets them back aboard.", [skill("seamanship", 1), stat("bonds", 1)]),
      one("rare-rescue-haul", "Secure the rope and help haul them aboard", "You secure the rope and work with the crew to bring the crewmate aboard. The pull leaves you sore, but you finish the job.", [stat("health", -2), skill("seamanship", 1), stat("bonds", 2)], trained("seamanship", 15)),
      choice("rare-rescue-jump", "Jump into the water after them", [
        result("rare-rescue-water-success", "You reach the crewmate and help them hold the rope. The crew pulls you both alongside before you lose your grip.", [stat("health", -5), stat("bonds", 3)], 80, [
          factor(trained("seamanship", 30), 1.5, "You know how to use the ship's lines in the water"),
          factor(attribute("health", 60), 1.3, "You have enough strength for the effort"),
        ]),
        result("rare-rescue-water-exhausted", "The current pulls you away from the crewmate. The crew gets a second rope to you and brings you aboard exhausted. Another sailor reaches your crewmate.", [stat("health", -10)], 17),
        result("rare-rescue-water-fatal", "You lose your grip before the crew can reach you. You are pulled under and drown during the rescue.", [fatal("rescue-drowning")], 3),
      ]),
    ], all(job("sailor"), age("lte", 69))),
  );

  world.character.deathCauses.push(
    { id: "abduction-stabbing", title: "Stab wound to the chest", text: "An armed captor stabs you during an attempted escape. The chest wound proves fatal.", weight: 1, choiceOnly: true },
    { id: "rescue-drowning", title: "Drowning during a rescue", text: "You enter the water to help a crewmate and drown before the crew can bring you aboard.", weight: 1, choiceOnly: true },
  );
  world.endings.push({ id: "death-in-rare-encounter", title: "Killed during a dangerous encounter", kind: "death", evidence: "fictional", sourceIds: [],
    text: "You die during the encounter." });
  return world;
}
