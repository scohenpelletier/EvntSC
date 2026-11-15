"use client";
import { useState, type FormEvent } from "react";
import { formatDate, formatTime, monthDay, zoneAbbrev } from "@/lib/dates";
import { nextActions, type ComputedPlan } from "@/lib/plan";
import { LABELS, newId, type Assumption, type Intake, type OpenQuestion, type PlanDoc } from "@/lib/schema";
import { TypeTag } from "./Checklist";
import { formatCents } from "@/lib/money";
import { Button, Card, cx, DateChip, Tag } from "./ui";
import { ChangeEntryView, UpdateEvent } from "./UpdateEvent";

export function EventSummary({ intake, plan }: { intake: Intake; plan: ComputedPlan }) {
  const tri = (v: "yes" | "no" | "unknown") => (v === "unknown" ? null : LABELS.tri[v]);
  const rows: [string, React.ReactNode | null][] = [
    ["Type", <>{LABELS.eventType[intake.eventType]}{intake.purpose ? ` · ${intake.purpose}` : ""}</>],
    ["Organizer", intake.organizerName ? `${intake.organizerName}${intake.organization ? ` · ${intake.organization}` : ""}` : intake.organization || null],
    [
      "Date",
      intake.date ? (
        <>
          {formatDate(intake.date, { weekday: true })} {!intake.dateConfirmed && <Tag tone="amber">Unconfirmed</Tag>}
        </>
      ) : intake.dateText ? (
        `“${intake.dateText}”`
      ) : null,
    ],
    ["Time", intake.startTime && intake.endTime ? `${formatTime(intake.startTime)} – ${formatTime(intake.endTime)} ${zoneAbbrev(plan.schedule.start)}` : null],
    ["Attendance", intake.attendance !== null ? `${intake.attendance}${intake.outsideSpeakers === "yes" && intake.guestCount !== null ? ` + ${intake.guestCount} guests` : ""}` : null],
    ["Venue", intake.venueName || intake.venueType !== "unknown" ? `${intake.venueName || LABELS.venueType[intake.venueType]} · ${LABELS.venueStatus[intake.venueStatus].toLowerCase()}` : null],
    ["Food", tri(intake.food)],
    [
      "Inspired by",
      intake.inspiredBy ? (
        <a href={`/events/${intake.inspiredBy.listingId}`} className="underline">
          “{intake.inspiredBy.title}”{intake.inspiredBy.organizer ? ` by ${intake.inspiredBy.organizer}` : ""}
        </a>
      ) : null,
    ],
    ["Accessibility", intake.accessibility === "yes" ? intake.accessibilityNotes || "Needs noted" : null],
  ];
  const shown = rows.filter(([, v]) => v !== null && v !== "");
  return (
    <dl className="divide-y divide-line text-sm sm:text-[15px]">
      {shown.map(([k, v]) => (
        <div key={k} className="grid gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[140px_1fr]">
          <dt className="text-muted">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function QuestionsPanel({ questions, onChange }: { questions: OpenQuestion[]; onChange: (q: OpenQuestion[]) => void }) {
  const [text, setText] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onChange([...questions, { id: newId("q"), text: text.trim().slice(0, 500), resolved: false, answer: "" }]);
    setText("");
  };
  const update = (id: string, patch: Partial<OpenQuestion>) => onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  return (
    <div>
      
      <ul className="space-y-2">
        {questions.map((q) => (
          <li key={q.id} className="rounded-lg bg-paper p-3">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={q.resolved}
                onChange={(e) => update(q.id, { resolved: e.target.checked })}
                aria-label={`Mark answered: ${q.text}`}
              />
              <p className={cx("flex-1 text-sm", q.resolved && "text-muted line-through")}>
                {q.text.startsWith("AI suggestion:") ? (
                  <>
                    <Tag tone="blue">AI</Tag> {q.text.replace(/^AI suggestion:\s*/, "")}
                  </>
                ) : (
                  q.text
                )}
              </p>
              <Button size="sm" variant="ghost" onClick={() => onChange(questions.filter((x) => x.id !== q.id))} aria-label={`Delete question: ${q.text}`}>
                ✕
              </Button>
            </div>
            {q.resolved && (
              <input
                aria-label="Answer"
                placeholder="Answer / what you learned"
                value={q.answer}
                maxLength={1000}
                onChange={(e) => update(q.id, { answer: e.target.value })}
                className="mt-2 w-full rounded-md border border-line-strong bg-white px-2 py-1 text-sm"
              />
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="new-q">
          New question
        </label>
        <input
          id="new-q"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="New question"
          className="min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={!text.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

export function Overview({
  doc,
  plan,
  today,
  aiEnabled,
  showChangeLog,
  onQuestions,
  onAssumptions,
  onUpdate,
  onGoto,
  onGotoTask,
}: {
  doc: PlanDoc;
  plan: ComputedPlan;
  today: string;
  aiEnabled: boolean;
  /** False while the change banner is on screen, so the same change isn't shown twice. */
  showChangeLog: boolean;
  onQuestions: (q: OpenQuestion[]) => void;
  onAssumptions: (a: Assumption[]) => void;
  onUpdate: (patch: Partial<Intake>, request: string, aiExplanation: string | null) => void;
  onGoto: (tab: "budget" | "checklist" | "contacts" | "drafts") => void;
  onGotoTask: (taskId: string) => void;
}) {
  const intake = doc.intake;
  const next = nextActions(plan.tasks, 3);
  const active = plan.tasks.filter((t) => t.applicable);
  const upcoming = active
    .filter((t) => t.targetDate && t.status !== "completed")
    .sort((a, b) => a.targetDate!.localeCompare(b.targetDate!))
    .slice(0, 4);
  const done = active.filter((t) => t.status === "completed").length;
  const [latest, ...older] = doc.changeLog;
  const b = plan.budget;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card
          className="border-[1.5px] border-gold"
          title="Do this next"
          action={
            <Button size="sm" variant="ghost" className="font-semibold text-cardinal" onClick={() => onGoto("checklist")}>
              Checklist ({done}/{active.length}) →
            </Button>
          }
        >
          {next.length ? (
            <ol className="divide-y divide-line">
              {next.map((t, i) => (
                <li key={t.id} className="flex items-start gap-3.5 py-3 first:pt-0 last:pb-0">
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold font-display text-base font-bold text-cardinal-deep">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <button type="button" onClick={() => onGotoTask(t.id)} className="text-left font-semibold hover:underline">
                      {t.title}
                    </button>{" "}
                    <TypeTag type={t.type} designation={t.derived?.designation} />
                    {t.targetDate && <span className={cx("ml-1 text-sm font-semibold text-cardinal", t.overdue && "underline")}>{formatDate(t.targetDate)}</span>}
                    {t.status === "needs_recheck" ? (
                      <p className="text-sm text-amber">{t.recheckReasons.join("; ")}</p>
                    ) : t.derived?.lateNote ? (
                      <p className="text-sm text-cardinal">{t.derived.lateNote}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Everything on the checklist is done.</p>
          )}
        </Card>

        <Card title="Update the event">
          <UpdateEvent doc={doc} today={today} aiEnabled={aiEnabled} onApply={onUpdate} />
        </Card>

        {latest && showChangeLog && (
          <Card title="What changed">
            <ChangeEntryView entry={latest} />
            {older.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-muted">Earlier changes ({older.length})</summary>
                <div className="mt-2 space-y-2">
                  {older.map((e) => (
                    <ChangeEntryView key={e.id} entry={e} />
                  ))}
                </div>
              </details>
            )}
          </Card>
        )}

        <Card title="Event details">
          <EventSummary intake={intake} plan={plan} />
          {plan.unknownDetails.length > 0 && (
            <p className="mt-4 rounded-lg bg-amber-wash px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-amber">Still unknown:</span> {plan.unknownDetails.join(", ")}
            </p>
          )}
          {doc.assumptions.length > 0 && (
            <div className="mt-3 text-sm">
              <p className="font-semibold">Assumptions to confirm</p>
              <ul className="mt-1 space-y-0.5">
                {doc.assumptions.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2">
                    <span>
                      {a.text} {a.source === "demo" ? <Tag tone="amber">Demo</Tag> : a.source === "ai" ? <Tag tone="blue">AI</Tag> : null}
                    </span>
                    <button type="button" className="text-muted hover:text-ink" onClick={() => onAssumptions(doc.assumptions.filter((x) => x.id !== a.id))} aria-label={`Remove assumption: ${a.text}`}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.schedule.errors.map((e) => (
            <p key={e} className="mt-2 text-sm font-medium text-cardinal" role="alert">
              {e}
            </p>
          ))}
        </Card>
      </div>

      <div className="space-y-6">
        <section aria-labelledby="ov-budget" className="overflow-hidden rounded-xl border border-line">
          <div className="on-cardinal bg-cardinal px-5 py-4 text-white">
            <div className="flex items-center justify-between">
              <h2 id="ov-budget" className="text-xs font-bold uppercase tracking-[0.14em] text-gold">
                Budget
              </h2>
              <button type="button" onClick={() => onGoto("budget")} className="text-sm font-semibold text-white hover:underline">
                Edit →
              </button>
            </div>
            {b.remainingCents !== null ? (
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-4xl tabular-nums">{formatCents(Math.abs(b.remainingCents))}</span>
                <span className="text-sm font-semibold text-gold">{b.remainingCents < 0 ? "over budget" : b.unknownCount > 0 ? "left so far" : "left"}</span>
              </p>
            ) : (
              <p className="mt-1 font-display text-2xl">No budget target yet</p>
            )}
          </div>
          <div className="bg-card px-5 py-4">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Budget</dt>
                <dd className="font-semibold tabular-nums">{b.target.cents !== null ? formatCents(b.target.cents) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Known costs</dt>
                <dd className="font-semibold tabular-nums">{formatCents(b.knownSubtotalCents)}</dd>
              </div>
              {b.remainingCents !== null && (
                <div className="flex justify-between font-semibold">
                  <dt className={cx(b.remainingCents < 0 && "text-cardinal")}>{b.remainingCents < 0 ? "Over budget" : "Left"}</dt>
                  <dd className={cx("tabular-nums", b.remainingCents < 0 && "text-cardinal")}>{formatCents(Math.abs(b.remainingCents))}</dd>
                </div>
              )}
            </dl>
            {b.unknownCount > 0 && (
              <p className="mt-3 rounded-lg bg-amber-wash px-3 py-2 text-sm font-medium text-amber">
                {b.unknownCount} cost{b.unknownCount === 1 ? "" : "s"} still unknown
              </p>
            )}
          </div>
        </section>
        <Card title="Open questions">
          <QuestionsPanel questions={doc.questions} onChange={onQuestions} />
        </Card>
        {upcoming.length > 0 && (
          <Card title="Coming up">
            <ul className="space-y-3 text-sm">
              {upcoming.map((t) => {
                const [m, d] = monthDay(t.targetDate!);
                return (
                  <li key={t.id} className="flex items-center gap-3.5">
                    <DateChip month={m} day={d} size="sm" />
                    <span className="sr-only">{formatDate(t.targetDate)}:</span>
                    <span className={cx("font-medium", t.overdue && "text-cardinal")}>
                      {t.title}
                      {t.overdue && <span className="ml-1 text-xs font-bold uppercase">· overdue target</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
