import { readFileSync } from "node:fs";

// These studies, meetings, duties, fees and recognitions are authored fiction.
// Service follows sourced contact windows; independent study can continue later.
// A card records this player's accepted work; it
// never replaces an attested historical officeholder or rewrites a real work.
const all = (...conditions) => ({ type: "all", conditions });
const not = condition => ({ type: "not", condition });
const year = (op, value) => ({ type: "year", op, value });
const age = value => ({ type: "age", op: "gte", value });
const skill = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const gain = (skill, delta) => ({ type: "skill", skill, delta });
const earned = (achievement, minYears = 0) => ({ type: "accomplishment", achievement, ...(minYears ? { minYears } : {}) });
const cash = delta => ({ type: "cash", delta });
const flag = flag => ({ type: "flag", flag, value: true });
const studyReaders = ["Damon", "Philista"];

export const historicalTitlePlans = [
  {
    id: "right-hand-of-alexander", figure: { id: "alexander", name: "Alexander" },
    routeId: "military", title: "Right Hand of Alexander", fromYear: -332, untilYear: -324, minAge: 18,
    sourceIds: ["classical-alexander"],
    description: "Earn Alexander's confidence through distinct duties, an upheld judgement and completed private responsibility.",
    steps: [
      {
        id: "introduction", title: "A messenger from the royal party", achievementTitle: "Accepted for Alexander's support service",
        text: "A messenger from Alexander's party visits your household with a request for help checking coastal deliveries. The work could lead to further service. Accepting means arranging travel with the party when it leaves Egypt, rather than waiting for the king to visit you again.",
        action: "Join the support service and check the first delivery", skills: { reckoning: 10, oratory: 8 }, untilYear: -331,
        accepted: "You check a coastal delivery for Alexander's officers and accept paid support service. The officer records your name, and you arrange to travel with the royal party when it leaves Egypt. Alexander is told who checked the account; you have no private appointment yet.",
        effects: [cash(10), gain("reckoning", 1)],
      },
      {
        id: "supply-duty", title: "A visitor with two conflicting receipts", achievementTitle: "Alexander's supply discrepancy settled",
        text: "An officer finds you with Alexander's travelling support staff. Two suppliers claim payment for the same consignment. You must compare the receipts with the goods actually received and explain a settlement to both parties.",
        action: "Check the receipts and complete the settlement", skills: { reckoning: 18, literacy: 12 },
        accepted: "You trace the duplicate entry, check the delivered goods and settle the two claims in Alexander's support camp. Alexander receives the corrected account; both suppliers acknowledge the recorded settlement.",
        failed: "The supporting receipt cannot be found. Alexander's officer keeps the account open and asks you to bring a checked correction before another review.",
        effects: [cash(12), gain("reckoning", 2)],
      },
      {
        id: "message-duty", title: "A message that must reach the right hands", achievementTitle: "Alexander's entrusted message delivered",
        text: "A returning officer brings a sealed message and a separate list of supplies. The receiver must confirm both without opening the private message before it reaches its addressee.",
        action: "Carry the message and obtain both receipts", skills: { literacy: 18, oratory: 18 },
        accepted: "You deliver Alexander's sealed message to its named recipient and reconcile the supply receipt separately. Alexander's officer confirms that the entrusted message and the goods reached the right hands.",
        failed: "The receiver will not confirm the supply list. You return Alexander's sealed material safely, but the duty remains incomplete until the receipt is checked.",
        effects: [cash(12), gain("literacy", 2)],
      },
      {
        id: "judgement", title: "The easier answer would be misleading", achievementTitle: "A difficult judgement upheld by Alexander",
        text: "An officer asks you to describe a doubtful supply route as ready. Your own checks show that its water stops remain uncertain. A candid report may delay the plan and anger the officer who asked for it.",
        action: "Submit the checked limits and a workable alternative", skills: { oratory: 25, reckoning: 20 },
        accepted: "You show Alexander the missing water checks and offer a shorter supported route. Alexander upholds the limited recommendation after the officers compare the records; the decision enters your service account under your own name.",
        failed: "Alexander's officers find your alternative insufficiently supported. No judgement is upheld in your favour; you retain your earlier completed duties and the chance to prepare a better-supported recommendation.",
        effects: [gain("oratory", 2)],
      },
      {
        id: "private-duty", title: "An officer returns with a private responsibility", achievementTitle: "Alexander's private responsibility completed",
        text: "An officer brings an explicit appointment to handle a confidential exchange of correspondence for Alexander. You must keep the material secure, obtain the required replies and return a complete account.",
        action: "Accept the appointment and complete the exchange", skills: { literacy: 25, oratory: 28 },
        accepted: "Alexander entrusts you with the private correspondence. You carry it, obtain the replies and return the complete account. Alexander and the receiving officer confirm that you fulfilled the responsibility they gave you.",
        failed: "A required reply does not arrive. You return Alexander's material securely, but the private duty is not certified as completed and earns no new distinction.",
        effects: [cash(20), gain("literacy", 2)],
      },
      {
        id: "recognition", title: "Alexander reviews the service you have completed",
        text: "Alexander's officer returns with your supply settlement, message receipt, upheld recommendation and completed private assignment. A final review will decide whether the confidence you earned merits a personal distinction.",
        action: "Submit the completed service record for recognition", skills: { oratory: 30, literacy: 25, reckoning: 20 }, minAge: 22,
        accepted: "Alexander reviews your completed duties, the judgement he upheld and the private responsibility you fulfilled. He recognizes {name} as Right Hand of Alexander. His officer enters the distinction beside your name and asks you to remain for the next private briefing.",
        failed: "Alexander acknowledges your completed service but does not grant the personal distinction. Your accepted work remains in the collection; this final review is complete.",
      },
    ],
  },
  {
    id: "general-of-alexander", figure: { id: "alexander", name: "Alexander" },
    routeId: "military", title: "General of Alexander", fromYear: -332, untilYear: -324, minAge: 18,
    sourceIds: ["classical-alexander"],
    description: "Join the travelling army, receive a bounded commission and complete two different command duties before recognition.",
    steps: [
      {
        id: "introduction", title: "A recruiting officer asks for you", achievementTitle: "Joined Alexander's travelling service",
        text: "A recruiting officer visits after checking your work with local guards. Alexander's army needs trained support for its onward campaign. Accepting means leaving Egypt with the travelling army; the offer promises service, not command.",
        action: "Join the travelling army and complete a support duty", skills: { warfare: 12, oratory: 8 }, untilYear: -331,
        accepted: "You join Alexander's travelling army, complete a supervised supply guard and arrange the onward journey with the unit. Alexander's officer records the completed support duty. You have not been appointed a general.",
        effects: [cash(10), gain("warfare", 1)],
      },
      {
        id: "commission", title: "An officer brings a limited commission", achievementTitle: "Alexander's bounded command commission",
        text: "Your officer returns with a commission to lead a small escort. The limits, stores and reporting officer are written down. Accepting the commission creates responsibility before it creates any command distinction.",
        action: "Accept the escort commission and organize its stores", skills: { warfare: 20, oratory: 10, reckoning: 10 },
        accepted: "Alexander's authorized officer appoints you to lead the escort. You muster its members, check the issued stores and confirm where you must report after the assignment.",
        failed: "Alexander's officer finds the muster incomplete and defers the commission. You remain in support service until a later review can check a prepared unit.",
        effects: [gain("warfare", 2)],
      },
      {
        id: "escort", title: "The entrusted column must arrive intact", achievementTitle: "Alexander's escort assignment completed",
        text: "A courier brings orders for your commissioned escort. You must bring the agreed supply column to its receiving post, account for the load and avoid pursuing an unrelated encounter beyond your orders.",
        action: "Lead the escort and deliver the accounted supplies", skills: { warfare: 25, reckoning: 15 },
        accepted: "You lead Alexander's commissioned escort to the receiving post and reconcile its delivered stores with the issued account. Alexander's officer certifies the completed command duty and the limits you kept.",
        failed: "The column returns with an unresolved shortage. Alexander's officer records the incomplete duty; it does not count as a command success.",
        effects: [cash(15), gain("warfare", 2)],
      },
      {
        id: "withdrawal", title: "A second command needs a different judgement", achievementTitle: "Alexander's ordered withdrawal completed",
        text: "An officer returns with a different assignment: move a forward detachment back to an agreed position while its stores are removed. A successful withdrawal depends on communication and timing rather than another supply delivery.",
        action: "Bring the detachment and stores to the agreed position", skills: { warfare: 30, oratory: 18 },
        accepted: "You bring Alexander's detachment and its entrusted stores back to the agreed position. The receiving officer confirms the withdrawal and the men accounted for. Alexander's records now contain two distinct completed command duties under your commission.",
        failed: "The detachment reaches safety, but its entrusted stores are not accounted for. Alexander's officer records the unresolved duty rather than a second command success.",
        effects: [cash(15), gain("oratory", 2)],
      },
      {
        id: "recognition", title: "Your commission and command records are reviewed",
        text: "A senior officer brings your commission and both completed command accounts before Alexander. The officers who received the escort and detachment have added their testimony. You are called forward to answer for the decisions you made.",
        action: "Present both command successes for Alexander's review", skills: { warfare: 35, oratory: 20, reckoning: 15 }, minAge: 22, chance: 35,
        accepted: "Alexander reviews your commission, completed escort and completed withdrawal. He recognizes {name} as General of Alexander. The officers enter the distinction with your command records and retain the limits of the assignments you have led.",
        failed: "Alexander retains your commission and accepted duties in the record but does not grant the General of Alexander distinction. The final review is complete.",
      },
    ],
  },
  {
    id: "disciple-of-aristotle", figure: { id: "aristotle", name: "Aristotle" },
    routeId: "philosophy", title: "Disciple of Aristotle", fromYear: -332, minAge: 18, independentStudy: true,
    sourceIds: ["classical-aristotle"],
    description: "Earn recognition for independent study of Aristotle's ideas through compared observations and a defended argument. Personal instruction from Aristotle is not required.",
    steps: [
      {
        id: "introduction", title: "A reader brings questions from Aristotle's tradition", achievementTitle: "An independent Aristotelian study begun",
        text: "A local reader brings copied arguments and questions associated with Aristotle's tradition. You can study them here, compare them with your own observations and have fellow readers check the work. Meeting Aristotle or receiving his instruction is not required.",
        action: "Pay 15 drachmas for copies and begin independent study", skills: { literacy: 15, philosophy: 10 }, cost: 15,
        accepted: "You obtain study copies and set out an independent inquiry into a distinction in Aristotle's tradition. Fellow readers check your starting question and agree to review your observations. This begins a course of work, without claiming a personal meeting or instruction from Aristotle.",
        effects: [gain("philosophy", 2)],
      },
      {
        id: "observations", title: "The readers ask for compared observations", achievementTitle: "An Aristotelian comparison independently checked",
        text: "Your next inquiry compares several ordinary observations. Distinguish what you saw from what you were told and bring the account to fellow readers for criticism.",
        action: "Pay 10 drachmas and submit the compared observations", skills: { philosophy: 15, literacy: 20 }, cost: 10,
        accepted: "You present separately recorded observations and their limits to fellow readers. They accept the corrected comparison after you distinguish observation from hearsay. This is your own completed inquiry, developed through independent study of Aristotle's ideas.",
        failed: "The readers find that your comparison relies on an unverified report. You keep a correction to investigate; the observation exercise is not accepted yet.",
        effects: [gain("philosophy", 2)],
      },
      {
        id: "argument", title: "An objection that your first answer cannot settle", achievementTitle: "An Aristotelian argument defended before readers",
        text: "A fellow reader brings a counterexample to your explanation. Rebuild the argument and answer the strongest objection rather than repeat an authority's conclusion.",
        action: "Pay 10 drachmas and defend the revised argument", skills: { philosophy: 20, literacy: 25, oratory: 10 }, cost: 10,
        accepted: "You revise the premise exposed by the counterexample and defend the remaining argument before fellow readers. They accept the substantial exercise after criticism. Your comparison and defended argument are two distinct accepted works in Aristotle's tradition.",
        failed: "The readers find that the revised premise still assumes the disputed point. You keep the sharper objection, without an accepted argument or a disciple title.",
        effects: [gain("oratory", 2)],
      },
      {
        id: "recognition", title: "The readers review your independent study",
        text: "Fellow readers gather your observation exercise, defended argument and corrections for a later review. The title recognizes demonstrated study of Aristotle's tradition; it does not claim that he personally taught you.",
        action: "Pay 10 drachmas and submit the work for recognition", skills: { philosophy: 20, literacy: 25, oratory: 10 }, cost: 10, chance: 60,
        accepted: "The readers review your compared observations, defended argument and sustained independent study. They recognize {name} as Disciple of Aristotle, a distinction for your work in his intellectual tradition. The record claims no personal instruction or approval from Aristotle.",
        failed: "The readers acknowledge your accepted exercises but do not grant the distinction. Your work remains recorded and independent philosophical study remains open.",
      },
    ],
  },
  {
    id: "disciple-of-euclid", figure: { id: "euclid", name: "Euclid" },
    routeId: "astronomy-calendar", title: "Disciple of Euclid", fromYear: -305, minAge: 18, independentStudy: true,
    sourceIds: ["classical-euclid"],
    description: "Study Euclidean geometry independently, complete two checked exercises and justify a connected proof before readers. Personal instruction from Euclid is not required.",
    steps: [
      {
        id: "introduction", title: "A reader brings a geometrical construction", achievementTitle: "Independent Euclidean study begun",
        text: "A local reader brings a practical construction and study copies from the Euclidean tradition. You can work through the definitions and demonstrations independently, with other readers checking the results. Euclid's presence or personal instruction is not required.",
        action: "Pay 5 drachmas for copies and begin geometrical study", skills: { reckoning: 20, literacy: 18 }, cost: 5,
        accepted: "You obtain study copies and identify which steps of a construction still need justification. Fellow readers check your starting definitions and agree to review further work. Your study claims neither a personal meeting with Euclid nor authorship of the Elements.",
        effects: [gain("reckoning", 2)],
      },
      {
        id: "construction", title: "The visiting reader asks why the construction works", achievementTitle: "A Euclidean construction independently justified",
        text: "The reader returns with your earlier drawing. Its appearance is convincing, but the circle wants each construction step connected to an agreed premise or earlier result.",
        action: "Bring a justified construction to the next session", skills: { reckoning: 25, literacy: 20 },
        accepted: "You explain the construction to fellow readers, stating the premises and justifying each step. They accept the corrected exercise after another reader reconstructs it from your account.",
        failed: "The readers identify a construction step that your stated premises do not support. You keep the corrected question and may prepare another account; the exercise is not accepted.",
        effects: [gain("reckoning", 2)],
      },
      {
        id: "proof", title: "A gap between two accepted steps", achievementTitle: "A connected Euclidean proof independently checked",
        text: "A reader visits with a second exercise. Two individual results are familiar, but the connection between them is missing. The next session asks you to supply a complete justified sequence.",
        action: "Defend the complete sequence before the working circle", skills: { reckoning: 30, literacy: 25 },
        accepted: "You defend a connected demonstration before fellow readers and repair the missing dependency. They check the sequence against the agreed premises, and another reader reproduces it. You have completed a second distinct exercise through independent study of Euclidean geometry.",
        failed: "A reader cannot reproduce the connection from your stated steps. The proof remains incomplete and no accepted-proof record or disciple title is awarded.",
        effects: [gain("literacy", 2), flag("studied-euclidean-proof")],
      },
      {
        id: "recognition", title: "The readers review your continued study",
        text: "A familiar reader returns to invite you to a later review of your construction, connected proof and continued participation. This is a separate recognition from having a single demonstration checked.",
        action: "Submit your independently checked geometrical work", skills: { reckoning: 30, literacy: 25 }, chance: 60,
        accepted: "Fellow readers review your construction, connected proof and sustained independent study. They recognize {name} as Disciple of Euclid, a distinction for your work in the Euclidean tradition. The record claims no personal instruction or approval from Euclid.",
        failed: "The readers acknowledge your accepted exercises but do not grant the requested distinction. The checked work remains yours, and practical geometry and independent authorship remain open.",
      },
    ],
  },
  {
    id: "scholar-of-theophrastus", figure: { id: "theophrastus", name: "Theophrastus" },
    routeId: "philosophy", title: "Scholar of Theophrastus", fromYear: -322, minAge: 18, independentStudy: true,
    sourceIds: ["historical-title-theophrastus"],
    description: "Study Theophrastus's inquiries independently through observed plants, tested explanations and reviewed contributions. Personal instruction from Theophrastus is not required.",
    steps: [
      {
        id: "introduction", title: "A scholar brings questions about the natural world", achievementTitle: "Independent Theophrastean study begun",
        text: "A local scholar brings questions and study copies associated with Theophrastus's inquiries. You can compare plants and explanations here, without travelling to his school or receiving his instruction. Earlier missed opportunities with famous teachers do not close this path.",
        action: "Pay 15 drachmas for copies and begin a comparative inquiry", skills: { philosophy: 15, literacy: 20 }, cost: 15,
        accepted: "You obtain study copies and record a limited observation for an independent comparative inquiry. Fellow readers check your starting account and agree to review further observations. This establishes your study, without claiming a personal meeting with Theophrastus or a place at the Lyceum.",
        effects: [gain("philosophy", 2)],
      },
      {
        id: "plant-observations", title: "The visiting scholar brings a question about plants", achievementTitle: "Theophrastean plant observations independently checked",
        text: "A messenger brings a question about why similar plants grow differently in two settings. A useful answer needs separate observations of the plants and their conditions, with uncertain reports marked as such.",
        action: "Pay 10 drachmas and submit the plant comparison", skills: { literacy: 25, philosophy: 20 }, cost: 10,
        accepted: "Fellow readers compare your separately recorded plants and growing conditions. They accept the limited observation record after you identify which differences remain unexplained. The contribution is yours, rather than a claim to have authored Theophrastus's botanical works.",
        failed: "The readers find that a reported plant was not checked in its stated setting. The comparison remains incomplete until you can verify it.",
        effects: [gain("philosophy", 2)],
      },
      {
        id: "explanation", title: "An explanation is tested against another case", achievementTitle: "A Theophrastean inquiry independently revised",
        text: "The scholar returns with a case that does not fit your first explanation. The next discussion asks you to test the explanation, revise its limits and credit the observations that came from others.",
        action: "Pay 10 drachmas and defend the revised inquiry", skills: { philosophy: 28, literacy: 28, oratory: 15 }, cost: 10,
        accepted: "You test the difficult case and defend the revised inquiry before fellow readers. They accept an account that states its limits and credits borrowed observations. Your accepted comparison and revised explanation are distinct contributions developed through independent study.",
        failed: "The readers find that the revised explanation still ignores the difficult case. The work remains open and no completed inquiry is recorded.",
        effects: [gain("oratory", 2)],
      },
      {
        id: "recognition", title: "A continuing place in the scholarly circle",
        text: "A returning colleague invites you to a review of the observations and inquiry you completed through repeated study. The readers have brought your earlier notes and the corrections others used in their own observations.",
        action: "Pay 10 drachmas and present the checked scholarly work", skills: { philosophy: 30, literacy: 30, oratory: 15 }, cost: 10, chance: 60,
        accepted: "Fellow readers review your checked plant observations, revised inquiry and sustained independent study. They recognize {name} as Scholar of Theophrastus, a distinction for your work in his intellectual tradition. Your notes remain available to other readers; the record claims no personal instruction or approval from Theophrastus.",
        failed: "The readers acknowledge your completed inquiries but do not grant the scholarly distinction. Your accepted work remains available for independent study and teaching.",
      },
    ],
  },
  {
    id: "navigator-of-nearchus", figure: { id: "nearchus", name: "Nearchus" },
    routeId: "seafaring", title: "Navigator of Nearchus", fromYear: -326, untilYear: -324, minAge: 24,
    sourceIds: ["historical-title-nearchus"],
    description: "Travel east, complete fleet preparation and a distinct coastal duty, then have the returned account reviewed.",
    steps: [
      {
        id: "fleet-preparation", title: "A travelling shipmaster brings an eastern commission", achievementTitle: "Nearchus's fleet stores checked",
        text: "A shipmaster visiting the Egyptian coast offers passage east with men bound for Alexander's fleet preparations. Taking the commission means joining Nearchus near the Indus and checking the issued water and stores there. Nearchus is not visiting Egypt.",
        action: "Pay 15 drachmas, travel east and check the fleet stores", skills: { seamanship: 25, reckoning: 15 }, cost: 15, untilYear: -326,
        accepted: "You travel east with the shipmaster, join Nearchus's fleet preparations near the Indus and check the water and stores issued to your assigned vessel. Nearchus's officer accepts the reconciled account as your first completed maritime duty.",
        effects: [gain("seamanship", 2)],
      },
      {
        id: "coastal-duty", title: "A fleet officer returns with a coastal assignment", achievementTitle: "Nearchus's coastal duty completed", fromYear: -325, untilYear: -325,
        text: "With Nearchus's fleet, an officer assigns you to a bounded coastal duty: keep an actual record of the landfalls and water taken on your vessel, and distinguish checked stops from reports received ashore.",
        action: "Complete the assigned coastal record and water account", skills: { seamanship: 30, reckoning: 18 }, chance: 80,
        accepted: "You complete the assigned coastal duty with Nearchus's fleet and reconcile the water actually taken aboard. Nearchus's officer accepts your checked landfall record, distinguishing places you reached from unverified reports. This is your second completed maritime duty, not command of the whole expedition.",
        failed: "Nearchus's officer finds an unverified water stop in the account. The voyage continues, but your assigned record is not accepted as a completed coastal duty.",
        effects: [gain("seamanship", 2)],
      },
      {
        id: "recognition", title: "Nearchus checks the returned account", fromYear: -324,
        text: "At the returned fleet's review, an officer brings your accepted store account and coastal duty record to Nearchus. The recognition concerns the duties you actually completed, rather than claiming that you led his expedition.",
        action: "Present both completed maritime duties for review", skills: { seamanship: 35, reckoning: 20, oratory: 10 }, chance: 60,
        accepted: "Nearchus reviews your reconciled fleet stores and completed coastal duty. Nearchus recognizes {name} as Navigator of Nearchus. The corrected landfalls and water stops are retained with the voyage account under your name.",
        failed: "Nearchus acknowledges your accepted duties but does not grant the navigator distinction. Your completed voyage work remains recorded; this review is complete.",
      },
    ],
  },
  {
    id: "secretary-of-eumenes", figure: { id: "eumenes", name: "Eumenes of Cardia" },
    routeId: "commerce", title: "Secretary of Eumenes", fromYear: -322, untilYear: -317, minAge: 28,
    sourceIds: ["historical-title-eumenes"],
    description: "Enter Eumenes's camp service, complete checked correspondence and a distinct stores account, then seek a bounded appointment.",
    steps: [
      {
        id: "introduction", title: "A camp messenger calls at your household", achievementTitle: "Accepted into Eumenes's camp service",
        text: "A messenger passing through Egypt brings an offer of clerical work with Eumenes of Cardia. Accepting requires a journey to his camp in Asia Minor and an introduction to its records staff. Eumenes is not a king, and the offer is not a royal secretaryship.",
        action: "Pay 10 drachmas and join the camp's records staff", skills: { literacy: 20, reckoning: 15 }, cost: 10,
        accepted: "You travel from Egypt to Eumenes of Cardia's camp in Asia Minor and complete a supervised copying task. Eumenes of Cardia's records officer accepts you into the staff for further checked duties. You have not received an independent secretary appointment.",
        effects: [gain("literacy", 2)],
      },
      {
        id: "correspondence", title: "The messenger returns with conflicting drafts", achievementTitle: "Eumenes's correspondence checked",
        text: "In the camp records office, a courier brings two drafts of the same instruction. Names and destinations differ. You must check the authorized wording, retain the correction and obtain the receiving officer's acknowledgement.",
        action: "Settle the authorized text and obtain its receipt", skills: { literacy: 25, oratory: 10 },
        accepted: "You check the authorized text, dispatch the corrected instruction and retain its receiving receipt in Eumenes of Cardia's camp. Eumenes of Cardia's officer accepts the completed correspondence duty under your name.",
        failed: "The receiving acknowledgement is missing. Eumenes of Cardia's officer keeps the correspondence duty unresolved rather than certifying a completed dispatch.",
        effects: [cash(12), gain("literacy", 2)],
      },
      {
        id: "stores-account", title: "An officer brings a different records problem", achievementTitle: "Eumenes's camp stores reconciled",
        text: "The next duty concerns stores actually issued to a unit, not another letter. You must compare the issue list with the receiving account and record any unresolved difference without hiding it in a clean copy.",
        action: "Reconcile the stores and preserve the supporting receipts", skills: { reckoning: 25, literacy: 28 },
        accepted: "You reconcile the issued stores with the receiving receipts in Eumenes of Cardia's camp and state the remaining limits plainly. Eumenes of Cardia's officer accepts the settled account as a distinct completed records duty.",
        failed: "A receipt does not match the stated issue. Eumenes of Cardia's officer asks for a checked correction; a clean-looking copy alone earns no accepted account.",
        effects: [cash(12), gain("reckoning", 2)],
      },
      {
        id: "recognition", title: "Eumenes reviews the staff's recommendation",
        text: "The records officer brings both completed duties and recommends you for a secretary appointment on Eumenes's staff. Your dispatch receipts and stores accounts are laid out for his inspection.",
        action: "Present the correspondence and stores records for appointment", skills: { literacy: 30, reckoning: 25, oratory: 15 }, chance: 55,
        accepted: "Eumenes of Cardia reviews your checked correspondence and reconciled stores account, then appoints {name} as Secretary of Eumenes. Eumenes of Cardia's records officer hands over the dispatches now assigned to your care.",
        failed: "Eumenes of Cardia retains your accepted duties in the camp record but defers the secretary appointment. Your earlier work remains credited; this final review is complete.",
      },
    ],
  },
  {
    id: "trusted-adviser-of-ptolemy", figure: { id: "ptolemy", name: "Ptolemy I" },
    routeId: "commerce", title: "Trusted Adviser of Ptolemy", fromYear: -323, untilYear: -284, minAge: 27,
    sourceIds: ["historical-title-ptolemy"],
    description: "Serve Ptolemy's Egyptian administration, complete separate supply and petition duties and seek personal recognition.",
    steps: [
      {
        id: "introduction", title: "An officer from Ptolemy's administration visits", achievementTitle: "Accepted into Ptolemy's administrative service",
        text: "An officer serving Ptolemy visits with a request for local records work. Since Alexander's death, Ptolemy governs Egypt; the invitation is to his administration, without assuming that he already bears the royal title.",
        action: "Join the office and complete the supervised account", skills: { literacy: 20, reckoning: 20, oratory: 12 },
        accepted: "You join an office in Ptolemy I's Egyptian administration and complete a supervised local account. Ptolemy I's officer accepts the work and asks you to return when the next delivery records arrive.",
        effects: [cash(10), gain("reckoning", 1)],
      },
      {
        id: "supply-settlement", title: "An officer returns with an unsettled delivery", achievementTitle: "Ptolemy's supply settlement completed",
        text: "The officer returns after a disagreement between a storehouse and a supplier. You must check the actual quantities, settle the agreed payment and obtain confirmation from both sides.",
        action: "Complete the checked delivery and payment settlement", skills: { reckoning: 28, literacy: 25 },
        accepted: "You reconcile the delivered quantities, settle the agreed payment and retain both acknowledgements for Ptolemy I's administration. Ptolemy I's officer accepts the completed supply settlement as your own work.",
        failed: "One acknowledgement is missing. Ptolemy I's officer records the unsettled difference, and the duty earns no completed-settlement credit.",
        effects: [cash(15), gain("reckoning", 2)],
      },
      {
        id: "petition", title: "Two households ask for incompatible decisions", achievementTitle: "A petition reviewed for Ptolemy",
        text: "A visiting official brings petitions from two households disputing access to a store. Your earlier accounts are useful, but this duty needs a separate hearing, a bounded recommendation and confirmation of what the decision actually changed.",
        action: "Hear both accounts and complete the reviewed recommendation", skills: { oratory: 25, literacy: 28, reckoning: 25 },
        accepted: "You hear both households, check their supporting records and submit a bounded recommendation to Ptolemy I's administration. Ptolemy I's officer confirms the implemented settlement and accepts the later review as a distinct completed duty.",
        failed: "The review finds that a household's evidence was not checked. Ptolemy I's officer returns the recommendation without accepting the petition duty.",
        effects: [cash(15), gain("oratory", 2)],
      },
      {
        id: "recognition", title: "Ptolemy asks to see the completed records",
        text: "An officer returns with an invitation to a personal service review. Your completed supply settlement and reviewed petition will be considered together before Ptolemy chooses whether to entrust you with an advisory role.",
        action: "Attend the review and present both completed duties", skills: { oratory: 30, literacy: 30, reckoning: 30 }, chance: 50,
        accepted: "Ptolemy I reviews your settled supply account, the petition settlement and its later review. Ptolemy I recognizes {name} as Trusted Adviser of Ptolemy. His officer adds your name to the people called when a disputed local account needs judgement.",
        failed: "Ptolemy I acknowledges your completed administrative work but does not grant the advisory distinction. Your accepted duties remain recorded; the final service review is complete.",
      },
    ],
  },
];

