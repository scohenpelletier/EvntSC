"use client";
import { useState } from "react";
import type { IntakeProposal } from "@/lib/ai/sanitize";
import { formatDate } from "@/lib/dates";
import { demoProposal, EXAMPLE_PROMPT } from "@/lib/demo-fixtures";
import { withoutOriginalIdentity } from "@/lib/troylens/discover";
import { LABELS, type BudgetLine, type Intake } from "@/lib/schema";
import { Alert, Button, Tag, TextArea } from "./ui";

const FIELD_LABEL: Partial<Record<keyof Intake, string>> = {
  title: "Title",
  eventType: "Event type",
  purpose: "Purpose",
  dateText: "Timing (your words)",
  guestCount: "Outside guests",
  accessibility: "Accessibility needs",
  organizerName: "Organizer",
  organization: "Organization",
  date: "Date",
  startTime: "Start time",
  endTime: "End time",
  attendance: "Attendance",
  venueName: "Venue",
  venueType: "Venue type",
  venueStatus: "Venue status",
  recognition: "Recognition",
  food: "Food",
  outsideSpeakers: "Outside speakers",
  vendors: "Vendors",
  fundraising: "Fundraising",
  budgetTarget: "Budget target",
};

function show(key: keyof Intake, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (key === "date") return formatDate(v as string);
  const map = (LABELS as unknown as Record<string, Record<string, string>>)[
    key === "outsideSpeakers" || key === "food" || key === "vendors" || key === "fundraising" || key === "accessibility" ? "tri" : key
  ];
  return map?.[v as string] ?? String(v);
}

/**
 * Natural-language intake. The model only proposes values; the organizer
 * reviews each one. Without AI the organizer simply uses the form.
 */
