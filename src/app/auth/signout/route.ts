import type { NextRequest } from "next/server";
import { json, sameOrigin, fail } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "Cross-origin request rejected");
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    // supabase-js already treats "session not found / expired" as signed out; any error left means the session may still be live.
    const { error } = await supabase.auth.signOut();
    if (error) return fail(502, "Couldn't sign you out. Check your connection and try again.");
  }
  return json({ signedOut: true });
}
