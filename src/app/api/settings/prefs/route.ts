import type { NextRequest } from "next/server";
import { authed, fail, json, readJson } from "@/lib/api";
import { parsePrefs, prefsPatchSchema } from "@/lib/prefs";

/** Saves the signed-in user's organizer preferences on their own account (user metadata). */
export async function PUT(req: NextRequest) {
  const a = await authed(req, { mutating: true });
  if ("error" in a) return a.error;
  let body: unknown;
  try {
    body = await readJson(req, 2_000);
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = prefsPatchSchema.safeParse(body);
  if (!parsed.success) return fail(422, "Invalid settings");
  const { data, error } = await a.sb.auth.updateUser({ data: parsed.data });
  if (error || !data.user) return fail(500, "Couldn't save your settings. Try again.");
  return json({ prefs: parsePrefs(data.user.user_metadata) });
}
