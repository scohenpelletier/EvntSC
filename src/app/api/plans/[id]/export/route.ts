import { NextResponse, type NextRequest } from "next/server";
import { authed, fail } from "@/lib/api";
import { campusToday } from "@/lib/dates";
import { renderPacketHtml } from "@/lib/packet";
import { getPlan, rowToDoc } from "@/lib/plans-repo";
import { DateTime } from "luxon";

/**
 * Planning packet from the SAVED plan. `?download=1` returns a standalone HTML
 * attachment; otherwise an in-browser print view.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/plans/[id]/export">) {
  const a = await authed(req, { mutating: false });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const row = await getPlan(a.sb, id);
  if (!row) return fail(404, "Plan not found");
  const doc = rowToDoc(row);
  if (!doc) return fail(500, "Saved plan data is unreadable");
  const fmt = (iso: string) => DateTime.fromISO(iso).setZone("America/Los_Angeles").toFormat("LLL d, yyyy h:mm a ZZZZ");
  const download = req.nextUrl.searchParams.get("download") === "1";
  const html = renderPacketHtml(doc, {
    savedAt: fmt(row.updated_at),
    generatedAt: fmt(new Date().toISOString()),
    today: campusToday(),
    isSample: row.is_sample,
    interactive: !download,
  });
  const slug = (doc.intake.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Inline view only allows the print button's handler; no external resources.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
      ...(download ? { "Content-Disposition": `attachment; filename="evntsc-${slug}.html"` } : {}),
    },
  });
}
