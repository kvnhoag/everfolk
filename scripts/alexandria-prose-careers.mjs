// Original prose, informed by the small domestic and public scenes of Hellenistic
// mime. Literary references guide the voice; they are not evidence for these
// invented people, commissions, prices or encounters. This pass changes copy only.
const routeCopy = {
  sculpture: {
    description: "Carve a figure for a household, then take on work that other makers come to inspect.",
    ordinaryDescription: "Philista keeps the finished figure. Menon names you as its maker when a visitor asks who carved it.",
    prestigeDescription: "The procession relief passes Menon's inspection. Philista accepts the commission, and younger workers come to examine the cuts.",
    promptTitle: "The faces in the procession",
    prompt: "Philista lays out a design with one figure behind another: a procession, crowded into a shallow strip of stone. Menon taps the place where two faces meet. Can you separate them without cutting too deep?",
    attempt: "Carve the procession relief",
    accepted: "Menon turns {name}'s Procession Relief toward the light. The faces remain distinct even in the shallowest cuts; Philista accepts the work and pays you. Other makers ask to look before the piece leaves the bench.",
    unfinished: "Menon turns the relief sideways, and two faces disappear into the same ridge. Philista asks you to rework that section. You keep the earlier commission to your name and return to the difficult cuts.",
    callbacks: [
      ["A visitor asks who made the figure", "A neighbour has seen {work:sculpture-first-work} in Philista's room and wants something for their own shelf. Menon brings them to your bench. You agree a smaller paid order before they leave."],
      ["The figure comes back for a repair", "Philista still keeps {work:sculpture-first-work}, though an edge now needs attention. Menon brings a younger worker to watch you repair it. You are paid to check a second piece while the tools are out."],
    ],
    activity: "small-figure-order",
    activityText: "Carve Philista's small figure",
    ordinary: "Philista turns {name}'s Harbor Figure in her hands, then sets down the agreed payment. Menon points out the carving to another worker and gives your name. Materials and bench hire leave you 30 drachmas for the work.",
  },
  philosophy: {
    description: "Test an argument in conversation and teach it well enough for a pupil to question you.",
    ordinaryDescription: "Kleio can explain your argument about agreements in her own words. Apollonios keeps the checked outline for another lesson.",
    prestigeDescription: "Kleio and Apollonios return with objections to your collected discussions. The revised text becomes the basis of regular meetings.",
    promptTitle: "The objection in the margin",
    prompt: "Kleio returns your discussion notes with a question beside the final argument. Apollonios has marked a different difficulty on the same sheet. They offer to gather a regular circle if you can make the reasoning hold.",
    attempt: "Revise the discussions and defend the argument",
    accepted: "Kleio follows the revised argument in {name}'s Collected Discussions, then tries a new objection. This time you can answer it without changing your starting claim. Apollonios arranges the next meeting and pays for the completed work.",
    unfinished: "Kleio finds a case your rule does not cover. Apollonios waits while you try the argument again, but the difficulty remains. You take the notes home to revise; the earlier lesson remains yours.",
    callbacks: [
      ["Your pupil brings a pupil", "Kleio arrives with someone she now teaches and a copy of {work:philosophy-first-work}. They disagree about the second example. Apollonios pays you to check their copy before the next discussion."],
      ["A rule brought to the dinner table", "Apollonios has tried the argument in {work:philosophy-first-work} on a household disagreement. Kleio brings both versions of the quarrel. You revise an example with them and receive payment for another lesson."],
    ],
    activity: "teach-a-reading-lesson",
    activityText: "Teach the argument about keeping agreements",
    ordinary: "Kleio closes {name}'s On Keeping Agreements and explains the argument without looking. Apollonios checks the outline against her account. The household pays you 20 drachmas for the lesson and keeps the copy.",
  },
  seafaring: {
    description: "Bring a cargo to its landing, keep a clear account and earn another place aboard.",
    ordinaryDescription: "Tasos signs for the cargo at the landing. Nikeratos keeps your name beside the completed delivery.",
    prestigeDescription: "Crew and cargo reach the quay after a difficult passage. Nikeratos recommends you for a task with greater responsibility.",
    promptTitle: "A passage that needs a steady hand",
    prompt: "Nikeratos spreads out the load list and leaves a space for your plan. The passage will need more careful preparation than your last delivery; Tasos wants the crew and every entrusted package accounted for at the other end.",
    attempt: "Plan and undertake the difficult passage",
    accepted: "The last package comes ashore with its binding intact. Tasos checks it off against {name}'s Safe Return while Nikeratos counts the crew. They pay you and recommend you for more responsibility aboard.",
    unfinished: "Nikeratos finds a weak point in your plan before it can be accepted. Tasos asks you to work through the load list again. Your earlier delivery stands, but this passage needs more preparation.",
    callbacks: [
      ["A crew asks for you by name", "Another crew asks Nikeratos who they should trust with a delivery. He names you and cites {work:seafaring-first-work}. Tasos pays you to help prepare the next cargo."],
      ["The old receipt settles the count", "Tasos returns with a disputed quantity and the receipt from {work:seafaring-first-work}. Nikeratos remembers the loading. Together you settle the count, and the customer pays you to check another delivery."],
    ],
    activity: "complete-cargo-voyage",
    activityText: "Deliver the cargo to the Delta landing",
    ordinary: "Nikeratos pulls once more at the lashings before you leave. At the far quay, Tasos counts the cargo and signs for {name}'s Delta Delivery. The agreed 30 drachmas change hands only after the last load is ashore.",
  },
  military: {
    description: "Account for stores, carry out a unit's orders and seek recognition for completed service.",
    ordinaryDescription: "Dion and Herakleides check the unit's stores against your record and enter your name beside the completed assignment.",
    prestigeDescription: "Dion and Herakleides record your handling of a difficult unit assignment. Their commendation can support an application for further responsibility.",
    promptTitle: "An assignment with no room for confusion",
    prompt: "Dion brings an awkward assignment: several tasks must be done in order, with stores accounted for at every handover. Herakleides asks you to explain who will do what. A clear plan could earn a commendation, though neither man offers you a new rank.",
    attempt: "Organise the unit assignment",
    accepted: "Dion checks the completed assignment against your plan. Herakleides enters {name}'s Unit Commendation, recording how the stores and duties were handled. You receive the payment; a new rank still requires a separate appointment.",
    unfinished: "Dion stops at a handover your plan has left unclear. Herakleides asks you to rehearse that part with the others before it can be accepted. Your previous service remains on record.",
    callbacks: [
      ["Pay still owed for old service", "Herakleides uncovers an unsettled service account. Dion checks it against {work:military-first-work}, and the outstanding payment reaches you. The old record settles the debt without creating a new appointment."],
      ["Stores to check in a different household", "A household needs someone to check its stores, and Herakleides gives them your name. Dion points to {work:military-first-work} as evidence that you can keep an account. You are paid for the civilian work, under whichever government now rules the city."],
    ],
    activity: "complete-service-assignment",
    activityText: "Complete the unit's supply assignment",
    ordinary: "You lay your completed Guard Supply Record beside the stores. Dion reads the entries while Herakleides checks the equipment entrusted to you. With the assignment finished, they enter your name and issue the 20 drachmas due.",
  },
  commerce: {
    description: "Fill an order, settle the supplier's account and persuade a customer to return.",
    ordinaryDescription: "Berenike accepts the delivered order. Sarapion is paid, and your copy of the account shows the sum you kept.",
    prestigeDescription: "Sarapion and Berenike agree to repeat the arrangement. Your seal identifies the orders placed through the venture.",
    promptTitle: "A customer wants the next order too",
    prompt: "Berenike lays your last receipt beside a list of goods needed again. Sarapion is willing to supply them, if the accounts and responsibilities are agreed first. They ask whether you can turn one completed order into a continuing arrangement.",
    attempt: "Negotiate the repeat supply agreement",
    accepted: "Sarapion checks the supplier's entries; Berenike checks what will arrive and when. Both accept the arrangement. Orders carrying {name}'s Trading Seal now identify your shared venture, and you receive the agreed payment.",
    unfinished: "Sarapion and Berenike cannot agree on an entry your plan leaves unsettled. The continuing arrangement must wait. You keep the earlier completed order and go back through the account.",
    callbacks: [
      ["The customer brings the receipt back", "Berenike puts {work:commerce-first-work} on the table and asks for another order. Sarapion remembers being paid on time. You arrange a smaller batch within your means and receive payment for the work."],
      ["A disputed line in the old account", "Sarapion questions a line in {work:commerce-first-work}. Berenike still has the receipt that explains it. Once the figures agree, another household pays you to check its own account."],
    ],
    activity: "fulfil-significant-order",
    activityText: "Fill Berenike's storehouse order",
    ordinary: "Sarapion releases the goods, and Berenike checks them against {name}'s Storehouse Order. You settle the supplier's account before putting your own coins away. The signed order stays with you; the completed trade leaves you 20 drachmas ahead.",
  },
  "astronomy-calendar": {
    description: "Compare observations, correct the columns and prepare tables another reader can check.",
    ordinaryDescription: "Heron checks your arithmetic. Isidora keeps the corrected seasonal table, including the distinction between calculated entries and uncertain expectations.",
    prestigeDescription: "Heron and Isidora credit the corrections in your compared tables. Your notes show how each calculation was checked and where uncertainty remains.",
    promptTitle: "The column that will not agree",
    prompt: "Heron and Isidora lay several table copies side by side. One column disagrees with the others, and the error has travelled into a second copy. They ask you to prepare a checked collection with a clear account of the corrections.",
    attempt: "Compare the tables and explain the corrections",
    accepted: "Heron follows the arithmetic in {name}'s Compared Tables without finding the old error. Isidora marks the corrections as yours and accepts the collection. Your notes distinguish calculations from seasonal expectations that may still prove wrong.",
    unfinished: "Heron reaches a total that still disagrees with your copy. Isidora sets the two sheets beside each other so you can trace the difference. The earlier corrected table keeps its credit; this collection is not ready yet.",
    callbacks: [
      ["A fresh copy of the table", "Isidora has worn her copy of {work:astronomy-calendar-first-work} thin at the folds. Heron checks a corrected column with you while you prepare another. The household pays for the fresh copy."],
      ["An error in someone else's copy", "Heron brings a version of {work:astronomy-calendar-first-work} with a total you do not recognise. Isidora traces the copied error back to one line. You are paid for a corrected version, with the method still credited to you."],
    ],
    activity: "copy-a-sky-table",
    activityText: "Prepare a checked seasonal table",
    ordinary: "Heron runs a finger down the arithmetic in {name}'s Seasonal Table. Isidora accepts the corrected copy, with its calculations set apart from uncertain seasonal expectations. After writing materials, the copying leaves you 20 drachmas.",
  },
  "music-performance": {
    description: "Learn the entrances, finish an engagement and give a host a reason to invite the ensemble back.",
    ordinaryDescription: "Melitta performs beside you at Theon's gathering. The agreed programme is finished, and the household pays for the engagement.",
    prestigeDescription: "Your signals keep the ensemble together through its programme. Theon credits your organisation and commissions another engagement.",
    promptTitle: "The entrance everyone must catch",
    prompt: "Melitta brings a programme that needs several performers to enter together. Theon wants the ensemble for another gathering, but first asks to hear how you will hold the difficult passage together. The invitation depends on the rehearsal.",
    attempt: "Lead the ensemble through the programme",
    accepted: "Melitta catches your signal, and the others enter with her. {name}'s Ensemble Repertoire reaches its final phrase without the passage breaking apart. Theon pays you and commissions another engagement, crediting you for bringing the performers together.",
    unfinished: "One entrance comes too soon and carries the others with it. Melitta stops the rehearsal so you can work on the cue. Theon's invitation must wait; your earlier paid engagement remains on record.",
    callbacks: [
      ["The host requests a familiar piece", "Theon asks for a piece from {work:music-performance-first-work} at another gathering. Melitta remembers where the entrances once went astray. You rehearse them together and are paid for the repeat engagement."],
      ["A performer arrives knowing your programme", "Melitta brings a new performer who heard about {work:music-performance-first-work} at Theon's house. You work through the entrances until the group can follow the same cue. The rehearsal earns you a further payment."],
    ],
    activity: "complete-paid-engagement",
    activityText: "Play the agreed programme at Theon's gathering",
    ordinary: "Melitta watches for your first entry at Theon's gathering. You finish {name}'s Evening Repertoire together, using the traditional melodies you rehearsed. Theon pays the agreed 20 drachmas once the programme is done.",
  },
};

