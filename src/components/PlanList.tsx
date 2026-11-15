"use client";
import Link from "next/link";
import { useState } from "react";
import { formatDate, monthDay } from "@/lib/dates";
import { useConfirm } from "./ConfirmDialog";
import { Alert, Button, DateChip, Tag } from "./ui";

export type PlanListItem = { id: string; title: string; date: string | null; isSample: boolean; updatedAt: string; href: string };

export function PlanList({
  plans,
  newHref,
  onDelete,
  onLoadSamples,
  onResetSamples,
}: {
  plans: PlanListItem[];
  newHref: string;
  onDelete: (id: string) => Promise<void>;
  onLoadSamples: () => Promise<void>;
  onResetSamples: () => Promise<void>;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };
  const own = plans.filter((p) => !p.isSample);
  const samples = plans.filter((p) => p.isSample);

  const row = (p: PlanListItem) => (
    <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card p-4 sm:px-5">
      {p.date ? <DateChip month={monthDay(p.date)[0]} day={monthDay(p.date)[1]} /> : <DateChip month="—" day="?" muted />}
      <div className="min-w-0 flex-1">
        <Link href={p.href} className="font-display text-lg font-bold hover:text-cardinal hover:underline">
          {p.title.trim() || "Untitled event"}
        </Link>
        <p className="text-sm text-muted">
          {p.date ? formatDate(p.date, { weekday: true }) : "Date unknown"} · updated{" "}
          {new Date(p.updatedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {p.isSample && <Tag tone="gold">Fictional sample</Tag>}
        <Link href={p.href} className="rounded-md bg-cardinal px-3 py-1 text-sm font-semibold text-white hover:bg-cardinal-ink">
          Open
        </Link>
        <Button
          size="sm"
          variant="danger"
          disabled={busy !== null}
          onClick={async () => {
            const name = p.title.trim() || "Untitled event";
            const ok = await confirm({
              title: `Delete “${name}”?`,
              body: p.isSample
                ? "This removes the fictional sample from your list. You can bring it back with “Reset samples to original”."
                : `The plan, its budget, checklist progress, and notes${process.env.NEXT_PUBLIC_ENABLE_TROYLENS === "true" ? ", and any public event card," : ""} will be permanently deleted. This cannot be undone.`,
              confirmLabel: "Delete plan",
              tone: "danger",
            });
            if (ok) void run(`del-${p.id}`, () => onDelete(p.id));
          }}
          aria-label={`Delete ${p.title || "Untitled event"}`}
        >
          {busy === `del-${p.id}` ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </li>
  );

  return (
    <div className="space-y-8">
      {error && <Alert tone="error">{error}</Alert>}
      <section aria-labelledby="own-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="own-h" className="flex items-center gap-2.5 font-display text-2xl font-bold">
            <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
            Your plans
          </h2>
          <Link href={newHref} className="rounded-md bg-cardinal px-4 py-2 text-sm font-semibold text-white hover:bg-cardinal-ink">
            + Plan an event
          </Link>
        </div>
        {own.length ? (
          <ul className="space-y-3">{own.map(row)}</ul>
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong bg-card p-8 text-center">
            <p className="font-display text-lg font-semibold">No plans yet</p>
            <p className="mt-1 text-sm text-muted">Start with a short description, or open a fictional sample to see how it works.</p>
            <Link href={newHref} className="mt-4 inline-block rounded-md bg-cardinal px-4 py-2 text-sm font-semibold text-white hover:bg-cardinal-ink">
              Plan an event
            </Link>
          </div>
        )}
      </section>
      <section aria-labelledby="sample-h" className="rounded-2xl border border-gold/70 bg-gold-wash/60 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="sample-h" className="font-display text-xl font-bold">
              Fictional sample plans
            </h2>
            <p className="text-sm text-muted">Three invented workshop plans for demos. Resetting removes only samples, never your own plans.</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                if (
                  samples.length &&
                  !(await confirm({
                    title: "Reset samples to original?",
                    body: "Any changes you made to the three fictional sample plans will be lost. Your own plans are not affected.",
                    confirmLabel: "Reset samples",
                    tone: "danger",
                  }))
                )
                  return;
                void run("load", onLoadSamples);
              }}
              disabled={busy !== null}
            >
              {busy === "load" ? "Loading…" : samples.length ? "Reset samples to original" : "Load samples"}
            </Button>
            {samples.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Remove ${samples.length === 1 ? "the sample plan" : `all ${samples.length} sample plans`}?`,
                    body: "Only the fictional samples are removed. Your own plans are not affected, and you can load the samples again any time.",
                    confirmLabel: "Remove samples",
                    tone: "danger",
                  });
                  if (ok) void run("reset", onResetSamples);
                }}
                disabled={busy !== null}
              >
                Remove samples
              </Button>
            )}
          </div>
        </div>
        {samples.length > 0 && <ul className="mt-3 space-y-3">{samples.map(row)}</ul>}
      </section>
    </div>
  );
}
