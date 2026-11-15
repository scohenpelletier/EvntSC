import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, json, readJson, sameOrigin } from "@/lib/api";
import { AI_LIMITS, AiError, aiConfigured, extractIntake } from "@/lib/ai";
import { aiCaller } from "@/lib/ai/access";
import { rateLimit } from "@/lib/ai/rate-limit";
import { intakeProposalFrom } from "@/lib/ai/sanitize";
import { campusToday } from "@/lib/dates";

const body = z.object({ description: z.string().min(1).max(AI_LIMITS.maxInputChars) });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "Cross-origin request rejected");
  if (!aiConfigured()) return json({ error: "AI is not configured. Use the form to enter details manually.", code: "not_configured" }, 503);
  // Signed-in users are rate-limited per account; the local (non-production) demo per client address.
  const caller = await aiCaller(req);
  if ("error" in caller) return caller.error;
  if (!rateLimit(`intake:${caller.key}`)) return json({ error: "Too many AI requests. Wait a minute and retry.", code: "rate_limited" }, 429);

  let parsed;
  try {
    parsed = body.safeParse(await readJson(req, 20_000));
  } catch {
    return fail(400, "Invalid JSON");
  }
  if (!parsed.success) return fail(422, `Description must be 1–${AI_LIMITS.maxInputChars} characters.`);
  try {
    const ai = await extractIntake(parsed.data.description, campusToday());
    return json({ proposal: intakeProposalFrom(ai, parsed.data.description), source: "ai" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("upstream", "AI request failed.");
    return json({ error: err.message, code: err.code }, err.code === "rate_limited" ? 429 : 502);
  }
}
