import { describe, expect, it } from "vitest";
import { formatCents, lineAmountCents, parseMoney, parseQuantity } from "@/lib/money";
import { computeBudget } from "@/lib/budget";
import { emptyIntake, type BudgetLine } from "@/lib/schema";

let n = 0;
const line = (p: Partial<BudgetLine>): BudgetLine => ({
  id: `l${n++}`,
  description: "Item",
  category: "other",
  quantity: "1",
  unitCost: "0",
  costUnknown: false,
  costType: "estimate",
  notes: "",
  ...p,
});

describe("money parsing", () => {
  it("parses dollars and cents without floating point", () => {
    expect(parseMoney("0.1")).toEqual({ kind: "ok", value: 10 });
    expect(parseMoney("$1,234.56")).toEqual({ kind: "ok", value: 123456 });
    expect(parseMoney("19.99")).toEqual({ kind: "ok", value: 1999 });
    expect(parseMoney("")).toEqual({ kind: "empty" });
  });
  it("rejects negative and malformed amounts", () => {
    expect(parseMoney("-5").kind).toBe("invalid");
    expect(parseMoney("12.345").kind).toBe("invalid");
    expect(parseMoney("abc").kind).toBe("invalid");
    expect(parseMoney("1,23").kind).toBe("invalid");
  });
  it("requires positive quantities", () => {
    expect(parseQuantity("0").kind).toBe("invalid");
    expect(parseQuantity("-2").kind).toBe("invalid");
    expect(parseQuantity("2.5")).toEqual({ kind: "ok", value: 250 });
  });
  it("multiplies exactly and rounds half up once", () => {
    expect(lineAmountCents(300, 10)).toBe(30); // 3 × $0.10, no 0.30000000000000004
    expect(lineAmountCents(150, 333)).toBe(500); // 1.5 × $3.33 = $4.995 → $5.00
    expect(lineAmountCents(4000, 25)).toBe(1000);
    expect(formatCents(123456)).toBe("$1,234.56");
  });
});

describe("budget calculations", () => {
  it("computes a complete total and remaining budget", () => {
    const b = computeBudget({ ...emptyIntake(), budgetTarget: "150", food: "no", vendors: "no", venueStatus: "confirmed" }, [
      line({ quantity: "40", unitCost: "0.25" }),
      line({ quantity: "30", unitCost: "0.50" }),
      line({ quantity: "1", unitCost: "12.99" }),
    ]);
    expect(b.complete).toBe(true);
    expect(b.totalCents).toBe(1000 + 1500 + 1299);
    expect(b.remainingCents).toBe(15000 - 3799);
    expect(b.overTargetCents).toBeNull();
    expect(b.findings.find((f) => f.id === "over-target")).toBeUndefined();
  });

  it("shows only a known subtotal when a cost is unknown, and flags over-target", () => {
    const b = computeBudget({ ...emptyIntake(), budgetTarget: "600", food: "yes", fundingRequested: "400" }, [
      line({ category: "food", quantity: "6", unitCost: "45" }),
      line({ category: "speaker", quantity: "1", unitCost: "300" }),
      line({ category: "marketing", quantity: "4", unitCost: "15" }),
      line({ category: "venue", unitCost: "", costUnknown: true }),
    ]);
    expect(b.complete).toBe(false);
    expect(b.totalCents).toBeNull();
    expect(b.knownSubtotalCents).toBe(63000);
    expect(b.overTargetCents).toBe(3000);
    const ids = b.findings.map((f) => f.id);
    expect(ids).toContain("over-target");
    expect(ids).toContain("incomplete");
    expect(ids).toContain("venue-cost-unknown");
    expect(ids).toContain("requested-not-awarded");
    expect(b.findings.find((f) => f.id === "over-target")!.title).toMatch(/^Known costs already exceed/);
    expect(b.uncoveredCents).toBeNull();
  });

  it("excludes invalid lines from totals and reports them", () => {
    const b = computeBudget({ ...emptyIntake(), budgetTarget: "-3" }, [
      line({ quantity: "0", unitCost: "5" }),
      line({ quantity: "1", unitCost: "10" }),
    ]);
    expect(b.invalidCount).toBe(1);
    expect(b.knownSubtotalCents).toBe(1000);
    expect(b.totalCents).toBeNull();
    const ids = b.findings.map((f) => f.id);
    expect(ids).toContain("invalid-lines");
    expect(ids).toContain("invalid-budgetTarget");
  });

  it("computes the uncovered amount from confirmed funding only", () => {
    const b = computeBudget({ ...emptyIntake(), fundingRequested: "500", fundingConfirmed: "100" }, [
      line({ quantity: "1", unitCost: "250" }),
    ]);
    expect(b.uncoveredCents).toBe(15000);
  });
});
