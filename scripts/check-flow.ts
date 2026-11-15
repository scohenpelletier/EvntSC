/**
 * Signed-in end-to-end check of the save / reload / export path.
 *   npm run check:flow        (dev server must be running; APP_URL defaults to http://localhost:3000)
 * Uses the service-role key only to create and delete one throwaway confirmed user.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { SAMPLES } from "../src/lib/samples";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL || "http://localhost:3000";
if (!URL_ || !ANON || !SERVICE) {
  console.error("BLOCKED: set NEXT_PUBLIC_SUPABASE_URL, the publishable key and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(2);
}

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
type S = { access_token: string; refresh_token: string };
const ref = new URL(URL_).hostname.split(".")[0];
const cookieFor = (s: S) => {
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  if (value.length <= 3180) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0, n = 0; i < value.length; i += 3180, n++) parts.push(`${name}.${n}=${value.slice(i, i + 3180)}`);
  return parts.join("; ");
};
const req = (path: string, s: S, init: RequestInit = {}) =>
  fetch(`${APP}${path}`, {
    ...init,
    redirect: "manual",
    headers: { cookie: cookieFor(s), origin: APP, "content-type": "application/json", ...(init.headers ?? {}) },
  });

async function main() {
  const admin = createClient(URL_!, SERVICE!, { auth: { persistSession: false } });
  const stamp = Date.now();
  const email = `evntsc-flow-${stamp}@example.test`;
  const pw = `T3st-${stamp}-${Math.random().toString(36).slice(2)}`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
  if (error) throw error;
  const signIn = async () => {
    const c = createClient(URL_!, ANON!, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;
    return { c, s: data.session! };
  };
  try {
    let { c, s } = await signIn();

    // Create a plan from the Founder sample, with an HTML-injection title.
    const doc = structuredClone(SAMPLES.find((x) => x.key === "founder-night")!.doc);
    doc.intake.title = "Founder Night <script>alert(1)</script>";
    const cr = await req("/api/plans", s, { method: "POST", body: JSON.stringify({ doc }) });
    const created = await cr.json();
    check("Create plan", cr.status === 201 && !!created.id, `status ${cr.status}`);
    const id = created.id as string;

    // Revise: change date + funding requested + add a custom task with a note; save.
    doc.intake.date = "2027-03-03";
    doc.intake.fundingRequested = "550";
    doc.tasks = [
      ...doc.tasks,
      {
        id: "user:11111111-1111-4111-8111-111111111111",
        label: "Book photographer",
        status: "open",
        doneSnapshot: null,
        notes: "Ask Media Club",
        targetDate: "2027-02-20",
        custom: { title: "Book photographer", detail: "" },
        updatedAt: new Date().toISOString(),
      },
    ];
    const sv = await req(`/api/plans/${id}`, s, { method: "PUT", body: JSON.stringify({ version: created.version, doc }) });
    const saved = await sv.json();
    check("Save revision", sv.status === 200 && saved.version === created.version + 1, `status ${sv.status}, version ${saved.version}`);

    // Stale save from an "old tab" must not overwrite.
    const staleDoc = { ...doc, intake: { ...doc.intake, title: "stale" } };
    const stale = await req(`/api/plans/${id}`, s, { method: "PUT", body: JSON.stringify({ version: created.version, doc: staleDoc }) });
    check("Stale save rejected with 409", stale.status === 409, `status ${stale.status}`);

    // Sign out and back in with a fresh session.
    await c.auth.signOut();
    ({ c, s } = await signIn());
    const g = await req(`/api/plans/${id}`, s);
    const got = await g.json();
    check("Reload after signing back in returns plan", g.status === 200, `status ${g.status}`);
    check(
      "Revision persisted (date, funding, version)",
      got.doc?.intake.date === "2027-03-03" && got.doc?.intake.fundingRequested === "550" && got.version === saved.version,
    );
    check("Stale title did not overwrite", got.doc?.intake.title.startsWith("Founder Night"));
    check("Custom task + note persisted", !!got.doc?.tasks.some((t: { notes: string }) => t.notes === "Ask Media Club"));
    const doneCount = (ts: { status: string }[]) => ts.filter((t) => t.status === "done").length;
    check("Completed task states kept", doneCount(got.doc?.tasks ?? []) === doneCount(doc.tasks));

    const list = await (await req("/api/plans", s)).json();
    check("Plan appears in My plans list", !!list.plans?.some((p: { id: string }) => p.id === id));

    // Server export: print view + download, rendered from the saved row.
    const pv = await req(`/api/plans/${id}/export`, s);
    const html = await pv.text();
    check("Print view 200 text/html", pv.status === 200 && (pv.headers.get("content-type") ?? "").includes("text/html"), `status ${pv.status}`);
    check("Export escapes injected title", !html.includes("<script>alert(1)") && html.includes("&lt;script&gt;"));
    check("Export has disclaimer", /not an official application/i.test(html));
    check("Export has over-target finding", html.includes("exceed your target"));
    check("Export lists sources", html.includes("usg.usc.edu") && html.includes("trojanevents.usc.edu"));
    check("Export reflects saved revision", html.includes("550") && html.includes("Ask Media Club"));
    check(
      "Export sent no-store + CSP",
      (pv.headers.get("cache-control") ?? "").includes("no-store") && !!pv.headers.get("content-security-policy"),
    );
    const dl = await req(`/api/plans/${id}/export?download=1`, s);
    const cd = dl.headers.get("content-disposition") ?? "";
    check("Download is an attachment named evntsc-*.html", dl.status === 200 && /attachment/.test(cd) && /evntsc-.*\.html/.test(cd), cd);
    const anonExport = await fetch(`${APP}/api/plans/${id}/export?download=1`, { redirect: "manual" });
    check("Anonymous export blocked", anonExport.status === 401 || anonExport.status === 404, `status ${anonExport.status}`);

    // Samples: load, then reset removes only samples.
    const ls = await req("/api/samples", s, { method: "POST" });
    const lsj = await ls.json();
    check("Load samples", ls.status === 201 && lsj.ids?.length === 3, `status ${ls.status}`);
    const rs = await req("/api/samples", s, { method: "DELETE" });
    check("Reset samples", rs.status === 200, `status ${rs.status}`);
    const after = await (await req("/api/plans", s)).json();
    check(
      "Reset kept the organizer's own plan and removed samples",
      after.plans?.length === 1 && after.plans[0].id === id,
      `plans ${after.plans?.length}`,
    );

    const del = await req(`/api/plans/${id}`, s, { method: "DELETE" });
    check("Delete own plan", del.status === 200, `status ${del.status}`);
  } finally {
    await admin.auth.admin.deleteUser(u.user.id);
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll flow checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR", e instanceof Error ? e.message : e);
  process.exit(1);
});
