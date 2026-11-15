import type { NextRequest } from "next/server";
import { authed, fail, json, readJson } from "@/lib/api";
import { getPlan, rowToDoc } from "@/lib/plans-repo";
import { cardFromIntake, listingColumns, publishBodySchema, troyLensEnabled } from "@/lib/troylens/card";
import { deleteListing, isMissingTable, upsertListing } from "@/lib/troylens/repo";

/**
 * Publish / update (PUT) or retract (DELETE) a plan's public event card.
 * The card's title, organizer, date, time and location are always taken from
 * the SAVED plan row on the server — never from the request body.
 */

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/plans/[id]/listing">) {
  if (!troyLensEnabled()) return fail(404, "Not found");
  const a = await authed(req, { mutating: true });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await readJson(req, 10_000);
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = publishBodySchema.safeParse(body);
  if (!parsed.success) return fail(422, "Card details failed validation");

  try {
    // RLS: another user's plan is invisible, so it looks the same as a missing one.
    const row = await getPlan(a.sb, id);
    if (!row) return fail(404, "Plan not found");
    if (row.version !== parsed.data.planVersion)
      return json({ error: "The saved plan changed since this page loaded. Reload, review the card, and publish again." }, 409);
    const doc = rowToDoc(row);
    if (!doc) return fail(422, "This plan's saved data could not be read.");
    const { fields, notes } = cardFromIntake(doc.intake);
    const blocker = notes.find((n) => n.level === "blocker");
    if (blocker) return fail(422, blocker.text);
    const listing = await upsertListing(a.sb, listingColumns(row.id, fields, parsed.data, row.is_sample, row.version));
    return json({ listing });
  } catch (e) {
    if (isMissingTable(e)) return fail(503, "Event cards aren't set up on this server yet (run supabase/migrations/0002_event_listings.sql).");
    return fail(500, "Publishing failed. Nothing was changed — try again.");
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/plans/[id]/listing">) {
  if (!troyLensEnabled()) return fail(404, "Not found");
  const a = await authed(req, { mutating: true });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  try {
    const ok = await deleteListing(a.sb, id);
    if (!ok) return fail(404, "No published card for this plan");
    return json({ retracted: true });
  } catch (e) {
    if (isMissingTable(e)) return fail(503, "Event cards aren't set up on this server yet.");
    return fail(500, "Retracting failed. Try again.");
  }
}
