/**
 * Two-account authorization check against a real Supabase project.
 *
 *   npm run check:authz
 *
 * Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * (or ANON_KEY), and SUPABASE_SERVICE_ROLE_KEY (used ONLY here, to create two
 * pre-confirmed throwaway test users and delete them afterwards).
 *
 * Optional: APP_URL=http://localhost:3000 also checks the app's own API routes
 * (the dev server must be running).
 *
 * Verifies that user B cannot select, update, delete, or export user A's plan
 * by ID, and that anonymous requests see nothing. If the TroyLens table exists
 * (migration 0002), also checks that only the plan owner can publish, edit or
 * retract its public card, that anyone can read cards, and that cards carry no
 * owner or private plan data.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { emptyDoc } from "../src/lib/schema";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL;

if (!URL_ || !ANON || !SERVICE) {
  console.error("BLOCKED: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(2);
}

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

async function main() {
  const admin = createClient(URL_!, SERVICE!, { auth: { persistSession: false } });
  const stamp = Date.now();
  const pw = `T3st-${stamp}-${Math.random().toString(36).slice(2)}`;
  const emails = [`evntsc-authz-a-${stamp}@example.test`, `evntsc-authz-b-${stamp}@example.test`];
  const ids: string[] = [];
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
    if (error) throw error;
    ids.push(data.user.id);
  }
  const signIn = async (email: string) => {
    const c = createClient(URL_!, ANON!, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;
    return { c, session: data.session! };
  };
  try {
    const A = await signIn(emails[0]);
    const B = await signIn(emails[1]);
    const doc = emptyDoc();
    doc.intake.title = "Authz test plan (A)";

    const { data: created, error: cErr } = await A.c.from("event_plans").insert({ title: doc.intake.title, intake: doc.intake, owner_id: ids[0] }).select("*").single();
    check("A can create own plan", !cErr && !!created, cErr?.message);
    const planId = created!.id as string;

    const { data: aRead } = await A.c.from("event_plans").select("id").eq("id", planId);
    check("A can read own plan", aRead?.length === 1);

    const { data: bRead } = await B.c.from("event_plans").select("*").eq("id", planId);
    check("B cannot read A's plan by ID", (bRead ?? []).length === 0);

    const { data: bUpd } = await B.c.from("event_plans").update({ title: "hijacked" }).eq("id", planId).select("id");
    check("B cannot update A's plan", (bUpd ?? []).length === 0);

    const { data: bDel } = await B.c.from("event_plans").delete().eq("id", planId).select("id");
    check("B cannot delete A's plan", (bDel ?? []).length === 0);

    const { error: spoofErr } = await B.c.from("event_plans").insert({ title: "spoof", intake: doc.intake, owner_id: ids[0] });
    check("B cannot insert a plan owned by A", !!spoofErr, spoofErr?.message);

    const { error: moveErr } = await A.c.from("event_plans").update({ owner_id: ids[1] }).eq("id", planId);
    check("A cannot reassign ownership to B", !!moveErr, moveErr?.message);

    const anon = createClient(URL_!, ANON!, { auth: { persistSession: false } });
    const { data: anonRead } = await anon.from("event_plans").select("id").eq("id", planId);
    check("Anonymous cannot read plans", (anonRead ?? []).length === 0);

    const { data: still } = await A.c.from("event_plans").select("title").eq("id", planId).single();
    check("A's plan is intact after B's attempts", still?.title === doc.intake.title);

    const listings = await listingChecks(planId, A.c, B.c, anon);

    if (APP) await appRouteChecks(planId, B.session, A.session, listings);
    else console.log("SKIP  App route checks (set APP_URL=http://localhost:3000 with the dev server running)");

    await A.c.from("event_plans").delete().eq("id", planId);
    if (listings) {
      const { data: gone } = await anon.from("event_listings").select("id").eq("id", planId);
      check("Deleting the plan removes its public card", (gone ?? []).length === 0);
    }
  } finally {
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll authorization checks passed");
  process.exit(failures ? 1 : 0);
}

/** TroyLens listing policies. Returns false (and skips) when migration 0002 hasn't been run. */
async function listingChecks(planId: string, A: SupabaseClient, B: SupabaseClient, anon: SupabaseClient): Promise<boolean> {
  const probe = await anon.from("event_listings").select("id").limit(1);
  if (probe.error) {
    console.log("SKIP  TroyLens listing checks (event_listings not found — run supabase/migrations/0002_event_listings.sql)");
    return false;
  }
  const card = { id: planId, title: "Authz test card", location_status: "tba", tags: ["tech"], plan_version: 1 };

  const { error: bIns } = await B.from("event_listings").insert({ ...card, title: "B hijack" });
  check("B cannot publish a card for A's plan", !!bIns, bIns?.message);
  const { error: anonIns } = await anon.from("event_listings").insert(card);
  check("Anonymous cannot publish a card", !!anonIns, anonIns?.message);
  const { error: badTag } = await A.from("event_listings").insert({ ...card, tags: ["not-a-tag"] });
  check("Database rejects unknown tags", !!badTag, badTag?.message);

  const { error: aIns } = await A.from("event_listings").insert(card);
  check("A can publish a card for own plan", !aIns, aIns?.message);

  const { data: pub } = await anon.from("event_listings").select("*").eq("id", planId);
  check("Anyone can read a published card", pub?.length === 1);
  const keys = Object.keys(pub?.[0] ?? {});
  check("Card exposes no owner or private plan columns", !keys.some((k) => /owner|user|email|budget|task|note|question|intake/.test(k)), keys.join(","));

  const { data: bUpd } = await B.from("event_listings").update({ title: "defaced" }).eq("id", planId).select("id");
  check("B cannot edit A's card", (bUpd ?? []).length === 0);
  const { data: anonUpd } = await anon.from("event_listings").update({ title: "defaced" }).eq("id", planId).select("id");
  check("Anonymous cannot edit a card", (anonUpd ?? []).length === 0);
  const { data: bDel } = await B.from("event_listings").delete().eq("id", planId).select("id");
  check("B cannot retract A's card", (bDel ?? []).length === 0);
  const { data: anonDel } = await anon.from("event_listings").delete().eq("id", planId).select("id");
  check("Anonymous cannot retract a card", (anonDel ?? []).length === 0);

  const { data: aUpd } = await A.from("event_listings").update({ title: "Authz test card v2" }).eq("id", planId).select("title");
  check("A can edit own card", aUpd?.[0]?.title === "Authz test card v2");
  return true;
}

