"use client";
import { useState } from "react";
import { explainChange, parseChangeRequest } from "@/lib/changes";
import type { ChangeEntry, Intake, PlanDoc } from "@/lib/schema";
import { Alert, Button, Tag } from "./ui";

type Preview = { request: string; patch: Partial<Intake>; entry: ChangeEntry; notices: string[]; via: "ai" | "parser" };

export function ChangeEntryView({ entry, highlight = false }: { entry: ChangeEntry; highlight?: boolean }) {
  const empty = !entry.fieldChanges.length && !entry.added.length && !entry.review.length && !entry.removed.length && !entry.budgetNotes.length;
  return (
    <div className={highlight ? "rounded-lg border-2 border-amber/50 bg-amber-wash p-3" : "rounded-lg border border-line bg-paper p-3"}>
      <p className="font-display text-[15px] italic">“{entry.request}”</p>
      {entry.aiExplanation && (
        <p className="mt-1 text-sm">
          <Tag tone="blue">AI reading</Tag> {entry.aiExplanation}
        </p>
      )}
      {empty && <p className="mt-1 text-sm text-muted">No plan changes.</p>}
      {entry.fieldChanges.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm">
          {entry.fieldChanges.map((f) => (
            <li key={f.field}>
              <span className="text-muted">{f.field}:</span> <span className="text-muted line-through">{f.before}</span> <span className="font-bold text-cardinal">→</span> <strong>{f.after}</strong>
            </li>
          ))}
        </ul>
      )}
      {entry.added.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-semibold text-green">＋ Added to your checklist</p>
          <ul className="list-disc pl-5">
            {entry.added.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {entry.review.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-semibold text-amber">⟳ Review these existing tasks</p>
          <ul className="list-disc pl-5">
            {entry.review.map((r) => (
              <li key={r.title + r.reason}>
                <strong>{r.title}</strong>: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {entry.removed.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-semibold text-muted">− No longer applies</p>
          <ul className="list-disc pl-5">
            {entry.removed.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {entry.budgetNotes.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-semibold">Budget</p>
          <ul className="list-disc pl-5">
            {entry.budgetNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function UpdateEvent({
  doc,
  today,
  aiEnabled,
  onApply,
}: {
  doc: PlanDoc;
  today: string;
  aiEnabled: boolean;
  onApply: (patch: Partial<Intake>, request: string, aiExplanation: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const request = text.trim();
    if (request.length < 3) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    const det = parseChangeRequest(request, doc.intake);
    let patch: Partial<Intake> = det.patch;
    let notices: string[] = [];
    let aiExplanation: string | null = null;
    let via: Preview["via"] = "parser";
    if (aiEnabled) {
      try {
        const res = await fetch("/api/ai/change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: request, intake: doc.intake }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
        // Built-in parser results win where both read the same field; AI fills in the rest.
        patch = { ...(data.patch as Partial<Intake>), ...det.patch };
        notices = [...(data.notices ?? []), ...((data.unclear as string[] | undefined)?.map((u) => `Not applied: ${u}`) ?? [])];
        aiExplanation = data.explanation || null;
        via = "ai";
      } catch (e) {
        notices = [`AI couldn't read this (${e instanceof Error ? e.message : "request failed"}). Showing what the built-in parser understood.`];
      }
    }
    setBusy(false);
    if (Object.keys(patch).length === 0) {
      setError(
        aiEnabled
          ? "Couldn't tell what changed from that message. Try naming the detail, like “attendance is now 100”, or use Edit details."
          : "The built-in parser didn't recognize a change. It understands attendance, budget, outdoors, outside guests, food, and accessibility. For anything else, use Edit details.",
      );
      return;
    }
    const after = { ...doc, intake: { ...doc.intake, ...patch } };
    setPreview({ request, patch, entry: explainChange(doc, after, request, today, aiExplanation), notices, via });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Tell EvntSC what changed in plain words. You&apos;ll see a preview of every task and budget effect before anything is applied.</p>
      <label htmlFor="update-event" className="block text-sm font-semibold">
        What changed?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="update-event"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && void run()}
          placeholder="e.g. Attendance is now 100, or we're moving it outdoors"
          className="min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 py-2 text-sm"
        />
        <Button variant="primary" onClick={run} disabled={busy || text.trim().length < 3}>
          {busy ? "Reading…" : "Preview update"}
        </Button>
      </div>
      {error && <Alert tone="warning">{error}</Alert>}
      {preview && (
        <div className="space-y-3 rounded-xl border-[1.5px] border-cardinal bg-white p-4">
          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
            Preview{" "}
            <Tag tone={preview.via === "ai" ? "blue" : "neutral"}>{preview.via === "ai" ? "Read by AI, checked by EvntSC" : "Read by built-in parser"}</Tag>
          </p>
          {preview.notices.map((n) => (
            <p key={n} className="rounded-md bg-amber-wash px-3 py-2 text-sm font-semibold text-amber">
              ⚠ {n}
            </p>
          ))}
          <ChangeEntryView entry={preview.entry} />
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                onApply(preview.patch, preview.request, preview.entry.aiExplanation);
                setPreview(null);
                setText("");
              }}
            >
              Apply update
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
