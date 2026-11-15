"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { campusToday, formatDate, formatTime } from "@/lib/dates";
import { localStore } from "@/lib/local-store";
import { renderPacketHtml } from "@/lib/packet";
import { computePlan } from "@/lib/plan";
import { explainChange } from "@/lib/changes";
import { defaultKindForTask, draftFromTemplate, relevantResources, resourceById } from "@/lib/outreach";
import { newId, type BudgetLine, type Draft, type Intake, type PlanDoc } from "@/lib/schema";
import { diffTasks, mergeChanges, type ChangeSummary, type MergedTask } from "@/lib/tasks/reconcile";
import { ContactsPanel } from "./ContactsPanel";
import { DraftsPanel } from "./DraftsPanel";
import { AiDescribe } from "./AiDescribe";
import { BudgetEditor } from "./BudgetEditor";
import { Checklist } from "./Checklist";
import { IntakeForm } from "./IntakeForm";
import { Overview } from "./Overview";
import { PublishCard } from "./PublishCard";
import type { Listing } from "@/lib/troylens/card";
import { useConfirm } from "./ConfirmDialog";
import { Alert, Button, cx, LinkButton, Tag } from "./ui";

export type WorkspaceMode = { kind: "remote"; id: string; version: number; updatedAt: string } | { kind: "local"; id: string; version: number; updatedAt: string };

type SaveState = { kind: "saved" } | { kind: "dirty" } | { kind: "saving" } | { kind: "error"; message: string; conflict?: boolean };
type Tab = "overview" | "checklist" | "contacts" | "budget" | "drafts";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "checklist", label: "Checklist" },
  { id: "contacts", label: "Contacts" },
  { id: "budget", label: "Budget" },
  { id: "drafts", label: "Drafts" },
];

function emptyChange(c: ChangeSummary) {
  return !c.added.length && !c.removed.length && !c.recheck.length && !c.moved.length;
}

