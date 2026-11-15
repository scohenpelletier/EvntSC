"use client";
import { useState } from "react";
import { placeholders, resourceById } from "@/lib/outreach";
import type { Resource } from "@/lib/resources";
import { draftKinds, LABELS, newId, type Draft, type Intake } from "@/lib/schema";
import { useConfirm } from "./ConfirmDialog";
import { Alert, Button, Card, Tag } from "./ui";

const SOURCE_TAG: Record<Draft["source"], { label: string; tone: "neutral" | "blue" | "amber" }> = {
  template: { label: "Template", tone: "neutral" },
  ai: { label: "AI draft — review before sending", tone: "blue" },
  demo: { label: "Demo fixture — not live AI", tone: "amber" },
};

/** Practical details about the recipient (hours, minimums, open questions), shown with the draft. */
function ContactNotes({ resource }: { resource: Resource }) {
  return (
    <details open className="mt-3 rounded-lg border border-line bg-paper p-3.5 text-sm">
      <summary className="cursor-pointer font-semibold">Before you send: {resource.name}</summary>
      <p className="mt-2">{resource.role}</p>
      {resource.sourcedFacts.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {resource.sourcedFacts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      {resource.needsVerification.length > 0 && (
        <div className="mt-2 rounded-md bg-amber-wash p-2">
          <p className="font-semibold text-amber">Needs verification</p>
          <ul className="list-disc pl-4">
            {resource.needsVerification.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        {resource.contactPage && (
          <>
            <a href={resource.contactPage} target="_blank" rel="noopener noreferrer" className="underline">
              Website
            </a>
            {" · "}
          </>
        )}
        Source:{" "}
        <a href={resource.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          {new URL(resource.sourceUrl).hostname}
        </a>
        {resource.verifiedOn ? `, checked ${resource.verifiedOn}` : ", not checked"}
      </p>
    </details>
  );
}

function DraftCard({
  draft,
  intake,
  aiEnabled,
  onUpdate,
  onDelete,
  onAiVersion,
}: {
  draft: Draft;
  intake: Intake;
  aiEnabled: boolean;
  onUpdate: (patch: Partial<Draft>) => void;
  onDelete: () => void;
  onAiVersion: (d: Draft) => void;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [ai, setAi] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const missing = placeholders(`${draft.to}\n${draft.subject}\n${draft.body}`);
  const resource = resourceById(draft.resourceId);
  const tag = SOURCE_TAG[draft.source];

  async function copy() {
    const text = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  async function rewrite() {
    setAi({ busy: true, error: null });
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: draft.kind, resourceId: draft.resourceId, taskTitle: null, intake }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      const now = new Date().toISOString();
      const norm = (t: string) => t.replace(/\s+/g, " ").replace(/[“”‐]/g, '"').trim();
      if (norm(data.body) === norm(draft.body)) throw new Error("The AI version came back the same as this draft, so nothing was added.");
      onAiVersion({ ...draft, id: newId("d"), to: data.to, subject: data.subject, body: data.body, source: "ai", createdAt: now, updatedAt: now });
      setAi({ busy: false, error: null });
    } catch (e) {
      setAi({ busy: false, error: e instanceof Error ? e.message : "AI draft failed." });
    }
  }

  const field = "mt-1 block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink";
  return (
    <Card className="border-[1.5px] border-gold">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={tag.tone}>{tag.label}</Tag>
        <span className="font-display text-lg font-bold">{LABELS.draftKind[draft.kind]}</span>
        {resource && <span className="text-sm text-muted">· {resource.name}</span>}
      </div>
      {resource && <ContactNotes resource={resource} />}
      <div className="mt-3 space-y-2">
        <label className="block text-xs text-muted">
          To
          <input className={field} value={draft.to} maxLength={200} onChange={(e) => onUpdate({ to: e.target.value })} />
        </label>
        <label className="block text-xs text-muted">
          Subject
          <input className={field} value={draft.subject} maxLength={200} onChange={(e) => onUpdate({ subject: e.target.value })} />
        </label>
        <label className="block text-xs text-muted">
          Message
          <textarea className={field + " font-[inherit] leading-relaxed"} rows={14} value={draft.body} maxLength={6000} onChange={(e) => onUpdate({ body: e.target.value })} />
        </label>
      </div>
      {missing.length > 0 ? (
        <div className="mt-3 rounded-lg bg-amber-wash px-3.5 py-3 text-sm">
          <p className="font-semibold text-amber">Fill in before sending ({missing.length}):</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <li key={m} className="rounded border border-gold bg-gold-wash px-2 py-0.5 text-xs font-bold text-cardinal-deep">
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-sm text-green">No placeholders left. Read it once more before you send.</p>
      )}
      {ai.error && (
        <div className="mt-2">
          <Alert tone="error" title="AI draft failed">
            {ai.error} This draft is unchanged.
          </Alert>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={copy}>
          Copy draft
        </Button>
        {aiEnabled && (
          <Button size="sm" onClick={rewrite} disabled={ai.busy}>
            {ai.busy ? "Writing…" : ai.error ? "Retry AI version" : "Write an AI version"}
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={onDelete}>
          Delete
        </Button>
        <span aria-live="polite" className="text-sm">
          {copied === "ok" ? "Copied to clipboard." : copied === "fail" ? "Couldn't copy. Select the text and copy it manually." : ""}
        </span>
      </div>
    </Card>
  );
}

export function DraftsPanel({
  drafts,
  intake,
  aiEnabled,
  onChange,
  onNew,
}: {
  drafts: Draft[];
  intake: Intake;
  aiEnabled: boolean;
  onChange: (drafts: Draft[]) => void;
  onNew: (kind: Draft["kind"]) => void;
}) {
  const confirm = useConfirm();
  const [kind, setKind] = useState<Draft["kind"]>("venue");
  const sorted = [...drafts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="space-y-5">
      <div className="on-cardinal flex flex-wrap items-end gap-3 rounded-xl bg-cardinal px-5 py-4 text-white">
        <label className="min-w-[220px] flex-1 text-sm font-medium">
          New draft
          <select value={kind} onChange={(e) => setKind(e.target.value as Draft["kind"])} className="mt-1.5 block w-full rounded-md border border-white bg-white px-3 py-2 text-sm text-ink">
            {draftKinds.map((k) => (
              <option key={k} value={k}>
                {LABELS.draftKind[k]}
              </option>
            ))}
          </select>
        </label>
        <Button variant="gold" onClick={() => onNew(kind)}>
          Create draft
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          No drafts yet. Start with a venue inquiry or a catering quote request. Missing details become [PLACEHOLDERS] you fill in.
        </p>
      ) : (
        <ul className="space-y-4">
          {sorted.map((d) => (
            <li key={d.id} id={`draft-${d.id}`}>
              <DraftCard
                draft={d}
                intake={intake}
                aiEnabled={aiEnabled}
                onUpdate={(patch) => onChange(drafts.map((x) => (x.id === d.id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)))}
                onAiVersion={(nd) => onChange([...drafts, nd])}
                onDelete={async () => {
                  const ok = await confirm({ title: "Delete this draft?", body: "It will be removed from the plan when you save.", confirmLabel: "Delete draft", tone: "danger" });
                  if (ok) onChange(drafts.filter((x) => x.id !== d.id));
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
