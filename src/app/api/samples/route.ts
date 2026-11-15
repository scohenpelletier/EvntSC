import type { NextRequest } from "next/server";
import { authed, fail, json } from "@/lib/api";
import { createPlan, deleteSamples } from "@/lib/plans-repo";
import { SAMPLES } from "@/lib/samples";

/** Adds the fictional sample plans to the signed-in account (flagged is_sample). */
export async function POST(req: NextRequest) {
  const a = await authed(req, { mutating: true });
  if ("error" in a) return a.error;
  try {
    await deleteSamples(a.sb);
    const ids: string[] = [];
    for (const s of SAMPLES) ids.push((await createPlan(a.sb, a.user.id, structuredClone(s.doc), true)).id);
    return json({ ids }, 201);
  } catch {
    return fail(500, "Could not load samples");
  }
}

/** Removes only sample plans. The organizer's own plans are never touched. */
export async function DELETE(req: NextRequest) {
  const a = await authed(req, { mutating: true });
  if ("error" in a) return a.error;
  return json({ deleted: await deleteSamples(a.sb) });
}
