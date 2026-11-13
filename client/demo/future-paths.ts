/**
 * What each locked future path will ask of a life: work done, skills learned and resources saved, shown as
 * short requirement chips instead of a description. Presentation only: the paths are not playable in this demo,
 * and these values never enter the simulation or the world's fingerprint.
 */

export interface PathRequirement {
  icon: string;
  text: string;
}

export const FUTURE_PATH_REQUIREMENTS: Readonly<Record<string, readonly PathRequirement[]>> = {
  generalship: [
    { icon: "military", text: "Soldier · 10 years" },
    { icon: "military", text: "Formation discipline" },
    { icon: "res-reputation", text: "Reputation 60" },
  ],
  kingship: [
    { icon: "res-reputation", text: "Reputation 90" },
    { icon: "coin", text: "Wealth 5,000 dr" },
    { icon: "oratory", text: "Coalition building" },
  ],
  "civil-war": [
    { icon: "military", text: "Officer or general" },
    { icon: "reckoning", text: "Field supply accounts" },
    { icon: "hourglass", text: "Age 25+" },
  ],
  "raising-children": [
    { icon: "people", text: "Married, a child aged 6+" },
    { icon: "res-grain", text: "Grain for one more mouth" },
  ],
  house: [
    { icon: "coin", text: "500 dr saved" },
    { icon: "res-labour", text: "Labour 200" },
    { icon: "craft", text: "Measuring and cutting" },
  ],
  crafts: [
    { icon: "pottery", text: "Apprentice · 3 years" },
    { icon: "craft", text: "Controlled making" },
  ],
  scholarship: [
    { icon: "book", text: "Knowledge 60" },
    { icon: "astrology", text: "Systematic observation" },
    { icon: "literacy", text: "Study focus · 5 years" },
  ],
  sea: [
    { icon: "ship", text: "Sailor or porter · 3 years" },
    { icon: "coin", text: "1,000 dr" },
    { icon: "commerce", text: "Delivery logistics" },
  ],
};

/** The chips for a path; a path without a list falls back to its authored prerequisite line, if any. */
export function pathRequirements(path: { id: string; prerequisites?: string }): readonly PathRequirement[] {
  return FUTURE_PATH_REQUIREMENTS[path.id] ?? (path.prerequisites ? [{ icon: "check", text: path.prerequisites }] : []);
}
