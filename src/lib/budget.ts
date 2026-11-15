import type { BudgetLine, Intake } from "./schema";
import { formatCents, lineAmountCents, parseMoney, parseQuantity } from "./money";

export type LineResult = {
  id: string;
  /** Computed amount in cents; null when the cost is unknown or inputs are invalid. */
  amountCents: number | null;
  errors: string[];
  unknown: boolean;
};

export type BudgetFinding = {
  id: string;
  severity: "issue" | "warning" | "info";
  title: string;
  detail: string;
  /** Which inputs produced this finding — shown so it is never a black box. */
  basis: string;
};

/** A way to spend less, with the assumption it rests on stated plainly. */
export type SavingsIdea = { id: string; title: string; savesCents: number | null; assumption: string };

export type MoneyField = { cents: number | null; error: string | null; entered: boolean };

export type BudgetSummary = {
  lines: LineResult[];
  knownSubtotalCents: number;
  unknownCount: number;
  invalidCount: number;
  /** Only set when every line has a valid, known amount. */
  totalCents: number | null;
  complete: boolean;
  target: MoneyField;
  requested: MoneyField;
  confirmed: MoneyField;
  /** target − known subtotal (an upper bound when the budget is incomplete). */
  remainingCents: number | null;
  /** Amount known costs exceed the target by, if any. */
  overTargetCents: number | null;
  /** total − confirmed funding, when both are known. */
  uncoveredCents: number | null;
  /** Known amounts split by where the figure came from. */
  estimatedCents: number;
  quotedCents: number;
  savings: SavingsIdea[];
  findings: BudgetFinding[];
};

function moneyField(raw: string): MoneyField {
  const p = parseMoney(raw);
  if (p.kind === "empty") return { cents: null, error: null, entered: false };
  if (p.kind === "invalid") return { cents: null, error: p.reason, entered: true };
  return { cents: p.value, error: null, entered: true };
}

export function computeLine(line: BudgetLine): LineResult {
  const errors: string[] = [];
  const q = parseQuantity(line.quantity);
  if (q.kind === "empty") errors.push("Quantity is required");
  if (q.kind === "invalid") errors.push(q.reason);
  if (!line.description.trim()) errors.push("Description is required");

  if (line.costUnknown) {
    return { id: line.id, amountCents: null, errors, unknown: true };
  }
  const c = parseMoney(line.unitCost);
  if (c.kind === "empty") errors.push("Enter a unit cost or mark it unknown");
  if (c.kind === "invalid") errors.push(c.reason);
  if (errors.length || q.kind !== "ok" || c.kind !== "ok") {
    return { id: line.id, amountCents: null, errors, unknown: false };
  }
  return { id: line.id, amountCents: lineAmountCents(q.value, c.value), errors, unknown: false };
}