// Each context has its own meeting, return visit, shared-work proposal and small
// conversational details. These are authored scenes, not generated synonyms.
const peopleCopy = {
  harbor: {
    meet: ["Waiting for the last sling", "The last load hangs above the quay while two workers argue over its weight. A harbour worker steps into your patch of shade and remarks that the argument has lasted longer than the unloading."],
    introduction: "You give your name, and the worker gives theirs. By the time the sling is moving again, you have exchanged enough stories to recognise each other another day.",
    date: ["A conversation above the quay", "{person} sees you above the quay and leaves room on the low wall. The talk begins with a delayed boat, then wanders into things neither of you came here to discuss."],
    friend: "You stay until the argument on the quay has finally ended. {person} laughs that you have both wasted the same hour, and you agree to seek each other out again as friends.",
    accepted: "{person} smiles and agrees to meet without an errand to excuse it. You settle on a day and begin dating.",
    declined: "{person} would rather keep the acquaintance as it is. You accept the answer and let the talk return to the boats.",
    business: ["A delivery between two landings", "{person} has found a small delivery that needs counting at both landings. You could divide the work, but first must put 20 drachmas into materials and settle who answers for a shortage. Future orders may earn or lose cash."],
    time: "You and {person} sit above the quay and try to guess which waiting boat will leave first. Neither keeps a very reliable count, but the afternoon passes easily.",
  },
  market: {
    meet: ["Room under the awning", "A brief shower drives you beneath a market awning. A seller pulls a basket aside to make room, then asks whether you found the thing you came for."],
    introduction: "You trade names while the rain taps the awning. The seller tells you which stall to try next; you promise to report whether the advice was any good.",
    date: ["The errand can wait", "{person} spots you passing the stalls and calls you over. You compare the morning's purchases, then carry on talking after the shopping is settled."],
    friend: "The next errand waits while you and {person} exchange the rest of your news. You agree to keep meeting as friends, even on days when neither needs anything from the market.",
    accepted: "{person} agrees to a date and suggests a time when neither of you will be watching a stall. You part with a plan to spend time together.",
    declined: "{person} shakes their head kindly; they do not want to date. You accept it, and the conversation returns to the price of the morning's goods.",
    business: ["An order too large for one pair of hands", "{person} has been asked to prepare a small market order and needs someone to check the quantities. You could work together for a 20-drachma materials outlay. No customer has paid yet, and later orders may earn or lose cash."],
    time: "You and {person} take the long way past the stalls, comparing each seller's account of the same morning. By the last awning, you have heard three different versions.",
  },
  workshop: {
    meet: ["While the binding dries", "A worker has finished binding a repaired handle and warns you not to test it yet. There is a place to sit beside the bench while it dries."],
    introduction: "You ask how the handle broke and soon exchange names. The binding is ready before either of you has finished the conversation; you agree to talk another day.",
    date: ["The bench swept clean", "{person} has cleared the day's shavings from the bench. There is room to sit, and for once no customer is waiting at the doorway."],
    friend: "You and {person} talk until someone comes to collect a repair. Before leaving, you agree to make time for the friendship beyond these chance visits.",
    accepted: "{person} agrees to meet after the tools are put away. You make the invitation a date and settle the time together.",
    declined: "{person} prefers to keep things friendly. You accept the answer without asking again, then help clear space for the waiting customer.",
    business: ["Repairs waiting on the bench", "{person} points out a repair order that one person could struggle to finish alone. You could share the work by putting 20 drachmas into materials and agreeing who checks each repair. Later orders may bring a profit or a loss."],
    time: "You sit with {person} outside the workshop, turning a discarded offcut in your hands as you talk. For once the conversation lasts longer than the work being discussed.",
  },
  linen: {
    meet: ["Two labels, one bundle", "A linen worker asks you to hold one bundle while they compare two labels. The labels have been exchanged; putting them right leaves a moment to talk."],
    introduction: "You exchange names while the worker fastens the correct labels. They remember how readily you held the awkward bundle and invite you to stop another time.",
    date: ["The last bundle tied", "{person} finishes tying a linen bundle and sits beside it. A story about the day's muddled deliveries gives you both an excuse to linger."],
    friend: "You finish the story together, each remembering a different detail. You and {person} agree that this should become a friendship, rather than another conversation snatched between bundles.",
    accepted: "{person} agrees to a date once the deliveries are done. You choose a time neither of you will have to hurry away.",
    declined: "{person} does not want a date, though the invitation is kindly meant. You accept the answer and ask how the muddled delivery was finally settled.",
    business: ["Cloth to count and deliver", "{person} has a cloth order that needs checking and delivery. A shared arrangement would take 20 drachmas for materials before any receipts come in. You discuss who will check the bundles and who will answer the customer; later orders may earn or lose cash."],
    time: "You and {person} sit out of the wind and exchange news. A story about two mislabelled bundles grows funnier with every detail you both remember.",
  },
  copies: {
    meet: ["The reader is still occupied", "Someone ahead of you has brought the reader a long, troublesome letter. Another visitor shifts along the seat to make room while you wait your turns."],
    introduction: "You exchange names and complaints about waiting, keeping your private messages folded. When the reader calls, you are reluctant to interrupt the conversation.",
    date: ["No letter to be read today", "{person} sees you near the copying workshop. Neither of you has brought a message this time, but you stop where you once waited together."],
    friend: "There is no reader to call either of you away. You and {person} finish the conversation and agree to keep making time for one another as friends.",
    accepted: "{person} agrees to a date. This time you choose to meet, rather than leave it to the reader's queue.",
    declined: "{person} would rather remain an acquaintance. You accept the answer and carry on talking until it is time to go.",
    business: ["A copying order to divide", "{person} has a copying order that needs someone to organise the materials and check the finished sheets. You could work together after a 20-drachma outlay. You agree to discuss errors and payment before taking later orders, which may earn or lose cash."],
    time: "You and {person} exchange the news you could never have fitted into a short letter. No queue moves you along, and neither needs to fold the conversation away.",
  },
  bakery: {
    meet: ["The loaves need another moment", "The first loaves are not ready. A bakery worker leans out to explain the delay, then stays in the doorway to ask what is happening further down the street."],
    introduction: "You exchange names and neighbourhood news until the worker is called back inside. By the time the bread appears, you have a reason to return beyond the loaf.",
    date: ["After the morning loaves", "{person} has a quiet interval after the morning's baking. You begin with the day's news and find yourselves talking about what you each do when the work is finished."],
    friend: "The next batch can wait for the moment. You and {person} agree to see each other as friends, with more time than these conversations in the doorway.",
    accepted: "{person} agrees to a date after the baking is done. You settle a time that belongs to you both, rather than to the oven.",
    declined: "{person} does not want to begin dating. You accept it and finish the neighbourhood story you were halfway through.",
    business: ["Loaves promised at another door", "{person} needs help organising a bread delivery: quantities, wrapping and the handover all need checking. You could put 20 drachmas into shared materials and work together. Later orders may earn money or leave the outlay lost."],
    time: "You and {person} compare the neighbourhood news after the busiest part of the day. One familiar story has acquired an improbable ending since you last heard it.",
  },
  well: {
    meet: ["A jar steadied in the queue", "Your jar tilts as the queue moves. Someone catches its shoulder, sets it straight and remarks that the waiting is easier with two people to complain about it."],
    introduction: "You exchange names before your turns arrive. When the jars are filled, you walk part of the way together and agree to look out for one another again.",
    date: ["Two jars set down", "You meet {person} near the water queue and set your jars safely aside. The queue moves on while your conversation finds a different subject."],
    friend: "You and {person} make room for a longer conversation after the water is carried home. You agree to keep meeting as friends, whether or not your errands coincide.",
    accepted: "{person} agrees to a date when neither of you is carrying a full jar. You choose a time and leave pleased with the arrangement.",
    declined: "{person} would rather keep your meetings friendly. You accept the answer and help clear the way for the next person with a jar.",
    business: ["Supplies for two households", "{person} suggests organising a small household-supply order together. It would take 20 drachmas for materials before either of you is paid. You compare who will count the goods and make the deliveries; future orders may earn or lose cash."],
    time: "With the day's carrying finished, you and {person} sit down without a jar between you. You talk until the queue you once waited in has passed through several times.",
  },
  festival: {
    meet: ["The stools after the music", "The gathering has ended, but the stools still crowd the courtyard. Another guest takes one end of a stack while you take the other; the last row gives you time to compare the music."],
    introduction: "You exchange names over the final stack of stools. The other guest recalls a different part of the performance, and you agree to finish the argument another day.",
    date: ["A tune neither of you has forgotten", "{person} recognises you before you reach the courtyard. You both remember the same gathering, though you disagree about which song was best."],
    friend: "Neither of you wins the argument about the music. You and {person} agree to keep meeting as friends, giving yourselves plenty of time to disagree again.",
    accepted: "{person} agrees to a date and offers to meet before the next gathering gets crowded. You begin making plans for time together.",
    declined: "{person} enjoys the conversation but does not want to date. You accept the distinction and return to your unfinished argument about the song.",
    business: ["Before the guests arrive", "{person} needs someone to help organise supplies for a gathering. You could divide the counting and deliveries after putting 20 drachmas into materials. Later orders may pay well or leave the outlay lost; neither of you has been paid yet."],
    time: "You and {person} recall the gathering from the first song to the final stool. Each of you supplies a detail the other missed, and the story takes most of the afternoon.",
  },
  library: {
    meet: ["The question after the reading", "The reader has finished, but one listener is still puzzling over a passage. You hear the question as you leave and stop to offer what you thought it meant."],
    introduction: "Your answers differ enough to keep you both talking. You exchange names before parting, so the next discussion will not begin with strangers.",
    date: ["A passage carried into the street", "{person} finds you after a reading and returns to a question from your last conversation. Soon you are comparing your own experiences instead of the reader's words."],
    friend: "The discussion runs beyond the passage that began it. You and {person} agree to meet as friends, with no reading needed to bring you together.",
    accepted: "{person} agrees to a date. You choose to spend an afternoon together and leave the next reading out of the plan.",
    declined: "{person} would rather keep the conversations as they are. You accept the answer and finish discussing the passage before you part.",
    business: ["Reading copies for a household", "{person} has been asked to organise copied reading materials for a household. Twenty drachmas would cover your shared materials before payment. You discuss checking the sheets and settling errors; later orders may earn or lose cash."],
    time: "You and {person} start with the latest reading and end with a story from home. Neither of you notices exactly when the discussion changed its subject.",
  },
  music: {
    meet: ["Everyone came in too early", "A rehearsal breaks up amid laughter about one disastrous entrance. A performer beside you insists that the cue was late; from where you stood, it looked rather different."],
    introduction: "You exchange names while defending your versions of the missed cue. Neither quite concedes, but you agree to look for each other after another rehearsal.",
    date: ["After the instruments are put away", "{person} stays behind after rehearsal and asks what you heard from your side of the room. Your different accounts of the music become an excuse to keep talking."],
    friend: "You and {person} agree that the missed entrance has earned enough argument for one day. You make plans to meet as friends when there is no rehearsal to review.",
    accepted: "{person} agrees to a date after the next rehearsal. You settle on a time and begin dating, with the argument over the cue still unresolved.",
    declined: "{person} is pleased by the invitation but does not want to date. You accept it, and the conversation returns to the music.",
    business: ["Everything needed before the first note", "{person} has a performance-supply order to organise. You could split the checking and deliveries after putting 20 drachmas into materials. Future orders may return a profit or a loss, so you discuss who handles each part before agreeing."],
    time: "You and {person} trade stories about rehearsals that went wrong and performances that somehow recovered. By the end, neither can tell the funniest story without laughing first.",
  },
  boat: {
    meet: ["The borrowed rope comes home", "You return a borrowed rope to the landing. A boat worker checks the coil, thanks you for bringing it back and asks what kept you busy along the way."],
    introduction: "You exchange names while the rope is hung in its place. The boat worker's own errand has gone no more smoothly than yours, and the conversation outlasts the task.",
    date: ["A place above the landing", "{person} waves you over from the landing. With the ropes put away, there is time to sit and exchange news that has nothing to do with boats."],
    friend: "You and {person} stay talking after the last errand is explained. You agree to keep seeing each other as friends, without waiting for another rope to be returned.",
    accepted: "{person} agrees to a date and suggests meeting away from the landing. You choose a time to spend together.",
    declined: "{person} does not want to begin dating. You accept the answer and finish the story of your day's troublesome errand.",
    business: ["A small delivery at the landing", "{person} has a landing-side delivery to organise and suggests sharing the work. You would put 20 drachmas into materials, then divide the counting and handover. Later orders may earn or lose cash; the first outlay earns nothing by itself."],
    time: "You and {person} sit above the landing and follow a long account of an errand that should have taken a few minutes. The telling now takes longer than the errand.",
  },
  drill: {
    meet: ["One practice shield left over", "The practice is over, but the equipment count is short on one side and long on the other. Another participant stays to help you sort it out before anyone leaves."],
    introduction: "The missing piece was in the wrong stack. You exchange names and compare the instruction that confused you both, with time now to laugh about it.",
    date: ["After the practice ground empties", "{person} asks whether you found today's instructions clearer than the last ones. You stand by the packed equipment, comparing what happened before moving on to news from home."],
    friend: "The talk continues well after the practice ground is empty. You and {person} agree to make time for a friendship beyond these meetings at the equipment pile.",
    accepted: "{person} agrees to a date on a day without practice. You make the plan together and begin dating.",
    declined: "{person} would prefer to remain friends or acquaintances. You accept it and let the discussion return to the day's practice.",
    business: ["Equipment counted before delivery", "{person} has an equipment order to check and deliver. You could share the task after putting 20 drachmas into materials. You discuss who answers for a missing piece before agreeing; later orders may earn or lose cash."],
    time: "You and {person} spend the afternoon retelling a practice session from two very different positions. Between you, the confused order becomes an excellent story.",
  },
  garden: {
    meet: ["A space on the courtyard wall", "A neighbour shifts along a low wall to make room beside a planted courtyard. Inside, someone is taking an unusually long time to finish an errand; outside, you both have time to talk."],
    introduction: "You exchange names while the errand continues indoors. When it is finally finished, you agree that another visit need not depend on such a long wait.",
    date: ["The familiar space on the wall", "{person} makes room on the courtyard wall again. This time you stop without anyone asking you to wait, and the talk moves easily beyond the household's news."],
    friend: "You and {person} linger until the patch of shade has moved past your seats. You agree to keep meeting as friends and make room for the next conversation.",
    accepted: "{person} agrees to a date and suggests a time to meet. You leave the wall with a plan to return for each other.",
    declined: "{person} enjoys your company but does not want to date. You accept it and sit a little longer before returning to your errands.",
    business: ["Supplies for a planted courtyard", "{person} has a gardening-supply order that needs someone to organise quantities and delivery. A shared arrangement would take 20 drachmas for materials. You compare the responsibilities first; later orders may earn or lose cash."],
    time: "You sit beside {person} on the familiar wall and exchange the small news of your households. The shade moves around the courtyard while you talk.",
  },
  accounts: {
    meet: ["The count agrees on the second try", "Another worker notices you counting a quantity twice. They admit to having done the same, and you compare your methods until the two totals agree."],
    introduction: "You exchange names with the totals safely settled. The other worker tells you about a far worse muddle, and you agree to compare stories another time.",
    date: ["The figures put aside", "{person} has finished checking an account and puts it aside when you arrive. Without a total between you, the conversation finds a more personal subject."],
    friend: "You and {person} have enough news to fill the time you usually spend checking figures. You agree to make space for a friendship, as well as these passing conversations.",
    accepted: "{person} agrees to a date. You choose a time together and leave the accounts out of the arrangement.",
    declined: "{person} does not want to date. You accept the answer and finish the conversation without trying to bargain over it.",
    business: ["An account with work behind every line", "{person} suggests checking and organising a small supply order together. You would put 20 drachmas into materials and divide the work before any payment comes in. Later orders may earn or lose cash, so you agree to examine the responsibilities as closely as the totals."],
    time: "You and {person} exchange stories about the people behind troublesome accounts. For once there are no figures to check at the end of the conversation.",
  },
  pottery: {
    meet: ["The cup that rocks on the bench", "A pottery worker sets a small vessel on the bench and nudges it: one edge of the base is uneven. You hold a straight board beside it while they check where it touches."],
    introduction: "You exchange names while the uneven spot is marked. The worker offers to show you whether the repair succeeds when you next pass the workshop.",
    date: ["A cup that finally sits flat", "{person} points out the vessel you once helped to check. The base now sits flat, and the small success leads into a conversation neither of you hurries to end."],
    friend: "You and {person} agree to keep meeting as friends. The repaired vessel has done its part in bringing you together; the next visit needs no excuse from the bench.",
    accepted: "{person} agrees to a date and helps choose a time. You begin planning an afternoon together away from the workshop bench.",
    declined: "{person} would rather keep your visits friendly. You accept the answer and ask how the rest of the kiln load turned out.",
    business: ["Pots to wrap before the cart arrives", "{person} has a pottery delivery that needs counting, wrapping and checking at the other end. You could share the work after a 20-drachma materials outlay. Future orders may earn or lose cash, especially if the goods cannot be delivered as planned."],
    time: "You and {person} compare the week's small triumphs and annoyances outside the workshop. A cup that once rocked on the bench becomes the beginning of a much longer story.",
  },
  neighbors: {
    meet: ["The basket returned at last", "Someone from a nearby household returns a borrowed basket and explains why it took so long. You set it down by the door; the explanation is turning into a story."],
    introduction: "You exchange names properly at last, instead of referring to each other by the household doors. The basket is put away, but the conversation continues until you agree to meet again.",
    date: ["No basket needed this time", "{person} stops by the doorway with news rather than something to return. You sit for a while and discover how much was left out of your earlier conversations."],
    friend: "You and {person} agree to keep visiting as friends. Neither household will need to lend another basket just to bring the two of you together.",
    accepted: "{person} agrees to a date. You choose a time to meet for yourselves, instead of waiting for another errand between households.",
    declined: "{person} likes these visits but does not want to date. You accept the answer and finish exchanging the household news.",
    business: ["An order shared across the neighbourhood", "{person} suggests organising a small neighbourhood order together. Twenty drachmas would cover the materials while you divide the counting and deliveries. Later orders may earn or lose cash; you discuss the risk before agreeing to shared work."],
    time: "You and {person} spend the afternoon exchanging household news. The doorway where you once returned a basket has become a place where you can simply sit and talk.",
  },
};

