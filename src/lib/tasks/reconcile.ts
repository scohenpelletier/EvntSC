import { DEP_LABELS, type BaseStatus, type DerivedTask, type TaskType } from "../policy/engine";
import type { TaskState } from "../schema";

/**
 * Merges freshly derived tasks with the organizer's saved task state.
 *
 * - Derived tasks are keyed by stable IDs, so recomputation never wipes notes,
 *   organizer target dates, or progress.
 * - A completed task stores a snapshot of its dependencies. If any of them
 *   change, the task shows "Needs recheck" with the specific change, until the
 *   organizer re-confirms it or the value changes back.
 * - Saved state for a task that no longer applies is kept and shown as
 *   "Not applicable now", never silently deleted.
 */

export type DisplayStatus =
  | "completed"
  | "in_progress"
  | "needs_recheck"
  | "needs_confirmation"
  | "missing_info"
  | "todo"
  | "not_applicable";

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  completed: "Completed",
  in_progress: "In progress",
  needs_recheck: "Needs recheck",
  needs_confirmation: "Needs confirmation",
  missing_info: "Missing information",
  todo: "To do",
  not_applicable: "Not applicable now",
};

export type MergedTask = {
  id: string;
  type: TaskType | "custom";
  title: string;
  detail: string;
  conditionText: string;
  baseStatus: BaseStatus;
  status: DisplayStatus;
  recheckReasons: string[];
  ruleId: string | null;
  derived: DerivedTask | null;
  state: TaskState | null;
  /** Effective target: organizer target wins over derived ones. */
  targetDate: string | null;
  targetLabel: "Organizer target" | "Official date (calculated from cited rule)" | "Suggested (not a USC deadline)" | null;
  targetExplanation: string | null;
  overdue: boolean;
  applicable: boolean;
};

export function emptyState(id: string, now: string): TaskState {
  return { id, label: "", status: "open", doneSnapshot: null, notes: "", targetDate: null, custom: null, updatedAt: now };
}

function describeChange(key: string, before: string, after: string): string {
  const label = DEP_LABELS[key] ?? key;
  const show = (v: string) => (v === "" ? "not set" : v.replace(/_/g, " "));
  return `${label} changed from ${show(before)} to ${show(after)}`;
}

export function recheckReasons(derived: DerivedTask, state: TaskState): string[] {
  if (state.status !== "done" || !state.doneSnapshot) return [];
  const reasons: string[] = [];
  // Compare what the snapshot recorded. A dependency added to a task after it was completed
  // (an app upgrade) isn't in older snapshots and must not, by itself, flag a recheck.
  for (const k of Object.keys(state.doneSnapshot)) {
    const before = state.doneSnapshot[k] ?? "";
    const after = derived.depValues[k] ?? "";
    if (before !== after) reasons.push(describeChange(k, before, after));
  }
  return reasons;
}

