import type { NextRequest } from "next/server";
import { fail, json, readJson, sameOrigin } from "@/lib/api";
import { AiError, aiConfigured, reviewPlan } from "@/lib/ai";
import { aiCaller } from "@/lib/ai/access";
import { rateLimit } from "@/lib/ai/rate-limit";
import { sanitizeReview } from "@/lib/ai/sanitize";
import { campusToday } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { computePlan } from "@/lib/plan";
import { RULES } from "@/lib/policy/registry";
import { planDocSchema } from "@/lib/schema";

/**
 * AI proposes which registered rules matter and explains them. The server
 * re-evaluates the registry itself and keeps only IDs that are registered AND
 * currently applicable; passages and links always come from the registry.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "Cross-origin request rejected");
  if (!aiConfigured()) return json({ error: "AI is not configured. The deterministic checklist is unaffected.", code: "not_configured" }, 503);
  const caller = await aiCaller(req);
  if ("error" in caller) return caller.error;
  if (!rateLimit(`review:${caller.key}`)) {
    return json({ error: "Too many AI requests. Wait a minute and retry.", code: "rate_limited" }, 429);
  }
  let doc;
  try {
    const parsed = planDocSchema.safeParse((await readJson(req)) as unknown);
    if (!parsed.success) return fail(422, "Plan data failed validation");
    doc = parsed.data;
  } catch {
    return fail(400, "Invalid JSON");
  }
  const plan = computePlan(doc, campusToday());
  const applicable = new Set(plan.tasks.filter((t) => t.applicable && t.ruleId).map((t) => t.ruleId!));
  const i = doc.intake;
  const summary = [
    `Type: ${i.eventType}`,
    `Title: ${i.title}`,
    `Description: ${i.description}`,
    `Date: ${i.date ?? "unknown"} ${i.startTime ?? ""}-${i.endTime ?? ""}`,
    `Attendance: ${i.attendance ?? "unknown"}`,
    `Venue: ${i.venueName || "unknown"} (${i.venueType}, ${i.venueStatus})`,
    `Recognition: ${i.recognition}; Food: ${i.food}; Speakers: ${i.outsideSpeakers}; Vendors: ${i.vendors}; Fundraising: ${i.fundraising}`,
    `Known costs: ${formatCents(plan.budget.knownSubtotalCents)}; unknown costs: ${plan.budget.unknownCount}; target: ${i.budgetTarget || "none"}; requested: ${i.fundingRequested || "none"}`,
  ].join("\n");
  const rules = [...applicable].map((id) => ({ id, title: RULES[id].title, condition: RULES[id].conditionText }));
  if (!rules.length) return json({ notes: [], questions: [], rejectedIds: [], source: "ai", message: "No registered rules apply to the current plan." });
  try {
    const review = await reviewPlan(summary, rules);
    return json({ ...sanitizeReview(review, applicable), source: "ai" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("upstream", "AI request failed.");
    return json({ error: err.message, code: err.code }, err.code === "rate_limited" ? 429 : 502);
  }
}