const creditCopy = {
  sculpture: ["A stone offcut on the spare bench", "A sculptor has cleared a spare bench and set a stone offcut beside it. For 90 drachmas, you can use the shared tools and spend several sessions learning to cut a relief under supervision. It is a practice place, not a customer commission.", "You pay for the bench and spend the sessions testing how shallow a cut can still catch the light. The sculptor makes you redo one uneven edge. You take the practice piece home, with no customer commission attached."],
  philosophy: ["A question with room for another reader", "A reader is gathering a small circle to compare arguments about keeping promises. Eighty drachmas will cover the copied extracts and guided meetings. You can take the place or leave it and continue your ordinary reading.", "You pay for the extracts and read your objection aloud. Another reader finds a case you had missed, and you revise the outline before the next meeting. The sessions are preparation, rather than a teaching appointment."],
  seafaring: ["A practice berth before departure", "A crew can take you on a short supervised passage for 100 drachmas, covering the berth, meals and practice materials. An experienced hand will check your work aboard. This berth pays no wage and carries no cargo-profit share.", "You pay for the berth and work through lashings, a shared watch and the load list with an experienced hand. The corrections are immediate, sometimes repeated. You return with practice, rather than a paid delivery to your name."],
  military: ["The veteran repeats the signal", "A veteran sets out worn practice gear and demonstrates a signal that is easily misunderstood. Eighty drachmas buys several sessions using the space and equipment. The lessons offer preparation; they promise neither enlistment nor rank.", "You pay for the sessions and repeat the signal until the others respond to the same instruction. The veteran checks your equipment list and makes you explain one confusing order again. You leave better prepared, without a military appointment."],
  commerce: ["The trader keeps the old receipts", "A trader offers to teach you from a set of practice supply accounts. For 90 drachmas, you can compare the receipts and work through the disputed entries together. The fee buys instruction and copies, not stock or a promise of profit.", "You pay for the copies and spread the receipts in order. The trader asks you to explain a disputed total before showing where the error began. You finish the lessons with corrected accounts, but no goods or customer order of your own."],
  "astronomy-calendar": ["A place at the measuring table", "A table reader has room for another learner beside the measuring materials. One hundred drachmas pays for copied tables, materials and several supervised sessions. You will compare recorded intervals and calculations; the place promises no knowledge of future events.", "You pay for the sessions and check one column against the recorded intervals. The reader stops at an uncertain seasonal entry and asks you to distinguish it from a calculation. Your corrected exercise remains practice, rather than a published table."],
  "music-performance": ["One place left at rehearsal", "An ensemble has room for another performer in a short course of rehearsals. Eighty drachmas covers the shared room, borrowed equipment and instruction. The practice place is available, though it comes with no paid engagement.", "You pay for the rehearsals and learn to wait for the entrance instead of rushing it. The lead performer repeats the difficult phrase until you fit it with the others. The rehearsal ends without a paid engagement, but the passage is steadier."],
};

