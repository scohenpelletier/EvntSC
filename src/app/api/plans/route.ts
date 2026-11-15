import type { NextRequest } from "next/server";
import { z } from "zod";
import { authed, fail, json, readJson } from "@/lib/api";
import { createPlan, listPlans } from "@/lib/plans-repo";
import { planDocSchema } from "@/lib/schema";

export async function GET(req: NextRequest) {
  const a = await authed(req, { mutating: false });
  if ("error" in a) return a.error;
  return json({ plans: await listPlans(a.sb) });
}

const createBody = z.object({ doc: planDocSchema });

export async function POST(req: NextRequest) {
  const a = await authed(req, { mutating: true });
  if ("error" in a) return a.error;
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = createBody.safeParse(body);
  if (!parsed.success) return fail(422, "Plan data failed validation");
  try {
    const row = await createPlan(a.sb, a.user.id, parsed.data.doc, false);
    return json({ id: row.id, version: row.version, updatedAt: row.updated_at }, 201);
  } catch {
    return fail(500, "Could not create the plan. Try again.");
  }
}
