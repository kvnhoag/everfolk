/** Full adult comparison hazards feed warned health episodes, never an unrelated death roll. */
export function applyAdultMortality(world) {
  world.version = "0.20.0";
  world.health.mortalityCalibration = {
    minAge: 18, referenceHealth: 50, referenceCare: 0.55, caseFatality: 0.8,
    onsetHealth: 20, convalescenceLoss: 4, healthInfluence: 0.5, careInfluence: 0.5,
  };
  world.health.sourceIds = [...new Set([...world.health.sourceIds, ...world.mortality.sourceIds])];
  world.health.description = "Early life keeps the easier health rules. From age 18, serious illness episodes use the full age-specific baseline from a Roman Egyptian female life-table comparison. Illness appears, Health falls and a care choice interrupts time before the condition can become fatal. Current Health, care and household support can change the outcome; dangerous choices retain their stated risks. Exact mortality for Ptolemaic Alexandria is unknown. The later Roman comparison is an estimate for the setting, not a measured rate for this character. Disease selection, severity and care effects are authored game rules.";
  world.mortality.description = "The adult baseline uses 100% of the annual probabilities converted from Zakrzewski (2015), Table 1, after Bagnall and Frier's Roman Egyptian female model. The former discounts at ages 18-94 are removed. Only the comparison bands below 18 retain early-play discounts; childhood still uses the existing causal-health system. In health-enabled lives these adult probabilities calibrate warned serious illness episodes, with a neutral reference of Health 50, household rest/care 0.55 and no family recovery bonus. They are not a second independent death roll. Actual play varies with Health, care, existing conditions and risky choices. This is a later-period female proxy, not observed Ptolemaic Alexandrian mortality. The 95+ tail and within-band annual interpolation remain assumptions; age 100 closes the record without assigning death.";
  world.character.deathCauseDescription = "Natural deaths name an active illness, injury or physical decline that was recorded before fatal progression. A serious illness can cause a sharp Health decline even in a previously healthy person, followed by a care decision. The adult all-cause baseline comes from the historical comparison; disease labels, severity and treatment response are fictional gameplay, not measured cause-specific rates or retrospective diagnoses. Explicit dangerous choices retain their authored fatal outcomes and record the choice that caused death.";
  return world;
}