const sceneCopy = {
  "specialist-kiln-load": ["The cracks after the firing", "The kiln has cooled enough to unload. You turn each vessel in the light: a few have split, but most can still be finished and sold."],
  "specialist-carved-repair": ["The fitting holds this time", "You work the repaired wooden fitting back and forth while the customer watches. It holds. Before taking it away, the customer asks whether you can make another."],
  "specialist-sculpture-detail": ["One more fold in the carving", "The customer studies the small figure and points to a fold they want added. The order was agreed before this change; another cut means more time and material."],
  "specialist-philosophy-objection": ["A question you cannot skip", "You have barely finished speaking when a listener asks why the conclusion follows. Others turn to hear your answer. You can work through the steps aloud or take the objection away to examine."],
  "specialist-sky-record": ["A clear strip of sky", "After several cloudy evenings, a clear strip of sky finally remains long enough to observe. You enter the observation beside the last usable record and compare the two."],
  "specialist-conflicting-charts": ["The same sky, two accounts", "Two readers lay their sky diagrams beside each other and give different interpretations. One points to a position; the other insists on the rule used to read it. You can test the arithmetic or ask each to explain the rule."],
  "specialist-dendera-chart": ["The signs on a copied diagram", "A copied temple sky diagram is unrolled for study. You set your notes beside its zodiacal signs and record where the arrangements differ."],
  "career-petition-opening": ["The clerk needs a second pair of eyes", "The clerk has a petition ready to file, except that the names and the request still need checking. You could help prepare it and explain the corrections. If the work is accepted, the clerk may recommend you for royal service."],
  "career-unit-supply-opening": ["The list and the stores disagree", "Your unit's equipment list does not explain everything in the stores. An officer wants the shortages made clear before the next issue. You could take the count in hand and explain the revised account."],
  "career-reader-opening": ["Your calculations beside the reader's", "An experienced reader is checking copied sky tables for a paying household. There is space beside the working copy for your own calculations. Showing them could earn a recommendation for a regular post."],
  "career-workshop-opening": ["A sample for the larger order", "A customer brings an order too large for the usual hurried arrangement at the bench. They want someone who can finish the work and organise the smaller tasks. Your pottery, carving or sculpture could serve as the sample."],
  "lender-offer": ["Ready cash across the table", "The moneylender sets ready cash within reach and names the repayment terms. You would have to repay this loan yourself. An unpaid balance can bring collectors, assault and, after a long delay, a fatal confrontation."],
  "lender-payment-due": ["The repayment day has come", "The moneylender opens the account at your name and asks for the remaining balance. The agreed deadline has arrived. Leaving it unpaid can bring threats and, with a longer delay, a dangerous confrontation."],
  "lender-threat": ["Two men at the doorway", "Two collectors stand in your doorway and ask for the overdue balance. They say the next visit will be rougher if you keep delaying. Their warning changes neither the amount owed nor its deadline."],
  "lender-confrontation": ["No room to pass", "The collectors stop you on the way home and leave no clear space to pass. The loan has been overdue for years, and they threaten violence unless you settle it. Running or refusing can end in a fatal wound."],
  "legacy-shared-cargo": ["A quay receipt and a household order", "Nikeratos lays down the quay receipt; Berenike brings the household's order. Comparing {work:seafaring-first-work} with {work:commerce-first-work} settles the disputed delivery. You are paid for the extra account work."],
  "legacy-performance-passage": ["The performers need a passage", "Melitta has an engagement to reach and performers to get aboard. Nikeratos recalls {work:seafaring-first-work}; you bring out the plan for {work:music-performance-first-work}. Between you, the passage and the performers' needs are settled, and the planning is paid."],
};

