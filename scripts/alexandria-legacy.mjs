// Named works and people are authored fiction. Sources support the settings and
// practices, not these characters, prices, odds or universal access to a career.
const all = (...conditions) => ({ type: "all", conditions });
const skill = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const gain = (skill, delta) => ({ type: "skill", skill, delta });
const cash = delta => ({ type: "cash", delta });
const bonds = delta => ({ type: "stat", stat: "bonds", delta });
const earned = (achievement, minYears = 0) => ({ type: "accomplishment", achievement, ...(minYears ? { minYears } : {}) });
const not = condition => ({ type: "not", condition });
const award = achievement => ({ type: "accomplishment", achievement });
const royalEra = { type: "year", op: "lt", value: -30 };

export function applyLegacy(world) {
  world.character.skills.music = {
    label: "Music", description: "Practise timing, phrasing and an agreed repertoire with other performers.",
    min: 0, max: 100, initial: 0, branch: "Performance", tier: 0, trainingActivity: "train-music",
    gainCurve: structuredClone(world.character.skills.oratory.gainCurve),
  };
  world.character.jobs.push({
    id: "performer", title: "Hired musician", minAge: 16, requirements: { music: 25 },
    description: "Rehearse with other performers and accept paid household engagements. This fictional livelihood does not reconstruct an ancient wage schedule.",
    yearlyEffects: [cash(30), gain("music", 1), gain("oratory", 1)],
  });
  world.character.activities.push({
    id: "train-music", text: "Rehearse a short musical phrase", category: "training", minAge: 8,
    when: all({ type: "cash", op: "gte", value: 5 }, { type: "skill", skill: "music", op: "lt", value: 100 }),
    outcomes: [{ id: "train-music-result", text: "A performer checks your timing as you repeat a phrase and practise entering with the others.", weight: 1,
      effects: [cash(-5), gain("music", 6)] }],
  }, {
    id: "work-performer", text: "Take regular work as a hired musician", category: "career", minAge: 16,
    when: all(skill("music", 25), not({ type: "job", job: "performer" })),
    outcomes: [{ id: "work-performer-accepted", text: "You agree a repertoire and regular rehearsals, then take paid work as a hired musician.", weight: 1,
      effects: [{ type: "job", job: "performer" }, { type: "flag", flag: "retired", value: false }] }],
  });

  const routes = [
    { id: "sculpture", title: "Sculpture", description: "Make works that customers keep and other makers remember.",
      skills: ["sculpture", "carving", "craft"], jobs: ["sculptor", "sculpture-workshop-lead"], sources: ["alexandrian-terracottas", "met-wood-carving"],
      people: ["Philista", "Menon"], activity: "small-figure-order", ordinaryTitle: "A customer's sculpture", ordinaryName: "{name}'s Harbor Figure",
      ordinaryText: "Philista accepts {name}'s Harbor Figure and pays for the finished commission. Menon, who checked the carving, introduces you as its maker. After materials and workshop use, you earn 30 drachmas.",
      prestigeTitle: "A distinguished relief", prestigeName: "{name}'s Procession Relief", prestigeSkill: "sculpture", prestigeLevel: 55,
      prestigeText: "Philista accepts {name}'s Procession Relief after Menon checks its difficult details. Other workers ask to study the finished surface; the commissioned work is credited to you.",
      followups: ["Philista returns with a neighbour who has seen {work:sculpture-first-work}. Menon introduces the new customer, and you agree a small paid order.",
        "Menon brings a younger worker to study {work:sculpture-first-work}. Philista still keeps the figure; you explain a repair and receive payment for checking another piece."],
    },
    { id: "philosophy", title: "Philosophy", description: "Develop arguments that pupils remember and put to use.",
      skills: ["philosophy", "literacy", "oratory"], jobs: ["philosophy-tutor", "court-adviser"], sources: ["bonazzi-2013-eudorus"],
      people: ["Kleio", "Apollonios"], activity: "teach-a-reading-lesson", ordinaryTitle: "A remembered argument", ordinaryName: "{name}'s On Keeping Agreements",
      ordinaryText: "Kleio works through {name}'s On Keeping Agreements until she can explain its reasoning. Apollonios checks the written outline, and the household pays you 20 drachmas for the lesson.",
      prestigeTitle: "A teaching circle", prestigeName: "{name}'s Collected Discussions", prestigeSkill: "philosophy", prestigeLevel: 50,
      prestigeText: "Kleio and Apollonios compare {name}'s Collected Discussions with their notes. You answer their objections and agree regular meetings around the revised work.",
      followups: ["Kleio returns with a pupil of her own and cites {work:philosophy-first-work}. Apollonios pays you to check the copy they will use in their next discussion.",
        "Apollonios asks how {work:philosophy-first-work} applies to a household disagreement. Kleio brings both accounts; you revise an example and receive a further teaching payment."],
    },
    { id: "seafaring", title: "Seafaring", description: "Complete voyages that earn the trust of crew and customers.",
      skills: ["seamanship", "reckoning"], jobs: ["sailor"], sources: ["strabo-alexandria", "wozniak-et-al-2021-berenike"],
      people: ["Nikeratos", "Tasos"], activity: "complete-cargo-voyage", ordinaryTitle: "A completed cargo voyage", ordinaryName: "{name}'s Delta Delivery",
      ordinaryText: "Nikeratos checks the lashings with you before departure. You finish {name}'s Delta Delivery, and Tasos signs for the agreed cargo at the quay. You receive 30 drachmas for the completed work.",
      requirements: all(skill("seamanship", 20), skill("reckoning", 10)), effects: [cash(30), gain("seamanship", 2), gain("reckoning", 1)],
      prestigeTitle: "A trusted difficult passage", prestigeName: "{name}'s Safe Return", prestigeSkill: "seamanship", prestigeLevel: 50,
      prestigeText: "Nikeratos follows your careful plan for {name}'s Safe Return. Tasos confirms that the crew and entrusted cargo reach the quay together, and recommends you for more responsibility.",
      followups: ["Nikeratos names {work:seafaring-first-work} when another crew asks for a reliable hand. Tasos offers you a paid share in preparing their next delivery.",
        "Tasos brings back the receipt from {work:seafaring-first-work} to settle a questioned quantity. Nikeratos confirms your account; the customer pays for another checked delivery."],
    },
    { id: "military", title: "Military", description: "Earn recognition through actual service and responsible decisions.",
      skills: ["warfare", "oratory", "reckoning"], jobs: ["soldier", "officer", "general"], sources: ["alexandrian-war", "fischer-bovet-2013-army"],
      people: ["Dion", "Herakleides"], activity: "complete-service-assignment", minAge: 18,
      ordinaryTitle: "A recorded service assignment", ordinaryName: "{name}'s Guard Supply Record",
      ordinaryText: "Dion checks your completed Guard Supply Record with Herakleides. You account for the equipment entrusted to you and finish the unit assignment; both record your service by name.",
      requirements: all(royalEra, skill("warfare", 15), { type: "any", conditions: ["soldier", "officer", "general"].map(job => ({ type: "job", job })) }),
      effects: [cash(20), gain("warfare", 2), gain("reckoning", 2)],
      prestigeTitle: "A service distinction", prestigeName: "{name}'s Unit Commendation", prestigeSkill: "warfare", prestigeLevel: 50,
      prestigeText: "Dion and Herakleides enter {name}'s Unit Commendation after your careful organisation of a difficult assignment. This recognition supports a later application; it does not itself grant a royal rank.",
      followups: ["Dion recalls {work:military-first-work} while Herakleides settles an old service account. You receive the outstanding payment; this acknowledgement grants no new royal appointment.",
        "Herakleides introduces a household needing someone to check stores. Dion cites {work:military-first-work}; you are paid for the civilian account work, whatever government now rules the city."],
    },
    { id: "commerce", title: "Commerce", description: "Build a trading concern around orders and relationships people remember.",
      skills: ["reckoning", "literacy", "oratory"], jobs: ["clerk", "shopkeeper"], sources: ["muhs-2016-ptolemaic-economy", "dogaer-2026-state-trade", "venticinque-2010-family-affairs"],
      people: ["Sarapion", "Berenike"], activity: "fulfil-significant-order", ordinaryTitle: "A fulfilled customer order", ordinaryName: "{name}'s Storehouse Order",
      ordinaryText: "Sarapion supplies the agreed goods for {name}'s Storehouse Order. Berenike checks the quantities and accepts delivery. After paying the supplier, you retain 20 drachmas and keep the signed order.",
      requirements: all(skill("reckoning", 25), skill("literacy", 15), { type: "cash", op: "gte", value: 20 }),
      effects: [cash(-20), cash(40), gain("reckoning", 2), gain("oratory", 1)],
      prestigeTitle: "A repeat supply agreement", prestigeName: "{name}'s Trading Seal", prestigeSkill: "reckoning", prestigeLevel: 50,
      prestigeText: "Sarapion and Berenike sign a further supply agreement after checking your records. Orders bearing {name}'s Trading Seal now identify the venture you have built together.",
      followups: ["Berenike returns with {work:commerce-first-work} and asks for another order. Sarapion remembers your prompt settlement and supplies the smaller batch you can presently afford.",
        "Sarapion finds a disputed entry from {work:commerce-first-work}. Berenike confirms the old receipt; resolving it earns you payment for checking another household's accounts."],
    },
    { id: "astronomy-calendar", title: "Astronomy & Calendar Tables", description: "Prepare checked tables that readers copy and credit.",
      skills: ["astronomy", "reckoning", "literacy"], jobs: ["sky-table-calculator", "patron-supported-reader"], sources: ["post-2025-calendars", "fanelli-jones-2019-almanac"],
      people: ["Heron", "Isidora"], activity: "copy-a-sky-table", ordinaryTitle: "A corrected seasonal table", ordinaryName: "{name}'s Seasonal Table",
      ordinaryText: "Heron checks the arithmetic in {name}'s Seasonal Table, and Isidora accepts the corrected copy. After writing materials you earn 20 drachmas. The table records calculations and traditional seasonal observations, not a guaranteed forecast.",
      prestigeTitle: "A credited table collection", prestigeName: "{name}'s Compared Tables", prestigeSkill: "astronomy", prestigeLevel: 50,
      prestigeText: "Heron and Isidora compare {name}'s Compared Tables against their copies and credit your corrections. You explain which entries are calculations and where seasonal expectations remain uncertain.",
      followups: ["Isidora returns with {work:astronomy-calendar-first-work} for an updated copy. Heron checks a corrected column with you, and the household pays for the copying.",
        "Heron finds a discrepancy in a copy of {work:astronomy-calendar-first-work}. Isidora helps trace the copied error; you receive payment for a corrected version and retain credit for the method."],
    },
    { id: "music-performance", title: "Music & Performance", description: "Build a repertoire that hosts, fellow performers and pupils remember.",
      skills: ["music", "oratory"], jobs: ["performer"], sources: ["emerit-2013-music", "aneziri-2009-performers", "prauscello-2023-theadelpheia", "coppens-2009-festivals"],
      people: ["Melitta", "Theon"], activity: "complete-paid-engagement", ordinaryTitle: "A paid musical engagement", ordinaryName: "{name}'s Evening Repertoire",
      ordinaryText: "Melitta rehearses the agreed entries with you before Theon's household gathering. You finish {name}'s Evening Repertoire together, and Theon pays the agreed 20 drachmas. The named engagement is your own work, not a claim to have invented its traditional melodies.",
      requirements: skill("music", 20), effects: [cash(20), gain("music", 2), gain("oratory", 1)],
      prestigeTitle: "A distinguished repeat invitation", prestigeName: "{name}'s Ensemble Repertoire", prestigeSkill: "music", prestigeLevel: 50,
      prestigeText: "Melitta follows your agreed signals through {name}'s Ensemble Repertoire. Theon commissions another engagement and credits you for bringing the performers together.",
      followups: ["Theon asks to hear a piece from {work:music-performance-first-work} again. Melitta returns to rehearse it with you; you receive a repeat engagement payment.",
        "Melitta brings a new performer who learned of {work:music-performance-first-work} from Theon's household. You check the entrances together and are paid to lead the rehearsal."],
    },
  ];
  world.legacy = { routes: [], achievements: [] };
  for (const route of routes) {
    const first = `${route.id}-first-work`, prestige = `${route.id}-prestige`;
    world.legacy.routes.push({ id: route.id, title: route.title, description: route.description,
      skillIds: route.skills, jobIds: route.jobs, achievementIds: [first, prestige] });
    for (const [id, kind, title, nameTemplate] of [[first, "ordinary", route.ordinaryTitle, route.ordinaryName], [prestige, "prestige", route.prestigeTitle, route.prestigeName]]) {
      world.legacy.achievements.push({ id, routeId: route.id, title, kind, nameTemplate, people: route.people,
        description: kind === "ordinary" ? route.description : `Distinguished work recognized by ${route.people.join(" and ")}.`,
        evidence: "fictional", sourceIds: route.sources });
    }
    if (route.requirements) {
      world.character.activities.push({ id: route.activity, text: route.ordinaryTitle, category: "career", minAge: route.minAge ?? 16,
        when: all(route.requirements, not(earned(first))),
        outcomes: [{ id: `${route.activity}-completed`, text: route.ordinaryText, weight: 1, effects: [...route.effects, award(first)] }] });
    } else {
      const activity = world.character.activities.find(item => item.id === route.activity);
      // A small supervised figure is the first sale, before the established
      // Sculpture-25 occupation. Full training prerequisites stay unchanged.
      if (route.id === "sculpture") {
        const lowerFirstOrder = condition => {
          if (condition.type === "skill" && condition.skill === "sculpture") condition.value = 10;
          if (condition.conditions) condition.conditions.forEach(lowerFirstOrder);
        };
        lowerFirstOrder(activity.when);
      }
      activity.outcomes[0].text = route.ordinaryText;
      activity.outcomes[0].effects.push(award(first));
    }
    const advanced = all(earned(first), skill(route.prestigeSkill, route.prestigeLevel),
      not(earned(prestige)), ...(route.id === "military" ? [royalEra] : []));
    world.events.push({ id: `legacy-${route.id}-prestige`, title: route.prestigeTitle,
      text: `${route.people.join(" and ")} ask you to attempt a more demanding undertaking after your earlier work. Preparation helps, but acceptance is uncertain.`,
      trigger: { type: "random", weight: 2 }, rarity: "rare", maxOccurrences: 1,
      when: all({ type: "age", op: "gte", value: 24 }, advanced), evidence: "fictional", sourceIds: route.sources,
      choices: [{ id: `attempt-${prestige}`, text: `Attempt ${route.prestigeTitle.toLowerCase()}`,
        opportunity: { label: route.prestigeTitle, outcomeIds: [`${prestige}-accepted`] },
        outcomes: [{ id: `${prestige}-accepted`, text: route.prestigeText, weight: 40,
          weightModifiers: [{ when: skill(route.prestigeSkill, 70), multiplier: 1.8, reason: "Your developed technique supports the undertaking" }],
          effects: [cash(60), bonds(3), award(prestige)] },
        { id: `${prestige}-unfinished`, text: `${route.people.join(" and ")} explain which parts need further work. You keep the earlier accomplishment and practise the difficult part.`, weight: 60,
          effects: [gain(route.prestigeSkill, 2)] }] },
      { id: `decline-${prestige}`, text: "Keep to your current work", outcomes: [{ id: `${prestige}-declined`, text: "You keep to the work you have already agreed.", weight: 1, effects: [] }] }],
    });
    route.followups.forEach((text, index) => world.events.push({ id: `legacy-${route.id}-callback-${index + 1}`,
      title: index ? "Your earlier work is remembered" : "A familiar contact returns", text,
      trigger: { type: "age", at: 0 }, mode: "automatic", choices: [], maxOccurrences: 1,
      when: earned(first, index ? 5 : 2), effects: [cash(index ? 15 : 20), gain(route.skills[0], 1)],
      evidence: "fictional", sourceIds: route.sources,
    }));
  }
  // Selected cross-route stories require both recorded works; they never invent
  // an unseen customer or confer an unearned job/appointment.
  world.events.push({ id: "legacy-shared-cargo", title: "Two records describe the same delivery",
    text: "Nikeratos brings the quay receipt while Berenike checks the household order. You compare {work:seafaring-first-work} and {work:commerce-first-work}, settle their question and are paid for the extra account work.",
    trigger: { type: "age", at: 0 }, mode: "automatic", choices: [], maxOccurrences: 1,
    when: all(earned("seafaring-first-work", 1), earned("commerce-first-work", 1)), effects: [cash(20), gain("reckoning", 1)], evidence: "fictional", sourceIds: ["muhs-2016-ptolemaic-economy"],
  }, { id: "legacy-performance-passage", title: "A passage for the performers",
    text: "Melitta needs help arranging a passage for a household engagement. Nikeratos remembers {work:seafaring-first-work}, and you use the plan from {work:music-performance-first-work} to agree what the performers will need aboard.",
    trigger: { type: "age", at: 0 }, mode: "automatic", choices: [], maxOccurrences: 1,
    when: all(earned("music-performance-first-work", 1), earned("seafaring-first-work", 1)), effects: [cash(20), gain("music", 1), gain("seamanship", 1)], evidence: "fictional", sourceIds: ["aneziri-2009-performers"],
  });
  return world;
}
