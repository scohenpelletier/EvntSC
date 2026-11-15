import type { NextRequest } from "next/server";
import { z } from "zod";
import { authed, fail, json, readJson } from "@/lib/api";
import { TAG_IDS, troyLensEnabled } from "@/lib/troylens/card";

const bodySchema = z.object({ interests: z.array(z.enum(TAG_IDS)).max(TAG_IDS.length) });

/** Saves the signed-in user's Discover interests on their own account (user metadata). */
export async function PUT(req: NextRequest) {
  if (!troyLensEnabled()) return fail(404, "Not found");
  const a = await authed(req, { mutating: true });
  if ("error" in a) return a.error;
  let body: unknown;
  try {
    body = await readJson(req, 2_000);
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(422, "Unknown interest");
  const interests = TAG_IDS.filter((t) => parsed.data.interests.includes(t));
  const { error } = await a.sb.auth.updateUser({ data: { interests } });
  if (error) return fail(500, "Couldn't save your interests. Try again.");
  return json({ interests });
}
