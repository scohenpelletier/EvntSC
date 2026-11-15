import { describe, expect, it, vi } from "vitest";
import { changePatchFrom, intakeProposalFrom } from "@/lib/ai/sanitize";
import { computeBudget } from "@/lib/budget";
import { explainChange, parseChangeRequest } from "@/lib/changes";
import { demoProposal, EXAMPLE_PROMPT } from "@/lib/demo-fixtures";
import { draftFromTemplate, placeholders, relevantResources, scrubEmails } from "@/lib/outreach";
import { computePlan, nextActions } from "@/lib/plan";
import { RESOURCES } from "@/lib/resources";
import { emptyDoc, emptyIntake, planDocSchema, type BudgetLine, type Intake, type PlanDoc } from "@/lib/schema";
import { completeTask, upsert } from "@/lib/tasks/reconcile";

vi.mock("server-only", () => ({}));

const TODAY = "2026-11-14";
const line = (over: Partial<BudgetLine>): BudgetLine => ({
  id: Math.random().toString(36).slice(2),
  description: "Item",
  category: "other",
  quantity: "1",
  unitCost: "0",
  costUnknown: false,
  costType: "estimate",
  notes: "",
  ...over,
});

/** The example networking night, as the demo fixture reads it, with a date set. */
function networkingDoc(over: Partial<Intake> = {}): PlanDoc {
  const p = demoProposal();
  return {
    ...emptyDoc(),
    intake: { ...emptyIntake(), ...p.fields, date: "2027-01-21", dateConfirmed: true, startTime: "18:00", endTime: "20:00", ...over },
    budget: p.budget,
  };
}

describe("incomplete prompts don't produce invented facts", () => {
  it("the demo reading of the example keeps vague timing and unknown prices unknown", () => {
    const p = demoProposal();
    expect(p.fields.date).toBeUndefined();
    expect(p.fields.dateText).toBe("next month");
    expect(p.fields.attendance).toBe(60);
    expect(p.fields.guestCount).toBe(5);
    expect(p.fields.budgetTarget).toBe("800");
    expect(p.fields.venueStatus).toBe("not_started");
    expect(p.budget[0].costUnknown).toBe(true);
    expect(p.budget[0].unitCost).toBe("");
  });

  it("drops counts and prices that aren't in the organizer's text", () => {
    const base = { ...demoProposalInput(), attendance: 75, guestCount: 12, budgetTarget: 950 };
    const p = intakeProposalFrom(base, EXAMPLE_PROMPT);
    expect(p.fields.attendance).toBeUndefined();
    expect(p.fields.guestCount).toBeUndefined();
    expect(p.fields.budgetTarget).toBeUndefined();
    expect(p.notices.length).toBeGreaterThanOrEqual(3);
  });
});

function demoProposalInput() {
  return {
    title: null,
    eventType: "networking" as const,
    organizerName: null,
    organization: null,
    dateText: "next month",
    date: null,
    startTime: null,
    endTime: null,
    attendance: null,
    venueName: null,
    venueType: "unknown" as const,
    venueStatus: "unknown" as const,
    recognition: "unknown" as const,
    food: "unknown" as const,
    outsideSpeakers: "unknown" as const,
    vendors: "unknown" as const,
    fundraising: "unknown" as const,
    budgetTarget: null,
    expenses: [],
    openQuestions: [],
  };
}

describe("budget", () => {
  it("never counts unknown costs as free and separates estimates from quotes", () => {
    const i = { ...emptyIntake(), budgetTarget: "800" };
    const b = computeBudget(i, [
      line({ category: "food", quantity: "65", unitCost: "9.50", costType: "quote" }),
      line({ category: "supplies", quantity: "1", unitCost: "40" }),
      line({ category: "venue", unitCost: "", costUnknown: true }),
    ]);
    expect(b.quotedCents).toBe(61750);
    expect(b.estimatedCents).toBe(4000);
    expect(b.knownSubtotalCents).toBe(65750);
    expect(b.totalCents).toBeNull();
    expect(b.unknownCount).toBe(1);
    expect(b.remainingCents).toBe(14250);
  });

  it("reports overage and states the assumption behind each savings idea", () => {
    const i = { ...emptyIntake(), budgetTarget: "500", attendance: 100 };
    const b = computeBudget(i, [line({ description: "Pizza", category: "food", quantity: "100", unitCost: "6" })]);
    expect(b.overTargetCents).toBe(10000);
    const trim = b.savings.find((s) => s.id.startsWith("trim-"))!;
    expect(trim.savesCents).toBe(6000);
    expect(trim.assumption).toMatch(/assum/i);
    expect(b.savings.every((s) => s.assumption.length > 10)).toBe(true);
  });

  it("flags a food line smaller than the headcount without changing it", () => {
    const lines = [line({ id: "f", description: "Boxed dinners", category: "food", quantity: "60", unitCost: "12" })];
    const b = computeBudget({ ...emptyIntake(), attendance: 100 }, lines);
    expect(b.findings.find((f) => f.id === "food-qty-f")?.title).toMatch(/covers 60 people, but you expect 100/);
    expect(lines[0].quantity).toBe("60");
  });
});

