import { formatCents } from "./money";
import { computePlan } from "./plan";
import { DEP_LABELS } from "./policy/engine";
import { LABELS, newId, type ChangeEntry, type Intake, type PlanDoc } from "./schema";
import { diffTasks } from "./tasks/reconcile";

/**
 * Conversational event updates. The built-in parser handles common phrasings
 * deterministically; AI (when configured) can propose a patch for anything
 * else. Either way the result is only a PROPOSED intake patch: the organizer
 * previews it, and applying it goes through the same recompute as the form, so
 * completed tasks, notes, and budget lines are never replaced.
 */

export type ChangeProposal = { patch: Partial<Intake>; understood: string[] };

const num = (s: string) => Number(s.replace(/,/g, ""));

export function parseChangeRequest(text: string, intake: Intake): ChangeProposal {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  const patch: Partial<Intake> = {};
  const understood: string[] = [];

  // Attendance: "attendance increased from 60 to 100", "now 100 students", "expecting 120 people"
  const att =
    /(?:attendance|headcount|rsvps?|turnout|students|people|attendees)[^.\d$]{0,40}?(?:from \d[\d,]* )?(?:to|is now|now|of|at|about|around) (\d[\d,]*)/.exec(t) ??
    /(?:now|expecting|expect|have) (?:about |around |roughly )?(\d[\d,]*) (?:students|people|attendees)/.exec(t);
  if (att) {
    const n = num(att[1]);
    if (Number.isInteger(n) && n > 0 && n <= 100000 && n !== intake.attendance) {
      patch.attendance = n;
      understood.push(`Attendance → ${n}`);
    }
  }

  // Budget: "budget dropped to $500", "our budget is now 650"
  const bud = /budget[^.\d$]{0,30}?(?:from \$?\d[\d,]*(?:\.\d{1,2})? )?(?:to|is now|now|is|of) \$?(\d[\d,]*(?:\.\d{1,2})?)/.exec(t);
  if (bud) {
    const v = bud[1].replace(/,/g, "");
    if (v !== intake.budgetTarget.replace(/^\$/, "")) {
      patch.budgetTarget = v;
      understood.push(`Budget target → $${v}`);
    }
  }

  // Outdoors
  if (/\b(outdoors?|outside venue|move(?:d|ing)? (?:it )?outside|lawn|courtyard)\b/.test(t) && !/\bno longer outdoor/.test(t) && intake.venueType !== "outdoor") {
    patch.venueType = "outdoor";
    understood.push("Venue type → outdoor");
    if (intake.venueStatus === "confirmed" || intake.venueStatus === "requested") {
      patch.venueStatus = "not_started";
      understood.push("Venue status → not requested yet (the earlier booking was for a different space)");
    }
  }

  // Outside guests: "we now have outside guests", "5 alumni are coming", "no outside guests anymore"
  const noGuests = /\bno (?:outside |external )?(?:guests|alumni|speakers)\b|\b(?:guests|alumni|speakers) (?:are|is) (?:no longer|not) coming\b/.test(t);
  const guestCount = /(\d[\d,]*) (?:outside |external )?(?:alumni|guests|speakers|employers|recruiters|panelists)/.exec(t);
  if (noGuests) {
    if (intake.outsideSpeakers !== "no") {
      patch.outsideSpeakers = "no";
      patch.guestCount = null;
      understood.push("Outside guests → no");
    }
  } else if (guestCount || /\b(?:outside|external) (?:guests|speakers)\b|\b(?:alumni|guests|speakers|panelists) (?:are|will be) (?:coming|joining|attending)\b|\bnow have (?:outside )?(?:guests|alumni|speakers)/.test(t)) {
    if (intake.outsideSpeakers !== "yes") {
      patch.outsideSpeakers = "yes";
      understood.push("Outside guests → yes");
    }
    if (guestCount) {
      const n = num(guestCount[1]);
      if (Number.isInteger(n) && n >= 0 && n <= 10000 && n !== intake.guestCount) {
        patch.guestCount = n;
        understood.push(`Outside guests → ${n}`);
      }
    }
  }

  // Food
  if (/\bno (?:more )?food\b|\bnot serving food\b|\bdropp(?:ed|ing) (?:the )?food\b|\bwithout food\b/.test(t)) {
    if (intake.food !== "no") {
      patch.food = "no";
      understood.push("Food → no");
    }
  } else if (/\b(?:add(?:ing)?|serv(?:e|ing)|want|order(?:ing)?|provid(?:e|ing)|with) (?:some )?(?:food|catering|pizza|snacks|refreshments|dinner|lunch)\b/.test(t)) {
    if (intake.food !== "yes") {
      patch.food = "yes";
      understood.push("Food → yes");
    }
  }

  // Accessibility
  if (/\b(wheelchair|accessib|asl|interpreter|captioning|mobility|step-free)/.test(t) && intake.accessibility !== "yes") {
    patch.accessibility = "yes";
    patch.accessibilityNotes = [intake.accessibilityNotes.trim(), text.trim().slice(0, 300)].filter(Boolean).join(" · ").slice(0, 1000);
    understood.push("Accessibility needs → yes");
  }

  return { patch, understood };
}

