"use client";
import { useState, type FormEvent } from "react";
import { formatDate } from "@/lib/dates";
import { sortTasks } from "@/lib/plan";
import { RULES, SOURCES } from "@/lib/policy/registry";
import { newId, type AiNote, type TaskState } from "@/lib/schema";
import { AREAS, type Designation } from "@/lib/policy/engine";
import { RESOURCES } from "@/lib/resources";
import { DETAIL_ACTIONS } from "@/lib/tasks/detail-actions";
import { completeTask, reopenTask, startTask, upsert, type MergedTask } from "@/lib/tasks/reconcile";
import { useConfirm } from "./ConfirmDialog";
import { Button, Card, cx, StatusBadge, Tag, TextField } from "./ui";

type Props = {
  tasks: MergedTask[];
  states: TaskState[];
  aiNotes: AiNote[];
  today: string;
  onChange: (states: TaskState[]) => void;
};

const now = () => new Date().toISOString();

export function TypeTag({ type, designation }: { type: MergedTask["type"]; designation?: Designation }) {
  if (type === "custom") return <Tag tone="green">Your task</Tag>;
  const d = designation ?? (type === "requirement" ? "requirement" : type === "suggestion" ? "recommendation" : "needs_confirmation");
  if (d === "requirement") return <Tag tone="cardinal">Verified requirement</Tag>;
  if (d === "recommendation") return null;
  return <Tag tone="blue">Needs confirmation</Tag>;
}

type Extra = {
  highlight: { added: string[]; recheck: string[] };
  onDraft: (task: MergedTask) => void;
  onGotoContacts: () => void;
  /** Opens Edit details at the form field with this label. */
  onEditDetail?: (fieldLabel: string) => void;
};

