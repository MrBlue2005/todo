import { addDays, addMonths, addWeeks, format, isBefore, isSameDay, parseISO, startOfDay } from "date-fns";
import type { RecurrenceRule, Task } from "@/types";

export const localDate = (date = new Date()) => format(date, "yyyy-MM-dd");
export const friendlyDate = (value: string) => format(parseISO(value), "EEE, d MMM");

export function taskBucket(task: Task, today = new Date()) {
  if (task.status === "completed") return "completed" as const;
  const due = parseISO(task.dueDate);
  if (isBefore(due, startOfDay(today))) return "overdue" as const;
  if (isSameDay(due, today)) return "today" as const;
  return "upcoming" as const;
}

export function nextOccurrence(dueDate: string, rule: RecurrenceRule) {
  const current = parseISO(dueDate);
  const amount = Math.max(1, rule.interval);
  if (rule.frequency === "daily") return localDate(addDays(current, amount));
  if (rule.frequency === "weekly") return localDate(addWeeks(current, amount));
  return localDate(addMonths(current, amount));
}
