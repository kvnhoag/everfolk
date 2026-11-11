/** Reviewed wording changes for display only. Saved worlds and journals stay intact. */
const substitutions: readonly (readonly [string, string])[] = [
  ["You practise knots, loads and the movements expected aboard a ship. Repetition teaches more than watching from the quay.", "You practise tying knots and handling cargo aboard a ship."],
  ["Appointment depends on rare patronage, not just qualifications.", "Appointments require a patron and are rarely offered."],
  ["agree that this should become a friendship, rather than another conversation snatched between bundles.", "agree to become friends."],
  ["This time you choose to meet, rather than leave it to the reader's queue.", "You arrange a time to meet."],
  ["You settle a time that belongs to you both, rather than to the oven.", "You settle on a time to meet."],
  ["stops by the doorway with news rather than something to return. You sit for a while and discover how much was left out of your earlier conversations.", "stops by your doorway to share some news. You sit and talk about things that never came up on earlier visits."],
  ["The passage reaches Athens late, and the promised introduction does not materialize.", "Your boat reaches Athens late, and no one arranges the promised introduction."],
  ["You have made the journey, but have not heard Aristotle himself.", "You do not get to hear Aristotle."],
  ["The officer keeps your name with the supply account; the work becomes part of the preparations around the new city.", "The officer records your name in the supply account."],
  ["You leave with a correction to work through, rather than an accepted demonstration. The fee and the failed attempt have still bought a clearer question.", "Your demonstration is rejected. You pay the fee and leave with a correction to work through."],
  ["A small kindness becomes part of the trust people place in you.", "You help them."],
  ["A small opportunity becomes a beginning for another person.", "You give them a chance to learn the work."],
  ["Your days become more crowded, and your presence matters to someone who needs it.", "You spend more time caring for them."],
  ["News becomes conversation, and conversation becomes the sort of ordinary memory that belongs to a place.", "You stay and exchange news."],
  ["One ordinary memory becomes new to someone else.", "You tell them a story."],
  ["For a while, you are simply together, each with something to give.", "You spend some time together."],
  ["Your life comes to an end after many seasons. What remains is scattered among people, work, stories and small acts that once seemed ordinary. The harbor goes on, and you become part of its past.", "You die in later life."],
];

const longestFirst = [...substitutions].sort(([a], [b]) => b.length - a.length);

export function displayProse(text: string): string {
  let result = text;
  for (const [before, after] of longestFirst) result = result.replaceAll(before, after);
  return result;
}