function TaskCard({
  task,
  all,
  states,
  aiNote,
  onChange,
  highlight,
  onDraft,
  onGotoContacts,
  onEditDetail,
}: { task: MergedTask; all: MergedTask[]; states: TaskState[]; aiNote?: AiNote; onChange: Props["onChange"] } & Extra) {
  const confirm = useConfirm();
  const rule = task.ruleId ? RULES[task.ruleId] : null;
  const source = rule ? SOURCES[rule.sourceId] : null;
  const dep = task.derived?.dependsOn ? all.find((t) => t.id === task.derived!.dependsOn) : null;
  const notes = task.state?.notes ?? "";
  const label = task.title;
  const links = [...(task.derived?.links ?? [])];
  if (source && !links.some((l) => l.url === source.url)) links.push({ label: "Official page", url: source.url });
  const contacts = (task.derived?.resourceIds ?? []).map((id) => RESOURCES[id]).filter(Boolean);
  const setState = (fn: (s: TaskState) => TaskState) => onChange(upsert(states, task.id, now(), (s) => ({ ...fn(s), label })));
  const isNew = highlight.added.includes(task.id);
  const late = task.derived?.lateNote;
  const statusValue = task.state?.status ?? "open";
  const canDraft = contacts.length > 0 || task.id === "sugg:guest-invite";
  const detail = onEditDetail && task.applicable && task.status !== "completed" ? DETAIL_ACTIONS[task.id] : undefined;

  return (
    <li
      className={cx(
        "scroll-mt-24 rounded-xl border bg-card px-4 py-4 sm:px-5",
        task.status === "needs_recheck" ? "border-[1.5px] border-amber" : isNew ? "border-[1.5px] border-green" : "border-line",
        !task.applicable && "opacity-80",
      )}
      id={`task-${task.id}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className={cx("text-[15px] font-semibold leading-snug", task.status === "completed" && "text-muted line-through")}>{task.title}</h3>
        <TypeTag type={task.type} designation={task.derived?.designation} />
        {isNew && <Tag tone="green">New</Tag>}
        {(task.status === "needs_recheck" || task.status === "not_applicable") && <StatusBadge status={task.status} />}
        {task.applicable && task.status !== "needs_recheck" && (
          <div role="group" aria-label={`Status: ${task.title}`} className="flex w-full rounded-lg border border-line-strong bg-white p-0.5 sm:ml-auto sm:w-auto">
            {(
              [
                ["open", "To do", "bg-ink"],
                ["in_progress", "In progress", "bg-blue"],
                ["done", "Done", "bg-green"],
              ] as const
            ).map(([v, text, on]) => (
              <button
                key={v}
                type="button"
                aria-pressed={statusValue === v}
                onClick={() => {
                  if (statusValue === v) return;
                  onChange(v === "done" ? completeTask(states, task, now()) : v === "in_progress" ? startTask(states, task, now()) : reopenTask(states, task, now()));
                }}
                className={cx(
                  "flex-1 rounded-md px-2.5 py-1 text-xs whitespace-nowrap sm:flex-none",
                  statusValue === v ? `${on} font-bold text-white` : "font-medium text-muted hover:text-ink",
                )}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>


      {late && task.status !== "completed" && (
        <p className="mt-2 rounded-md border border-cardinal/30 bg-cardinal-wash p-2 text-sm" role="status">
          {late}
        </p>
      )}

      {task.status === "needs_recheck" && (
        <div className="mt-3 rounded-md border border-amber/40 bg-amber-wash p-3 text-sm" role="status">
          <p className="font-semibold">Completed under different assumptions</p>
          <ul className="mt-1 list-disc pl-5">
            {task.recheckReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onChange(completeTask(states, task, now()))}>
              Still complete — confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(reopenTask(states, task, now()))}>
              Reopen
            </Button>
          </div>
        </div>
      )}

      {(task.targetDate || detail || (canDraft && task.applicable && task.status !== "completed")) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {detail && (
            <button
              type="button"
              onClick={() => onEditDetail!(detail.field)}
              className="rounded-md bg-cardinal px-3 py-1.5 font-semibold text-white hover:bg-cardinal-ink"
            >
              + {detail.label}
            </button>
          )}
          {task.targetDate && (
            <span className={cx("font-semibold text-cardinal", task.overdue && task.status !== "completed" && "underline")}>
              {formatDate(task.targetDate, { weekday: true })}
              {task.overdue && task.status !== "completed" && " · overdue target"}
            </span>
          )}
          {canDraft && task.applicable && task.status !== "completed" && (
            <button type="button" onClick={() => onDraft(task)} className="inline-flex items-center gap-1.5 font-semibold text-cardinal underline hover:no-underline">
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Draft email
            </button>
          )}
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">More</summary>
        <div className="mt-2 space-y-3">
          {!task.targetDate && task.derived?.deadlineNote && <p className="rounded-md bg-blue-wash px-3 py-2 text-sm text-blue">⏱ {task.derived.deadlineNote}</p>}
          {task.detail && <p className="text-sm">{task.detail}</p>}
          <p className="text-xs text-muted">Why it&apos;s here: {task.conditionText}</p>
          {contacts.length > 0 && (
            <div className="text-sm">
              <p className="text-xs font-medium text-muted">Who to contact</p>
              <ul>
                {contacts.map((c) => (
                  <li key={c.id}>
                    {c.name}: {c.email ?? c.phone ?? <span className="italic text-amber">contact needs verification</span>}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={onGotoContacts} className="text-xs text-cardinal underline">
                All contact details →
              </button>
            </div>
          )}
          {links.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-cardinal underline">
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
          {dep && (
            <p className="text-xs text-muted">
              Depends on:{" "}
              <a href={`#task-${dep.id}`} className="underline">
                {dep.title}
              </a>{" "}
              ({dep.status === "completed" ? "done" : "not done yet"})
            </p>
          )}
          {aiNote && (
            <div className="rounded-md border border-dashed border-blue/40 bg-blue-wash/50 p-2 text-sm">
              <Tag tone="blue">AI suggestion — unverified</Tag>
              <p className="mt-1 whitespace-pre-wrap">{aiNote.text}</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <label className="block text-xs text-muted">
              Your target date
              <input
                type="date"
                value={task.state?.targetDate ?? ""}
                onChange={(e) => setState((s) => ({ ...s, targetDate: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="block text-xs text-muted">
              Notes
              <textarea
                rows={2}
                maxLength={2000}
                value={notes}
                onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>
          {task.type === "custom" && (
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete “${task.title}”?`,
                  body: notes.trim() ? "This task and its notes will be removed from the plan when you save." : "This task will be removed from the plan when you save.",
                  confirmLabel: "Delete task",
                  tone: "danger",
                });
                if (ok) onChange(states.filter((s) => s.id !== task.id));
              }}
            >
              Delete task
            </Button>
          )}
        </div>
      </details>
    </li>
  );
}

function AddTask({ states, onChange }: { states: TaskState[]; onChange: Props["onChange"] }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const id = newId("user:");
    onChange(upsert(states, id, now(), (s) => ({ ...s, label: title.trim(), custom: { title: title.trim().slice(0, 200), detail: "" }, targetDate: date || null })));
    setTitle("");
    setDate("");
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <TextField label="New task" className="min-w-[220px] flex-1" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Book a photographer" />
      <TextField label="Organizer target (optional)" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button type="submit" variant="primary" disabled={!title.trim()}>
        Add task
      </Button>
    </form>
  );
}

export function Checklist({ tasks, states, aiNotes, onChange, highlight, onDraft, onGotoContacts, onEditDetail }: Props & Extra) {
  const sorted = sortTasks(tasks);
  const groups = AREAS.map((a) => ({ key: a.id, title: a.title, items: sorted.filter((t) => t.applicable && t.derived?.area === a.id) })).filter((g) => g.items.length > 0);
  const custom = sorted.filter((t) => t.type === "custom");
  const na = sorted.filter((t) => !t.applicable);
  const noteFor = (t: MergedTask) => (t.ruleId ? aiNotes.find((n) => n.ruleId === t.ruleId) : undefined);
  const extra = { highlight, onDraft, onGotoContacts, onEditDetail };

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const open = g.items.filter((t) => t.status !== "completed").length;
        return (
          <section key={g.key} aria-labelledby={`g-${g.key}`}>
            <h2 id={`g-${g.key}`} className="mb-3 flex flex-wrap items-baseline gap-x-2 font-display text-[22px] font-bold">
              <span aria-hidden className="h-4 w-1 self-center rounded-full bg-gold" />
              {g.title} <span className="text-base font-normal text-muted">({open ? `${open} open` : "all done"})</span>
            </h2>
            <ul className="space-y-3">
              {g.items.map((t) => (
                <TaskCard key={t.id} task={t} all={tasks} states={states} aiNote={noteFor(t)} onChange={onChange} {...extra} />
              ))}
            </ul>
          </section>
        );
      })}
      <section aria-labelledby="g-custom">
        <h2 id="g-custom" className="mb-3 flex flex-wrap items-baseline gap-x-2 font-display text-[22px] font-bold">
          <span aria-hidden className="h-4 w-1 self-center rounded-full bg-gold" />
          Your tasks <span className="text-base font-normal text-muted">({custom.length})</span>
        </h2>
        {custom.length > 0 && (
          <ul className="mb-3 space-y-3">
            {custom.map((t) => (
              <TaskCard key={t.id} task={t} all={tasks} states={states} onChange={onChange} {...extra} />
            ))}
          </ul>
        )}
        <Card>
          <AddTask states={states} onChange={onChange} />
        </Card>
      </section>
      {na.length > 0 && (
        <details className="rounded-xl border border-line bg-card p-4">
          <summary className="cursor-pointer font-semibold">Not applicable ({na.length})</summary>
          <ul className="mt-3 space-y-3">
            {na.map((t) => (
              <TaskCard key={t.id} task={t} all={tasks} states={states} onChange={onChange} {...extra} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
