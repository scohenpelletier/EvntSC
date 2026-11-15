import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, json, readJson, sameOrigin } from "@/lib/api";
import { AiError, aiConfigured, interpretChange } from "@/lib/ai";
import { aiCaller } from "@/lib/ai/access";
import { rateLimit } from "@/lib/ai/rate-limit";
import { changePatchFrom } from "@/lib/ai/sanitize";
import { campusToday } from "@/lib/dates";
import { intakeSchema } from "@/lib/schema";

const body = z.object({ message: z.string().min(3).max(1000), intake: intakeSchema });

/** AI reads a conversational change ("budget dropped to $500") into a proposed intake patch. Nothing is applied server-side. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "Cross-origin request rejected");
  if (!aiConfigured()) return json({ error: "AI is not configured.", code: "not_configured" }, 503);
  const caller = await aiCaller(req);
  if ("error" in caller) return caller.error;
  if (!rateLimit(`change:${caller.key}`)) return json({ error: "Too many AI requests. Wait a minute and retry.", code: "rate_limited" }, 429);

  let parsed;
  try {
    parsed = body.safeParse(await readJson(req, 30_000));
  } catch {
    return fail(400, "Invalid JSON");
  }
  if (!parsed.success) return fail(422, "Describe the change in 3–1,000 characters.");
  const { message, intake: i } = parsed.data;
  const current = [
    `Attendance: ${i.attendance ?? "unknown"}; outside guests: ${i.outsideSpeakers} (${i.guestCount ?? "count unknown"})`,
    `Date: ${i.date ?? (i.dateText || "unknown")} ${i.startTime ?? ""}-${i.endTime ?? ""}`,
    `Venue: ${i.venueName || "unknown"} (${i.venueType}, ${i.venueStatus})`,
    `Food: ${i.food}; accessibility: ${i.accessibility}; budget target: ${i.budgetTarget || "none"}`,
  ].join("\n");
  try {
    const ai = await interpretChange(message, current, campusToday());
    return json({ ...changePatchFrom(ai, message, i), source: "ai" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("upstream", "AI request failed.");
    return json({ error: err.message, code: err.code }, err.code === "rate_limited" ? 429 : 502);
  }
}
