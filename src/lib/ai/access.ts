import "server-only";
import type { NextRequest } from "next/server";
import { fail } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";

/**
 * Who may call the AI routes. With accounts configured: signed-in users only.
 * Without accounts (local demo): allowed only outside production, so a
 * deployment that is missing its Supabase settings never makes anonymous provider calls.
 * Returns the rate-limit key, or an error response.
 */
export async function aiCaller(req: NextRequest, env: { production: boolean; accounts: boolean } = defaultEnv()) {
  if (env.accounts) {
    const user = await getUser();
    if (!user) return { error: fail(401, "Sign in required") } as const;
    return { key: user.id } as const;
  }
  if (env.production) return { error: fail(503, "AI requires accounts on this server. Configure Supabase (see /setup).") } as const;
  return { key: req.headers.get("x-forwarded-for") ?? "local" } as const;
}

function defaultEnv() {
  return { production: process.env.NODE_ENV === "production", accounts: isSupabaseConfigured() };
}
