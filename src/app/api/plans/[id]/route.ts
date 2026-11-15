import type { NextRequest } from "next/server";
import { z } from "zod";
import { authed, fail, json, readJson } from "@/lib/api";
import { deletePlan, getPlan, rowToDoc, savePlan } from "@/lib/plans-repo";
import { planDocSchema } from "@/lib/schema";
import { troyLensEnabled } from "@/lib/troylens/card";
import { syncListing } from "@/lib/troylens/repo";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/plans/[id]">) {
  const a = await authed(req, { mutating: false });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const row = await getPlan(a.sb, id);
  // RLS hides other users' rows, so "not yours" and "doesn't exist" look identical.
  if (!row) return fail(404, "Plan not found");
  return json({ id: row.id, version: row.version, updatedAt: row.updated_at, isSample: row.is_sample, doc: rowToDoc(row) });
}

const saveBody = z.object({ version: z.number().int().positive(), doc: planDocSchema });

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/plans/[id]">) {
  const a = await authed(req, { mutating: true });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = saveBody.safeParse(body);
  if (!parsed.success) return fail(422, "Plan data failed validation");
  try {
    const r = await savePlan(a.sb, id, parsed.data.version, parsed.data.doc);
    if (r.kind === "not_found") return fail(404, "Plan not found");
    if (r.kind === "conflict")
      return json({ error: "This plan was changed in another tab or device. Reload to see the latest version.", currentVersion: r.currentVersion }, 409);
    // A shared event follows its plan: a newly confirmed date or venue reaches Discover on save.
    // The plan is already saved, so a sync failure never fails the save.
    const listing = troyLensEnabled() ? await syncListing(a.sb, r.row.id, parsed.data.doc.intake, r.row.version).catch(() => undefined) : undefined;
    return json({ id: r.row.id, version: r.row.version, updatedAt: r.row.updated_at, ...(listing !== undefined && { listing }) });
  } catch {
    return fail(500, "Save failed. Your changes are still on this page — try again.");
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/plans/[id]">) {
  const a = await authed(req, { mutating: true });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const ok = await deletePlan(a.sb, id);
  if (!ok) return fail(404, "Plan not found");
  return json({ deleted: true });
}
