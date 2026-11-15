import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, json, readJson, sameOrigin } from "@/lib/api";
import { AiError, aiConfigured, writeDraft } from "@/lib/ai";
import { aiCaller } from "@/lib/ai/access";
import { rateLimit } from "@/lib/ai/rate-limit";
import { draftFromTemplate, eventFacts, resourceById, scrubEmails } from "@/lib/outreach";
import { draftKinds, intakeSchema, LABELS } from "@/lib/schema";

const body = z.object({
  kind: z.enum(draftKinds),
  resourceId: z.string().max(80).nullable(),
  taskTitle: z.string().max(200).nullable(),
  intake: intakeSchema,
});

/**
 * AI tailors an outreach draft. The server builds the facts and the template
 * itself from validated intake data; the model's text is scrubbed of any email
 * address that isn't in the verified resource dataset.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "Cross-origin request rejected");
  if (!aiConfigured()) return json({ error: "AI is not configured.", code: "not_configured" }, 503);
  const caller = await aiCaller(req);
  if ("error" in caller) return caller.error;
  if (!rateLimit(`draft:${caller.key}`)) return json({ error: "Too many AI requests. Wait a minute and retry.", code: "rate_limited" }, 429);

  let parsed;
  try {
    parsed = body.safeParse(await readJson(req, 30_000));
  } catch {
    return fail(400, "Invalid JSON");
  }
  if (!parsed.success) return fail(422, "Draft request failed validation");
  const { kind, resourceId, taskTitle, intake } = parsed.data;
  const resource = resourceById(resourceId);
  const template = draftFromTemplate(kind, intake, resource);
  const f = eventFacts(intake);
  const facts = [
    `Event: ${f.title} (${LABELS.eventType[intake.eventType]}) by ${f.org}`,
    intake.purpose ? `Purpose: ${intake.purpose}` : "",
    `Date: ${f.date}; time: ${f.time}; venue: ${f.venue}`,
    `Students: ${f.attendance}; outside guests: ${intake.outsideSpeakers === "yes" ? f.guests : "none stated"}`,
    `Food: ${f.food}`,
    resource ? `Recipient: ${resource.name} — ${resource.role}` : "Recipient: [RECIPIENT]",
    taskTitle ? `Related task: ${taskTitle}` : "",
    `Sender: ${f.sender}`,
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const d = await writeDraft(LABELS.draftKind[kind], facts, `Subject: ${template.subject}\n\n${template.body}`);
    const allowed = resource?.email ? [resource.email] : [];
    return json({ to: template.to, subject: scrubEmails(d.subject, allowed).slice(0, 200), body: scrubEmails(d.body, allowed).slice(0, 6000), source: "ai" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("upstream", "AI request failed.");
    return json({ error: err.message, code: err.code }, err.code === "rate_limited" ? 429 : 502);
  }
}