describe("networking plan", () => {
  it("groups relevant tasks by area, with honest designations and contacts", () => {
    const plan = computePlan(networkingDoc(), TODAY);
    const byId = new Map(plan.tasks.map((t) => [t.id, t]));
    expect(byId.get("rule:tes-catering")!.derived!.designation).toBe("requirement");
    expect(byId.get("sugg:catering-quote")!.derived!.designation).toBe("recommendation");
    expect(byId.get("sugg:catering-quote")!.title).toMatch(/65 people/);
    expect(byId.get("sugg:catering-quote")!.derived!.resourceIds).toContain("usc-hospitality-catering");
    expect(byId.get("sugg:guest-invite")!.title).toMatch(/5 outside guests/);
    expect(byId.get("rule:rso-space-request")!.derived!.designation).toBe("needs_confirmation"); // venue type unknown → may apply
    // Every recommendation's date is labelled as a suggestion, never a USC deadline.
    for (const t of plan.tasks.filter((t) => t.derived?.designation === "recommendation" && t.targetDate)) expect(t.targetLabel).toBe("Suggested (not a USC deadline)");
    expect(relevantResources(plan.tasks).map((r) => r.resource.id)).toEqual(expect.arrayContaining(["tes", "usc-hospitality-catering"]));
  });

  it("flags tasks whose lead time has passed and gives a next step", () => {
    const doc = networkingDoc({ date: "2026-11-24", fundingRequested: "300", recognition: "recognized" });
    const plan = computePlan(doc, TODAY);
    const invite = plan.tasks.find((t) => t.id === "sugg:guest-invite")!;
    expect(invite.derived!.lateNote).toMatch(/has passed.*10 days away/);
    expect(plan.tasks.find((t) => t.id === "rule:usg-application-deadline")!.derived!.lateNote).toMatch(/very likely too late/);
    expect(nextActions(plan.tasks)[0].derived?.lateNote ?? nextActions(plan.tasks)[0].status).toBeTruthy();
  });
});

