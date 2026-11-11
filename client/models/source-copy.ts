const summaries = new Map<string, string>([
  ["Describes a bakery lease, equipment, rent, repairs and responsibility for taxes, illustrating workshop livelihoods and contractual obligations.", "A bakery lease covering equipment, rent, repairs and responsibility for taxes."],
  ["Records an agreement concerning the partial payment of an inheritance, supporting a narrative theme of property and obligations between generations.", "An agreement for the partial payment of an inheritance."],
  ["Documents a carved wooden ritual figure associated with temple equipment, illustrating skilled Egyptian wood carving.", "A carved wooden ritual figure associated with temple equipment."],
  ["Catalogues a sandstone ceiling relief with zodiacal signs, decans and constellations, providing a contemporary example of Egyptian astral imagery.", "A sandstone ceiling relief showing zodiacal signs, decans and constellations."],
  ["Depicts the philosopher Areius receiving public favour from Octavian and interceding for others, illustrating elite intellectual patronage and political access.", "Plutarch describes Areius receiving Octavian’s favour and interceding for others."],
  ["Introduces a source-based naming database that records personal names alongside attested occupations, dates, family connections and provenance. It supports a varied Greek-language and Egyptian-rendered naming context for fictional characters.", "A database of personal names with recorded occupations, dates, family connections and provenance."],
  ["Augustus claims to have added Egypt to Roman rule. The inscription offers a contemporary imperial voice for the political transition.", "Augustus claims to have added Egypt to Roman rule."],
]);

/** Match reviewed annotations only; custom text and bibliographic fields are untouched. */
export function sourceSummary(text: string): string {
  return summaries.get(text) ?? text;
}

const sharedGameNote = "Characters, accomplishment titles, wages, prices and probabilities in the game are authored fiction.";

/** This note appears once above the list; each source keeps its specific limitations. */
export function sourceScope(text: string): string {
  return text.endsWith(sharedGameNote) ? text.slice(0, -sharedGameNote.length).trimEnd() : text;
}

const modelNotes = new Map<string, string>([
  ...["Exact mortality for the Egyptian coast in this era is unknown.", "Exact mortality for Ptolemaic Alexandria is unknown."].map(limit => [
    `Early life keeps the easier health rules. From age 18, serious illness episodes use the full age-specific baseline from a Roman Egyptian female life-table comparison. Illness appears, Health falls and a care choice interrupts time before the condition can become fatal. Current Health, care and household support can change the outcome; dangerous choices retain their stated risks. ${limit} The later Roman comparison is an estimate for the setting, not a measured rate for this character. Disease selection, severity and care effects are authored game rules.`,
    `Childhood has easier health rules. From age 18, serious illness uses age-specific risks from a Roman Egyptian female comparison model. Illness is recorded and the clock pauses for a care decision before it can become fatal. Health, care and household support affect recovery. ${limit} The diseases, severity and effects of care are game rules. Dangerous choices can still kill you.`,
  ] as const),
  ["Natural deaths name an active illness, injury or physical decline that was recorded before fatal progression. A serious illness can cause a sharp Health decline even in a previously healthy person, followed by a care decision. The adult all-cause baseline comes from the historical comparison; disease labels, severity and treatment response are fictional gameplay, not measured cause-specific rates or retrospective diagnoses. Explicit dangerous choices retain their authored fatal outcomes and record the choice that caused death.", "Deaths from illness, injury or physical decline follow a condition already recorded in your life. Serious illness can quickly lower Health and trigger a care decision, even if you were healthy before. Adult death risks use the historical comparison. Disease labels, severity and treatment results are game rules, not measured cause-specific death rates or retrospective diagnoses. Fatal choices keep their stated risks and appear in the death record."],
]);

export function modelNote(text: string): string {
  return modelNotes.get(text) ?? text;
}