export function computeBudget(intake: Intake, budget: BudgetLine[]): BudgetSummary {
  const lines = budget.map(computeLine);
  const known = lines.filter((l) => l.amountCents !== null);
  const knownSubtotalCents = known.reduce((s, l) => s + (l.amountCents ?? 0), 0);
  const unknownCount = lines.filter((l) => l.unknown).length;
  const invalidCount = lines.filter((l) => l.errors.length > 0).length;
  const complete = lines.length > 0 && unknownCount === 0 && invalidCount === 0;
  const totalCents = complete ? knownSubtotalCents : null;

  const target = moneyField(intake.budgetTarget);
  const requested = moneyField(intake.fundingRequested);
  const confirmed = moneyField(intake.fundingConfirmed);

  const remainingCents = target.cents !== null ? target.cents - knownSubtotalCents : null;
  const overTargetCents =
    target.cents !== null && knownSubtotalCents > target.cents ? knownSubtotalCents - target.cents : null;
  const uncoveredCents =
    totalCents !== null && confirmed.cents !== null ? Math.max(0, totalCents - confirmed.cents) : null;

  const findings: BudgetFinding[] = [];
  const add = (f: BudgetFinding) => findings.push(f);

  for (const [label, field, key] of [
    ["Budget target", target, "budgetTarget"],
    ["Funding requested", requested, "fundingRequested"],
    ["Confirmed funding", confirmed, "fundingConfirmed"],
  ] as const) {
    if (field.error) {
      add({ id: `invalid-${key}`, severity: "issue", title: `${label} is not a valid amount`, detail: field.error, basis: `${label} field` });
    }
  }

  if (invalidCount > 0) {
    add({
      id: "invalid-lines",
      severity: "issue",
      title: `${invalidCount} expense line${invalidCount > 1 ? "s have" : " has"} invalid input`,
      detail: "Fix the highlighted quantity, cost, or description. Invalid lines are excluded from every total.",
      basis: "Expense line validation",
    });
  }

  if (overTargetCents !== null) {
    add({
      id: "over-target",
      severity: "issue",
      title: complete
        ? `Total costs exceed your target by ${formatCents(overTargetCents)}`
        : `Known costs already exceed your target by ${formatCents(overTargetCents)}`,
      detail: complete
        ? `Total ${formatCents(knownSubtotalCents)} vs. target ${formatCents(target.cents!)}.`
        : `Known subtotal ${formatCents(knownSubtotalCents)} vs. target ${formatCents(target.cents!)}, before ${unknownCount} unknown cost${unknownCount === 1 ? "" : "s"} are added.`,
      basis: "Known subtotal compared with your own budget target",
    });
  }

  if (unknownCount > 0) {
    add({
      id: "incomplete",
      severity: "warning",
      title: `${unknownCount} cost${unknownCount === 1 ? " is" : "s are"} still unknown`,
      detail: `Only a known subtotal of ${formatCents(knownSubtotalCents)} can be shown. No final total is calculated until every cost is entered.`,
      basis: "Lines marked “cost unknown”",
    });
  }

  const venueLines = budget.filter((b) => b.category === "venue");
  const venueUnknown = venueLines.some((b) => lines.find((l) => l.id === b.id)?.unknown);
  if (venueUnknown) {
    add({
      id: "venue-cost-unknown",
      severity: "warning",
      title: "Venue cost is still unknown",
      detail: "Ask the venue or Trojan Event Services whether your space has a fee before treating the budget as complete.",
      basis: "Venue expense line marked “cost unknown”",
    });
  } else if (venueLines.length === 0 && intake.venueStatus !== "confirmed") {
    add({
      id: "venue-cost-missing",
      severity: "info",
      title: "No venue cost line",
      detail: "If your space might carry a fee, add a venue line (mark the cost unknown if you don't have a figure).",
      basis: "No venue line and venue not confirmed",
    });
  }

  if (intake.food === "unknown") {
    add({ id: "food-unanswered", severity: "warning", title: "Food decision is unanswered", detail: "Decide whether food will be served; it affects costs and catering requirements.", basis: "Intake: food = unknown" });
  } else if (intake.food === "yes" && !budget.some((b) => b.category === "food")) {
    add({ id: "food-no-line", severity: "warning", title: "Food is planned but has no expense line", detail: "Add a food line (cost can be marked unknown).", basis: "Intake: food = yes, no food line" });
  }

  if (intake.vendors === "unknown" || (intake.vendors === "yes" && intake.vendorStatus === "unknown")) {
    add({ id: "vendor-unanswered", severity: "warning", title: "Vendor details are unanswered", detail: "Record whether you need a vendor and where that stands.", basis: "Intake: vendor fields unknown" });
  }

  if (intake.outsideSpeakers === "yes" && !budget.some((b) => b.category === "speaker")) {
    add({ id: "speaker-no-line", severity: "info", title: "Outside speaker has no cost line", detail: "If there is an honorarium, travel, or parking, add it. If the speaker is free, you can ignore this.", basis: "Intake: outside speakers = yes, no speaker line" });
  }

  if (requested.cents !== null && requested.cents > 0) {
    add({
      id: "requested-not-awarded",
      severity: "info",
      title: `${formatCents(requested.cents)} requested is not money awarded`,
      detail: "Requested funding is excluded from coverage calculations until it is externally confirmed.",
      basis: "Funding requested vs. confirmed funding fields",
    });
    const base = totalCents ?? knownSubtotalCents;
    if (lines.length > 0 && requested.cents > base && totalCents !== null) {
      add({ id: "requested-exceeds-costs", severity: "warning", title: "Request exceeds total costs", detail: `You requested ${formatCents(requested.cents)} but listed costs total ${formatCents(base)}.`, basis: "Funding requested vs. total" });
    }
  }

  if (confirmed.cents !== null && totalCents !== null && confirmed.cents > totalCents) {
    add({ id: "confirmed-exceeds-costs", severity: "info", title: "Confirmed funding exceeds total costs", detail: `Confirmed ${formatCents(confirmed.cents)} vs. total ${formatCents(totalCents)}. Double-check the confirmed amount.`, basis: "Confirmed funding vs. total" });
  }

  if (lines.length === 0) {
    add({ id: "no-lines", severity: "info", title: "No expense lines yet", detail: "Add expected costs to see a subtotal. A free event can stay empty.", basis: "Expense list is empty" });
  }

  if (!target.entered) {
    add({ id: "no-target", severity: "info", title: "No budget target set", detail: "Set your own spending target to check costs against it.", basis: "Budget target field is empty" });
  }

  // ---- Estimates vs. quotes ------------------------------------------------
  let estimatedCents = 0;
  let quotedCents = 0;
  for (const b of budget) {
    const r = lines.find((l) => l.id === b.id);
    if (r?.amountCents == null) continue;
    if (b.costType === "quote") quotedCents += r.amountCents;
    else estimatedCents += r.amountCents;
  }

  // ---- Food quantity vs. headcount -------------------------------------------
  const headcount = (intake.attendance ?? 0) + (intake.guestCount ?? 0);
  if (headcount > 0) {
    for (const b of budget) {
      if (b.category !== "food") continue;
      const q = parseQuantity(b.quantity);
      if (q.kind !== "ok" || q.value <= 100) continue; // a single "1 × catering order" line is fine
      const qty = q.value / 100;
      if (qty < headcount) {
        add({
          id: `food-qty-${b.id}`,
          severity: "warning",
          title: `“${b.description || "Food"}” covers ${qty} people, but you expect ${headcount}`,
          detail: "Your line was kept as entered. Update the quantity if the food order should grow with the headcount.",
          basis: "Food line quantity compared with attendance plus guests",
        });
      }
    }
  }

  // ---- Savings ideas (only when over target) ---------------------------------
  const savings: SavingsIdea[] = [];
  if (overTargetCents !== null) {
    const food = budget.filter((b) => b.category === "food");
    for (const b of food) {
      const q = parseQuantity(b.quantity);
      const c = parseMoney(b.unitCost);
      if (b.costUnknown || q.kind !== "ok" || c.kind !== "ok" || q.value < 1000) continue;
      const trimmed = Math.floor((q.value * 90) / 100 / 100) * 100; // 90% of the quantity, whole units
      const saves = lineAmountCents(q.value, c.value) - lineAmountCents(trimmed, c.value);
      if (saves > 0)
        savings.push({
          id: `trim-${b.id}`,
          title: `Order “${b.description || "food"}” for ${trimmed / 100} instead of ${q.value / 100}`,
          savesCents: saves,
          assumption: "Assumes about 10% of RSVPs don't attend. That is a planning assumption, not USC guidance; check your own past attendance.",
        });
    }
    const estimates = budget
      .map((b) => ({ b, r: lines.find((l) => l.id === b.id) }))
      .filter((x) => x.b.costType !== "quote" && x.r?.amountCents)
      .sort((x, y) => (y.r!.amountCents ?? 0) - (x.r!.amountCents ?? 0));
    if (estimates[0])
      savings.push({
        id: "quote-largest",
        title: `Get a written quote for “${estimates[0].b.description}”`,
        savesCents: null,
        assumption: `Assumes your ${formatCents(estimates[0].r!.amountCents!)} estimate may be higher than the actual price. A quote could also come in higher.`,
      });
    if (!requested.entered && !confirmed.entered)
      savings.push({
        id: "seek-funding",
        title: "Look into USG funding",
        savesCents: null,
        assumption: "Assumes your organization is eligible and the event is far enough away. USG applications are due six academic weeks before the event, and funding is not guaranteed.",
      });
  }

  return {
    lines,
    knownSubtotalCents,
    estimatedCents,
    quotedCents,
    savings,
    unknownCount,
    invalidCount,
    totalCents,
    complete,
    target,
    requested,
    confirmed,
    remainingCents,
    overTargetCents,
    uncoveredCents,
    findings,
  };
}