const FIELD_NAMES: Record<string, string> = {
  ...DEP_LABELS,
  title: "Title",
  purpose: "Purpose",
  dateText: "Date wording",
  budgetTarget: "Budget target",
  fundingConfirmed: "Confirmed funding",
  dateConfirmed: "Date confirmed",
};

function show(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "not set";
  if (key === "budgetTarget" || key === "fundingRequested" || key === "fundingConfirmed") return `$${String(v).replace(/^\$/, "")}`;
  const maps = LABELS as unknown as Record<string, Record<string, string>>;
  const map = ["food", "outsideSpeakers", "vendors", "fundraising", "accessibility", "highProfileGuest"].includes(key) ? maps.tri : maps[key];
  return (map?.[String(v)] ?? String(v)).slice(0, 200);
}

/**
 * Builds the persisted explanation for a change: what fields changed, which
 * tasks were added, which existing tasks need review (and why), what no longer
 * applies, and budget effects. Everything here is computed by code.
 */
export function explainChange(before: PlanDoc, after: PlanDoc, request: string, today: string, aiExplanation: string | null = null): ChangeEntry {
  const pb = computePlan(before, today);
  const pa = computePlan(after, today);
  const diff = diffTasks(pb.tasks, pa.tasks);
  const byId = new Map(pa.tasks.map((t) => [t.id, t]));
  const beforeById = new Map(pb.tasks.map((t) => [t.id, t]));

  const fieldChanges = (Object.keys(after.intake) as (keyof Intake)[])
    .filter((k) => k !== "description" && k !== "notes" && JSON.stringify(before.intake[k]) !== JSON.stringify(after.intake[k]))
    .map((k) => ({ field: FIELD_NAMES[k] ?? k, before: show(k, before.intake[k]), after: show(k, after.intake[k]) }));

  // Tasks that need review: completed tasks now flagged for recheck, plus open tasks whose wording changed (e.g. a new headcount).
  const review: ChangeEntry["review"] = [];
  for (const id of diff.recheck) {
    const t = byId.get(id);
    if (t) review.push({ title: t.title, reason: `Completed earlier, but ${t.recheckReasons.join("; ").replace(/^./, (c) => c.toLowerCase())}.` });
  }
  for (const t of pa.tasks) {
    const prev = beforeById.get(t.id);
    if (!prev || !t.applicable || !prev.applicable || diff.recheck.includes(t.id) || t.status === "completed") continue;
    if (prev.title !== t.title) review.push({ title: t.title, reason: `Updated from “${prev.title}”.` });
    else if (prev.derived?.designation !== t.derived?.designation && t.derived) review.push({ title: t.title, reason: `Now marked ${t.derived.designation.replace("_", " ")}.` });
  }

  const budgetNotes: string[] = [];
  const ob = pb.budget;
  const nb = pa.budget;
  if (ob.target.cents !== nb.target.cents && nb.target.cents !== null) {
    budgetNotes.push(
      nb.remainingCents !== null && nb.remainingCents < 0
        ? `Known costs (${formatCents(nb.knownSubtotalCents)}) are now ${formatCents(-nb.remainingCents)} over the ${formatCents(nb.target.cents)} target.`
        : `Known costs leave ${formatCents(nb.remainingCents ?? 0)} of the ${formatCents(nb.target.cents)} target${nb.unknownCount ? `, before ${nb.unknownCount} unknown cost${nb.unknownCount === 1 ? "" : "s"}` : ""}.`,
    );
  }
  const oldF = new Set(ob.findings.map((f) => f.id));
  for (const f of nb.findings) if (!oldF.has(f.id) && f.severity !== "info" && f.id !== "over-target") budgetNotes.push(f.title);
  if (budgetNotes.length === 0 && after.budget.length && JSON.stringify(before.budget) === JSON.stringify(after.budget) && fieldChanges.length)
    budgetNotes.push("Your expense lines were kept exactly as entered.");

  return {
    id: newId("chg"),
    at: new Date().toISOString(),
    request: request.slice(0, 500),
    fieldChanges: fieldChanges.slice(0, 30),
    added: diff.added.map((id) => byId.get(id)?.title ?? id).slice(0, 50),
    review: review.slice(0, 50),
    removed: diff.removed.map((id) => beforeById.get(id)?.title ?? id).slice(0, 50),
    budgetNotes: budgetNotes.map((n) => n.slice(0, 300)).slice(0, 20),
    aiExplanation: aiExplanation ? aiExplanation.slice(0, 1000) : null,
  };
}
