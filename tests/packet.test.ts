import { describe, expect, it } from "vitest";
import { renderPacketHtml } from "@/lib/packet";
import { SAMPLES } from "@/lib/samples";
import { planDocSchema, type PlanDoc } from "@/lib/schema";

const meta = { savedAt: "2026-11-12 10:00", generatedAt: "2026-11-12 10:01", today: "2026-11-12", isSample: true, interactive: false };

describe("planning packet", () => {
  it("samples are valid plan documents", () => {
    for (const s of SAMPLES) expect(planDocSchema.safeParse(s.doc).success, s.key).toBe(true);
  });
  it("includes summary, budget, checklist, sources and questions", () => {
    const html = renderPacketHtml(SAMPLES[1].doc, meta);
    expect(html).toContain("Founder Speaker Night");
    expect(html).toContain("Known subtotal");
    expect(html).toContain("$630.00");
    expect(html).toContain("Not calculated");
    expect(html).toContain("Known costs already exceed your target by $30.00");
    expect(html).toContain("https://usg.usc.edu/branches/funding/");
    expect(html).toContain("Reviewed 2026-11-12");
    expect(html).toContain("Does the speaker need a parking pass?");
    expect(html).toContain("not an official application");
    expect(html).toContain("FICTIONAL SAMPLE");
  });
  it("escapes organizer and model text", () => {
    const doc: PlanDoc = JSON.parse(JSON.stringify(SAMPLES[0].doc));
    doc.intake.title = '<script>alert("x")</script>';
    doc.aiNotes = [{ ruleId: "tes-catering", text: "<img src=x onerror=alert(1)>", createdAt: "" }];
    const html = renderPacketHtml(doc, meta);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });
});