export function Workspace({
  initial,
  mode: initialMode,
  isSample,
  aiEnabled,
  troyLens,
}: {
  initial: PlanDoc;
  mode: WorkspaceMode;
  isSample: boolean;
  aiEnabled: boolean;
  /** Optional TroyLens extension; omitted when the feature flag is off. */
  troyLens?: { listing: Listing | null; unavailable?: string };
}) {
  const [doc, setDoc] = useState<PlanDoc>(initial);
  const [mode, setMode] = useState(initialMode);
  const [save, setSave] = useState<SaveState>({ kind: "saved" });
  const confirm = useConfirm();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [drawer, setDrawer] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [change, setChange] = useState<{ causes: string[]; summary: ChangeSummary } | null>(null);
  const [review, setReview] = useState<{ busy: boolean; error: string | null; message: string | null }>({ busy: false, error: null, message: null });
  const today = useMemo(() => campusToday(), []);
  const plan = useMemo(() => computePlan(doc, today), [doc, today]);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ overview: null, checklist: null, contacts: null, budget: null, drafts: null });
  const contacts = useMemo(() => relevantResources(plan.tasks), [plan.tasks]);
  const drawerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  /** Increments on every edit so a save that finishes after a newer edit doesn't claim "Saved". */
  const editSeq = useRef(0);

  /** Apply an edit; for intake/budget edits, compute and surface what it changed. */
  const edit = useCallback(
    (next: (d: PlanDoc) => PlanDoc, cause?: string) => {
      setDoc((prev) => {
        const updated = next(prev);
        if (cause) {
          const before = computePlan(prev, today).tasks;
          const after = computePlan(updated, today).tasks;
          const summary = diffTasks(before, after);
          if (!emptyChange(summary))
            setChange((c) => (c ? { causes: [...new Set([...c.causes, cause])], summary: mergeChanges(c.summary, summary) } : { causes: [cause], summary }));
        }
        return updated;
      });
      editSeq.current += 1;
      setSave({ kind: "dirty" });
    },
    [today],
  );

  const setIntake = (patch: Partial<Intake>) => {
    const keys = Object.keys(patch).filter((k) => k !== "notes" && k !== "description");
    edit((d) => ({ ...d, intake: { ...d.intake, ...patch } }), keys.length ? describePatch(patch) : undefined);
  };
  const setBudget = (budget: BudgetLine[]) => edit((d) => ({ ...d, budget }), "Budget edited");

  /** Conversational update: apply the patch and persist a computed explanation of what it changed. */
  const applyUpdate = (patch: Partial<Intake>, request: string, aiExplanation: string | null) => {
    edit((d) => {
      const after = { ...d, intake: { ...d.intake, ...patch } };
      const entry = explainChange(d, after, request, today, aiExplanation);
      return { ...after, changeLog: [entry, ...d.changeLog].slice(0, 50) };
    }, `“${request.slice(0, 80)}”`);
    setFormKey((k) => k + 1);
  };

  const scrollTo = (id: string) =>
    setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.querySelector<HTMLElement>("select,button,summary")?.focus({ preventScroll: true });
    }, 50);

  const gotoTask = (taskId: string) => {
    setTab("checklist");
    scrollTo(`task-${taskId}`);
  };

  const newDraft = (kind: Draft["kind"], resourceId: string | null, taskId: string | null) => {
    const t = draftFromTemplate(kind, doc.intake, resourceById(resourceId));
    const at = new Date().toISOString();
    const draft: Draft = { id: newId("d"), kind, resourceId, taskId, ...t, source: "template", createdAt: at, updatedAt: at };
    edit((d) => ({ ...d, drafts: [...d.drafts, draft].slice(-40) }));
    setTab("drafts");
    scrollTo(`draft-${draft.id}`);
  };

  const draftForTask = (task: MergedTask) => {
    const kind = defaultKindForTask(task.id);
    const resourceId = kind === "guest_invite" ? null : (task.derived?.resourceIds[0] ?? null);
    newDraft(kind, resourceId, task.id);
  };

  /** Resolves true only when everything on screen is saved: false on failure, or if an edit landed while the save was in flight. */
  const doSave = useCallback(async (): Promise<boolean> => {
    const seqAtStart = editSeq.current;
    const settle = () => {
      const current = editSeq.current === seqAtStart;
      setSave(current ? { kind: "saved" } : { kind: "dirty" });
      return current;
    };
    setSave({ kind: "saving" });
    try {
      if (mode.kind === "local") {
        const updatedAt = new Date().toISOString();
        localStore.put({ id: mode.id, doc, isSample, updatedAt, version: mode.version + 1 });
        setMode({ ...mode, version: mode.version + 1, updatedAt });
        return settle();
      }
      const res = await fetch(`/api/plans/${mode.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: mode.version, doc }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Your session expired. Sign in again in another tab, then save — your changes are still here.");
      if (res.status === 409) {
        setSave({ kind: "error", message: data.error ?? "Version conflict.", conflict: true });
        return false;
      }
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status}).`);
      setMode({ ...mode, version: data.version, updatedAt: data.updatedAt });
      return settle();
    } catch (e) {
      setSave({ kind: "error", message: e instanceof Error ? e.message : "Save failed." });
      return false;
    }
  }, [doc, isSample, mode]);

  // Keyboard save + unsaved-changes guard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (save.kind === "dirty" || save.kind === "error" || save.kind === "saving") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [doSave, save.kind]);

  // In-app navigation guard: links inside the app (header, breadcrumbs) would
  // silently drop unsaved work, and beforeunload doesn't fire for client-side
  // navigation. Intercept them and ask with an in-app dialog instead. (Reloading
  // or closing the tab still uses the browser's own prompt — pages can't
  // replace that one.)
  const unsavedRef = useRef(false);
  const saveRef = useRef(doSave);
  useEffect(() => {
    unsavedRef.current = save.kind === "dirty" || save.kind === "error" || save.kind === "saving";
    saveRef.current = doSave;
  }, [save.kind, doSave]);
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      if (!unsavedRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // same page / hash link
      e.preventDefault();
      e.stopPropagation();
      const choice = await confirm({
        title: "Leave without saving?",
        body: "You have changes to this plan that aren't saved yet. If you leave now, they'll be lost.",
        confirmLabel: "Leave without saving",
        extraLabel: "Save and leave",
        cancelLabel: "Stay",
        tone: "danger",
      });
      if (choice === false) return;
      // Stay if the save failed (error is shown) or newer edits arrived meanwhile (still marked unsaved).
      if (choice === "extra" && !(await saveRef.current())) return;
      router.push(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [confirm, router]);

  // Drawer focus management. A checklist "Add …" button opens the drawer at one field (found by its label).
  const [focusField, setFocusField] = useState<string | null>(null);
  const openDetailsAt = (fieldLabel: string) => {
    setFocusField(fieldLabel);
    setDrawer(true);
  };
  useEffect(() => {
    if (!drawer) return;
    const el = drawerRef.current;
    const label = focusField ? [...(el?.querySelectorAll("label") ?? [])].find((l) => l.textContent?.trim() === focusField) : undefined;
    const target = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.focus({ preventScroll: true });
    } else el?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    const opener = openerRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
      setFocusField(null);
    };
  }, [drawer, focusField]);

  async function runReview() {
    setReview({ busy: true, error: null, message: null });
    try {
      const res = await fetch("/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(doc) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      const notes = (data.notes ?? []) as { ruleId: string; text: string }[];
      const qs = (data.questions ?? []) as string[];
      const createdAt = new Date().toISOString();
      edit((d) => ({
        ...d,
        aiNotes: [...d.aiNotes.filter((n) => !notes.some((x) => x.ruleId === n.ruleId)), ...notes.map((n) => ({ ...n, createdAt }))].slice(0, 60),
        questions: [
          ...d.questions,
          ...qs
            .filter((q) => !d.questions.some((x) => x.text.endsWith(q)))
            .map((q) => ({ id: newId("q"), text: `AI suggestion: ${q}`.slice(0, 500), resolved: false, answer: "" })),
        ].slice(0, 100),
      }));
      const rejected = (data.rejectedIds ?? []) as string[];
      setReview({
        busy: false,
        error: null,
        message:
          data.message ??
          `Added ${notes.length} explanation(s) to checklist items and ${qs.length} question(s).${rejected.length ? ` Ignored ${rejected.length} unregistered or non-applicable rule ID(s).` : ""}`,
      });
    } catch (e) {
      setReview({ busy: false, error: e instanceof Error ? e.message : "AI review failed.", message: null });
    }
  }

  function exportLocal(download: boolean) {
    const html = renderPacketHtml(doc, {
      savedAt: null,
      generatedAt: new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
      today,
      isSample,
      interactive: !download,
    });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const saveFile = () => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `evntsc-${(doc.intake.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}.html`;
      a.click();
    };
    if (download) saveFile();
    else {
      const w = window.open(url, "_blank");
      if (w) w.opener = null;
      else saveFile(); // Popup blocked: fall back to downloading the same packet.
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const attention = plan.tasks.filter((t) => t.applicable && t.status === "needs_recheck").length;
  const issues = plan.budget.findings.filter((f) => f.severity === "issue").length;

  const timeText = doc.intake.startTime ? `${formatTime(doc.intake.startTime)}${doc.intake.endTime ? `–${formatTime(doc.intake.endTime)}` : ""}` : null;
  // "Publish event!" appears once every checklist item is done and the event has no public card yet.
  const [published, setPublished] = useState(!!troyLens?.listing);
  const activeTasks = plan.tasks.filter((t) => t.applicable);
  const checklistDone = activeTasks.length > 0 && activeTasks.every((t) => t.status === "completed");
  const canPublish = !!troyLens && !troyLens.unavailable && mode.kind === "remote";
  const showPublish = canPublish && checklistDone && !published;
  // Completed: the event date has passed and every checklist item is done.
  const completed = checklistDone && !!doc.intake.date && doc.intake.date < today;
  const goToPublish = () => {
    const el = document.getElementById("publish");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    el?.querySelector<HTMLElement>("textarea")?.focus({ preventScroll: true });
  };
  const publishButton = (cls?: string) => (
    // Plain button (not <Button>) so its size isn't overridden by the shared size classes.
    <button
      type="button"
      onClick={goToPublish}
      className={cx(
        "inline-flex items-center justify-center rounded-lg bg-gold px-8 py-4 text-xl font-extrabold text-cardinal-deep shadow-xl ring-4 ring-white/70 transition-transform hover:scale-[1.03] hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-white motion-reduce:transition-none motion-reduce:hover:scale-100",
        cls,
      )}
    >
      Publish event!
    </button>
  );

  const saveButton = (cls?: string, variant: "gold" | "primary" = "gold") => (
    <Button variant={variant} className={cls} onClick={doSave} disabled={save.kind === "saving" || save.kind === "saved"} aria-keyshortcuts="Control+S">
      {save.kind === "saving" ? "Saving…" : save.kind === "saved" ? "Saved" : "Save"}
    </Button>
  );

  return (
    <div>
      {/* Plan header: cardinal band with gold tab indicator */}
      <div className="no-print on-cardinal bg-cardinal text-white">
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
          <nav aria-label="Breadcrumb" className="text-sm text-white/75">
            <Link href={mode.kind === "local" ? "/demo" : "/plans"} className="hover:text-white hover:underline">
              {mode.kind === "local" ? "Local demo plans" : "My plans"}
            </Link>{" "}
            / <span>Plan</span>
          </nav>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl leading-[1.1] sm:text-[44px]">{doc.intake.title.trim() || "Untitled event"}</h1>
                {isSample && <Tag tone="gold">Fictional sample</Tag>}
                {completed && <Tag tone="green">Completed</Tag>}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90 sm:text-[15px]">
                <span>
                  {doc.intake.date ? formatDate(doc.intake.date, { weekday: true }) : "Date unknown"}
                  {timeText && ` · ${timeText}`}
                </span>
                <SaveIndicator save={save} updatedAt={mode.updatedAt} />
              </div>
            </div>
            <div className="hidden flex-wrap items-center gap-2.5 sm:flex">
              {showPublish && publishButton()}
              <Button ref={openerRef} variant="onCardinal" onClick={() => setDrawer(true)}>
                Edit details
              </Button>
              {saveButton()}
            </div>
          </div>

          {/* Tabs */}
          <div role="tablist" aria-label="Plan views" className="-mx-4 mt-6 flex gap-1 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onKeyDown={(e) => onTabKey(e, i)}
                onClick={() => setTab(t.id)}
                className={cx(
                  "flex shrink-0 items-center whitespace-nowrap rounded-t-md border-b-4 px-3 pt-3 pb-2.5 text-[15px] sm:px-4",
                  tab === t.id ? "border-gold bg-white/10 font-bold text-white" : "border-transparent font-semibold text-white/80 hover:text-white",
                )}
              >
                {t.label}
                {t.id === "budget" && issues > 0 && <span className="ml-1.5 rounded-full bg-gold px-1.5 text-xs font-bold text-cardinal-deep">{issues}</span>}
                {t.id === "checklist" && attention > 0 && <span className="ml-1.5 rounded-full bg-gold px-1.5 text-xs font-bold text-cardinal-deep">{attention}</span>}
                {t.id === "contacts" && contacts.length > 0 && <span className="ml-1.5 text-sm font-bold text-gold">{contacts.length}</span>}
                {t.id === "drafts" && doc.drafts.length > 0 && <span className="ml-1.5 text-sm font-bold text-gold">{doc.drafts.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8">
        {save.kind === "error" && (
          <div className="mb-4">
            <Alert tone="error" title={save.conflict ? "Newer version exists" : "Not saved"}>
              <p>{save.message}</p>
              <div className="mt-2 flex gap-2">
                {save.conflict ? (
                  <Button size="sm" onClick={() => window.location.reload()}>
                    Reload latest (discards these edits)
                  </Button>
                ) : (
                  <Button size="sm" onClick={doSave}>
                    Retry save
                  </Button>
                )}
              </div>
            </Alert>
          </div>
        )}

        {plan.evaluation.timingWarning && (
          <div className="mb-4">
            <Alert tone="warning" title="Timing">
              {plan.evaluation.timingWarning}
            </Alert>
          </div>
        )}

        {plan.evaluation.scopeWarning && (
          <div className="mb-4">
            <Alert tone="warning" title="Outside EvntSC's supported scope">
              {plan.evaluation.scopeWarning}
            </Alert>
          </div>
        )}

        {change && <ChangeBanner change={change} plan={plan} onDismiss={() => setChange(null)} />}

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
          {tab === "overview" && (
            <Overview
              doc={doc}
              plan={plan}
              today={today}
              aiEnabled={aiEnabled}
              showChangeLog={!change}
              onQuestions={(questions) => edit((d) => ({ ...d, questions }))}
              onAssumptions={(assumptions) => edit((d) => ({ ...d, assumptions }))}
              onUpdate={applyUpdate}
              onGoto={setTab}
              onGotoTask={gotoTask}
            />
          )}
          {tab === "contacts" && <ContactsPanel items={contacts} onDraft={newDraft} onGotoTask={gotoTask} />}
          {tab === "drafts" && (
            <DraftsPanel drafts={doc.drafts} intake={doc.intake} aiEnabled={aiEnabled} onChange={(drafts) => edit((d) => ({ ...d, drafts }))} onNew={(k) => newDraft(k, null, null)} />
          )}
          {tab === "budget" && <BudgetEditor lines={doc.budget} summary={plan.budget} onChange={setBudget} />}
          {tab === "checklist" && (
            <div className="space-y-4">
              {aiEnabled && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={runReview} disabled={review.busy}>
                    {review.busy ? "Asking AI…" : "Explain with AI"}
                  </Button>
                </div>
              )}
              {review.error && (
                <Alert tone="error" title="AI explanation failed">
                  <p>{review.error} Your checklist is unchanged.</p>
                  <Button size="sm" className="mt-2" onClick={runReview}>
                    Retry
                  </Button>
                </Alert>
              )}
              {review.message && <Alert tone="info">{review.message}</Alert>}
              <Checklist
                tasks={plan.tasks}
                states={doc.tasks}
                aiNotes={doc.aiNotes}
                today={today}
                onChange={(tasks) => edit((d) => ({ ...d, tasks }))}
                highlight={change?.summary ?? { added: [], recheck: [] }}
                onDraft={draftForTask}
                onGotoContacts={() => setTab("contacts")}
                onEditDetail={openDetailsAt}
              />
            </div>
          )}
        </div>

        {/* Export */}
        <section aria-label="Planning packet" className="no-print on-cardinal mt-8 flex flex-wrap items-center gap-4 rounded-xl bg-cardinal-deep px-5 py-5 text-white sm:px-6">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gold text-cardinal-deep">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
              <rect x="6" y="14" width="12" height="8" rx="1" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold">Planning packet</h2>
            <p className="text-sm text-white/80">
              {save.kind !== "saved" && mode.kind === "remote"
                ? "Save first: the packet uses your last saved version."
                : "A preparation document from your last saved version — not an official application."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {mode.kind === "remote" ? (
              <>
                <LinkButton href={`/api/plans/${mode.id}/export`} variant="onCardinal">
                  Print view
                </LinkButton>
                <LinkButton href={`/api/plans/${mode.id}/export?download=1`} variant="gold" download>
                  Download
                </LinkButton>
              </>
            ) : (
              <>
                <Button variant="onCardinal" onClick={() => exportLocal(false)}>
                  Print view
                </Button>
                <Button variant="gold" onClick={() => exportLocal(true)}>
                  Download
                </Button>
              </>
            )}
          </div>
        </section>

        {troyLens && mode.kind === "remote" && (
          troyLens.unavailable ? (
            <div className="no-print mt-6">
              <Alert tone="info" title="Sharing with other clubs is unavailable">{troyLens.unavailable}</Alert>
            </div>
          ) : (
            <PublishCard planId={mode.id} planVersion={mode.version} intake={doc.intake} dirty={save.kind !== "saved"} isSample={isSample} initialListing={troyLens.listing} onListingChange={(l) => setPublished(!!l)} />
          )
        )}

      </div>

      {/* Mobile: sticky Edit details / Save */}
      <div aria-hidden className="h-20 sm:hidden" />
      <div className="no-print fixed inset-x-0 bottom-0 z-30 flex flex-wrap gap-2.5 border-t border-line bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:hidden">
        {showPublish && publishButton("w-full")}
        <Button className="flex-1" onClick={() => setDrawer(true)}>
          Edit details
        </Button>
        {saveButton("flex-1", "primary")}
      </div>

      {/* Intake drawer */}
      {drawer && (
        <div className="no-print fixed inset-0 z-40 flex justify-end bg-ink/30" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}>
          <div ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="drawer-h" className="flex h-full w-full flex-col bg-paper shadow-2xl sm:max-w-xl">
            <div className="on-cardinal flex items-center justify-between border-b-4 border-gold bg-cardinal px-4 py-3 text-white">
              <h2 id="drawer-h" className="font-display text-xl font-bold">
                Event details
              </h2>
              <div className="flex gap-2">
                <Button size="sm" variant="gold" onClick={doSave} disabled={save.kind === "saving" || save.kind === "saved"}>
                  {save.kind === "saved" ? "Saved" : "Save"}
                </Button>
                <Button size="sm" variant="onCardinal" onClick={() => setDrawer(false)}>
                  Done
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              <details className="rounded-xl border border-line bg-card p-4">
                <summary className="cursor-pointer text-sm font-semibold">Fill from a description {aiEnabled ? "(AI)" : ""}</summary>
                <div className="mt-3">
                  <AiDescribe
                    aiEnabled={aiEnabled}
                    intake={doc.intake}
                    onApply={(fields, lines, qs, assumptions, source) => {
                      edit(
                        (d) => ({
                          ...d,
                          intake: { ...d.intake, ...fields },
                          budget: [...d.budget, ...lines],
                          questions: [...d.questions, ...qs.map((q) => ({ id: newId("q"), text: q.slice(0, 500), resolved: false, answer: "" }))],
                          assumptions: [...d.assumptions, ...assumptions.map((text) => ({ id: newId("a"), text: text.slice(0, 300), source }))].slice(0, 30),
                        }),
                        "Applied AI proposal",
                      );
                      setFormKey((k) => k + 1);
                    }}
                  />
                </div>
              </details>
              <IntakeForm key={formKey} intake={doc.intake} onChange={setIntake} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders the accumulated change summary using LIVE task state (no stale mid-typing values). */
function ChangeBanner({ change, plan, onDismiss }: { change: { causes: string[]; summary: ChangeSummary }; plan: ReturnType<typeof computePlan>; onDismiss: () => void }) {
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const recheck = change.summary.recheck.map((id) => byId.get(id)).filter((t) => t && t.status === "needs_recheck");
  const added = change.summary.added.map((id) => byId.get(id)).filter((t) => t && t.applicable);
  const removed = change.summary.removed.map((id) => byId.get(id)?.title ?? id.replace(/^(rule|sugg|q):/, "").replace(/-/g, " "));
  const moved = change.summary.moved.map((id) => byId.get(id)).filter((t) => t && t.applicable && t.targetDate);
  if (!recheck.length && !added.length && !removed.length && !moved.length) return null;
  return (
    <div className="mb-4 rounded-xl border-2 border-amber/50 bg-amber-wash p-4 sm:p-5" role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">What changed: {change.causes.join("; ")}</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {recheck.map((t) => (
              <li key={t!.id}>
                ⟳ <strong>Needs recheck</strong> — {t!.title}: {t!.recheckReasons.join("; ")}
              </li>
            ))}
            {added.map((t) => (
              <li key={t!.id}>＋ Now applies — {t!.title}</li>
            ))}
            {removed.map((r) => (
              <li key={r}>− No longer applies — {r}</li>
            ))}
            {moved.map((t) => (
              <li key={t!.id}>
                → Target moved — {t!.title}: {formatDate(t!.targetDate)} ({t!.targetLabel})
              </li>
            ))}
          </ul>
        </div>
        <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss change summary">
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function SaveIndicator({ save, updatedAt }: { save: SaveState; updatedAt: string }) {
  const t = new Date(updatedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const map = {
    saved: <span className="text-white/80">● Saved {t}</span>,
    dirty: <span className="font-bold text-gold">● Unsaved changes</span>,
    saving: <span className="text-white/80">● Saving…</span>,
    error: <span className="rounded bg-white px-1.5 font-bold text-cardinal">● Not saved</span>,
  } as const;
  return (
    <span aria-live="polite" className="font-medium">
      {map[save.kind]}
    </span>
  );
}

function describePatch(patch: Partial<Intake>): string {
  const names: Record<string, string> = {
    date: "Event date",
    startTime: "Start time",
    endTime: "End time",
    attendance: "Attendance",
    venueStatus: "Venue status",
    venueType: "Venue type",
    venueName: "Venue",
    recognition: "Recognition",
    food: "Food",
    outsideSpeakers: "Outside speakers",
    highProfileGuest: "High-profile guest",
    vendors: "Vendors",
    vendorStatus: "Vendor status",
    fundraising: "Fundraising",
    budgetTarget: "Budget target",
    fundingRequested: "Funding requested",
    fundingConfirmed: "Confirmed funding",
    eventType: "Event type",
    dateConfirmed: "Date confirmation",
    guestCount: "Outside guests",
    accessibility: "Accessibility needs",
    purpose: "Purpose",
    dateText: "Date wording",
  };
  const keys = Object.keys(patch).filter((k) => names[k]);
  return keys.length ? `${keys.map((k) => names[k]).join(", ")} edited` : "Details edited";
}
