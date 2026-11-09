// Ordinary scenes and small decisions are authored fiction. They do not add
// historical claims, disease incidence or hidden changes to career/death odds.
const age = (op, value) => ({ type: "age", op, value });
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const job = (...ids) => any(...ids.map(job => ({ type: "job", job })));
const trained = (skill, value = 10) => ({ type: "skill", skill, op: "gte", value });
const cashAtLeast = value => ({ type: "cash", op: "gte", value });
const relationship = status => ({ type: "relationship", status });
const children = value => ({ type: "children", op: "gte", value });
const childAge = (min, max) => ({ type: "child-age", min, max });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const cash = delta => ({ type: "cash", delta });
const partner = delta => ({ type: "closeness", target: "partner", delta });
const childTie = delta => ({ type: "closeness", target: "children", delta });
const one = (id, text, result, effects = [], when) => ({
  id, text, ...(when ? { when } : {}),
  outcomes: [{ id: `${id}-result`, text: result, weight: 1, effects }],
});

export function applyEventVariety(world) {
  const stories = [];
  const add = (min, max, rows, condition) => {
    for (const [id, title, text, extra, once = false] of rows) {
      stories.push({
        id: `variety-${id}`, title, text, trigger: { type: "random", weight: 1 },
        when: all(age("gte", min), age("lte", max), ...(condition ? [condition] : []), ...(extra ? [extra] : [])),
        mode: "automatic", effects: [], choices: [], evidence: "fictional", sourceIds: [],
        maxOccurrences: once ? 1 : 2, cooldownYears: 12,
      });
    }
  };

  add(1, 4, [
    ["small-basket-bed", "A different sleeping place", "Your household moves your sleeping basket away from a draft. You wake in the unfamiliar corner and cry until someone picks you up."],
    ["small-first-steps", "Across the mat", "You cross a mat toward the doorway. An adult moves a basket out of your path and calls you back from the street.", undefined, true],
    ["small-pot-lid", "A lid on the floor", "Someone leaves a pot lid within reach. You bang it against the floor until the cook trades it for a wooden spoon."],
    ["small-cat-tail", "The cat keeps its distance", "You reach for a cat resting near the wall. It moves out of reach and watches you from a shelf."],
    ["small-supper-lap", "Supper on a lap", "A relative keeps you on their lap through supper. You take food from their bowl and fall asleep before the dishes are cleared."],
    ["small-washing-cloth", "A cloth to hold", "While someone washes you, they let you hold the clean cloth. You drop it into the water and laugh at the splash."],
    ["small-rain-inside", "Waiting out the rain", "Rain keeps the household indoors. Someone moves a basket so you have room to crawl while the adults finish their work."],
    ["small-dog-bark", "A bark at the door", "A dog barks outside the doorway. You hurry back to a familiar adult and watch it from behind their legs."],
    ["small-shared-sleep", "A restless night", "You will not settle to sleep. The adults take turns carrying you until the room finally becomes quiet."],
    ["small-pebble-count", "Stones in a bowl", "A relative gives you a bowl and a few smooth stones. You move them in and out while they keep count aloud."],
    ["small-new-sandals", "Sandals that slip", "Your household fits a pair of small sandals to your feet. You keep kicking one off, and someone keeps putting it back."],
    ["small-curtain-game", "Behind the hanging cloth", "An older child hides behind a hanging cloth and calls your name. You pull the edge aside each time they disappear."],
    ["small-first-cup", "Holding the cup", "Someone helps you drink from a small cup. Most reaches your mouth, and the rest runs down the front of your clothes.", undefined, true],
    ["small-different-carer", "An afternoon with a relative", "The usual carer has an errand. A relative looks after you, learning which song and which toy will keep you settled."],
  ]);

  add(5, 11, [
    ["child-wrong-basket", "Two similar baskets", "You bring home the wrong basket from an errand. An adult goes back with you, and the shopkeeper swaps it for the right one."],
    ["child-seed-game", "A game with seeds", "Children mark a game on the ground and use seeds as counters. You argue over a move, erase the lines and start again."],
    ["child-string-sail", "A scrap sail", "You tie a scrap of cloth to a stick and float it in a shallow basin. The little boat tips over as soon as you let go."],
    ["child-stray-chick", "Under the bench", "A chick slips into the room. You crouch under a bench to catch it while its owner waits at the door."],
    ["child-olive-pit", "Pits to sort", "After a meal, you sort olive pits into neat rows. Someone sweeps them into a bowl before the next task can begin."],
    ["child-faded-mark", "A faded doorway mark", "You use a mark on a wall to remember a turning. When the wall is patched, you have to learn another way to recognize the street."],
    ["child-warm-bread", "The bread is still warm", "You carry a loaf home wrapped in cloth. You keep switching hands because the bread is hotter than you expected."],
    ["child-jug-strap", "A strap comes loose", "The strap on a small jug slips from its knot. You set the jug down and wait for someone to retie it before carrying on."],
    ["child-store-room", "A shelf to clear", "An adult asks you to clear the bottom shelf of a storeroom. You find a missing spoon behind the jars."],
    ["child-courtyard-song", "Getting the words wrong", "You try to join a song in the courtyard. Another child quietly teaches you the words you keep missing."],
    ["child-shade-lines", "Following the shade", "You trace the edge of a building's shade on the ground. Later, you come back and find the line has moved."],
    ["child-loose-bead", "A bead in the dust", "A loose bead rolls between the floor stones. You work it out with a thin stick and return it to its owner."],
    ["child-watch-weighing", "Watching the scales", "You stand beside an adult while a seller weighs a purchase. On the way home, they explain why they watched both sides of the scales."],
    ["child-guest-name", "Remembering a visitor's name", "A visitor asks if you remember them. You remember the food they brought last time, but need help with the name."],
  ]);

  add(12, 19, [
    ["youth-early-start", "Before the street fills", "You leave early to finish an errand before the street gets busy. The shop has not opened, so you wait with the other early arrivals."],
    ["youth-corrected-knot", "A knot that holds", "Someone checks the knot on a bundle you tied. They undo it, show you another turn and ask you to try again."],
    ["youth-name-mixup", "Two people with the same name", "You deliver a message to the wrong person with the right name. They point you toward the other household before you walk away."],
    ["youth-worn-handle", "A handle needs wrapping", "A tool handle is rubbing your palm. You wrap it with a strip of cloth and finish the small job more comfortably."],
    ["youth-work-supper", "A late supper", "A task runs past the meal hour. Your household saves a portion and asks what kept you when you finally arrive."],
    ["youth-price-memory", "Remembering the price", "You repeat the agreed price while walking to make a purchase. At the stall, you remember it but have to count the coins twice."],
    ["youth-carry-pair", "Carrying it together", "A bundle is awkward rather than heavy. Another young worker takes the far end, and the two of you get it through the doorway."],
    ["youth-swept-yard", "The yard fills again", "You finish sweeping a work yard just before a delivery arrives. Loose packing covers the clean ground, and you fetch the broom again."],
    ["youth-evening-wager", "A contest with no prize", "A group challenges each other to balance a pebble on a narrow post. Nobody manages it for long, and no money changes hands."],
    ["youth-saved-offcut", "Keeping an offcut", "A worker lets you keep a small offcut after clearing the bench. You bring it home and use it to wedge a loose shutter."],
    ["youth-second-check", "Checking before leaving", "You return to check a delivery before leaving the yard. One item is missing, and you find it where the cart was unloaded."],
    ["youth-sore-voice", "A message over the noise", "You try to call a message across a noisy street. Nobody hears the whole thing, so you walk over and say it again."],
  ]);

  add(18, 64, [
    ["adult-empty-oil", "The lamp goes out", "The lamp runs out of oil in the middle of an evening task. You leave the last part until daylight."],
    ["adult-rent-receipt", "Checking a payment mark", "A household payment is questioned. You find the mark recording the earlier payment and settle the mistake without paying again."],
    ["adult-salt-bag", "A split bag", "A bag splits on the way home. You borrow a bowl from a nearby stall, gather what you can and return the bowl before supper."],
    ["adult-cart-detour", "A cart blocks the lane", "A cart with a damaged wheel blocks your lane. The people carrying goods pass them around it until the owner clears the way."],
    ["adult-rope-line", "Washing on the line", "A line holding washed clothes sags into the dust. You take the clothes down, tighten the rope and rinse the fallen pieces again."],
    ["adult-water-turn", "Waiting for your turn", "You arrive to collect water just as several other households do. Everyone waits while a cracked vessel is moved out of the way."],
    ["adult-no-small-coins", "No smaller coins", "A seller cannot make change for your purchase. You visit another stall for a small item and come back with a more useful set of coins."],
    ["adult-lent-pan", "Returning a pan", "A neighbor brings back a borrowed pan with food still in it. You share the food and remember to return their bowl the next day."],
    ["adult-stale-loaf", "A loaf for tomorrow", "A loaf has gone too dry to eat on its own. You soften pieces in a bowl rather than throw it away."],
    ["adult-mat-reed", "A reed catches your foot", "A loose reed is sticking out of the sleeping mat. You trim it and turn the worn edge toward the wall."],
    ["adult-waiting-seller", "The seller has moved", "You go to the usual place for a purchase and find a different seller. Someone points you to the stall you were looking for."],
    ["adult-reserved-bench", "Room on the bench", "A visitor arrives while the room is being used for work. You clear a place on a bench and move the tools back after they leave."],
    ["adult-too-many-onions", "More onions than planned", "A household purchase turns out larger than expected. You swap part of it with a neighbor before the food spoils."],
    ["adult-shutter-pin", "A rattling shutter", "A shutter keeps knocking in the wind. You find its loose pin and secure it with a small wooden wedge."],
    ["adult-dark-stair", "A dark stair", "You pause at an unlit stair until someone brings a lamp. The wait is shorter than feeling your way down with a full basket."],
    ["adult-food-cover", "Keeping flies off the food", "You spend part of a meal chasing flies away. Before the next meal, you find a cloth wide enough to cover the serving bowl."],
  ]);

  add(55, 99, [
    ["later-shorter-round", "A shorter round of errands", "You combine two nearby errands and leave the farther one for another day. The household still has what it needs for supper."],
    ["later-window-seat", "Moving the seat", "You move a seat nearer the doorway for better light. Someone objects to the narrow passage, and you find a place that suits you both."],
    ["later-familiar-recipe", "Explaining the recipe", "A younger person asks how you prepare a familiar dish. You give the quantities, then have to explain what you mean by a small handful."],
    ["later-old-container", "A lid for an old jar", "The lid of an old storage jar no longer fits well. You test two others before finding one that keeps the contents covered."],
    ["later-missing-appointment", "The visitor is late", "A visitor arrives long after the agreed time. You have already eaten, so you put out a small plate while they explain the delay."],
    ["later-new-shop", "Trying a nearer shop", "You try a shop closer to home. The choice is smaller, but the shorter walk makes it useful for ordinary purchases."],
    ["later-sorted-cord", "Sorting a tangle of cord", "You sit down with a tangled bundle of cord. By the time someone asks for a length, you have enough of it untangled to help."],
    ["later-corrected-directions", "The streets have changed", "You give someone directions, then remember that a passage has been closed. You call them back before they turn the corner."],
    ["later-old-work-token", "Something from an old household task", "You find a small item left from an old household task. You explain what it was used for before putting it back with the other things."],
    ["later-carry-light", "Taking the lighter basket", "Two baskets need carrying. You take the lighter one and agree where to meet the person carrying the other."],
    ["later-outside-listening", "Listening at the doorway", "You sit by the doorway while people discuss a delivery. You recognize the place they mention and settle a disagreement about the route."],
    ["later-grain-scoop", "A useful measure", "A household measure has lost its handle. You show someone which unbroken cup can hold the same amount until it is repaired."],
  ]);

  add(14, 99, [
    ["trade-porter-balancing", "Balancing the load", "A load keeps slipping to one side. You stop, move the packing and ask another porter to check it before setting off.", job("porter")],
    ["trade-porter-mark", "An unclear cargo mark", "Two bundles have similar cargo marks. You leave them apart until the person receiving the delivery identifies the right one.", job("porter")],
    ["trade-potter-drying", "Pots drying too quickly", "The edges of a fresh clay piece are drying faster than its base. You cover part of it and return to check it later.", job("potter", "ceramic-decorator", "pottery-workshop-lead")],
    ["trade-potter-stack", "Finding space for the firing", "You rearrange a group of dry pots so they will fit the available kiln space. A narrow piece needs a place of its own.", job("potter", "ceramic-decorator", "pottery-workshop-lead")],
    ["trade-carver-grain", "Following the wood grain", "A cut starts to lift a splinter along the wood grain. You turn the piece and work back from the other direction.", job("wood-carver", "carving-workshop-lead")],
    ["trade-carver-pair", "Matching two fittings", "Two wooden fittings are meant to match. You set them side by side and remove a little more from the uneven one.", job("wood-carver", "carving-workshop-lead")],
    ["trade-sculptor-light", "Checking the relief in daylight", "A shallow line in the stone disappears when you move the lamp. You check the relief in daylight before deciding whether it needs another cut.", job("sculptor", "sculpture-workshop-lead")],
    ["trade-clerk-total", "A total checked twice", "You check a column of quantities and get two different totals. A line was counted twice; you correct it before the record is handed over.", job("clerk")],
    ["trade-copyist-damp", "Keeping a sheet dry", "Water reaches the edge of the workbench. You lift the written sheet clear and dry the bench before continuing the copy.", job("copyist", "patron-supported-reader")],
    ["trade-shopkeeper-display", "Moving the display", "A doorway display keeps getting knocked by people passing. You move it farther inside and leave more room to enter.", job("shopkeeper")],
    ["trade-sailor-coil", "A coil out of place", "A loose coil of rope is lying where the crew walks. You put it away before the next load comes aboard.", all(age("gte", 16), job("sailor"))],
    ["trade-sailor-shore", "Waiting ashore", "The crew is ready before the cargo is. You wait ashore and check the bundles when the last delivery finally arrives.", all(age("gte", 16), job("sailor"))],
    ["trade-tutor-example", "A different example", "A learner cannot follow an argument. You try an example about buying bread, and they can finally explain the point back to you.", all(age("gte", 18), job("philosophy-tutor"))],
    ["trade-astronomy-line", "A line copied out of place", "A copied sky table has one line shifted into the wrong column. You compare it with the source and mark where the copy must be corrected.", all(age("gte", 18), job("sky-table-calculator"))],
    ["trade-astrology-question", "A client asks again", "A client asks you to repeat part of a traditional chart interpretation. You explain what the reading claims and where you cannot give a definite answer.", all(age("gte", 18), { type: "year", op: "gte", value: -29 }, job("astrologer"))],
    ["trade-army-kit", "Checking the kit", "You spread out your equipment and replace a worn fastening. Another soldier points out a strap you had missed.", all(age("gte", 18), job("soldier", "officer", "general"))],
    ["trade-officer-tally", "The supply tally", "The supply tally does not match the delivered bundles. You have the bundles opened and counted before accepting the delivery.", all(age("gte", 22), job("officer", "general"))],
    ["trade-court-wait", "Waiting outside the meeting", "A meeting runs late. You compare notes with another attendant and check which papers you will need when called inside.", all(age("gte", 24), job("court-adviser"))],
  ]);

  add(16, 99, [
    ["tie-courting-visit", "A visit cut short", "You meet the person you are courting, but a household errand cuts the visit short. You agree on another time before leaving.", relationship("courting")],
    ["tie-courting-gift", "A small thing remembered", "The person you are courting brings something you mentioned needing. You had forgotten the conversation, but they had remembered it.", relationship("courting")],
    ["tie-married-late", "Keeping supper warm", "One of you comes home late. The other keeps part of supper covered, and you catch up while the dishes are put away.", relationship("married")],
    ["tie-married-space", "Making room for two tasks", "You and your spouse both need the same work surface. You move one task to a tray and finish without another argument.", relationship("married")],
    ["tie-child-question", "Another question", "A child in your household asks why the moon does not look the same every night. You watch it together and answer what you can.", all(children(1), childAge(4, 14))],
    ["tie-child-sandals", "Sandals left in the way", "A child leaves sandals where everyone walks. After someone trips over them, you find a place where the child can put them each day.", all(children(1), childAge(2, 10))],
    ["tie-child-help", "Help without being asked", "One of your children helps put away the meal without being asked. The job goes faster, though a bowl ends up on the wrong shelf.", all(children(1), childAge(4, 14))],
    ["tie-divorced-bundle", "A bundle returned", "After the separation, a bundle of your things reaches your household. You check it and send back an item that belongs to your former spouse.", relationship("divorced"), true],
    ["tie-single-invitation", "A place at someone else's meal", "A neighbor invites you to a meal with their household. You bring a small contribution and stay to help clear the dishes.", any(relationship("single"), relationship("divorced"))],
    ["tie-sibling-news", "News carried by a relative", "A relative brings household news from across the city. You ask them to take a short reply when they next visit.", undefined],
  ]);

  const decisions = [];
  const decision = (id, title, text, min, max, choices, condition, once = false) => {
    decisions.push({ id: `variety-choice-${id}`, title, text,
      trigger: { type: "random", weight: 1 },
      when: all(age("gte", min), age("lte", max), ...(condition ? [condition] : [])),
      maxOccurrences: once ? 1 : 2, cooldownYears: 14, evidence: "fictional", sourceIds: [], choices });
  };

  decision("broken-jar", "A jar breaks on your errand", "A small empty jar slips from your hands. Nobody saw it fall, and the household will ask where it is.", 6, 11, [
    one("tell-household", "Tell the household what happened", "You show the broken pieces. An adult helps you clear them and sends you with an unbroken jar next time.", [stat("bonds", 1)]),
    one("try-a-repair", "Ask someone to show you a repair", "The jar will not hold water again, but a worker shows you how to secure the pieces for another use.", [skill("craft", 1)]),
    one("hide-breakage", "Hide the pieces for now", "The missing jar is noticed. You have to explain the breakage and why you hid it.", [stat("bonds", -1)]),
  ]);
  decision("game-boundary", "An argument over the game", "The children disagree about where the playing area ends. The argument is taking longer than the game.", 5, 11, [
    one("remark-lines", "Draw clear lines and start again", "You draw new boundaries where everyone can see them. The game starts over with less arguing.", [stat("bonds", 1)]),
    one("suggest-turns", "Ask each child to explain their rule", "You hear several different rules. The group agrees on one version for this afternoon.", [skill("oratory", 1)]),
    one("leave-game", "Find something else to do", "You leave the game and spend the afternoon near home. The others are still arguing when you pass later."),
  ]);
  decision("water-spill", "The water is too heavy", "You are asked to carry a small water jar. It is full enough that you keep spilling some as you walk.", 6, 11, [
    one("ask-lighter-fill", "Ask for a smaller load", "An adult pours some water into another vessel. You carry the lighter jar home without losing more.", [stat("knowledge", 1)]),
    one("two-child-carry", "Ask another child to carry it with you", "You and another child hold the jar between you. You have to agree on each turn, but the water reaches home.", [stat("bonds", 1)]),
    one("keep-full-load", "Carry it slowly on your own", "You stop several times to change hands. By the time you arrive, the jar is lighter and your arms are tired.", [stat("health", -1)]),
  ]);
  decision("clay-scraps", "Clay left on the bench", "A potter lets you use a little leftover clay while an adult watches. There is time for one small piece.", 7, 12, [
    one("clay-cup", "Try shaping a tiny cup", "You pinch up the sides of a small cup. The rim is uneven, and the potter shows you where you made it too thin.", [skill("pottery", 1)]),
    one("clay-counter", "Make counters for a game", "You roll the clay into small counters and press a mark into each one. The other children help you count them.", [skill("reckoning", 1)]),
    one("watch-potter", "Watch the potter instead", "You leave the clay alone and watch how the potter keeps the sides of a vessel even.", [stat("knowledge", 1)]),
  ]);
  decision("message-forgotten", "Part of the message is missing", "Halfway through an errand, you realize you cannot remember the end of the message.", 7, 12, [
    one("ask-message-again", "Go back and ask again", "The sender repeats the message. You say it back before setting off a second time.", [stat("knowledge", 1)]),
    one("take-help", "Ask a familiar adult to come with you", "A familiar adult walks back with you and helps you check the message before you deliver it.", [stat("bonds", 1)]),
    one("deliver-remembered", "Deliver only the part you remember", "The recipient has questions you cannot answer. An adult must make another trip to put the message right."),
  ]);

  decision("measure-error", "Your measurements do not match", "You help measure a length of material. Your result differs from the worker checking it.", 12, 19, [
    one("measure-together", "Measure it together from the same end", "You had started from a different mark. Measuring together shows where the difference came from.", [skill("reckoning", 1)]),
    one("mark-again", "Practise marking a spare piece", "You practise on a spare piece until the marks line up with the worker's measure.", [skill("craft", 1)]),
    one("leave-measuring", "Let the worker finish the measuring", "The worker finishes the measurements while you clear the space for the next task."),
  ]);
  decision("first-small-wages", "A small payment of your own", "You receive 5 drachmas for a completed errand. Someone at home asks what you plan to do with it.", 12, 17, [
    one("save-errand-pay", "Keep the 5 drachmas", "You put the payment away and check where you have stored it before leaving the room.", [cash(5)]),
    one("share-errand-pay", "Use the payment for a shared meal", "You bring home food bought with the errand payment. There is a little more to share at supper.", [stat("bonds", 2)]),
    one("lesson-errand-pay", "Trade the payment for help with numbers", "A worker spends time checking simple sums with you in exchange for the payment.", [skill("reckoning", 2)]),
  ], undefined, true);
  decision("late-delivery", "A delivery before closing", "Someone offers you 5 drachmas to deliver a small parcel before a nearby shop closes. It will use the time you meant to spend practising.", 12, 19, [
    one("do-late-delivery", "Make the delivery for 5 drachmas", "You arrive before the shop closes and bring back the acknowledgment. The sender pays you 5 drachmas.", [cash(5), stat("health", -1)]),
    one("keep-practice-time", "Keep the time for tool practice", "Someone else takes the parcel. You use the time to practise making a clean cut under a worker's eye.", [skill("craft", 1)]),
    one("split-task", "Ask a friend to make the trip with you", "Your friend helps you finish the delivery. You share the payment and spend it together on food.", [stat("bonds", 1)]),
  ]);
  decision("damaged-measure", "A chipped measuring cup", "A measuring cup has a chipped rim. You are about to use it for a household purchase.", 12, 19, [
    one("borrow-good-measure", "Borrow an unbroken measure", "You borrow a sound measure and check the purchase with it before returning it.", [skill("reckoning", 1)]),
    one("ask-about-chip", "Ask how much the damage changes it", "A worker compares the damaged cup with another. You learn why filling it to the chipped rim gives a different amount.", [stat("knowledge", 1)]),
    one("send-measure-back", "Take it back and ask for another", "The household gives you another cup. The errand takes longer, but there is no argument about the quantity."),
  ]);
  decision("unfamiliar-customer", "A customer you cannot understand", "A customer asks a question in words you do not follow. They point at the goods and begin again.", 12, 19, [
    one("find-translator", "Find someone who understands them", "A nearby worker explains the request. You stay to hear the answer and recognize a few words the next time.", [stat("knowledge", 1)]),
    one("use-demonstration", "Show the goods and check by gesture", "You set out the possible items and let the customer indicate what they need. A worker checks before anything is sold.", [skill("oratory", 1)]),
    one("call-worker", "Leave the request to an experienced worker", "An experienced worker takes over while you return to the task you were doing."),
  ]);

  decision("shared-storage", "Room for a neighbor's goods", "A neighbor asks to keep a few dry baskets in your household's storage space for a short time.", 18, 69, [
    one("lend-storage", "Make room without charging", "You move your household's baskets together and make space. The neighbor collects everything on the agreed day.", [stat("bonds", 1)]),
    one("charge-storage", "Agree on a 5-drachma storage payment", "You agree on which baskets can stay and for how long. The neighbor pays 5 drachmas when collecting them.", [cash(5)]),
    one("decline-storage", "Keep the space for your own household", "The neighbor finds another place. You keep the storage area ready for your own deliveries."),
  ]);
  decision("extra-change", "Too much change", "After a purchase, you find that the seller returned 5 drachmas more than you were owed.", 18, 79, [
    one("return-change", "Return the extra coins", "You go back and show the seller the mistake. They check the payment and thank you.", [stat("bonds", 1)]),
    one("keep-change", "Keep the extra coins", "You put the extra coins away. On a later visit, the seller questions the earlier payment.", [cash(5), stat("bonds", -1)]),
  ], undefined, true);
  decision("wrong-delivery", "The wrong bundle arrives", "A delivery to your household contains goods meant for someone else. The person who brought it has already left.", 18, 79, [
    one("track-carrier", "Find the carrier and exchange the bundle", "You find the carrier before the next delivery is unloaded. The two bundles are exchanged.", [stat("bonds", 1)]),
    one("read-delivery-mark", "Ask a reader to check the delivery mark", "A reader identifies the household named on the bundle. You take it there and ask where your own delivery went.", [stat("knowledge", 1)]),
    one("wait-carrier", "Keep it aside for the carrier's return", "You leave the bundle unopened. The carrier comes back after the other household notices the mistake."),
  ]);
  decision("repair-complaint", "A repair does not hold", "A customer returns a small wooden fitting you repaired. The joint has opened, and they want you to put it right.", 16, 79, [
    one("redo-fitting", "Redo the joint without another charge", "You take the joint apart and make a better fit. The customer checks it before leaving.", [skill("craft", 1), stat("bonds", 1)]),
    one("refund-fitting", "Return 5 drachmas", "You return 5 drachmas and take the fitting back. You examine the failed joint before deciding whether to reuse the wood.", [cash(-5), skill("craft", 1)], cashAtLeast(5)),
    one("ask-experienced-help", "Ask a more experienced worker to inspect it", "The worker points out where the wood was split. You explain the fault to the customer and agree on a replacement."),
  ], trained("craft", 10));
  decision("relative-stall", "A relative wants help at a stall", "A relative is trying a small market stall and asks you to help for an afternoon.", 18, 64, [
    one("help-stall", "Help without taking a share", "You watch the goods while your relative handles customers. They finish the afternoon with the stock in order.", [stat("bonds", 1)]),
    one("check-stall-sums", "Check the stock and payment records", "You help count the remaining goods and match the payments. A missed entry explains the uneven total.", [skill("reckoning", 1)]),
    one("decline-stall", "Keep the time for your own household", "Your relative finds other help. You finish the tasks already waiting at home."),
  ]);
  decision("food-purchase", "A joint purchase of grain", "Several neighbors want to combine a grain purchase. Your share would cost 10 drachmas and needs someone to check the quantities.", 18, 79, [
    one("join-food-purchase", "Pay 10 drachmas and help divide it", "You contribute 10 drachmas and help measure each household's share. Everyone leaves with the agreed amount.", [cash(-10), stat("bonds", 2), skill("reckoning", 1)], cashAtLeast(10)),
    one("help-food-measure", "Help check the measure without joining", "You help compare the measures before the grain is divided. The neighbors thank you and keep the shares separate.", [skill("reckoning", 1)]),
    one("buy-separately", "Keep buying for your own household", "You leave the shared purchase to the neighbors and keep to your usual food arrangement."),
  ]);
  decision("unfinished-hinge", "A hinge still needs fitting", "You have promised to fit a wooden hinge for someone nearby. Another task has used most of the time you set aside.", 16, 74, [
    one("finish-hinge", "Finish the fitting before going home", "You check the hinge against the opening and finish it before leaving. The extra work makes for a late meal.", [skill("craft", 1), stat("health", -1)]),
    one("reschedule-hinge", "Explain the delay and agree on another time", "You tell the household before they start waiting for you. They agree to the new time.", [skill("oratory", 1)]),
    one("find-hinge-help", "Ask another worker to finish it", "Another worker can finish the fitting. You pass over your measurements and leave the rest of the task to them."),
  ], trained("craft", 10));
  decision("late-wages", "A payment arrives late", "Someone who owes you 10 drachmas for a small job says they cannot pay the whole amount today.", 16, 69, [
    one("accept-half-now", "Accept 5 drachmas and leave the rest for later", "They pay 5 drachmas now. You agree that the remaining amount is still owed.", [cash(5)]),
    one("accept-goods-payment", "Accept useful household goods instead", "You agree on goods your household needs and settle the payment that way. The next meal takes less preparation.", [stat("bonds", 1)]),
    one("wait-agreed-payment", "Agree on a later collection day", "You leave without payment and agree when to return. You keep a note of the amount so there is no dispute later.", [skill("reckoning", 1)]),
  ]);

  decision("courting-plan", "Different plans for the visit", "You and the person you are courting have made different plans for the same free afternoon.", 16, 79, [
    one("visit-their-household", "Join the visit they planned", "You go with their plan and help carry something for the visit. You have time to talk on the return walk.", [partner(2)]),
    one("suggest-new-time", "Choose another time together", "You compare the errands each of you must finish and find a time that works for both.", [partner(1), skill("oratory", 1)]),
    one("keep-own-plan", "Keep your own plan this time", "You keep the afternoon for your own plans. The other person is disappointed, but the disagreement stays small.", [partner(-1)]),
  ], relationship("courting"));
  decision("household-spending", "Two uses for the same coins", "You and your spouse disagree about whether spare cash should go toward supplies or a shared meal with relatives.", 18, 89, [
    one("compare-supplies", "Check the household supplies together", "You go through what is left before deciding. The discussion settles which purchases can wait.", [partner(1), skill("reckoning", 1)]),
    one("host-small-meal", "Spend 5 drachmas on a smaller shared meal", "You agree on a smaller meal and spend 5 drachmas. There is still time to talk after the visitors arrive.", [cash(-5), partner(2)], cashAtLeast(5)),
    one("delay-spending", "Leave the coins untouched for now", "You postpone the purchase and the meal. The money stays available, though the decision still needs to be made."),
  ], relationship("married"));
  decision("child-wants-letters", "A child asks about letters", "One of your children asks you to explain marks on a delivered message. You have a little time before the next task.", 20, 89, [
    one("find-child-reader", "Ask a familiar reader to explain them", "A reader explains a few marks with you both listening. The child repeats them on the way home.", [childTie(2), stat("knowledge", 1)]),
    one("teach-child-known", "Show the child the marks you know", "You explain the marks you recognize and leave the unfamiliar ones for someone who knows more.", [childTie(2)], trained("literacy", 10)),
    one("promise-child-later", "Finish the household task first", "You put the message somewhere safe and finish the task. The child goes back to playing nearby."),
  ], all(children(1), childAge(5, 13)));
  decision("child-wants-help", "A child wants to help with work", "One of your children asks for a task while you are arranging materials. There are safe small jobs, but they will need watching.", 20, 89, [
    one("child-sort-materials", "Let the child sort harmless scraps nearby", "You set aside small safe pieces to sort and keep the tools out of reach. You check the piles together when the child finishes.", [childTie(2)]),
    one("child-explain-work", "Explain the task without having them do it", "You show the finished pieces and explain what each part does. The child asks more questions than you expected.", [childTie(1), stat("bonds", 1)]),
    one("child-keep-work-clear", "Keep the work area clear today", "You explain that the task needs your full attention. The child finds another place to play."),
  ], all(children(1), childAge(4, 14)));
  decision("after-separation", "A shared possession after separation", "A household item was left between you and your former spouse. A relative asks you to settle who will keep it.", 18, 89, [
    one("former-return-item", "Send it to your former spouse", "You send the item with the relative and ask for an acknowledgment that it arrived.", [stat("bonds", 1)]),
    one("former-discuss-item", "Arrange a practical agreement", "You send a clear account of which items each household still needs. The relative helps carry the reply.", [skill("oratory", 1)]),
    one("former-postpone-item", "Keep it set aside until you can agree", "You leave the item unused and separate from the rest of your things. The question remains open."),
  ], relationship("divorced"), true);

  decision("pottery-mark", "A customer wants a different pattern", "A customer changes the painted pattern after you have prepared a group of clay vessels. The pieces have not yet been fired.", 14, 79, [
    one("pottery-repaint", "Redo the pattern on the agreed pieces", "You remove the unfinished decoration and paint the new pattern. The extra work gives you more practice, but delays the batch.", [skill("pottery", 1), stat("health", -1)]),
    one("pottery-sample", "Make a sample before changing the batch", "You paint one sample and show it to the customer. You agree which details to keep before starting the rest.", [skill("pottery", 1), skill("oratory", 1)]),
    one("pottery-keep-contract", "Offer the original pattern as agreed", "You show the original sample and explain what was agreed. The customer accepts it rather than wait for a new batch."),
  ], job("potter", "ceramic-decorator", "pottery-workshop-lead"));
  decision("carving-warped-board", "The board is not straight", "A board prepared for a carved fitting has bent while drying. Cutting the planned shape now would leave a poor fit.", 14, 79, [
    one("carving-smaller-fit", "Mark a smaller fitting that will fit the wood", "You change the layout and cut the smaller fitting. The customer needs fewer pieces than planned, but the fit is sound.", [skill("carving", 1)]),
    one("carving-new-board", "Buy a replacement board for 5 drachmas", "You spend 5 drachmas on another board and keep the original measurements.", [cash(-5), skill("carving", 1)], cashAtLeast(5)),
    one("carving-wait-board", "Set it aside and explain the delay", "You explain why the board cannot be used as planned. The customer agrees to wait while you find suitable material."),
  ], job("wood-carver", "carving-workshop-lead"));
  decision("stone-flaw", "A flaw in the stone", "A dark line appears as you cut a small stone relief. You cannot yet tell whether it is only on the surface.", 16, 79, [
    one("stone-check-flaw", "Stop and check the line with another worker", "You check the surface together and alter the shallow cut. The flaw stays outside the main detail.", [skill("sculpture", 1)]),
    one("stone-change-design", "Simplify the design around the flaw", "You redraw the border and explain the change to the customer before cutting farther.", [skill("sculpture", 1), skill("oratory", 1)]),
    one("stone-set-aside", "Set the piece aside for a later job", "You put the flawed piece aside and tell the customer you need another stone. The job remains unfinished."),
  ], job("sculptor", "sculpture-workshop-lead"));
  decision("copy-gap", "A gap in the original", "The text you are copying has an unreadable word. Guessing would make the finished copy look complete, but might change its meaning.", 14, 89, [
    one("copy-mark-gap", "Mark the gap clearly", "You leave a clear mark for the missing word. The recipient knows exactly where the original was unreadable.", [skill("literacy", 1)]),
    one("copy-compare", "Ask to compare another copy", "Another copy preserves the missing word. You check it carefully and finish the line.", [stat("knowledge", 1)]),
    one("copy-ask-owner", "Ask the owner how they want the gap handled", "You show the damaged line to the owner and agree how to mark it in the finished copy.", [skill("oratory", 1)]),
  ], job("copyist", "clerk", "patron-supported-reader"));
  decision("learner-argument", "A learner disagrees", "A learner challenges the example you used in a discussion. They can explain why it does not fit their experience.", 18, 89, [
    one("argument-rework", "Work through their objection", "You ask them to explain each step, then revise the example together. The discussion lasts longer than the lesson you planned.", [skill("philosophy", 1), stat("knowledge", 1)]),
    one("argument-compare", "Ask the group to compare two examples", "The learners compare the examples and identify where each one breaks down.", [skill("oratory", 1)]),
    one("argument-return-later", "Leave the question for the next lesson", "You write down the objection and return to the remaining material. You will need a better example next time."),
  ], job("philosophy-tutor", "patron-supported-reader"));
  decision("clouded-record", "Cloud hides the observation", "Cloud covers the part of the sky you planned to observe. There is still an earlier table to check indoors.", 16, 89, [
    one("sky-check-numbers", "Check the arithmetic in the earlier table", "You compare the entries and recalculate a short section. One copied number needs correction.", [skill("reckoning", 1)]),
    one("sky-note-cloud", "Record that the observation was not made", "You mark the missed observation clearly rather than entering an estimate as if you had seen it.", [skill("astronomy", 1)]),
    one("sky-rest-night", "Put the work away for the night", "You cover the working sheet and leave the observation for another clear night."),
  ], any(job("sky-table-calculator"), trained("astronomy", 15)));
  decision("rope-replacement", "A rope is too short", "A rope prepared for a shore task does not reach the intended fastening. The crew asks how to rearrange the work.", 16, 69, [
    one("rope-reposition", "Move the load before fastening it", "The crew shifts the load to a position the rope can reach. You check the new arrangement before the work continues.", [skill("seamanship", 1)]),
    one("rope-find-replacement", "Find a suitable replacement rope", "You fetch another rope and check its length before bringing it back. The task starts later, with the planned arrangement.", [stat("knowledge", 1)]),
    one("rope-defer-task", "Wait for the experienced crew to decide", "You keep the area clear while the experienced crew changes the arrangement."),
  ], job("sailor"));

  decision("teach-younger", "A younger worker asks for advice", "A younger worker asks how you handled a routine problem. You have time to show them, talk it through or leave it for another day.", 55, 99, [
    one("older-demonstrate", "Demonstrate the task slowly", "You show each step and let the younger worker repeat it. They get the last part right without another prompt.", [stat("bonds", 1)]),
    one("older-explain", "Explain how to check their own work", "You point out the signs of a mistake and ask them to inspect their attempt. The correction is theirs to make.", [skill("oratory", 1), stat("knowledge", 1)]),
    one("older-another-day", "Suggest asking again on a quieter day", "You explain that you cannot give the task enough attention today. They agree to return another time."),
  ]);
  decision("sort-possession", "Things kept for years", "You are sorting household possessions and find several small tools nobody has used for years.", 55, 99, [
    one("older-pass-tools", "Pass a few on to someone who can use them", "You give the unused tools to someone who needs them and keep the ones still useful at home.", [stat("bonds", 1)]),
    one("older-label-tools", "Explain each tool and sort them by use", "You show the household what each tool does. The useful pieces are put where someone can find them.", [stat("knowledge", 1)]),
    one("older-keep-tools", "Wrap them and put them back", "You wrap the tools to keep them dry and put them back in storage. There is more room after the rest is sorted."),
  ], undefined, true);

  // The original small annual bank allowed the same exact paragraph up to100
  // times, every3years. Keep its content, but make returns a rarer occurrence.
  // Do not touch medical care, collections, history or rare career openings.
  for (const event of world.events) {
    if (event.trigger.type !== "random") continue;
    if (event.mode === "automatic" && event.maxOccurrences === 100 && event.cooldownYears === 3) {
      event.maxOccurrences = 2;
      event.cooldownYears = 12;
    }
    if (/^(child|youth|adult|later)-/.test(event.id) && event.mode !== "automatic" && event.maxOccurrences === 8 && event.cooldownYears === 9) {
      event.maxOccurrences = 2;
      event.cooldownYears = 16;
    }
    if (event.id.startsWith("specialist-") && event.mode === "automatic") {
      event.maxOccurrences = 3;
      event.cooldownYears = 12;
    }
  }
  world.events.push(...stories, ...decisions);
  return world;
}
