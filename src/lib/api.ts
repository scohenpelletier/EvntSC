import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient, getUser, type AuthedUser } from "./supabase/server";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export const fail = (status: number, error: string) => json({ error }, status);

/** Blocks cross-site form/fetch submissions to mutating endpoints. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  return origin === req.nextUrl.origin;
}

export async function authed(req: NextRequest, { mutating }: { mutating: boolean }) {
  if (!isSupabaseConfigured()) return { error: fail(503, "Accounts are not configured on this server. See /setup.") } as const;
  if (mutating && !sameOrigin(req)) return { error: fail(403, "Cross-origin request rejected") } as const;
  const user = await getUser();
  if (!user) return { error: fail(401, "Sign in required") } as const;
  const sb = await createClient();
  return { user: user as AuthedUser, sb } as const;
}

export async function readJson(req: NextRequest, maxBytes = 600_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("Request too large");
  return JSON.parse(text);
}
