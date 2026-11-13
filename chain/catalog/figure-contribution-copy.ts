/** Readable card labels, applied at display boundaries so saved packs and records keep their fingerprints. */
const corrections: readonly (readonly [string, string])[] = [
  ["Campaign Stores Aide", "Army Supply Assistant"],
  ["Aide in Macedonian Supply Studies", "Macedonian Supply Assistant"],
  ["Inquiry Note Keeper", "Student of the Lyceum"],
  ["Keeper of Aristotelian Inquiry Notes", "Student of the Aristotelian School"],
  ["Diagram Aide", "Geometry Assistant"],
  ["Aide in Geometrical Diagram Studies", "Assistant in Euclidean Geometry"],
  ["Bronze Workshop Aide", "Workshop Assistant"],
  ["Aide in Lysippan Workshop Practice", "Lysippan Materials Assistant"],
  ["Rehearsal Aide", "Rehearsal Assistant"],
  ["Aide in New Comedy Rehearsal", "New Comedy Rehearsal Assistant"],
];

export function figureContributionTitleCopy(text: string): string {
  let result = text;
  for (const [before, after] of corrections) result = result.replaceAll(before, after);
  return result;
}

export function figureContributionStageCopy<T extends { rank: string; title: string; traditionTitle: string }>(stage: T): T {
  if (stage.rank !== "Common") return stage;
  const title = figureContributionTitleCopy(stage.title), traditionTitle = figureContributionTitleCopy(stage.traditionTitle);
  return title === stage.title && traditionTitle === stage.traditionTitle ? stage : { ...stage, title, traditionTitle };
}
