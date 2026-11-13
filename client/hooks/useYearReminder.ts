import { useEffect, useRef, useState } from "react";
import type { YearReminder } from "../components/EventNotificationStack.tsx";
import { flashSections } from "../lib/section-flash.ts";
import { YEAR_TASK_TARGETS, yearReminderKey, yearReminderText, yearTasks, type YearTaskFacts } from "../models/year-reminder.ts";

/**
 * Once a year, when the year is running, returns a short notice naming what the player can still do (fields, focus,
 * yearly action) and lights up only the first of them, so one thing is in focus at a time. Each year is announced
 * once per life on this page.
 */
export function useYearReminder(facts: YearTaskFacts, lifeKey: string, enabled: boolean): YearReminder | null {
  const [reminder, setReminder] = useState<YearReminder | null>(null);
  const announced = useRef(new Set<string>());
  const tasks = yearTasks(facts);
  const key = yearReminderKey(lifeKey, facts.age);
  const ready = enabled && tasks.length > 0;

  useEffect(() => {
    if (!ready || announced.current.has(key)) return;
    announced.current.add(key);
    setReminder({ key, title: "Plan this year", body: yearReminderText(tasks) });
    return undefined;
  }, [ready, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // The glow follows the notice; it is not cancelled when the year moves on, so it always fades by itself.
  const flashed = useRef("");
  useEffect(() => {
    if (!reminder || flashed.current === reminder.key) return;
    flashed.current = reminder.key;
    if (tasks[0]) flashSections([YEAR_TASK_TARGETS[tasks[0]]]);
  }, [reminder?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return reminder && reminder.key.startsWith(`year-reminder:${lifeKey}:`) ? reminder : null;
}
