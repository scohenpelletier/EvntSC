import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase session cookie on each request and marks account
 * pages/APIs as private so no shared cache stores them. Authorization itself
 * happens in route handlers/pages (getUser) and in Postgres RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = supabaseEnv();
  if (env) {
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet, headers) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    });
    await supabase.auth.getUser();
  }
  const p = request.nextUrl.pathname;
  if (p.startsWith("/plans") || p.startsWith("/api") || p.startsWith("/account")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
