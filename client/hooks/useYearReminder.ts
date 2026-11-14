import { useEffect, useRef, useState } from "react";
import type { YearReminder } from "../components/EventNotificationStack.tsx";
import { flashSections } from "../lib/section-flash.ts";
import { stillOngoing, yearGuideFacts, type GuideInput } from "../models/year-guide.ts";
import { YEAR_TASK_TARGETS, yearReminderKey, yearReminderLine, yearTask, type YearTask } from "../models/year-reminder.ts";
import { guidePointers } from "../state/guide-pointers.ts";

export interface YearReminderOptions {
  /** The life and what it shows; `pointed` and `ongoing` are filled in here. */
  guide: Omit<GuideInput, "pointed" | "ongoing">;
  lifeKey: string;
  /** The game screen is in view with nothing over it. */
  enabled: boolean;
  /** Remember pointed steps in this browser (not for preview lives). */
  persistent: boolean;
}

/**
 * Once a year, when the year runs, names the one new thing the player can do (the next step not tried yet, or a
 * problem a click fixes) and lights up exactly that section with the same words. A step is pointed at once per life
 * and a problem once while it lasts, so nothing is named year after year.
 */
export function useYearReminder({ guide, lifeKey, enabled, persistent }: YearReminderOptions): YearReminder | null {
  const [reminder, setReminder] = useState<YearReminder | null>(null);
  const announced = useRef(new Set<string>());
  // Problems already named; a solved one drops out, so it may be named again if it comes back.
  const ongoing = useRef<readonly YearTask[]>([]);
  ongoing.current = stillOngoing(ongoing.current, { overfull: guide.overfull ?? false, planProblem: guide.planProblem ?? false });
  const pick = yearTask(yearGuideFacts({ ...guide, pointed: guidePointers.read(lifeKey, persistent), ongoing: ongoing.current }));
  const key = yearReminderKey(lifeKey, guide.life.age);
  const ready = enabled && pick !== null;

  useEffect(() => {
    if (!ready || !pick || announced.current.has(key)) return;
    announced.current.add(key);
    // Any notice about a step is its one pointer: a market named for an overfull store is not named again to learn it.
    guidePointers.add(lifeKey, pick.task, persistent);
    if (pick.reason === "problem") ongoing.current = [...ongoing.current, pick.task];
    const line = yearReminderLine(pick);
    setReminder({ key, title: "Plan this year", body: line.body });
    // The glow is not cancelled when the year moves on, so it always fades by itself.
    flashSections([{ selectors: YEAR_TASK_TARGETS[pick.task], label: line.label }]);
  }, [ready, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return reminder && reminder.key.startsWith(`year-reminder:${lifeKey}:`) ? reminder : null;
}