/** Calls the Next.js API routes with B's session cookie in @supabase/ssr's cookie format. */
async function appRouteChecks(planId: string, bSession: { access_token: string; refresh_token: string }, aSession: typeof bSession, listings: boolean) {
  const ref = new URL(URL_!).hostname.split(".")[0];
  const cookieFor = (s: typeof bSession) => {
    const value = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
    // @supabase/ssr chunks cookies above ~3180 chars.
    const name = `sb-${ref}-auth-token`;
    if (value.length <= 3180) return `${name}=${value}`;
    const parts: string[] = [];
    for (let i = 0, n = 0; i < value.length; i += 3180, n++) parts.push(`${name}.${n}=${value.slice(i, i + 3180)}`);
    return parts.join("; ");
  };
  const req = (path: string, s: typeof bSession, init: RequestInit = {}) =>
    fetch(`${APP}${path}`, { ...init, headers: { cookie: cookieFor(s), origin: APP!, "content-type": "application/json", ...(init.headers ?? {}) }, redirect: "manual" });

  const own = await req(`/api/plans/${planId}`, aSession);
  check("App: A can GET own plan", own.status === 200, `status ${own.status}`);
  const g = await req(`/api/plans/${planId}`, bSession);
  check("App: B GET A's plan → 404", g.status === 404, `status ${g.status}`);
  const e = await req(`/api/plans/${planId}/export?download=1`, bSession);
  check("App: B export A's plan → 404", e.status === 404, `status ${e.status}`);
  const doc = emptyDoc();
  const p = await req(`/api/plans/${planId}`, bSession, { method: "PUT", body: JSON.stringify({ version: 1, doc }) });
  check("App: B PUT A's plan → 404", p.status === 404, `status ${p.status}`);
  const d = await req(`/api/plans/${planId}`, bSession, { method: "DELETE" });
  check("App: B DELETE A's plan → 404", d.status === 404, `status ${d.status}`);
  const anon = await fetch(`${APP}/api/plans/${planId}`);
  check("App: anonymous GET → 401", anon.status === 401, `status ${anon.status}`);
  const cross = await fetch(`${APP}/api/plans/${planId}`, { method: "DELETE", headers: { cookie: cookieFor(aSession), origin: "https://evil.example" } });
  check("App: cross-origin DELETE → 403", cross.status === 403, `status ${cross.status}`);

  if (!listings) return;
  const disc = await fetch(`${APP}/discover`);
  if (disc.status === 404) {
    console.log("SKIP  App TroyLens checks (NEXT_PUBLIC_ENABLE_TROYLENS is not true on the running app)");
    return;
  }
  check("App: Discover loads without sign-in", disc.status === 200, `status ${disc.status}`);
  const listingPath = `/api/plans/${planId}/listing`;
  const body = JSON.stringify({ planVersion: 1, description: "hijack", tags: ["arts"] });
  const bPub = await req(listingPath, bSession, { method: "PUT", body });
  check("App: B publish A's card → 404", bPub.status === 404, `status ${bPub.status}`);
  const bRet = await req(listingPath, bSession, { method: "DELETE" });
  check("App: B retract A's card → 404", bRet.status === 404, `status ${bRet.status}`);
  const anonPub = await fetch(`${APP}${listingPath}`, { method: "PUT", body, headers: { origin: APP!, "content-type": "application/json" } });
  check("App: anonymous publish → 401", anonPub.status === 401, `status ${anonPub.status}`);
  const page = await fetch(`${APP}/events/${planId}`);
  const html = await page.text();
  check("App: public card page loads without sign-in", page.status === 200 && html.includes("Authz test card v2"), `status ${page.status}`);
  check("App: public card page shows B's attempts had no effect", !html.includes("hijack") && !html.includes("defaced"));

  const interestsPath = "/api/settings/interests";
  const anonInt = await fetch(`${APP}${interestsPath}`, { method: "PUT", body: JSON.stringify({ interests: ["tech"] }), headers: { origin: APP!, "content-type": "application/json" } });
  check("App: anonymous save interests → 401", anonInt.status === 401, `status ${anonInt.status}`);
  const badInt = await req(interestsPath, bSession, { method: "PUT", body: JSON.stringify({ interests: ["not-a-tag"] }) });
  check("App: unknown interest rejected → 422", badInt.status === 422, `status ${badInt.status}`);
  const bInt = await req(interestsPath, bSession, { method: "PUT", body: JSON.stringify({ interests: ["career", "tech"] }) });
  check("App: B can save own interests", bInt.status === 200, `status ${bInt.status}`);
  const settings = await (await req("/settings", bSession)).text();
  check("App: Settings page shows saved interests", settings.includes("Your interests") && settings.includes('aria-pressed="true"'));
  // The session cookie still holds the old metadata until refresh; Discover reads the fresh user from Supabase Auth.
  const bDisc = await (await req("/discover", bSession)).text();
  check("App: Discover sorts by B's saved interests", /Your interests:.*Tech, Career/.test(bDisc.replace(/<!-- -->/g, "")));
  const aDisc = await (await req("/discover", aSession)).text();
  check("App: B's interests don't leak to A", !aDisc.includes("Sorted by your interests"));
}

main().catch((e) => {
  console.error("ERROR", e instanceof Error ? e.message : e);
  process.exit(1);
});

export type { SupabaseClient };
