import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { emptyIntake, type Intake } from "@/lib/schema";
import { safeNextPath } from "@/lib/safe-redirect";
import { cardFromIntake } from "@/lib/troylens/card";

vi.mock("server-only", () => ({}));
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getUser: () => getUser(), createClient: vi.fn() }));

const req = { headers: new Headers({ "x-forwarded-for": "203.0.113.9" }) } as unknown as NextRequest;

describe("AI route access", () => {
  it("refuses anonymous calls in production when accounts aren't configured", async () => {
    const { aiCaller } = await import("@/lib/ai/access");
    const r = await aiCaller(req, { production: true, accounts: false });
    expect("error" in r && r.error?.status).toBe(503);
  });
  it("allows the local demo outside production, keyed by client address", async () => {
    const { aiCaller } = await import("@/lib/ai/access");
    expect(await aiCaller(req, { production: false, accounts: false })).toEqual({ key: "203.0.113.9" });
  });
  it("requires a signed-in user when accounts are configured", async () => {
    const { aiCaller } = await import("@/lib/ai/access");
    getUser.mockResolvedValueOnce(null);
    const r = await aiCaller(req, { production: true, accounts: true });
    expect("error" in r && r.error?.status).toBe(401);
    getUser.mockResolvedValueOnce({ id: "u1", email: null, interests: [] });
    expect(await aiCaller(req, { production: true, accounts: true })).toEqual({ key: "u1" });
  });
});

describe("auth callback redirect", () => {
  it.each(["/\\example.invalid/path", "//example.invalid", "/\t/example.invalid", "https://example.invalid", "/%5Cexample.invalid", "", null])(
    "rejects %j",
    (raw) => {
      const out = safeNextPath(raw);
      expect(new URL(out, "https://evntsc.test").origin).toBe("https://evntsc.test");
    },
  );
  it("rejects backslash and protocol-relative tricks outright", () => {
    expect(safeNextPath("/\\example.invalid/path")).toBe("/plans");
    expect(safeNextPath("//example.invalid")).toBe("/plans");
  });
  it("keeps genuine internal paths", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/plans/abc?tab=budget#x")).toBe("/plans/abc?tab=budget#x");
  });
});

describe("public card schedule validation", () => {
  const intake = (over: Partial<Intake>): Intake => ({
    ...emptyIntake(),
    title: "Fictional event",
    organization: "Fictional club",
    date: "2027-04-01",
    dateConfirmed: true,
    startTime: "18:00",
    endTime: "19:00",
    ...over,
  });
  const blockers = (i: Intake) => cardFromIntake(i).notes.filter((n) => n.level === "blocker");

  it("accepts a valid schedule", () => {
    expect(blockers(intake({}))).toEqual([]);
  });
  it("blocks an end time before the start time", () => {
    expect(blockers(intake({ startTime: "19:00", endTime: "18:00" }))[0].text).toMatch(/End time must be after start time/);
  });
  it("blocks a time that doesn't exist (spring forward)", () => {
    expect(blockers(intake({ date: "2027-03-14", startTime: "02:30", endTime: "04:00" }))[0].text).toMatch(/does not exist/);
  });
  it("blocks a fall-back time until an occurrence is chosen", () => {
    const i = intake({ date: "2027-11-07", startTime: "01:30", endTime: "03:00" });
    expect(blockers(i)[0].text).toMatch(/happens twice/);
    expect(blockers({ ...i, dstChoice: "earlier" })).toEqual([]);
  });
  it("doesn't validate times that won't be published (unconfirmed date)", () => {
    expect(blockers(intake({ dateConfirmed: false, startTime: "19:00", endTime: "18:00" }))).toEqual([]);
  });
});
