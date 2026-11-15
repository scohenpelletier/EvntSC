import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/** Handles email verification and password-recovery links (PKCE code or token hash). */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  // Same-origin only: resolved like a browser would, so "//host" and "/\host" style tricks fall back to /plans.
  const next = safeNextPath(url.searchParams.get("next"));
  const supabase = await createClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  const dest = ok ? (type === "recovery" ? "/reset-password" : next) : "/sign-in?error=link";
  return NextResponse.redirect(new URL(dest, url.origin));
}
