// Original scene writing, informed by the domestic scale and crowded public
// spaces of Theocritus, Idyll 15. This is fiction, not a translation or evidence
// that these particular incidents happened in first-century BCE Alexandria.
// Only text is replaced; every condition, effect and probability stays intact.
const scenes = {
  "caesar-in-alexandria": {
    title: "War at the harbor",
    text: "Caesar arrives in Alexandria in 48 BCE, drawn into the struggle for Egypt's throne. Fighting reaches the harbor and nearby streets; the quarrel over the kingdom is now a danger close to home.",
  },
  "water-and-war": {
    title: "Water under siege",
    text: "The fighting continues into 47 BCE. A Roman account tells of efforts to spoil Caesar's water supply and of wells dug in response. Amid the struggle for the city, even drinking water has become a weapon.",
  },
  "news-of-actium": {
    title: "Word from Actium",
    text: "Word reaches Alexandria of defeat at Actium in 31 BCE. Antony and Cleopatra have lost to Octavian; the kingdom must now reckon with his victory.",
  },
  "roman-rule": {
    title: "The kingdom ends",
    text: "In 30 BCE, Egypt passes from Ptolemaic to Roman rule. Augustus will count it among his conquests. For the people who live here, the change brings a new authority over the same homes and livelihoods.",
  },
  "the-first-household": {
    title: "You are born",
    text: "You are born in Alexandria. For now, the city is no larger than the room where someone lifts you, feeds you and settles you to sleep.",
  },
  "first-steps": {
    title: "Between two hands",
    text: "One adult lets go; another waits a few steps away. You cross the gap on unsteady feet, with hands following close enough to catch you.",
  },
  "a-child-in-the-courtyard": {
    title: "The game outside",
    text: "A shout comes through the doorway: the children outside are starting another game. Indoors, a familiar adult is counting things into a basket. There is room for you in either place.",
    choices: {
      "close-to-home": [null, "You put the pieces into little groups and count with the adult. When the basket is full, you tip it out and ask to begin again."],
      "play-with-neighbors": [null, "Everyone wants the first turn. With a carer's help, you name the order, and the children start moving again. You bring the game's signals home on dusty hands."],
    },
  },
  "early-care-market-morning": {
    title: "A basket for the market",
    text: "Your carer is ready to leave, basket on one arm. Outside, the sellers are calling; a relative offers to keep you at home. The adults must decide before the morning grows hotter.",
    choices: {
      "early-care-go-market": [null, "Your carer lets you count the purchases as they go into the basket. The seller waits through your first muddled attempt, then helps you check."],
      "early-care-stay-relative": [null, "The relative spreads broad wooden pieces on the floor. You make an animal, change its head, then insist that everyone look before you take it apart."],
    },
  },
  "early-care-visitors": {
    title: "One room, too many voices",
    text: "Visitors squeeze into the room while supper is being set out. Someone moves a stool; someone asks where the cups have gone. Your carer must find a place for you before another dish reaches the table.",
    choices: {
      "early-care-help-table": ["Stay beside the adults and ask questions", "You ask why one guest does things differently from another. An answer leads to another question, and soon two adults are arguing gently over your head."],
      "early-care-quiet-play": ["Make little figures in the quieter room", "An older child takes you next door with a handful of broad wooden pieces. You fit them into a person, then an animal, while the supper voices rise and fall through the wall."],
    },
  },
  "early-care-restless-afternoon": {
    title: "Under everyone's feet",
    text: "The adults are sorting household stores, and you keep getting in the way. Each time they set you aside, you return with another question. Someone suggests finding you a task of your own.",
    choices: {
      "early-care-sorting-game": [null, "You line up the empty containers beside the adults' piles. The line falls over; you set it up again, now very much occupied."],
      "early-care-outside-song": ["Go out for a song and a walk", "A familiar adult carries the song from one stretch of shade to the next. By the time you return, you are content to sit and listen."],
    },
  },
  "the-first-letters": {
    title: "The first readable word",
    text: "A neighbor offers to teach you a few letters. Your household must find the lesson money and spare you from its errands. The marks are small; making time for them is the harder part.",
    choices: {
      "learn-letters": [null, "At first you copy shapes. Then the neighbor covers the example, and you recognize a word on your own."],
      "learn-by-doing": [null, "You stay with the work already at hand. A worker guides your grip, lets you try, then shows you where the tool slipped."],
    },
  },
  "early-learning-shop-marks": {
    title: "Whose mark is on the jar?",
    text: "The jars in a shop carry marks you cannot read. You ask whether they name the owner, the contents or the price. With no customer waiting, a worker puts down the tally and offers to show you.",
    choices: {
      "early-jars-read-labels": [null, "You copy the letters, lose one, and begin again. Before leaving, you pick out the same name on a second jar."],
      "early-jars-count-stock": [null, "The worker tips a small batch onto the bench. You count it together, then compare your total with the marks."],
      "early-jars-make-stoppers": [null, "You compare the jar mouths and smooth a stopper under the worker's eye. The first sits crooked; the next fits more closely."],
    },
  },
  "early-learning-model-boat": {
    title: "A boat on dry ground",
    text: "A neighbor is repairing a little model boat outside the door. Spare cord and pegs lie around it. You stop long enough for the neighbor to make space beside the work.",
    choices: {
      "early-boat-knots": [null, "You tie the spare cord until the neighbor can pull it without the knot slipping. Then you learn how to undo what you have made."],
      "early-boat-letters": [null, "Someone who can read spells out the boat's name. You copy its letters and search for the same shapes on other things."],
      "early-boat-pieces": [null, "You sort the pegs by size and count each pile. The neighbor checks them before gathering the parts away."],
    },
  },
  "early-learning-clay-scrap": {
    title: "Clay left on the bench",
    text: "A worker pushes a leftover piece of clay towards you. The afternoon's errands are finished, and nobody needs the bench yet. You can flatten it, divide it or try to give it a shape.",
    choices: {
      "early-clay-letter": [null, "A reader draws a few letters for you. You press them into the clay, wipe away the crooked attempt and make a clearer one."],
      "early-clay-counters": [null, "You roll out little counters and divide them into groups. The worker takes one away and asks you to make the groups equal again."],
      "early-clay-container": [null, "You pinch the clay into a small container. One wall is much thicker than the other; the worker shows you before it begins to dry."],
    },
  },
  "the-shape-of-the-city": {
    title: "Beyond the familiar turning",
    text: "You can now name the streets that once needed an adult to explain them. A workshop doorway, a seller's usual place, the turn towards the quays: the city is becoming a set of errands you can manage.",
  },
  "a-place-to-learn": {
    title: "A place at the bench",
    text: "You have outgrown the smallest errands. Your household discusses reading lessons, a place in a workshop, or more work at home. Each arrangement will take something from the week's time or money.",
    choices: {
      "practice-reading": [null, "You fit lessons around the household's work. Short passages and simple counts grow easier with repetition."],
      "join-workbench": [null, "The workshop gives you a preparation place. You carry materials, clean tools and repeat the tasks the worker has shown you."],
      "help-household": [null, "You take over more of the errands and small repairs. At home, the adults have fewer tasks left unfinished at night."],
    },
  },
  "early-training-merchants-list": {
    title: "The count on the page",
    text: "A merchant who knows your household needs another pair of eyes on the stock. There is work beside the lists, and a nearby workshop also needs preparation help. Both expect you to learn while the day's work goes on.",
    choices: {
      "early-training-check-list": [null, "You compare the list with the goods on the shelf. The merchant points to a quantity you missed and waits while you write it again."],
      "early-training-preparation": [null, "The workshop puts you beside an experienced worker. You prepare the materials and check the measures before the skilled work begins."],
      "early-training-count-goods": [null, "You count each batch aloud while a worker checks. When the last batch agrees with the list, the merchant pays your household 10 drachmas."],
      "early-training-decline-list": ["Keep the work already arranged", "You thank the merchant and go back to the day's errands. The stock list passes to someone else."],
    },
  },
  "early-training-repair-yard": {
    title: "A cleared corner of the bench",
    text: "Cord, wooden offcuts and small fittings crowd a repair bench. A worker clears a corner and offers you a place. The yard also has messages to read and errands that cannot wait.",
    choices: {
      "early-training-cord-bench": [null, "You learn to prepare the cord and wood before attempting a small repair. The worker checks it, pulls it apart and has you fit it once more."],
      "early-training-yard-messages": [null, "A reader helps you untangle the short requests sent to the yard. You copy the names carefully enough for someone else to use them."],
      "early-training-yard-errands": [null, "You carry the messages and light supplies yourself. At home, there is less need to pay someone else to make the trips."],
      "early-training-decline-yard": ["Pass on the yard's offers", "You leave the cleared corner for another learner and return to the work arranged at home."],
    },
  },
  "early-training-potters-bench": {
    title: "Orders beside the clay",
    text: "A potter has more orders than space on the bench. Someone must prepare the clay and tools; someone must keep one customer's vessels apart from another's. The worker asks which part you want to learn.",
    choices: {
      "early-training-pottery-apprentice": [null, "You begin with clay preparation and clean tools. Your first small pieces stay on the bench until the worker has checked them."],
      "early-training-pottery-records": [null, "You copy the order notes with a reader beside you. A wrong quantity is crossed out, and you count that customer's vessels again."],
      "early-training-pottery-home": [null, "You leave the place at the bench and take on more purchases and small repairs for the household."],
      "early-training-decline-potter": ["Pass on the workshop's offers", "The worker returns to the orders. You go home to the tasks that were already waiting."],
    },
  },
  "the-first-wages": {
    title: "A place on the quay crew",
    text: "The quay crew is taking on workers. Cargo waits beside the landing place, and a day's delay costs somebody money. You can take regular work, seek a smaller task, or keep the job you have.",
    choices: {
      "steady-work": [null, "You join the carrying and sorting on the quays. The first pay is welcome; the ache in your shoulders comes home with it."],
      "seek-experience": [null, "You take a task you have not done before. The pay is small, and another worker stops twice to correct your method."],
      "keep-first-job": [null, "You let the crew fill its place and return to your current work."],
    },
  },
  "early-wages-shop-help": {
    title: "An extra worker for the shop",
    text: "The shop's deliveries and records are falling behind. The owner wants someone to carry goods or check the accounts, and asks what you can already do. A small parcel also needs taking nearby.",
    choices: {
      "early-wages-clerk": [null, "The merchant gives you a regular place beside the lists. You begin by checking small accounts against the goods."],
      "early-wages-shop-porter": [null, "You join the quay workers carrying the shop's cargo. The deliveries become part of your regular working day."],
      "early-wages-shop-parcel": [null, "You deliver the parcel and wait for the acknowledgment. Back at the shop, the owner counts out your 10 drachmas."],
      "early-wages-decline-shop": ["Pass on the shop's offers", "You leave the parcel on the counter and keep the arrangements you already have."],
    },
  },
  "early-wages-kiln-order": {
    title: "More pots than hands",
    text: "Rows of everyday pots crowd the workshop. A large order needs finishing, and the usual workers cannot clear it alone. There are places for a trained potter, a learner, or someone willing to prepare the packing.",
    choices: {
      "early-wages-potter": [null, "You take regular pottery work among the rows of vessels, shaping and finishing the pieces still owed to customers."],
      "early-wages-kiln-apprentice": [null, "You begin preparing materials beside the bench. A worker shows which tools belong where and checks your first tasks."],
      "early-wages-kiln-preparation": [null, "You sweep the bench and prepare packing around the finished pots. When the worker has checked the rows, you receive 10 drachmas."],
      "early-wages-decline-kiln": ["Leave the workshop to its order", "You step out between the stacked vessels and go back to your existing work."],
    },
  },
  "early-wages-quay-delivery": {
    title: "Bundles waiting to go",
    text: "Small deliveries have piled up on the quays. The carrying crew needs another worker; nearby, a repair worker sits with a tangle of cord. There is a day's task here as well as a regular place.",
    choices: {
      "early-wages-quay-porter": [null, "You join the regular crew moving cargo into the nearby stores. Before long, you know which doorway belongs to each load."],
      "early-wages-cord-work": [null, "You cut and coil the cord under the repair worker's eye. They pay 10 drachmas and leave you with a knot to practise."],
      "early-wages-check-loads": [null, "A worker reads the list while you count the bundles. Together you catch an entry that has been counted twice."],
      "early-wages-decline-quay": ["Keep to your present work", "You leave the bundles to the crew and return to the tasks already waiting for you."],
    },
  },
  "early-work-harbor-crew": {
    title: "Before the ship leaves",
    text: "A merchant crew is making ready to sail. They have a place for someone who knows the ropes, while the quay crew needs workers who will stay. You must decide before the ship's remaining business is finished.",
    choices: {
      "early-work-join-crew": [null, "You take your place aboard and begin the work you have practised ashore. The familiar quay will soon be behind you."],
      "early-work-quay-place": [null, "You take regular work carrying and sorting on the quays. At the end of the day, you can still walk home."],
      "early-work-practise-cord": [null, "You remain ashore with the spare rope. A worker checks the knots you will need before you seek a berth."],
      "early-work-decline-crew": [null, "The crew makes ready without you. You keep the work and arrangements you already have."],
    },
  },
  "early-work-workshop-orders": {
    title: "Two benches, two kinds of work",
    text: "A potter needs vessels finished; a copyist has sheets waiting for another hand. Both want to see what you can do. There is also room for a learner to prepare materials at a workshop bench.",
    choices: {
      "early-work-pottery-place": [null, "You take regular pottery work and begin on the vessels owed to the workshop's customers."],
      "early-work-copyist-place": [null, "You take a regular place at the copying bench. Another reader checks the first sheets before letting them leave."],
      "early-work-preparation-place": [null, "You begin a workshop apprenticeship, preparing materials and learning the tools beside an experienced worker."],
      "early-work-decline-workshops": [null, "You pass on both benches and return to your present arrangements."],
    },
  },
  "early-work-reader-introduction": {
    title: "A name to take to the employer",
    text: "A reader who knows your household offers to introduce you to a merchant or a copying workshop. Their word will get you through the door; the work will still have to speak for you.",
    choices: {
      "early-work-merchant-records": [null, "The merchant gives you stock lists and small accounts to check. An experienced clerk goes over the first entries with you."],
      "early-work-copying-bench": [null, "You begin regular work at the copying bench, checking each sheet before you hand it over."],
      "early-work-reading-practice": [null, "The reader sets you a passage and a few sums. You work through them, then return to the places where you went wrong."],
      "early-work-decline-introductions": [null, "You thank the reader but take neither introduction. Your existing work still needs you."],
    },
  },
  "child-route-care-clay-animals": {
    title: "An animal without ears",
    text: "Your carer sets a lump of clay before you. One person calls it a goat; another insists it is a dog. At present it has neither ears nor a tail to settle the matter.",
    choices: {
      shape: [null, "Your carer steadies the lump while you press on the ears and tail. Now you want another piece, for a second animal."],
      ask: [null, "You point at the same lump and ask each person again. Their answers change, and you want to know why."],
      leave: ["Go and play with something else", "You leave the clay on the mat and turn to another game. Its identity remains unsettled."],
    },
  },
  "child-route-care-echo-rhythm": {
    title: "An answer on the bowl",
    text: "The meal is too hot to eat. While you wait, someone taps a little pattern on an empty wooden bowl, then pauses and looks at you.",
    choices: {
      answer: [null, "You tap back, miss a beat and try again. The other person answers with a new pattern, and supper has to wait another moment."],
      count: [null, "You hold up a finger for each tap. An extra sound catches you short, and your carer helps you begin the count again."],
      leave: ["Wait for the food instead", "You leave the bowl quiet and watch the steam rising from your meal."],
    },
  },
  "child-route-care-window-shadow": {
    title: "Sunlight on the floor",
    text: "A bright patch lies across the floor. Each time you come back, it has slipped a little farther towards the wall. Your carer stops to see what you are watching.",
    choices: {
      mark: [null, "You set a pebble at the edge, with your carer keeping it clear of the doorway. When you return, the light has left it behind."],
      story: [null, "You give the patch a voice. Your carer answers, and for a while the room contains a conversation with the sunlight."],
      leave: ["Find another game", "You leave the light to cross the room without you and go to another game."],
    },
  },
  "child-route-care-cloth-loop": {
    title: "The bundle that opens again",
    text: "A folded cloth keeps falling open as the household puts things away. Your carer takes a short piece of spare cord and makes a loose loop. You reach to see how it holds.",
    choices: {
      loop: [null, "Your carer watches your hands while you work the short cord. At last the loop stays together when you pull."],
      fold: [null, "You press the cloth's corners into a new outline. The shape pleases you more than the knot, and you begin folding another scrap."],
      leave: ["Let your carer finish", "You give back the cord. Your carer ties the cloth and puts it away."],
    },
  },
  "child-route-care-shared-steps": {
    title: "Whose turn comes first?",
    text: "The children have laid scraps into a path across the courtyard. Two of them step onto the first piece at once. The game stops while everyone claims the next turn.",
    choices: {
      turns: [null, "With a carer's help, you name who follows whom. Feet begin moving along the path again."],
      reason: [null, "You ask why that child should go first. The others offer reasons, and you go on asking even after the game has changed."],
      leave: ["Go to another game", "You step away from the path. Behind you, the argument about turns continues."],
    },
  },
  "child-route-care-floating-reed": {
    title: "A reed on the water",
    text: "Your carer sets a shallow washing bowl within reach. A short reed stays on the surface; a little stone drops to the bottom. You point from one to the other.",
    choices: {
      boat: [null, "Your carer holds the bowl while you balance light scraps on the reed. One tips into the water, and you ask to try another."],
      compare: [null, "You put the reed and stone in again and again. Your carer answers your questions, then has to think harder when you repeat them."],
      leave: ["Leave the bowl with your carer", "You dry your hands and go to something else. Your carer lifts the stone out of the water."],
    },
  },
  "child-route-care-unequal-portions": {
    title: "The fuller-looking cup",
    text: "Your carer divides a snack between two cups. One is tall and narrow, the other low and broad. Someone is certain the tall cup has more.",
    choices: {
      count: [null, "You match the pieces one by one, with help. When the last pair is counted, the portions seem different from how they first looked."],
      ask: [null, "You ask why the division is fair. The adults begin with the pieces, move on to the cups, and are still talking when the snack is gone."],
      leave: ["Eat your share", "You eat without settling the question. Soon both cups are empty."],
    },
  },
  "child-route-care-puppet-voices": {
    title: "Who is behind the cloth?",
    text: "A cloth puppet appears above a hanging sheet and begins asking questions. You know the older child hiding behind it, but the voice makes you laugh. Your carer sits nearby.",
    choices: {
      voice: [null, "You give another puppet a voice of its own. The older child answers, then waits for you to think of the next reply."],
      make: [null, "You arrange large scraps for the eyes and mouth. With help fastening them, the face you imagined begins to stay in place."],
      leave: ["Watch for a while", "You sit beside your carer and let the puppet carry on talking."],
    },
  },
  "child-route-learning-pattern-repair": {
    title: "A break in the pattern",
    text: "A decorative pattern stops at the broken edge of an offcut. A worker lays it on the bench and asks what should come next. There is time to try an answer before the real work resumes.",
    choices: {
      shape: [null, "You shape a soft replacement against the surviving edges. The worker points to a line that fails to meet, and you adjust it."],
      read: [null, "The worker's notes become a lesson in letters. You copy each mark until you can pick it out without a pointing finger."],
      measure: [null, "You set out counters for the missing parts. The number agrees with the pattern only after you move one counter back."],
      leave: ["Leave the offcut on the bench", "You put down the offcut. The worker sets it beside the unfinished pieces and returns to work."],
    },
  },
  "child-route-learning-two-explanations": {
    title: "Two answers at the table",
    text: "Two adults give you different reasons for the same household rule. Each thinks the other has made it too complicated. A reader offers to help you work out what they mean.",
    choices: {
      compare: [null, "You repeat each reason back. The adults correct you, then discover that they disagree with each other too."],
      read: [null, "The reader helps you sound out a little story about the rule. Once you can read it, the question of what its people should have done remains."],
      perform: [null, "You give each adult a different voice. The household laughs, then asks you to repeat the part they could not hear."],
      leave: ["Let the adults settle it", "You leave the discussion to its two authors and go back to your own task."],
    },
  },
  "child-route-learning-cord-and-names": {
    title: "The rope worker's list",
    text: "Short lengths of cord lie beside a written list of jobs. A rope worker sets one piece aside for you. You can learn what it does, how much is needed, or what the marks on the list say.",
    choices: {
      knots: [null, "You tie and undo the knot until it holds without becoming impossible to open. The worker pulls it once to check."],
      read: [null, "A reader helps you copy the task names. You find the same letters again when the list is turned around."],
      lengths: [null, "You count out cord for each job and put the pieces in separate piles. The worker checks before taking them away."],
      leave: ["Leave the cord with the worker", "You put the spare length back beside the list. The worker gathers it into the next job."],
    },
  },
  "child-route-learning-ordered-figures": {
    title: "A procession at a standstill",
    text: "The children send wooden figures through a narrow gap in a pretend procession. Every group arrives at once. Now someone must decide who moves and who waits.",
    choices: {
      organise: [null, "You agree on an order and a signal for each group. The figures pass through the gap without another collision."],
      read: [null, "A reader helps you copy the labels. Even when the children move the figures, you can find the names again."],
      carve: [null, "With a worker watching, you fit a broad scrap beneath a loose figure. It finally stands alongside the others."],
      leave: ["Leave the procession to the others", "You leave the figures at the gap. The other children try a different order."],
    },
  },
  "child-route-learning-counter-exchange": {
    title: "The price on the mat",
    text: "An adult lays out a pretend trade with counters. The two sides look equal until the counters are moved. Before you agree, there is time to look more closely.",
    choices: {
      balance: [null, "You group the counters and compare the totals. A piece hidden behind another changes the bargain."],
      read: [null, "You copy the short record and match its letters and numbers to the counters. The marks begin to describe something you can check."],
      question: [null, "You explain why you think the trade is fair. The adult changes one term and asks whether your reason still holds."],
      leave: ["Put the counters away", "You gather the counters without agreeing to the pretend trade."],
    },
  },
  "child-route-learning-shadow-marks": {
    title: "Where the shadow was",
    text: "A familiar adult scratches a mark where a stick's shadow ends. Later, the shadow is elsewhere. They ask you to help compare today's marks before the ground is disturbed.",
    choices: {
      compare: [null, "You measure the gaps with equal scraps. The adult makes you replace one that is too short before trusting the count."],
      read: [null, "A reader helps you copy the day labels. You learn which line belongs to which visit to the shadow."],
      shape: [null, "You shape a broad marker and set it where the adult will find it again. It gives the next comparison a clear starting place."],
      leave: ["Leave the marks as they are", "You step around the scratches and leave the adult to finish the comparison."],
    },
  },
  "child-route-learning-missing-phrase": {
    title: "The sound you are waiting for",
    text: "A performer repeats a short phrase and stops before its final sound. The gap seems louder each time. On the next repetition, the performer looks towards you.",
    choices: {
      complete: [null, "You put a sound into the gap. The performer repeats the phrase and asks you to find the same moment again."],
      read: [null, "A reader helps you copy the words used to introduce the piece. You begin to recognize them without the example beside you."],
      count: [null, "You count the beats with the performer. This time you know how long to wait before the phrase returns."],
      leave: ["Let the performer finish it", "You stay quiet. The performer supplies the missing sound and begins the next phrase."],
    },
  },
  "child-route-learning-measuring-cord": {
    title: "Two cords, two answers",
    text: "Two workers have marked the same length with knots set differently. Laid apart, the cords seem to disagree. A reader brings over a short note describing the measure they need.",
    choices: {
      compare: [null, "You lay the cords side by side and count the spaces. The positions of the knots no longer fool you about the length."],
      read: [null, "With the reader's help, you copy the task's words beside a sketch of the cord. You can now follow the note as well as the workers' hands."],
      fit: [null, "You help fit a small wooden frame and lay the cord along it. The worker checks the joints before accepting the measure."],
      leave: ["Leave the measure to the workers", "You hand back the cords. The workers lay them out for another comparison."],
    },
  },
  "child-route-training-puppet-frame": {
    title: "The frame before the performance",
    text: "The performance cloth sags on its frame. A craft worker has brought spare wood, while the performer worries about the gathering that is approaching. They can use help with the joints, the fittings or the rehearsal.",
    choices: {
      frame: [null, "You measure the loose joints and fit replacements. The worker checks each cut before the cloth is hung again."],
      rehearse: [null, "You repeat the entrance, waiting for the cue rather than rushing it. This time the next performer is ready when you finish."],
      list: [null, "You read the supply list and count the fittings aloud. Nothing is hidden beneath the spare wood when the final count is made."],
      leave: ["Leave them to prepare", "You step away from the frame. The craft worker reaches for the next fitting while the performer starts again."],
    },
  },
  "child-route-training-unequal-tasks": {
    title: "Too many helpers at the door",
    text: "Light supplies need moving between two rooms. The helpers keep meeting in the doorway, each sure their load should go first. The adult supervising them asks for a better arrangement.",
    choices: {
      coordinate: [null, "You count the loads, divide the tasks and agree on signals. When two helpers meet at the door again, you change the order."],
      reasons: [null, "You hear why each helper wants to go first. Once the tasks are divided, you explain which point they still disagree about."],
      record: [null, "You check the bundles as they arrive. The supervisor confirms that one mark was made twice, and you correct the count."],
      leave: ["Let the supervisor arrange it", "You leave the doorway clear. The supervisor calls the helpers together to try again."],
    },
  },
  "child-route-training-two-day-lists": {
    title: "A line missing from the list",
    text: "A calculator lays two copies of a day list beside one another. Their headings agree, but farther down the entries drift apart. There is room beside the table if you want to help find the mistake.",
    choices: {
      columns: [null, "You count the intervals and find a line one copy has skipped. The calculator follows your marks and confirms the correction."],
      read: [null, "You read the headings aloud, with help when a word defeats you. The two copies are easier to compare once you know what each column records."],
      cord: [null, "You measure and tie cord for carrying the writing board. The calculator tests it before moving the lists to the next room."],
      leave: ["Leave the copies on the table", "You leave the calculator bent over the two lists and return to your own work."],
    },
  },
  "child-route-training-vessel-packing": {
    title: "A vessel for another house",
    text: "A finished vessel rocks inside its packing. The workshop needs it delivered whole and has more preparation work to come. A worker offers smaller tasks alongside a place for a new apprentice.",
    choices: {
      apprentice: [null, "You take the workshop's preparation place. The worker gives you the first materials to arrange and shows where the tools are kept."],
      protect: [null, "You fit soft supports around the vessel's uneven outline. The worker steadies it while you close the remaining gaps."],
      lash: [null, "You secure a light practice bundle before touching the customer's vessel. The worker pulls at the cord and shows where it still slips."],
      count: [null, "You check the labels and count the packed items with the worker. The receipt agrees before anything leaves the workshop."],
      leave: ["Leave the packing to the worker", "You move away from the vessel. The worker reaches for another piece of packing."],
    },
  },
  "child-route-wages-rehearsal-messages": {
    title: "A message before rehearsal",
    text: "A performer has not yet sent word about a household engagement. Props lie in pieces beside the rehearsal space. There is paid message work, or you can stay to help the performance take shape.",
    choices: {
      message: [null, "You deliver the agreed message, wait for the reply and bring it back without losing a word. The performer pays your household 10 drachmas."],
      props: [null, "You fit the wooden props while a worker checks the joins. The performers can finally rehearse with them in place."],
      cue: [null, "You repeat the entrances until each performer knows when the next will begin. The sequence holds through a full rehearsal."],
      leave: ["Leave them to rehearse", "You go back to your other tasks as the performers start the opening once more."],
    },
  },
  "child-route-wages-delivery-receipt": {
    title: "The count before the delivery",
    text: "A delivery waits beside the shop counter, with its receipt still unchecked. The owner has regular accounts work for a capable clerk. There is also a small parcel to carry and packing to inspect.",
    choices: {
      clerk: [null, "You take the shop's regular clerk work and begin checking its accounts. The first delivery record is already waiting on the counter."],
      parcel: [null, "You count the light parcel with a worker and take it to the nearby recipient. You bring back the acknowledgment and receive 10 drachmas."],
      knots: [null, "You test the spare practice knots beside the packing. The worker shows why one holds and another opens under a pull."],
      read: [null, "A reader helps you separate the names from the quantities. By the end, you can follow the short receipt without losing your place."],
      leave: ["Pass on the shop's work", "You leave the parcel and receipt on the counter. The owner calls for another helper."],
    },
  },
  "child-route-wages-bench-measures": {
    title: "The measure at the bench",
    text: "The workshop's bench is crowded with a wooden fitting, finished pots and packing still to be cut. A potter could take regular work here. The smaller tasks also need hands before the delivery leaves.",
    choices: {
      potter: [null, "You begin regular pottery work for the workshop. There are vessels waiting for you beyond the crowded preparation bench."],
      fitting: [null, "You mark the wood, measure again and fit it under the worker's eye. A small correction brings the edges together."],
      packing: [null, "You put the light tasks in an order the helpers can follow. The final count agrees with the prepared bundles."],
      paid: [null, "You cut and arrange the soft packing. The worker checks it around the vessels before paying your 10 drachmas."],
      leave: ["Keep to your other work", "You leave the busy bench to the workshop's helpers and go back to your own tasks."],
    },
  },
  "child-route-wages-competing-records": {
    title: "Two accounts of one job",
    text: "Two adults set down their records of the same short job. The columns and the explanations disagree, and each points to the other's copy. They need someone to check before they argue any further.",
    choices: {
      explain: [null, "With a reader's help, you compare the wording. You point out the claim that neither account has yet explained."],
      columns: [null, "You count down the columns until one entry has slipped beneath the wrong heading. The disagreement in the numbers becomes easier to locate."],
      copy: [null, "A reader checks as you prepare a clean copy from the two accounts. The household pays 10 drachmas for the finished work."],
      leave: ["Leave the records with their owners", "You set the two copies down. The adults return to comparing them, a little more quietly."],
    },
  },
  "child-route-work-ensemble-repertoire": {
    title: "The part another voice could take",
    text: "The performers are rehearsing for household engagements and need another musician. They will hear you before offering regular work. The entrances and the introduction also need putting in order.",
    choices: {
      performer: [null, "You join the paid rehearsals and engagements. The part that needed another musician is now yours to prepare."],
      practice: [null, "You repeat the entrances with the ensemble. The others stop at the missed cues and give you room to try them again."],
      intro: [null, "A reader checks the introduction while you practise it aloud. You agree on the words the gathering needs to hear before the music."],
      organise: [null, "You break the rehearsal into short sections and agree who enters next. Less of the afternoon disappears in starting over."],
      leave: ["Let the ensemble rehearse", "You step out of the rehearsal space. The performers begin the disputed passage again."],
    },
  },
  "child-route-work-merchant-and-crew": {
    title: "Work ashore or aboard",
    text: "A merchant needs a clerk; a ship's crew needs a sailor. Their work begins at the same quay and goes in different directions. There are smaller tasks if neither place is right for you yet.",
    choices: {
      sailor: [null, "You take a sailor's place with the crew and turn to the work aboard."],
      clerk: [null, "You take the merchant's clerk position and begin checking the regular accounts."],
      cord: [null, "You stay ashore and work through the rope handling with an experienced worker. Your present arrangements remain in place."],
      accounts: [null, "You compare the light delivery with the list. One quantity needs another count before you are satisfied."],
      leave: ["Keep your present arrangements", "You pass on the clerk's place and the berth, and return to your existing work."],
    },
  },
  "child-route-work-copy-explained": {
    title: "More than a clean copy",
    text: "A reader has work for a copyist, but the passage on the table is causing an argument. A separate day list also waits to be checked. You can ask for the regular place or help with one of the unfinished tasks.",
    choices: {
      copyist: [null, "You take a regular place at the copying bench. The reader brings over the first sheets."],
      argument: [null, "You read the disputed words together and ask which reason supports the conclusion. The reader returns to a sentence they had passed over."],
      days: [null, "You check the intervals against the copied observations. A skipped entry accounts for the difference."],
      "read-aloud": [null, "You practise the introduction aloud while the reader follows the words. A pause makes the difficult sentence clearer."],
      leave: ["Leave the reader to the passage", "You set down the copy and go back to your other work. The reader is still considering the difficult sentence."],
    },
  },
  "child-route-work-checked-pattern": {
    title: "A pattern to fit, an order to pack",
    text: "The workshop has regular places for a potter and an apprentice. For now, a repeated wooden pattern needs fitting and a delivery needs packing. Helpers keep reaching across one another for the same materials.",
    choices: {
      potter: [null, "You take regular pottery work at the workshop and begin on the waiting vessels."],
      apprentice: [null, "You take the preparation place as an apprentice. The worker starts you with the materials needed at the bench."],
      pattern: [null, "You fit a spare section of the pattern. The craft worker checks the measurements and shows where a cut needs correcting."],
      order: [null, "You agree on an order for the packing tasks. This time the helpers can reach their materials without crossing each other's paths."],
      leave: ["Pass on the workshop's offers", "You leave the pattern and packing to the workers already there, and keep your present arrangements."],
    },
  },
  "letters-across-the-water": {
    title: "A message carried home",
    text: "A sailor returning home has room for a message. A writer can help you put the news into words, for a price. Otherwise the day is yours to learn the port before work begins again.",
    choices: {
      "write-home": [null, "You send news of the work, the port and the people you have met. The message leaves with the sailor; there is nothing more to add until a reply comes."],
      "learn-port": [null, "You walk the quays and find the shops and landing places you will need. On the return, you no longer stop to ask the way."],
    },
  },
  "the-unfamiliar-page": {
    title: "The words at the torn edge",
    text: "A damaged page reaches the workshop. An experienced copyist moves it into better light and offers to work through it with you. A paid task is also waiting, with no missing words to puzzle over.",
    choices: {
      "work-together": [null, "The copyist shows you how to compare the damaged words. You finish part of the page together and leave the uncertain places marked."],
      "extra-work": [null, "You finish the paid task and put the money aside. The damaged page remains under the copyist's hand."],
    },
  },
  "the-weight-of-years": {
    title: "Forty years",
    text: "You turn forty. A repeated error in a list, a household quarrel, a job that will take longer than promised: some troubles now announce themselves before anyone has explained them.",
  },
  "care-between-generations": {
    title: "A meal that needs bringing",
    text: "An older relative can no longer manage meals and daily tasks alone. The help takes time and money already needed elsewhere. At home, you discuss who can be there and when.",
    choices: {
      "give-time": [null, "You bring meals and help with the day's tasks. Your relative has more company; the extra household costs leave less money at home."],
      "share-care": [null, "The household divides the visits and tasks. You check the arrangements together so that no meal or journey is left to chance."],
    },
  },
  "a-different-kind-of-work": {
    title: "The ache after work",
    text: "The tiredness from carrying and lifting lasts into the next morning. There are lighter tasks that need an experienced eye, though you could still take the familiar heavier work.",
    choices: {
      "work-with-experience": [null, "You take work that needs checking and advice more than lifting. Other hands carry the heavier loads."],
      "keep-pace": [null, "You keep the familiar jobs and their better earnings. When the work is finished, recovery takes longer."],
    },
  },
  "a-trade-to-pass-on": {
    title: "A learner at your elbow",
    text: "A younger worker watches your hands and asks you to slow down. They want to learn the task properly. Your own orders are still waiting to be finished.",
    choices: {
      "teach-patiently": [null, "You break the task into steps and check the learner's first attempts. Your own work takes longer, but they can do more of the next piece themselves."],
      "keep-independent": [null, "You return to your orders and note the troublesome parts for your own use. The learner must look elsewhere for today's lesson."],
    },
  },
  "the-cost-of-rest": {
    title: "Another morning still tired",
    text: "You wake with the previous day's work still in your limbs. More days off would help, but fewer paid hours leave less money at home. You could instead give up only the most demanding tasks.",
    choices: {
      "take-rest": [null, "You leave more days free of paid work. Some energy returns, while the household makes do with smaller earnings."],
      "reduce-a-little": [null, "You turn down the heaviest tasks and keep the lighter paid work. The week's pace becomes a little easier to bear."],
    },
  },
  "stepping-back": {
    title: "A smaller working week",
    text: "Your regular job is harder to manage now. Leaving it would give you rest, but the household would lose its income. Keeping some lighter work is another arrangement to consider.",
    choices: {
      "step-back": [null, "You leave the regular job and give more of the day to rest. At home, you help with the smaller tasks when you can."],
      "continue-light-work": [null, "You keep some regular work and decline the heavier tasks. There is still pay coming in, at a pace you can better manage."],
    },
  },
  "putting-things-in-order": {
    title: "Who should have what",
    text: "A few belongings have already been promised to different people. There are obligations to settle as well. You decide whether to have the arrangements written down or explain them to the household yourself.",
    choices: {
      "write-arrangements": [null, "You pay to have the instructions recorded. The belongings and obligations are named clearly enough for someone else to follow."],
      "speak-with-household": [null, "You gather the household and explain who should receive what. They ask questions, and you settle the uncertain parts aloud."],
    },
  },
  "what-you-will-keep": {
    title: "Letters kept for years",
    text: "You set out the papers and letters you have kept. Some need only sorting; others bring a familiar voice back as someone reads them aloud. A younger person also hopes you will show them a task today.",
    choices: {
      "guide-beginner": [null, "You leave the papers and show the beginner the task. At the first mistake, you move their hand and let them try again."],
      "gather-letters": [null, "You sort the letters with a reader, marking the ones to keep. A few names take longer to put aside than the rest."],
    },
  },
  "the-people-who-return": {
    title: "A visitor pulls up a seat",
    text: "A familiar visitor has an hour to spare and settles beside you. They ask about an old job; you want to know what has been happening outside. Neither subject will fit into a single question.",
    choices: {
      "tell-old-stories": [null, "You tell how the old job went wrong before it went right. The visitor's questions bring back details you had not meant to include."],
      listen: [null, "You ask for the news and let the visitor talk. Work and household troubles fill the hour, with several names you still know."],
    },
  },
  "the-small-pleasures": {
    title: "An afternoon without errands",
    text: "For once, nobody needs an errand from you this afternoon. There is a comfortable place outside, and someone nearby who might welcome an invitation.",
    choices: {
      "sit-in-light": [null, "You rest outside and watch the passers-by until you are tired. Then you go indoors without having hurried anywhere."],
      "welcome-company": [null, "Your visitor accepts a drink and stays. The afternoon passes in talk, with no task waiting at its end."],
    },
  },
  "names-remembered": {
    title: "The house where they lived",
    text: "An old neighbor's name comes up. Someone younger asks where they lived, and you describe the doorway and the turn beside it. For a moment, the absent household has an address again.",
  },
  "a-later-season": {
    title: "More hands to help",
    text: "At ninety, meals, washing and moving through the house take more help. People arrange their day around bringing what you need within reach.",
  },
  "an-extraordinary-age": {
    title: "Ninety-five",
    text: "You turn ninety-five. The household manages most daily tasks for you now, and someone makes time to sit nearby. The conversation often lasts longer than the meal.",
  },
  "a-quiet-room": {
    title: "The open door",
    text: "You spend much of the day resting. Someone brings water, moves it within reach and leaves the door open for air. From the next room, the household's work can still be heard.",
  },
};

export const LIFE_PROSE_EVENT_IDS = Object.freeze(Object.keys(scenes));

export function applyLifeProse(world) {
  for (const [id, scene] of Object.entries(scenes)) {
    const event = world.events.find(item => item.id === id);
    if (!event) throw new Error(`Missing life-prose event ${id}`);
    event.title = scene.title;
    event.text = scene.text;
    for (const [key, [text, result]] of Object.entries(scene.choices ?? {})) {
      const choice = event.choices.find(item => item.id === key || item.id === `${id}-${key}`);
      if (!choice) throw new Error(`Missing life-prose choice ${id}/${key}`);
      if (text !== null) choice.text = text;
      if (choice.outcomes.length !== 1) throw new Error(`Expected one life-prose outcome ${choice.id}`);
      choice.outcomes[0].text = result;
    }
  }
}
