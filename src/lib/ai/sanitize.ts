import { dateWordingNeedsConfirmation } from "../dates";
import { isKnownRuleId } from "../policy/registry";
import { newId, type BudgetLine, type Intake } from "../schema";

/**
 * Pure post-processing of model output. The model can only PROPOSE values;
 * these functions drop anything unsupported by the organizer's own text or
 * the registry before the UI shows it for review.
 */

type IntakeLike = {
  title: string | null;
  eventType: Intake["eventType"] | null;
  organizerName: string | null;
  organization: string | null;
  dateText: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  attendance: number | null;
  purpose?: string | null;
  guestCount?: number | null;
  accessibility?: Intake["accessibility"];
  accessibilityNotes?: string | null;
  assumptions?: string[];
  venueName: string | null;
  venueType: Intake["venueType"];
  venueStatus: Intake["venueStatus"];
  recognition: Intake["recognition"];
  food: Intake["food"];
  outsideSpeakers: Intake["outsideSpeakers"];
  vendors: Intake["vendors"];
  fundraising: Intake["fundraising"];
  budgetTarget: number | null;
  expenses: { description: string; category: BudgetLine["category"]; quantity: number | null; unitCost: number | null }[];
  openQuestions: string[];
};

export type IntakeProposal = {
  fields: Partial<Intake>;
  budget: BudgetLine[];
  questions: string[];
  /** Things the plan assumes because the description doesn't say; shown as assumptions, never facts. */
  assumptions: string[];
  /** Explanations of anything dropped or flagged — shown to the organizer. */
  notices: string[];
};