export function applyHistoricalTitles(world) {
  const sources = JSON.parse(readFileSync(new URL("../research/historical-title-event-sources.json", import.meta.url), "utf8"));
  world.sources ??= [];
  for (const source of sources) if (!world.sources.some(existing => existing.id === source.id)) world.sources.push(structuredClone(source));
  for (const plan of historicalTitlePlans) {
    const route = world.legacy.routes.find(item => item.id === plan.routeId);
    if (!route) throw new Error(`Historical title path requires the ${plan.routeId} legacy route.`);
    const declined = `historical-${plan.id}-declined`;
    world.flags[declined] = { label: `Ended the ${plan.title} invitation path`, initial: false };
    plan.steps.forEach((step, index) => {
      const final = index === plan.steps.length - 1;
      const achievement = final ? plan.id : `${plan.id}-${step.id}`;
      const previous = index ? `${plan.id}-${plan.steps[index - 1].id}` : undefined;
      route.achievementIds.push(achievement);
      world.legacy.achievements.push({
        id: achievement, routeId: plan.routeId, title: final ? plan.title : step.achievementTitle,
        description: final ? plan.description : step.accepted.replaceAll("{name}", "the player"),
        kind: final ? "prestige" : "ordinary", nameTemplate: final ? `{name}, ${plan.title}` : `{name}'s ${step.achievementTitle}`,
        people: plan.independentStudy ? [...studyReaders] : [plan.figure.name], figure: { ...plan.figure }, evidence: "fictional", sourceIds: [...plan.sourceIds],
      });
      // A late invitation must leave enough whole years for the remaining
      // accepted milestones; an impossible last-minute start is not a path.
      const deadline = plan.untilYear === undefined ? step.untilYear
        : Math.min(step.untilYear ?? plan.untilYear, plan.untilYear - (plan.steps.length - 1 - index));
      const conditions = [
        age(step.minAge ?? plan.minAge), year("gte", step.fromYear ?? plan.fromYear),
        ...(deadline === undefined ? [] : [year("lte", deadline)]),
        { type: "flag", flag: declined, value: false }, not(earned(achievement)),
        ...(previous ? [earned(previous, 1)] : []),
        ...Object.entries(step.skills).map(([id, value]) => skill(id, value)),
      ];
      const cost = step.cost ?? 0;
      const acceptedId = `${plan.id}-${step.id}-accepted`;
      const chance = step.chance ?? (final ? 50 : index ? 75 : 100);
      const requirements = cost ? [...conditions, { type: "cash", op: "gte", value: cost }] : conditions;
      const mainSkill = Object.keys(step.skills)[0];
      const expenseText = cost ? ` You spend ${cost} drachmas on ${plan.independentStudy ? "copies and study materials" : "the journey and materials"}.` : "";
      const outcomes = [{
        id: acceptedId, text: `${step.accepted}${plan.independentStudy ? ` ${studyReaders.join(" and ")} record the reviewed work under your name.` : ""}${expenseText}`,
        weight: chance,
        ...(chance < 100 ? { weightModifiers: [{ when: skill(mainSkill, Math.min(75, step.skills[mainSkill] + 20)), multiplier: 1.3,
          reason: "Further developed skill supports the checked undertaking" }] } : {}),
        effects: [...(cost ? [cash(-cost)] : []), ...(step.effects ?? []), { type: "accomplishment", achievement }],
      }];
      if (chance < 100) outcomes.push({
        id: `${plan.id}-${step.id}-unfinished`,
        text: `${step.failed}${expenseText}${final ? "" : ` You can prepare a correction for another annual opportunity${plan.independentStudy ? "." : " while this historical window remains open."}`}`,
        weight: 100 - chance, effects: [...(cost ? [cash(-cost)] : []), gain(mainSkill, 1)],
      });
      world.events.push({
        id: `historical-${plan.id}-${step.id}`, title: step.title, text: step.text,
        trigger: { type: "year", at: step.fromYear ?? plan.fromYear }, when: all(...requirements),
        maxOccurrences: final || index === 0 ? 1 : 3, ...(index && !final ? { cooldownYears: 1 } : {}),
        evidence: "fictional", sourceIds: [...plan.sourceIds],
        choices: [{
          id: `attempt-${plan.id}-${step.id}`, text: step.action, when: all(...requirements),
          ...(chance < 100 ? { opportunity: { label: final ? plan.title : step.achievementTitle, outcomeIds: [acceptedId] } } : {}), outcomes,
        }, {
          id: `decline-${plan.id}-${step.id}`, text: "End this invitation path and keep your own plans",
          outcomes: [{ id: `${plan.id}-${step.id}-declined`, text: `You tell the messenger that you will not continue this invitation path. Your completed work remains in the record, and your other careers remain open.`, weight: 1, effects: [flag(declined)] }],
        }],
      });
    });
  }
  return world;
}