export function AiDescribe({
  aiEnabled,
  intake,
  onApply,
  seed,
}: {
  aiEnabled: boolean;
  intake: Intake;
  /** A proposal produced elsewhere (e.g. read from a flyer), shown for review on mount. */
  seed?: { text: string; proposal: IntakeProposal };
  onApply: (fields: Partial<Intake>, budget: BudgetLine[], questions: string[], assumptions: string[], source: "ai" | "demo") => void;
}) {
  const [text, setText] = useState(seed?.text ?? intake.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<IntakeProposal | null>(seed?.proposal ?? null);
  const [demo, setDemo] = useState(false);
  const [acceptAssumptions, setAcceptAssumptions] = useState(true);
  const [accepted, setAccepted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(seed?.proposal.fields ?? {}).map((k) => [k, true])),
  );
  const [acceptLines, setAcceptLines] = useState(true);
  const [acceptQs, setAcceptQs] = useState(true);

  async function run() {
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/ai/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: text }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      const raw = data.proposal as IntakeProposal;
      // Starting from another club's event: never adopt that club's name or event title as ours.
      const own = withoutOriginalIdentity(raw.fields, intake.inspiredBy);
      const p: IntakeProposal = own.dropped.length
        ? { ...raw, fields: own.fields, notices: [...raw.notices, `Kept your own ${own.dropped.join(" and ")}: the original event is credited separately.`] }
        : raw;
      setDemo(false);
      setProposal(p);
      const acc: Record<string, boolean> = {};
      for (const k of Object.keys(p.fields)) acc[k] = true;
      setAccepted(acc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  function runDemo() {
    const p = demoProposal();
    setText(EXAMPLE_PROMPT);
    setError(null);
    setDemo(true);
    setProposal(p);
    setAccepted(Object.fromEntries(Object.keys(p.fields).map((k) => [k, true])));
  }

  function apply() {
    if (!proposal) return;
    const fields: Partial<Intake> = { description: text };
    for (const [k, v] of Object.entries(proposal.fields)) {
      if (k === "dateConfirmed") continue;
      if (accepted[k]) (fields as Record<string, unknown>)[k] = v;
    }
    if (accepted.date) fields.dateConfirmed = proposal.fields.dateConfirmed ?? false;
    onApply(fields, acceptLines ? proposal.budget : [], acceptQs ? proposal.questions : [], acceptAssumptions ? proposal.assumptions : [], demo ? "demo" : "ai");
    setProposal(null);
  }

  // Only fields the proposal would actually change.
  const visibleKeys = proposal ? (Object.keys(proposal.fields) as (keyof Intake)[]).filter((k) => FIELD_LABEL[k] && show(k, proposal.fields[k]) !== show(k, intake[k])) : [];

  return (
    <div className="space-y-3">
      <TextArea
        label="Describe your event in your own words"
        rows={4}
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE_PROMPT}
      />
      {aiEnabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={run} disabled={busy || text.trim().length < 10}>
            {busy ? "Reading your description…" : "Build my plan from this"}
          </Button>
        </div>
      ) : (
        <Alert tone="info" title="AI isn't configured on this server">
          <p>Fill in the form below. The checklist, contacts, budget, drafts, and saving all work without AI.</p>
          <Button size="sm" className="mt-2" onClick={runDemo}>
            Try the example in demo mode
          </Button>
        </Alert>
      )}
      {error && (
        <Alert tone="error" title="AI couldn't read the description">
          <p>{error} Your text and form entries are unchanged.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={run}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>
              Continue manually
            </Button>
          </div>
        </Alert>
      )}
      {proposal && (
        <div className="rounded-xl border-[1.5px] border-cardinal bg-card p-4">
          <div className="flex items-center gap-2">
            {demo ? <Tag tone="amber">Demo fixture — not live AI</Tag> : <Tag tone="blue">AI proposal</Tag>}
            <p className="text-sm font-semibold">Review before applying</p>
          </div>
          {proposal.notices.map((n) => (
            <p key={n} className="mt-2 text-sm text-amber">
              ⚠ {n}
            </p>
          ))}
          <div className="mt-3 overflow-x-auto">
          <table className="w-full table-fixed text-sm [overflow-wrap:anywhere]">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted">
                <th className="w-8 py-1">
                  <span className="sr-only">Accept</span>
                </th>
                <th className="w-[28%] py-1">Field</th>
                <th className="py-1">Current</th>
                <th className="py-1">Proposed</th>
              </tr>
            </thead>
            <tbody>
              {visibleKeys.map((k) => (
                <tr key={k} className="border-t border-line">
                  <td className="py-1">
                    <input
                      type="checkbox"
                      checked={!!accepted[k]}
                      aria-label={`Accept ${FIELD_LABEL[k]}`}
                      onChange={(e) => setAccepted((a) => ({ ...a, [k]: e.target.checked }))}
                    />
                  </td>
                  <td className="py-1 text-muted">{FIELD_LABEL[k]}</td>
                  <td className="py-1">{show(k, intake[k])}</td>
                  <td className="py-1 font-semibold text-cardinal">
                    {show(k, proposal.fields[k])}
                    {k === "date" && proposal.fields.dateConfirmed === false && <Tag tone="amber">Needs confirmation</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {proposal.budget.length > 0 && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={acceptLines} onChange={(e) => setAcceptLines(e.target.checked)} className="mt-1" />
              <span>
                Add {proposal.budget.length} expense line{proposal.budget.length > 1 ? "s" : ""}:{" "}
                {proposal.budget.map((b) => `${b.description}${b.costUnknown ? " (cost unknown)" : ` ($${b.unitCost})`}`).join(", ")}
              </span>
            </label>
          )}
          {proposal.questions.length > 0 && (
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={acceptQs} onChange={(e) => setAcceptQs(e.target.checked)} className="mt-1" />
              <span>Add {proposal.questions.length} open question(s): {proposal.questions.join(" · ")}</span>
            </label>
          )}
          {proposal.assumptions.length > 0 && (
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={acceptAssumptions} onChange={(e) => setAcceptAssumptions(e.target.checked)} className="mt-1" />
              <span>Record {proposal.assumptions.length} assumption(s) to confirm later: {proposal.assumptions.join(" · ")}</span>
            </label>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={apply}>
              Apply selected
            </Button>
            <Button variant="ghost" onClick={() => setProposal(null)}>
              Discard proposal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