export function mergeTasks(derived: DerivedTask[], states: TaskState[], today: string): MergedTask[] {
  const byId = new Map(states.map((s) => [s.id, s]));
  const out: MergedTask[] = [];

  for (const d of derived) {
    const st = byId.get(d.id) ?? null;
    const reasons = st ? recheckReasons(d, st) : [];
    let status: DisplayStatus = d.baseStatus;
    if (st?.status === "done") status = reasons.length ? "needs_recheck" : "completed";
    else if (st?.status === "in_progress") status = "in_progress";
    const targetDate = st?.targetDate ?? d.target?.date ?? null;
    const targetLabel = st?.targetDate
      ? "Organizer target"
      : d.target?.kind === "official_computed"
        ? "Official date (calculated from cited rule)"
        : d.target
          ? "Suggested (not a USC deadline)"
          : null;
    out.push({
      id: d.id,
      type: d.type,
      title: d.title,
      detail: d.detail,
      conditionText: d.conditionText,
      baseStatus: d.baseStatus,
      status,
      recheckReasons: reasons,
      ruleId: d.ruleId,
      derived: d,
      state: st,
      targetDate,
      targetLabel,
      targetExplanation: st?.targetDate ? "Selected by the organizer." : (d.target?.explanation ?? null),
      overdue: !!targetDate && targetDate < today && status !== "completed",
      applicable: true,
    });
  }

  const derivedIds = new Set(derived.map((d) => d.id));
  for (const st of states) {
    if (derivedIds.has(st.id)) continue;
    if (st.custom) {
      out.push({
        id: st.id,
        type: "custom",
        title: st.custom.title,
        detail: st.custom.detail,
        conditionText: "Added by the organizer.",
        baseStatus: "todo",
        status: st.status === "done" ? "completed" : st.status === "in_progress" ? "in_progress" : "todo",
        recheckReasons: [],
        ruleId: null,
        derived: null,
        state: st,
        targetDate: st.targetDate,
        targetLabel: st.targetDate ? "Organizer target" : null,
        targetExplanation: st.targetDate ? "Selected by the organizer." : null,
        overdue: !!st.targetDate && st.targetDate < today && st.status !== "done",
        applicable: true,
      });
      continue;
    }
    // Saved state for a derived task that no longer applies: keep it visible.
    if (st.status !== "open" || st.notes.trim() || st.targetDate) {
      out.push({
        id: st.id,
        type: st.id.startsWith("rule:") ? "requirement" : st.id.startsWith("sugg:") ? "suggestion" : "question",
        title: st.label || humanizeId(st.id),
        detail: st.status === "done" ? "Completed under earlier assumptions; no longer applies to the current plan." : "No longer applies to the current plan. Your notes are kept.",
        conditionText: "Its condition is no longer met.",
        baseStatus: "todo",
        status: "not_applicable",
        recheckReasons: [],
        ruleId: st.id.startsWith("rule:") ? st.id.slice(5) : null,
        derived: null,
        state: st,
        targetDate: st.targetDate,
        targetLabel: st.targetDate ? "Organizer target" : null,
        targetExplanation: null,
        overdue: false,
        applicable: false,
      });
    }
  }
  return out;
}

function humanizeId(id: string): string {
  return id.replace(/^(rule|sugg|q):/, "").replace(/[-:]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Mark a task complete, snapshotting the assumptions it was completed under. */
export function completeTask(states: TaskState[], task: MergedTask, now: string): TaskState[] {
  const snap = task.derived ? { ...task.derived.depValues } : null;
  return upsert(states, task.id, now, (s) => ({ ...s, label: task.title, status: "done", doneSnapshot: snap }));
}

export function startTask(states: TaskState[], task: MergedTask, now: string): TaskState[] {
  return upsert(states, task.id, now, (s) => ({ ...s, label: task.title, status: "in_progress", doneSnapshot: null }));
}

export function reopenTask(states: TaskState[], task: MergedTask, now: string): TaskState[] {
  return upsert(states, task.id, now, (s) => ({ ...s, label: task.title, status: "open", doneSnapshot: null }));
}

export function upsert(states: TaskState[], id: string, now: string, fn: (s: TaskState) => TaskState): TaskState[] {
  const idx = states.findIndex((s) => s.id === id);
  const base = idx >= 0 ? states[idx] : emptyState(id, now);
  const next = { ...fn(base), updatedAt: now };
  if (idx >= 0) return states.map((s, i) => (i === idx ? next : s));
  return [...states, next];
}

export type ChangeSummary = { added: string[]; removed: string[]; recheck: string[]; moved: string[] };

/** Diff two merged lists so the UI can show exactly what an edit changed (task IDs). */
export function diffTasks(before: MergedTask[], after: MergedTask[]): ChangeSummary {
  const b = new Map(before.map((t) => [t.id, t]));
  const a = new Map(after.map((t) => [t.id, t]));
  const added: string[] = [];
  const removed: string[] = [];
  const recheck: string[] = [];
  const moved: string[] = [];
  for (const [id, t] of a) {
    const prev = b.get(id);
    if (t.applicable && (!prev || !prev.applicable)) added.push(id);
    if (prev && t.status === "needs_recheck" && prev.status !== "needs_recheck") recheck.push(id);
    if (prev && prev.applicable && t.applicable && prev.targetDate !== t.targetDate && t.targetDate) moved.push(id);
  }
  for (const [id, t] of b) {
    const next = a.get(id);
    if (t.applicable && (!next || !next.applicable)) removed.push(id);
  }
  return { added, removed, recheck, moved };
}

export function mergeChanges(x: ChangeSummary, y: ChangeSummary): ChangeSummary {
  const u = (p: string[], q: string[]) => [...new Set([...p, ...q])];
  return { added: u(x.added, y.added), removed: u(x.removed, y.removed), recheck: u(x.recheck, y.recheck), moved: u(x.moved, y.moved) };
}
