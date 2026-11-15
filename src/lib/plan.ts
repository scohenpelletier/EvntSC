import { computeBudget, type BudgetSummary } from "./budget";
import { checkSchedule, type ScheduleCheck } from "./dates";
import { evaluate, type Evaluation } from "./policy/engine";
import type { PlanDoc } from "./schema";
import { mergeTasks, type MergedTask } from "./tasks/reconcile";

export type ComputedPlan = {
  budget: BudgetSummary;
  schedule: ScheduleCheck;
  evaluation: Evaluation;
  tasks: MergedTask[];
  unknownDetails: string[];
};

/** Single deterministic pipeline used by the workspace, the server, and the packet. */
export function computePlan(doc: PlanDoc, today: string): ComputedPlan {
  const budget = computeBudget(doc.intake, doc.budget);
  const schedule = checkSchedule(doc.intake);
  const evaluation = evaluate(doc.intake, budget, today);
  const tasks = mergeTasks(evaluation.tasks, doc.tasks, today);
  const i = doc.intake;
  const unknownDetails: string[] = [];
  if (!i.date) unknownDetails.push("Event date");
  else if (!i.dateConfirmed) unknownDetails.push("Event date (unconfirmed)");
  if (!i.startTime || !i.endTime) unknownDetails.push("Start/end time");
  if (i.attendance === null) unknownDetails.push("Expected attendance");
  if (!i.venueName.trim()) unknownDetails.push("Venue name");
  if (i.venueStatus === "unknown") unknownDetails.push("Venue status");
  if (i.venueType === "unknown") unknownDetails.push("Venue type");
  if (i.recognition === "unknown") unknownDetails.push("Recognition status");
  if (i.food === "unknown") unknownDetails.push("Food");
  if (i.outsideSpeakers === "unknown") unknownDetails.push("Outside speakers or guests");
  else if (i.outsideSpeakers === "yes" && i.guestCount === null) unknownDetails.push("Number of outside guests");
  if (i.accessibility === "unknown") unknownDetails.push("Accessibility needs");
  if (i.vendors === "unknown") unknownDetails.push("Vendors");
  if (i.fundraising === "unknown") unknownDetails.push("Fundraising");
  if (!budget.target.entered) unknownDetails.push("Budget target");
  return { budget, schedule, evaluation, tasks, unknownDetails };
}

export const TASK_ORDER: Record<string, number> = {
  needs_recheck: 0,
  missing_info: 1,
  needs_confirmation: 2,
  in_progress: 3,
  todo: 4,
  completed: 5,
  not_applicable: 6,
};

export function sortTasks(tasks: MergedTask[]): MergedTask[] {
  return [...tasks].sort((a, b) => {
    const s = TASK_ORDER[a.status] - TASK_ORDER[b.status];
    if (s) return s;
    if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return 0;
  });
}

/**
 * The few things to do next, most urgent first: tasks to recheck, tasks whose
 * lead time has passed, missing basics, then the earliest dated work.
 */
export function nextActions(tasks: MergedTask[], limit = 3): MergedTask[] {
  const open = tasks.filter((t) => t.applicable && t.status !== "completed" && t.status !== "not_applicable");
  const rank = (t: MergedTask) =>
    t.status === "needs_recheck" ? 0 : t.derived?.lateNote || t.overdue ? 1 : t.derived?.area === "details" ? 2 : t.status === "in_progress" ? 3 : t.targetDate ? 4 : t.type === "requirement" ? 5 : 6;
  return [...open]
    .sort((a, b) => rank(a) - rank(b) || (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"))
    .slice(0, limit);
}