describe("event changes", () => {
  it("parses the common phrasings", () => {
    const i = networkingDoc().intake;
    expect(parseChangeRequest("Attendance increased from 60 to 100.", i).patch).toEqual({ attendance: 100 });
    expect(parseChangeRequest("Our budget dropped to $500.", i).patch).toEqual({ budgetTarget: "500" });
    expect(parseChangeRequest("We're moving it outdoors.", i).patch.venueType).toBe("outdoor");
    const g = parseChangeRequest("We now have 8 outside guests", { ...i, outsideSpeakers: "no", guestCount: null }).patch;
    expect(g).toEqual({ outsideSpeakers: "yes", guestCount: 8 });
    expect(parseChangeRequest("please make it nicer", i).patch).toEqual({});
  });

  it("an attendance change preserves completed work, notes, and costs, and explains what to review", () => {
    let doc = networkingDoc();
    doc.budget = [line({ id: "food", description: "Catering", category: "food", quantity: "65", unitCost: "10", costType: "quote" })];
    const before = computePlan(doc, TODAY);
    const quote = before.tasks.find((t) => t.id === "sugg:catering-quote")!;
    doc = { ...doc, tasks: completeTask(doc.tasks, quote, TODAY) };
    doc = { ...doc, tasks: upsert(doc.tasks, "sugg:catering-quote", TODAY, (s) => ({ ...s, notes: "Quote from Catering2Go, ref 123" })) };
    doc = { ...doc, tasks: upsert(doc.tasks, "user:1", TODAY, (s) => ({ ...s, custom: { title: "Order lanyards", detail: "" } })) };

    const after = { ...doc, intake: { ...doc.intake, ...parseChangeRequest("Attendance increased from 60 to 100.", doc.intake).patch } };
    const entry = explainChange(doc, after, "Attendance increased from 60 to 100.", TODAY);
    const plan = computePlan(after, TODAY);
    const q = plan.tasks.find((t) => t.id === "sugg:catering-quote")!;

    expect(entry.fieldChanges).toContainEqual({ field: "Expected attendance", before: "60", after: "100" });
    expect(q.status).toBe("needs_recheck");
    expect(q.state?.notes).toBe("Quote from Catering2Go, ref 123");
    expect(entry.review.some((r) => /Request a catering quote/.test(r.title) && /attendance changed from 60 to 100/i.test(r.reason))).toBe(true);
    expect(after.budget).toEqual(doc.budget); // manual cost untouched
    expect(entry.budgetNotes.join(" ")).toMatch(/covers 65 people, but you expect 105/);
    expect(plan.tasks.find((t) => t.id === "user:1")?.title).toBe("Order lanyards");
  });

  it("moving outdoors adds weather and space tasks; a budget drop explains the gap", () => {
    const doc = networkingDoc({ venueType: "event_space" });
    doc.budget = [line({ category: "food", quantity: "65", unitCost: "10" })];
    const out = explainChange(doc, { ...doc, intake: { ...doc.intake, venueType: "outdoor" } }, "We're moving it outdoors.", TODAY);
    expect(out.added).toContain("Arrange an indoor backup for bad weather");
    const cut = explainChange(doc, { ...doc, intake: { ...doc.intake, budgetTarget: "500" } }, "Our budget dropped to $500.", TODAY);
    expect(cut.budgetNotes[0]).toMatch(/\$650\.00\) are now \$150\.00 over the \$500\.00 target/);
    expect(cut.added).toContain("Close the $150.00 gap to your budget");
  });

  it("AI change patches accept a count that is the current value plus a stated number, and nothing else", () => {
    const i = { ...networkingDoc().intake, guestCount: 5 };
    const ai = (guestCount: number) => ({
      attendance: null, guestCount, budgetTarget: null, date: null, startTime: null, endTime: null, venueName: null, venueType: null,
      venueStatus: null, food: null, outsideSpeakers: null, accessibility: null, accessibilityNotes: null, explanation: "", unclear: [],
    });
    expect(changePatchFrom(ai(8), "3 more alumni are coming", i).patch).toEqual({ guestCount: 8 });
    expect(changePatchFrom(ai(3), "two alumni dropped out", i).patch).toEqual({});
    expect(changePatchFrom(ai(9), "3 more alumni are coming", i).patch).toEqual({});
  });

  it("AI change patches can't invent numbers or confirm a venue", () => {
    const i = networkingDoc().intake;
    const r = changePatchFrom(
      {
        attendance: 140, guestCount: null, budgetTarget: null, date: null, startTime: null, endTime: null, venueName: null, venueType: null,
        venueStatus: "confirmed", food: null, outsideSpeakers: null, accessibility: null, accessibilityNotes: null, explanation: "x", unclear: [],
      },
      "a lot more people are coming",
      i,
    );
    expect(r.patch).toEqual({});
    expect(r.notices.join(" ")).toMatch(/isn't in your message/);
    expect(r.notices.join(" ")).toMatch(/won't mark a venue confirmed/);
  });
});

describe("outreach drafts", () => {
  it("fills known details and leaves placeholders for unknowns", () => {
    const i = { ...networkingDoc().intake, date: null, dateText: "next month", startTime: null, endTime: null };
    const d = draftFromTemplate("catering", i, RESOURCES["usc-hospitality-catering"]);
    expect(d.to).toBe("catering2go@usc.edu");
    expect(d.body).toMatch(/about 60 students plus 5 guests/);
    expect(placeholders(d.body)).toEqual(expect.arrayContaining(["[START AND END TIME]", "[DIETARY RESTRICTIONS]", "[EXACT DATE — currently “next month”]"]));
    expect(d.body).toMatch(/\[EXACT DATE — currently “next month”\]/);
  });

  it("never invents an email address for a contact without a verified one", () => {
    expect(draftFromTemplate("catering", emptyIntake(), RESOURCES["university-club"]).to).toMatch(/needs verification/);
    expect(scrubEmails("Write to events@universityclub.example or catering2go@usc.edu")).toBe("Write to [EMAIL — needs verification] or catering2go@usc.edu");
  });
});

describe("storage compatibility", () => {
  it("plans saved before this change still parse, with empty planner data", () => {
    const old = { intake: { ...emptyIntake(), purpose: undefined, guestCount: undefined }, budget: [{ ...line({}), costType: undefined }], tasks: [], questions: [], aiNotes: [] };
    const parsed = planDocSchema.parse(JSON.parse(JSON.stringify(old)));
    expect(parsed.drafts).toEqual([]);
    expect(parsed.changeLog).toEqual([]);
    expect(parsed.intake.accessibility).toBe("unknown");
    expect(parsed.budget[0].costType).toBe("estimate");
  });

  it("round-trips drafts and the change log through the intake column", async () => {
    const { rowToDoc } = await import("@/lib/plans-repo");
    const doc = networkingDoc();
    const entry = explainChange(doc, { ...doc, intake: { ...doc.intake, attendance: 100 } }, "Attendance is now 100", TODAY);
    const row = {
      id: "x", owner_id: "o", title: "t", is_sample: false, version: 1, created_at: "", updated_at: "",
      intake: { ...doc.intake, _workspace: { assumptions: [], drafts: [], changeLog: [entry] } },
      budget: doc.budget, tasks: [], questions: [], ai_notes: [],
    };
    const back = rowToDoc(row)!;
    expect(back.changeLog[0].request).toBe("Attendance is now 100");
    expect("_workspace" in back.intake).toBe(false);
  });
});
