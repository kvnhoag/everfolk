/** Readable card labels, applied at display boundaries so saved packs and records keep their fingerprints. */
const corrections: readonly (readonly [string, string])[] = [
  ["Camp Runner", "Campaign Soldier"],
  ["Campaign Stores Aide", "Campaign Soldier"],
  ["Army Supply Assistant", "Campaign Soldier"],
  ["Aide in Macedonian Supply Studies", "Soldier in Macedonian Campaign Service"],
  ["Campaign Provisioner", "Campaign Squad Leader"],
  ["Reader of Macedonian Supply Records", "Leader of a Macedonian Squad"],
  ["Expedition Provisioner", "Navigation Assistant"],
  ["Inquiry Note Keeper", "Lyceum Student"],
  ["Student of the Lyceum", "Lyceum Student"],
  ["Keeper of Aristotelian Inquiry Notes", "Student of the Aristotelian School"],
  ["Diagram Aide", "Geometry Assistant"],
  ["Aide in Geometrical Diagram Studies", "Assistant in Euclidean Geometry"],
  ["Bronze Workshop Aide", "Workshop Assistant"],
  ["Aide in Lysippan Workshop Practice", "Lysippan Materials Assistant"],
  ["Rehearsal Aide", "Rehearsal Assistant"],
  ["Aide in New Comedy Rehearsal", "New Comedy Rehearsal Assistant"],
  ["Palace Messenger", "Junior Court Official"],
  ["Court Records Apprentice", "Junior Court Official"],
];

export function figureContributionTitleCopy(text: string): string {
  let result = text;
  for (const [before, after] of corrections) result = result.replaceAll(before, after);
  return result;
}

export function figureContributionStageCopy<T extends { rank: string; title: string; traditionTitle: string }>(stage: T): T {
  const commonCourtOfficial = stage.rank === "Common" && stage.title === "Egyptian Administration Clerk";
  const title = commonCourtOfficial ? "Junior Court Official" : figureContributionTitleCopy(stage.title);
  const traditionTitle = commonCourtOfficial && stage.traditionTitle === "Reader of Early Ptolemaic Accounts"
    ? "Junior Official in Ptolemaic Administration" : figureContributionTitleCopy(stage.traditionTitle);
  return title === stage.title && traditionTitle === stage.traditionTitle ? stage : { ...stage, title, traditionTitle };
}
