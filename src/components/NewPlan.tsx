"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { IntakeProposal } from "@/lib/ai/sanitize";
import { localStore } from "@/lib/local-store";
import { emptyDoc, newId, type BudgetLine, type Intake, type PlanDoc } from "@/lib/schema";
import { AiDescribe } from "./AiDescribe";
import { FollowUps, followUpQuestions } from "./FollowUps";
import { IntakeForm } from "./IntakeForm";
import { FlyerUpload } from "./FlyerUpload";
import { Alert, Button, PageBand } from "./ui";

export function NewPlan({
  storage,
  aiEnabled,
  mode = "describe",
  defaultOrganization = "",
}: {
  storage: "remote" | "local";
  aiEnabled: boolean;
  mode?: "describe" | "flyer";
  /** From Settings: prefilled into the new plan's organization field. */
  defaultOrganization?: string;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState<PlanDoc>(() => {
    const d = emptyDoc();
    return defaultOrganization ? { ...d, intake: { ...d.intake, organization: defaultOrganization } } : d;
  });
  const [flyerSeed, setFlyerSeed] = useState<{ key: number; text: string; proposal: IntakeProposal } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(!aiEnabled);
  useEffect(() => {
    // The URL hash only exists in the browser, so it can't be read during the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from window.location after mount
    if (window.location.hash === "#details") setDetailsOpen(true);
  }, []);
  const [formKey, setFormKey] = useState(0);
  const [described, setDescribed] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setIntake = (patch: Partial<Intake>) => setDoc((d) => ({ ...d, intake: { ...d.intake, ...patch } }));
  const pending = described ? followUpQuestions(doc.intake, skipped) : [];

  async function create() {
    setBusy(true);
    setError(null);
    try {
      if (storage === "local") {
        const id = newId("demo-");
        localStore.put({ id, doc, isSample: false, updatedAt: new Date().toISOString(), version: 1 });
        router.push(`/demo/${id}`);
        return;
      }
      const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Could not create plan (${res.status}).`);
      router.push(`/plans/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create plan.");
      setBusy(false);
    }
  }

  const base = storage === "local" ? "/demo/new" : "/plans/new";
  const applyProposal = (fields: Partial<Intake>, lines: BudgetLine[], qs: string[], assumptions: string[], source: "ai" | "demo") => {
    setDoc((d) => ({
      ...d,
      intake: { ...d.intake, ...fields },
      budget: [...d.budget, ...lines],
      questions: [...d.questions, ...qs.map((q) => ({ id: newId("q"), text: q.slice(0, 500), resolved: false, answer: "" }))],
      assumptions: [...d.assumptions, ...assumptions.map((text) => ({ id: newId("a"), text: text.slice(0, 300), source }))].slice(0, 30),
    }));
    setDescribed(true);
    setFlyerSeed(null);
    setFormKey((k) => k + 1);
  };
  const openDetails = () => {
    setDetailsOpen(true);
    requestAnimationFrame(() => document.getElementById("details")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const step = (n: number) => (
    <span aria-hidden className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-cardinal text-sm font-bold text-gold">
      {n}
    </span>
  );

  return (
    <div>
      <PageBand
        eyebrow={
          <span className="normal-case tracking-normal">
            <Link href={storage === "local" ? "/demo" : "/plans"} className="text-white/85 underline-offset-2 hover:underline">
              {storage === "local" ? "Local demo plans" : "My plans"}
            </Link>{" "}
            <span className="text-white/60">/ New plan</span>
          </span>
        }
        title={mode === "flyer" ? "Start from a flyer" : "Plan an event"}
        subtitle={
          mode === "flyer"
            ? "Upload a flyer and review what EvntSC reads from it. Anything it can’t see stays Unknown."
            : "Describe your on-campus workshop or info session. You review everything before it becomes a plan."
        }
        actions={
          mode === "flyer" ? (
            <Link href={base} className="rounded-md border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Describe it instead
            </Link>
          ) : aiEnabled ? (
            <Link href={`${base}/flyer`} className="rounded-md border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Start from a flyer
            </Link>
          ) : undefined
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <section className="rounded-xl border-2 border-cardinal/25 bg-card p-4 sm:p-6">
          <h2 className="flex items-center font-display text-xl font-bold">
            {step(1)}
            {mode === "flyer" ? (flyerSeed ? "Review what the flyer says" : "Upload your flyer") : "Describe your event"}
          </h2>
          <div className="mt-4">
            {mode === "flyer" && !aiEnabled ? (
              <Alert tone="info" title="Reading flyers needs AI, which isn’t configured on this server">
                <p>Fill in the form below instead. The checklist, contacts, budget, drafts, and saving all work without AI.</p>
              </Alert>
            ) : mode === "flyer" && !flyerSeed ? (
              described ? (
                <Alert tone="success" title="Flyer details applied">
                  <p>Answer any follow-up questions, then review the details below.</p>
                </Alert>
              ) : (
                <FlyerUpload onResult={(text, proposal) => setFlyerSeed({ key: Date.now(), text, proposal })} onManual={openDetails} />
              )
            ) : (
              <AiDescribe
                key={flyerSeed?.key ?? "describe"}
                aiEnabled={aiEnabled}
                intake={doc.intake}
                seed={flyerSeed ?? undefined}
                onApply={applyProposal}
              />
            )}
          </div>
        </section>
        {pending.length > 0 && (
          <section className="mt-6 rounded-xl border border-line bg-card p-4 sm:p-6">
            <h2 className="flex items-center font-display text-xl font-bold">{step(2)}A few quick questions</h2>
            <div className="mt-4">
              <FollowUps
                intake={doc.intake}
                skipped={skipped}
                onAnswer={(patch) => {
                  setIntake(patch);
                  setFormKey((k) => k + 1);
                }}
                onSkip={(key) => setSkipped((s) => [...s, key])}
              />
            </div>
          </section>
        )}
        <details
          id="details"
          className="mt-6 scroll-mt-4 rounded-xl border border-line bg-card p-4 sm:p-6"
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer items-center font-display text-xl font-bold">
            {step(pending.length ? 3 : 2)}
            Review or fill in details
          </summary>
          <div className="mt-4">
            <IntakeForm key={formKey} intake={doc.intake} onChange={setIntake} />
          </div>
        </details>
        <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-3 border-t border-line bg-paper py-4">
          <Button variant="primary" onClick={create} disabled={busy} className="px-6 py-2.5 text-[15px]">
            {busy ? "Creating…" : "Create my plan"}
          </Button>
          <p className="text-xs text-muted">You can change anything later. Unknowns stay as open questions.</p>
        </div>
        {error && <Alert tone="error">{error} Your entries are still here.</Alert>}
      </div>
    </div>
  );
}
