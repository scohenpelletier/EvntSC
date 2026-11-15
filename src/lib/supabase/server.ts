import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parsePrefs, type Prefs } from "@/lib/prefs";
import type { InterestTag } from "@/lib/troylens/card";
import { parseTags } from "@/lib/troylens/rank";
import { supabaseEnv } from "./config";

/** A fresh, cookie-bound client per request. Queries run as the signed-in user, so RLS applies. */
export async function createClient() {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase is not configured");
  const store = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * `interests` are Discover topic tags and `prefs` are organizer preferences, both saved on the
 * account (Supabase user metadata) and validated on read.
 */
export type AuthedUser = { id: string; email: string | null; interests: InterestTag[]; prefs: Prefs };

/** Verifies the session with Supabase Auth (not just the cookie) and returns the user. */
export async function getUser(): Promise<AuthedUser | null> {
  if (!supabaseEnv()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const saved = data.user.user_metadata?.interests;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    interests: parseTags(Array.isArray(saved) ? saved.map(String) : undefined),
    prefs: parsePrefs(data.user.user_metadata),
  };
}

export async function requireUser(): Promise<AuthedUser> {
  if (!supabaseEnv()) redirect("/setup");
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user;
}
