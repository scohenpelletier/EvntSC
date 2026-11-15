import { describe, expect, it } from "vitest";
import { checkSchedule, dateWordingNeedsConfirmation, resolveWallTime } from "@/lib/dates";
import { computeBudget } from "@/lib/budget";
import { evaluate } from "@/lib/policy/engine";
import { RULES, SOURCES } from "@/lib/policy/registry";
import { emptyIntake, type Intake } from "@/lib/schema";

const ev = (p: Partial<Intake>) => {
  const intake = { ...emptyIntake(), ...p };
  return evaluate(intake, computeBudget(intake, []));
};

describe("timezone handling", () => {
  it("resolves normal LA wall times with the right offset", () => {
    const r = resolveWallTime("2027-02-24", "18:00");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.instant.toUTC().toISO()).toBe("2027-02-25T02:00:00.000Z");
  });
  it("rejects times in the spring-forward gap", () => {
    expect(resolveWallTime("2027-03-14", "02:30").kind).toBe("gap");
  });
  it("flags fall-back overlap times as ambiguous", () => {
    const r = resolveWallTime("2026-11-01", "01:30");
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") expect(r.later.toMillis() - r.earlier.toMillis()).toBe(3_600_000);
  });
  it("requires a DST choice before accepting an ambiguous time", () => {
    const base = { ...emptyIntake(), date: "2026-11-01", startTime: "01:30", endTime: "03:00" };
    expect(checkSchedule(base).needsConfirmation.length).toBe(1);
    expect(checkSchedule({ ...base, dstChoice: "later" }).needsConfirmation.length).toBe(0);
  });
  it("validates end after start", () => {
    expect(checkSchedule({ ...emptyIntake(), date: "2027-02-24", startTime: "18:00", endTime: "17:00" }).errors.length).toBe(1);
  });
  it("flags natural-language dates without a year or with relative wording", () => {
    expect(dateWordingNeedsConfirmation("March 4")).toMatch(/year/);
    expect(dateWordingNeedsConfirmation("next Tuesday, 2027")).toMatch(/relative/);
    expect(dateWordingNeedsConfirmation("March 4, 2027")).toBeNull();
  });
});

describe("registry integrity", () => {
  it("every rule points at a registered source; accessible sources carry passages", () => {
    for (const r of Object.values(RULES)) {
      const s = SOURCES[r.sourceId];
      expect(s, r.id).toBeDefined();
      expect(s.url).toMatch(/^https:\/\//);
      if (s.accessible) expect(r.passages.length, r.id).toBeGreaterThan(0);
      else expect(r.passages.length, r.id).toBe(0);
    }
  });
});

describe("rule evaluation", () => {
  it("never computes a calendar date for academic-week rules", () => {
    const t = ev({ date: "2027-03-10", fundingRequested: "400", recognition: "recognized" }).tasks.find(
      (x) => x.id === "rule:usg-application-deadline",
    )!;
    expect(t).toBeDefined();
    expect(t.target).toBeNull();
    expect(t.baseStatus).toBe("needs_confirmation");
    expect(t.deadlineNote).toMatch(/academic weeks/);
  });
  it("never computes the classroom Week 4 rule", () => {
    const t = ev({ date: "2027-03-10", venueType: "classroom", venueStatus: "not_started" }).tasks.find(
      (x) => x.id === "rule:rso-classroom-week4",
    )!;
    expect(t.target).toBeNull();
    expect(t.baseStatus).toBe("needs_confirmation");
  });
  it("computes the fundraising two-week (calendar) date only when the date is known", () => {
    const withDate = ev({ date: "2027-03-10", fundraising: "yes" }).tasks.find((x) => x.id === "rule:rso-fundraising-uepa")!;
    expect(withDate.target).toEqual(expect.objectContaining({ date: "2027-02-24", kind: "official_computed" }));
    const noDate = ev({ fundraising: "yes" }).tasks.find((x) => x.id === "rule:rso-fundraising-uepa")!;
    expect(noDate.target).toBeNull();
    expect(noDate.baseStatus).toBe("needs_confirmation");
  });
  it("keeps unknown conditions as questions instead of passing them", () => {
    const e = ev({ food: "unknown", fundraising: "unknown" });
    expect(e.tasks.find((t) => t.id === "q:food")?.baseStatus).toBe("missing_info");
    expect(e.tasks.find((t) => t.id === "q:fundraising")).toBeDefined();
    expect(e.tasks.find((t) => t.id === "rule:tes-catering")).toBeUndefined();
  });
  it("unknown recognition makes eligibility need confirmation", () => {
    const t = ev({ fundingRequested: "100", recognition: "unknown" }).tasks.find((x) => x.id === "rule:usg-applicant-eligibility")!;
    expect(t.baseStatus).toBe("needs_confirmation");
  });
  it("flags requests above the cited $8,000 yearly limit", () => {
    expect(ev({ fundingRequested: "9000" }).tasks.find((x) => x.id === "rule:usg-event-cap")!.title).toMatch(/above/);
  });
  it("marks unsupported event types as a scope limitation", () => {
    expect(ev({ eventType: "other" }).scopeWarning).toMatch(/For other event types/);
  });
  it("labels suggestion dates as non-official offsets", () => {
    const t = ev({ date: "2027-03-10" }).tasks.find((x) => x.id === "sugg:promote")!;
    expect(t.target?.kind).toBe("suggested_offset");
    expect(t.target?.explanation).toMatch(/Not a USC deadline/);
    expect(t.target?.date).toBe("2027-02-24");
  });
  it("every requirement task references a registered rule", () => {
    const e = ev({
      date: "2027-03-10",
      fundingRequested: "100",
      food: "yes",
      fundraising: "yes",
      outsideSpeakers: "yes",
      highProfileGuest: "yes",
      venueType: "unknown",
      venueStatus: "not_started",
    });
    for (const t of e.tasks.filter((x) => x.type === "requirement")) expect(RULES[t.ruleId!], t.id).toBeDefined();
  });
});
