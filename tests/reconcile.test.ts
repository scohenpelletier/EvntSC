import { describe, expect, it } from "vitest";
import { computePlan } from "@/lib/plan";
import { SAMPLES } from "@/lib/samples";
import { completeTask, diffTasks, upsert } from "@/lib/tasks/reconcile";
import type { PlanDoc } from "@/lib/schema";

const TODAY = "2026-11-12";
const clone = (d: PlanDoc): PlanDoc => JSON.parse(JSON.stringify(d));

describe("task preservation on revision", () => {
  it("a date change marks a completed date-dependent task Needs recheck and keeps notes", () => {
    const doc = clone(SAMPLES[2].doc);
    const before = computePlan(doc, TODAY);
    expect(before.tasks.find((t) => t.id === "sugg:promote")!.status).toBe("completed");

    doc.intake.date = "2027-02-24";
    const after = computePlan(doc, TODAY);
    const promote = after.tasks.find((t) => t.id === "sugg:promote")!;
    expect(promote.status).toBe("needs_recheck");
    expect(promote.recheckReasons[0]).toMatch(/Event date changed from 2027-02-17 to 2027-02-24/);
    expect(promote.state?.notes).toBe("Draft post written for Feb 3.");
    expect(promote.targetDate).toBe("2027-02-10");

    // The space request was made for the old date, so it needs rechecking too.
    const space = after.tasks.find((t) => t.id === "rule:rso-space-request")!;
    expect(space.status).toBe("needs_recheck");
    expect(space.recheckReasons).toContain("Event date changed from 2027-02-17 to 2027-02-24");

    const diff = diffTasks(before.tasks, after.tasks);
    expect(diff.recheck).toContain("sugg:promote");
    expect(diff.moved).toContain("sugg:room-check");
  });

  it("reverting the change clears the recheck", () => {
    const doc = clone(SAMPLES[2].doc);
    doc.intake.date = "2027-02-24";
    doc.intake.date = "2027-02-17";
    expect(computePlan(doc, TODAY).tasks.find((t) => t.id === "sugg:promote")!.status).toBe("completed");
  });

  it("keeps organizer target dates and notes when inputs change", () => {
    const doc = clone(SAMPLES[1].doc);
    doc.tasks = upsert(doc.tasks, "sugg:promote", TODAY, (s) => ({ ...s, notes: "Use the club newsletter", targetDate: "2027-02-20" }));
    doc.intake.date = "2027-03-17";
    const t = computePlan(doc, TODAY).tasks.find((x) => x.id === "sugg:promote")!;
    expect(t.targetDate).toBe("2027-02-20");
    expect(t.targetLabel).toBe("Organizer target");
    expect(t.state?.notes).toBe("Use the club newsletter");
  });

  it("a task that stops applying keeps its saved state as Not applicable", () => {
    const doc = clone(SAMPLES[1].doc);
    const plan = computePlan(doc, TODAY);
    doc.tasks = completeTask(doc.tasks, plan.tasks.find((t) => t.id === "rule:tes-catering")!, TODAY);
    doc.intake.food = "no";
    const t = computePlan(doc, TODAY).tasks.find((x) => x.id === "rule:tes-catering")!;
    expect(t.status).toBe("not_applicable");
    expect(t.title).toMatch(/caterer/);
  });

  it("a funding change marks the funding-dependent task for recheck", () => {
    const doc = clone(SAMPLES[1].doc);
    const plan = computePlan(doc, TODAY);
    doc.tasks = completeTask(doc.tasks, plan.tasks.find((t) => t.id === "rule:usg-event-cap")!, TODAY);
    doc.intake.fundingRequested = "550";
    const t = computePlan(doc, TODAY).tasks.find((x) => x.id === "rule:usg-event-cap")!;
    expect(t.status).toBe("needs_recheck");
    expect(t.recheckReasons[0]).toMatch(/Funding requested changed from 400 to 550/);
  });

  it("custom tasks survive any recomputation", () => {
    const doc = clone(SAMPLES[0].doc);
    doc.tasks = upsert(doc.tasks, "user:abc", TODAY, (s) => ({ ...s, custom: { title: "Book photographer", detail: "" } }));
    doc.intake.date = null;
    expect(computePlan(doc, TODAY).tasks.find((t) => t.id === "user:abc")?.title).toBe("Book photographer");
  });

  it("flags overdue organizer targets", () => {
    const doc = clone(SAMPLES[0].doc);
    doc.tasks = upsert(doc.tasks, "sugg:room-check", TODAY, (s) => ({ ...s, targetDate: "2026-11-01" }));
    expect(computePlan(doc, TODAY).tasks.find((t) => t.id === "sugg:room-check")!.overdue).toBe(true);
  });
});

describe("venue request rechecks", () => {
  const base = () => clone(SAMPLES[2].doc);
  const spaceStatus = (doc: PlanDoc) => computePlan(doc, TODAY).tasks.find((t) => t.id === "rule:rso-space-request")!;

  it("starts completed", () => {
    expect(spaceStatus(base()).status).toBe("completed");
  });

  it.each([
    ["start time", (d: PlanDoc) => (d.intake.startTime = "18:00"), /Start time changed/],
    ["end time", (d: PlanDoc) => (d.intake.endTime = "19:00"), /End time changed/],
    ["room name", (d: PlanDoc) => (d.intake.venueName = "Fictional Hall 2"), /Venue changed/],
  ])("flags Needs recheck when the %s changes", (_label, change, reason) => {
    const doc = base();
    change(doc);
    const t = spaceStatus(doc);
    expect(t.status).toBe("needs_recheck");
    expect(t.recheckReasons.some((r) => reason.test(r))).toBe(true);
  });

  it("doesn't flag tasks completed before a dependency was tracked (older snapshots)", () => {
    const doc = base();
    const st = doc.tasks.find((t) => t.id === "rule:rso-space-request")!;
    st.doneSnapshot = { venueStatus: "requested", venueType: "unknown", recognition: "unknown" };
    expect(spaceStatus(doc).status).toBe("completed");
  });
});