/** True when the number appears literally in the text (e.g. "45", "$45", "45.00"). */
function numberStated(text: string, n: number): boolean {
  const normalized = text.replace(/,/g, "");
  const variants = new Set([String(n), n.toFixed(2), Number.isInteger(n) ? `${n}.00` : String(n)]);
  return [...variants].some((v) => new RegExp(`(^|[^\\d.])${v.replace(".", "\\.")}(?![\\d])`).test(normalized));
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function intakeProposalFrom(ai: IntakeLike, description: string): IntakeProposal {
  const fields: Partial<Intake> = {};
  const notices: string[] = [];
  const s = (v: string | null) => (v && v.trim() ? v.trim() : null);

  if (s(ai.title)) fields.title = s(ai.title)!;
  if (ai.eventType) fields.eventType = ai.eventType;
  if (s(ai.organizerName)) fields.organizerName = s(ai.organizerName)!;
  if (s(ai.organization)) fields.organization = s(ai.organization)!;
  if (s(ai.purpose ?? null)) fields.purpose = s(ai.purpose ?? null)!.slice(0, 300);

  if (ai.date && DATE_RE.test(ai.date)) {
    fields.date = ai.date;
    const reason = dateWordingNeedsConfirmation(ai.dateText ?? "");
    fields.dateConfirmed = reason === null;
    if (reason) notices.push(`Date needs confirmation: ${reason} (“${(ai.dateText ?? "").slice(0, 80)}”)`);
  } else if (ai.dateText) {
    fields.dateText = ai.dateText.slice(0, 120);
    notices.push(`The description mentions timing (“${ai.dateText.slice(0, 80)}”) but not a specific day, so the date is left unknown.`);
  }
  if (ai.startTime && TIME_RE.test(ai.startTime)) fields.startTime = ai.startTime;
  if (ai.endTime && TIME_RE.test(ai.endTime)) fields.endTime = ai.endTime;

  if (ai.attendance !== null && ai.attendance > 0 && ai.attendance <= 100000) {
    if (numberStated(description, ai.attendance)) fields.attendance = ai.attendance;
    else notices.push("An attendance figure was proposed but isn't in your description — left unknown.");
  }
  if (ai.guestCount != null && ai.guestCount >= 0 && ai.guestCount <= 10000) {
    if (numberStated(description, ai.guestCount)) fields.guestCount = ai.guestCount;
    else notices.push("A guest count was proposed but isn't in your description, so it's left unknown.");
  }
  if (ai.accessibility) fields.accessibility = ai.accessibility;
  if (s(ai.accessibilityNotes ?? null)) fields.accessibilityNotes = s(ai.accessibilityNotes ?? null)!.slice(0, 1000);
  if (s(ai.venueName)) fields.venueName = s(ai.venueName)!;
  fields.venueType = ai.venueType;
  fields.venueStatus = ai.venueStatus;
  fields.recognition = ai.recognition;
  fields.food = ai.food;
  fields.outsideSpeakers = ai.outsideSpeakers;
  fields.vendors = ai.vendors;
  fields.fundraising = ai.fundraising;

  if (ai.budgetTarget !== null && ai.budgetTarget >= 0) {
    if (numberStated(description, ai.budgetTarget)) fields.budgetTarget = money(ai.budgetTarget);
    else notices.push("A budget target was proposed but isn't in your description — left blank.");
  }

  let droppedPrices = 0;
  const budget: BudgetLine[] = ai.expenses
    .filter((e) => e.description.trim())
    .map((e) => {
      const priceOk = e.unitCost !== null && e.unitCost >= 0 && numberStated(description, e.unitCost);
      if (e.unitCost !== null && !priceOk) droppedPrices++;
      const qty = e.quantity !== null && e.quantity > 0 && numberStated(description, e.quantity) ? money(e.quantity) : "1";
      return {
        id: newId("l"),
        description: e.description.trim().slice(0, 160),
        category: e.category,
        quantity: qty,
        unitCost: priceOk ? money(e.unitCost!) : "",
        costUnknown: !priceOk,
        costType: "estimate" as const,
        notes: "Proposed from description — review",
      };
    });
  if (droppedPrices) notices.push(`${droppedPrices} proposed price${droppedPrices > 1 ? "s were" : " was"} not in your description and left as unknown.`);

  const questions = ai.openQuestions.map((q) => q.trim()).filter(Boolean).slice(0, 10);
  const assumptions = (ai.assumptions ?? []).map((a) => a.trim().slice(0, 200)).filter(Boolean).slice(0, 6);
  return { fields, budget, questions, assumptions, notices };
}

type ChangeLike = {
  attendance: number | null;
  guestCount: number | null;
  budgetTarget: number | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  venueType: Intake["venueType"] | null;
  venueStatus: Intake["venueStatus"] | null;
  food: Intake["food"] | null;
  outsideSpeakers: Intake["outsideSpeakers"] | null;
  accessibility: Intake["accessibility"] | null;
  accessibilityNotes: string | null;
  explanation: string;
  unclear: string[];
};

/**
 * Turns a model's change interpretation into an intake patch. Numbers must
 * appear in the organizer's message; unchanged values are dropped.
 */
export function changePatchFrom(ai: ChangeLike, message: string, current: Intake): { patch: Partial<Intake>; notices: string[]; explanation: string; unclear: string[] } {
  const patch: Partial<Intake> = {};
  const notices: string[] = [];
  const stated = (n: number) => numberStated(message, n);
  // Counts may also be the current value plus or minus a number in the message ("3 more alumni"); code checks the sum.
  const messageNumbers = [...message.replace(/,/g, "").matchAll(/\d+/g)].map((m) => Number(m[0]));
  const countOk = (n: number, cur: number | null) => stated(n) || (cur !== null && messageNumbers.some((x) => x > 0 && (cur + x === n || cur - x === n)));
  if (ai.attendance !== null && ai.attendance > 0 && ai.attendance <= 100000 && ai.attendance !== current.attendance) {
    if (countOk(ai.attendance, current.attendance)) patch.attendance = ai.attendance;
    else notices.push("An attendance number was proposed that isn't in your message, so it was ignored.");
  }
  if (ai.guestCount !== null && ai.guestCount >= 0 && ai.guestCount <= 10000 && ai.guestCount !== current.guestCount) {
    if (countOk(ai.guestCount, current.guestCount)) patch.guestCount = ai.guestCount;
    else notices.push("A guest count was proposed that isn't in your message, so it was ignored.");
  }
  if (ai.budgetTarget !== null && ai.budgetTarget >= 0) {
    if (stated(ai.budgetTarget)) {
      const v = money(ai.budgetTarget);
      if (v !== current.budgetTarget) patch.budgetTarget = v;
    } else notices.push("A budget amount was proposed that isn't in your message, so it was ignored.");
  }
  if (ai.date && DATE_RE.test(ai.date) && ai.date !== current.date) {
    patch.date = ai.date;
    patch.dateConfirmed = false;
    notices.push("The new date needs your confirmation in Edit details.");
  }
  if (ai.startTime && TIME_RE.test(ai.startTime) && ai.startTime !== current.startTime) patch.startTime = ai.startTime;
  if (ai.endTime && TIME_RE.test(ai.endTime) && ai.endTime !== current.endTime) patch.endTime = ai.endTime;
  if (ai.venueName && ai.venueName.trim() && ai.venueName.trim() !== current.venueName) patch.venueName = ai.venueName.trim().slice(0, 160);
  for (const k of ["venueType", "venueStatus", "food", "outsideSpeakers", "accessibility"] as const) {
    const v = ai[k];
    if (v !== null && v !== current[k]) (patch as Record<string, unknown>)[k] = v;
  }
  if (patch.venueStatus === "confirmed") {
    delete patch.venueStatus;
    notices.push("EvntSC won't mark a venue confirmed from a message. Set it in Edit details once you have a confirmation.");
  }
  if (ai.accessibilityNotes && ai.accessibilityNotes.trim()) patch.accessibilityNotes = ai.accessibilityNotes.trim().slice(0, 1000);
  return { patch, notices, explanation: ai.explanation.trim().slice(0, 500), unclear: ai.unclear.map((u) => u.trim()).filter(Boolean).slice(0, 4) };
}

export type ReviewResult = {
  notes: { ruleId: string; text: string }[];
  questions: string[];
  rejectedIds: string[];
};

/** Keeps only registered rule IDs whose registered conditions currently apply. */
export function sanitizeReview(
  review: { relevantRuleIds: string[]; explanations: { ruleId: string; text: string }[]; questions: string[] },
  applicableRuleIds: Set<string>,
): ReviewResult {
  const rejected = new Set<string>();
  const ok = (id: string) => {
    const good = isKnownRuleId(id) && applicableRuleIds.has(id);
    if (!good) rejected.add(id);
    return good;
  };
  const chosen = new Set(review.relevantRuleIds.filter(ok));
  const notes = review.explanations
    .filter((e) => chosen.has(e.ruleId) || ok(e.ruleId))
    .map((e) => ({ ruleId: e.ruleId, text: e.text.trim().slice(0, 600) }))
    .filter((e) => e.text);
  const seen = new Set<string>();
  const dedup = notes.filter((n) => (seen.has(n.ruleId) ? false : (seen.add(n.ruleId), true)));
  return { notes: dedup, questions: review.questions.map((q) => q.trim()).filter(Boolean).slice(0, 8), rejectedIds: [...rejected] };
}
