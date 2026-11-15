import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, json, readJson, sameOrigin } from "@/lib/api";
import { AiError, aiConfigured, FLYER_MIME_TYPES, readFlyer } from "@/lib/ai";
import { aiCaller } from "@/lib/ai/access";
import { rateLimit } from "@/lib/ai/rate-limit";
import { intakeProposalFrom } from "@/lib/ai/sanitize";
import { campusToday } from "@/lib/dates";
import { sniffImage } from "@/lib/flyer";

const MAX_IMAGE_BYTES = 4_000_000;
const body = z.object({
  mimeType: z.enum(FLYER_MIME_TYPES),
  base64: z.string().min(100).max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

/** Reads an uploaded flyer image into an intake proposal the organizer reviews field by field. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "Cross-origin request rejected");
  if (!aiConfigured()) return json({ error: "AI is not configured. Fill in the form manually instead.", code: "not_configured" }, 503);
  const caller = await aiCaller(req);
  if ("error" in caller) return caller.error;
  if (!rateLimit(`flyer:${caller.key}`)) return json({ error: "Too many AI requests. Wait a minute and retry.", code: "rate_limited" }, 429);

  let parsed;
  try {
    parsed = body.safeParse(await readJson(req, 5_500_000));
  } catch {
    return fail(400, "The image is too large or the request was malformed. Use an image under 4 MB.");
  }
  if (!parsed.success) return fail(422, "Upload a JPEG, PNG, WebP or GIF image under 4 MB.");
  const bytes = Buffer.from(parsed.data.base64, "base64");
  // Trust the bytes, not the declared type.
  if (bytes.length > MAX_IMAGE_BYTES || sniffImage(bytes) !== parsed.data.mimeType) return fail(422, "That file doesn't look like a supported image.");

  try {
    const result = await readFlyer({ mimeType: parsed.data.mimeType, base64: parsed.data.base64 }, campusToday());
    if (!result) return json({ error: "We couldn't read event details from that image. Try a clearer photo, or fill in the form.", code: "unreadable" }, 422);
    const proposal = intakeProposalFrom(result.intake, result.transcript);
    proposal.notices.unshift("Read from a flyer image. Check every value against the flyer before applying.");
    return json({ transcript: result.transcript, proposal, source: "ai" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("upstream", "AI request failed.");
    return json({ error: err.message, code: err.code }, err.code === "rate_limited" ? 429 : 502);
  }
}