export const CAREER_PROSE_EVENT_IDS = [
  ...Object.keys(sceneCopy),
  ...Object.keys(routeCopy).flatMap(id => [`legacy-${id}-prestige`, `legacy-${id}-callback-1`, `legacy-${id}-callback-2`]),
  ...Object.keys(peopleCopy).flatMap(id => [`meet-person-${id}`, `date-person-${id}`, `business-proposal-person-${id}`]),
  ...Object.keys(creditCopy).map(id => `credit-opportunity-${id}`),
];

export function applyCareerProse(world) {
  const required = (items, id, kind) => {
    const found = items.find(item => item.id === id);
    if (!found) throw new Error(`Career prose: missing ${kind} ${id}`);
    return found;
  };
  const event = id => required(world.events, id, "event");
  const activity = id => required(world.character.activities, id, "activity");
  const choice = (item, id) => required(item.choices, id, "choice");
  const outcome = (item, id) => required(item.outcomes, id, "outcome");
  const scene = (item, [title, text]) => Object.assign(item, { title, text });
  for (const [id, copy] of Object.entries(sceneCopy)) scene(event(id), copy);
  for (const [id, copy] of Object.entries(routeCopy)) {
    required(world.legacy.routes, id, "legacy route").description = copy.description;
    required(world.legacy.achievements, `${id}-first-work`, "achievement").description = copy.ordinaryDescription;
    required(world.legacy.achievements, `${id}-prestige`, "achievement").description = copy.prestigeDescription;
    const prestige = event(`legacy-${id}-prestige`);
    scene(prestige, [copy.promptTitle, copy.prompt]);
    const attempt = choice(prestige, `attempt-${id}-prestige`);
    attempt.text = copy.attempt;
    outcome(attempt, `${id}-prestige-accepted`).text = copy.accepted;
    outcome(attempt, `${id}-prestige-unfinished`).text = copy.unfinished;
    copy.callbacks.forEach((item, index) => scene(event(`legacy-${id}-callback-${index + 1}`), item));
    const first = activity(copy.activity);
    first.text = copy.activityText;
    if (first.outcomes.length !== 1) throw new Error(`Career prose: ambiguous first work ${copy.activity}`);
    first.outcomes[0].text = copy.ordinary;
  }
  for (const [key, copy] of Object.entries(peopleCopy)) {
    const id = `person-${key}`, person = `{person:${id}}`;
    const fill = text => text.replaceAll("{person}", person);
    const meet = event(`meet-${id}`);
    scene(meet, copy.meet);
    outcome(choice(meet, `introduce-${id}`), `introduce-${id}-result`).text = copy.introduction;
    const date = event(`date-${id}`);
    scene(date, [copy.date[0], fill(copy.date[1])]);
    outcome(choice(date, `keep-friendly-${id}`), `keep-friendly-${id}-result`).text = fill(copy.friend);
    const invitation = choice(date, `invite-date-${id}`);
    outcome(invitation, `date-${id}-accepted`).text = fill(copy.accepted);
    outcome(invitation, `date-${id}-declined`).text = fill(copy.declined);
    const proposal = event(`business-proposal-${id}`);
    scene(proposal, [copy.business[0], fill(copy.business[1])]);
    outcome(activity(`friend-time-${id}`), `friend-time-${id}-result`).text = fill(copy.time);
    outcome(activity(`befriend-${id}`), `befriend-${id}-result`).text = fill(copy.friend);
    const court = activity(`court-${id}`);
    outcome(court, `court-${id}-accepted`).text = fill(copy.accepted);
    outcome(court, `court-${id}-declined`).text = fill(copy.declined);
  }
  for (const [id, copy] of Object.entries(creditCopy)) {
    const prefix = `credit-opportunity-${id}`, item = event(prefix);
    scene(item, copy);
    outcome(choice(item, `${prefix}-pay`), `${prefix}-completed`).text = copy[2];
    outcome(choice(item, `${prefix}-borrow`), `${prefix}-financed`).text = `You accept the moneylender's stated repayment terms and use the borrowed cash for the place. ${copy[2]}`;
  }
  return world;
}
